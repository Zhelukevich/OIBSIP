import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { EventEmitter, once } from "node:events";
import test from "node:test";
import mongoose, { Types } from "mongoose";
import { createApp } from "../../dist/app.js";
import { startReservationJob } from "../../dist/jobs/reservations.js";
import { Inventory } from "../../dist/models/Inventory.js";
import { Order } from "../../dist/models/Order.js";
import { createOrder, releaseExpiredReservation, reservationCutoff } from "../../dist/services/orders.js";
import { reconcileExpiredReservation } from "../../dist/services/payments.js";

const mongoUri = process.env.TEST_MONGODB_URI;

test("reservation lifecycle on a MongoDB replica set", { skip: !mongoUri }, async (t) => {
  await mongoose.connect(mongoUri, { dbName: `pizza_reservations_test_${randomUUID()}`, serverSelectionTimeoutMS: 5000 });
  t.after(async () => {
    try {
      await mongoose.connection.dropDatabase();
    } finally {
      await mongoose.disconnect();
    }
  });
  await Promise.all([Inventory.init(), Order.init()]);
  const user = new Types.ObjectId().toString();

  async function expire(order, razorpayOrderId) {
    await Order.collection.updateOne({ _id: order._id }, {
      $set: { createdAt: new Date(reservationCutoff().getTime() - 1000), razorpayOrderId: razorpayOrderId ?? null },
    });
    return Order.findById(order._id);
  }

  await t.test("the last item is reserved once and a retry releases it once", async () => {
    const item = await Inventory.create({ type: "base", name: "Thin", quantity: 1 });
    const other = await Inventory.create({ type: "sauce", name: "Tomato", quantity: 5 });
    const ingredient = { inventoryItem: item.id, quantity: 1 };
    const results = await Promise.allSettled([createOrder(user, [ingredient]), createOrder(user, [ingredient])]);
    assert.equal(results.filter(({ status }) => status === "fulfilled").length, 1);
    assert.equal(results.find(({ status }) => status === "rejected").reason.status, 409);
    assert.equal((await Inventory.findById(item.id)).quantity, 0);

    await assert.rejects(createOrder(user, [{ inventoryItem: other.id, quantity: 1 }, ingredient]), { status: 409 });
    assert.equal((await Inventory.findById(other.id)).quantity, 5);

    const order = await expire(results.find(({ status }) => status === "fulfilled").value);
    const releases = await Promise.all([
      releaseExpiredReservation(order._id, null, reservationCutoff()),
      releaseExpiredReservation(order._id, null, reservationCutoff()),
    ]);
    assert.equal(releases.filter(Boolean).length, 1);
    assert.equal((await Inventory.findById(item.id)).quantity, 1);
    assert.deepEqual((await Order.findById(order.id)).statusHistory.map(({ status }) => status), [
      "AWAITING_PAYMENT", "PAYMENT_FAILED",
    ]);
  });

  await t.test("the job releases unpaid stock, preserves captured stock and refunds a late capture", async (t) => {
    for (const key of ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"]) {
      const previous = process.env[key];
      process.env[key] = "reservation-test";
      t.after(() => {
        if (previous === undefined) delete process.env[key];
        else process.env[key] = previous;
      });
    }
    const item = await Inventory.create({ type: "cheese", name: "Mozzarella", quantity: 8 });
    const ingredient = { inventoryItem: item.id, quantity: 2 };
    const unpaid = await expire(await createOrder(user, [ingredient, ingredient]), "order_unpaid");
    const paid = await expire(await createOrder(user, [ingredient]), "order_paid");
    const active = await createOrder(user, [ingredient]);
    assert.equal((await Inventory.findById(item.id)).quantity, 0);

    const captured = { id: "pay_captured", order_id: "order_paid", status: "captured", amount: 600,
      currency: "USD", amount_refunded: 0 };
    const late = { ...captured, id: "pay_late", order_id: "order_unpaid", amount: 1200 };
    const refunds = [];
    const originalFetch = globalThis.fetch;
    t.mock.method(globalThis, "fetch", async (url, options) => {
      if (url === "https://api.razorpay.com/v1/orders/order_paid/payments") return Response.json({ items: [captured] });
      if (url === "https://api.razorpay.com/v1/orders/order_unpaid/payments") {
        return Response.json({ items: [{ ...late, status: "failed" }] });
      }
      if (["pay_late", "pay_race"].some((id) => url === `https://api.razorpay.com/v1/payments/${id}/refund`)) {
        assert.equal(options.method, "POST");
        refunds.push({ key: options.headers.get("X-Refund-Idempotency"), ...JSON.parse(options.body) });
        return Response.json({ status: "pending" });
      }
      return originalFetch(url, options);
    });

    const app = createApp();
    const events = new EventEmitter();
    app.set("io", { to: () => ({ emit: (_event, payload) => events.emit(payload.orderId, payload.status) }) });
    const signal = AbortSignal.timeout(10_000);
    const updates = Promise.all([once(events, unpaid.id, { signal }), once(events, paid.id, { signal })]);
    const stop = startReservationJob(app);
    try {
      assert.deepEqual(await updates, [["PAYMENT_FAILED"], ["RECEIVED"]]);
    } finally {
      await stop();
    }
    assert.equal((await Inventory.findById(item.id)).quantity, 4);
    assert.equal((await Order.findById(active.id)).status, "AWAITING_PAYMENT");
    assert.equal((await Order.findById(paid.id)).razorpayPaymentId, captured.id);
    assert.equal(await reconcileExpiredReservation(paid, reservationCutoff()), null);
    assert.equal(await releaseExpiredReservation(paid._id, paid.razorpayOrderId, reservationCutoff()), null);

    const server = app.listen(0, "127.0.0.1");
    t.after(() => new Promise((resolve) => server.close(resolve)));
    await once(server, "listening");
    const webhookUrl = `http://127.0.0.1:${server.address().port}/api/payments/webhook`;
    const captureBody = (entity) => JSON.stringify({ event: "payment.captured", payload: { payment: { entity } } }, null, 2);
    const body = captureBody(late);
    const sign = (payload) => createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET).update(payload).digest("hex");
    const send = (payload, signature = sign(payload)) => fetch(webhookUrl, {
      method: "POST", body: payload, headers: { "Content-Type": "application/json", "X-Razorpay-Signature": signature },
    });
    assert.equal((await send(body + "\n", sign(body))).status, 400);
    assert.equal(refunds.length, 0);
    const deliveries = await Promise.all([send(body), send(body)]);
    assert.deepEqual(deliveries.map(({ status }) => status), [204, 204]);
    assert.deepEqual(refunds, Array(2).fill({ key: "expired_pay_late", receipt: "expired_pay_late", amount: 1200 }));
    assert.equal((await Inventory.findById(item.id)).quantity, 4);
    assert.equal((await Order.findById(unpaid.id)).status, "PAYMENT_FAILED");

    const racing = await expire(active, "order_race");
    const racingPayment = { ...captured, id: "pay_race", order_id: "order_race" };
    const [response, release] = await Promise.all([
      send(captureBody(racingPayment)),
      releaseExpiredReservation(racing._id, racing.razorpayOrderId, reservationCutoff()),
    ]);
    assert.equal(response.status, 204);
    const finalOrder = await Order.findById(racing.id);
    const finalStatus = release ? "PAYMENT_FAILED" : "RECEIVED";
    assert.equal(finalOrder.status, finalStatus);
    assert.deepEqual(finalOrder.statusHistory.map(({ status }) => status), ["AWAITING_PAYMENT", finalStatus]);
    assert.equal((await Inventory.findById(item.id)).quantity, release ? 6 : 4);
    assert.equal(refunds.filter(({ key }) => key === "expired_pay_race").length, release ? 1 : 0);
  });
});
