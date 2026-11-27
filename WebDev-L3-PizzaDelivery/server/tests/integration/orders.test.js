import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:http";
import test from "node:test";
import mongoose, { Types } from "mongoose";
import Razorpay from "razorpay";
import { createApp } from "../../dist/app.js";
import { Inventory } from "../../dist/models/Inventory.js";
import { Order } from "../../dist/models/Order.js";
import { User } from "../../dist/models/User.js";
import { attachOrderSockets } from "../../dist/realtime/orders.js";
import { signToken } from "../../dist/services/tokens.js";

const orderId = new Types.ObjectId();
const ownerId = new Types.ObjectId().toString();
const adminId = new Types.ObjectId().toString();

async function startApi(t) {
  const app = createApp("http://localhost:5173");
  const events = [];
  app.set("io", { to: (room) => ({ emit: (event, payload) => events.push({ room, event, payload }) }) });
  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await once(server, "listening");
  return {
    events,
    request: (path, options) => fetch(`http://127.0.0.1:${server.address().port}/api${path}`, options),
  };
}

function jsonRequest(method, token, body) {
  return {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  };
}

test("database errors and malformed requests return JSON through the app", async (t) => {
  const { request } = await startApi(t);
  t.mock.method(Inventory, "find", () => ({
    sort: async () => { throw new Error("internal database detail"); },
  }));
  const rejected = await request("/catalog");
  assert.equal(rejected.status, 500);
  assert.deepEqual(await rejected.json(), { message: "Internal server error" });

  const malformed = await request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{",
  });
  assert.equal(malformed.status, 400);
  assert.deepEqual(await malformed.json(), { message: "Invalid request" });

  const missing = await request("/missing");
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { message: "Route not found" });
});

test("order creation uses the same transaction for stock and the order", async (t) => {
  const { request } = await startApi(t);
  const ingredientId = new Types.ObjectId();
  const session = {};
  const payload = { ingredients: [{ inventoryItem: ingredientId, quantity: 2 }] };
  let available = true;
  t.mock.method(User, "exists", async () => ({ _id: ownerId }));
  t.mock.method(mongoose.connection, "transaction", async (callback) => callback(session));
  t.mock.method(Inventory, "findOneAndUpdate", async (filter, update, options) => {
    assert.deepEqual(filter, { _id: ingredientId.toString(), quantity: { $gte: 2 }, isActive: true });
    assert.deepEqual(update, { $inc: { quantity: -2 } });
    assert.equal(options.session, session);
    return available ? { _id: ingredientId, name: "Thin Crust" } : null;
  });
  const save = t.mock.method(Order, "create", async ([fields], options) => {
    assert.equal(options.session, session);
    return [new Order(fields)];
  });

  const token = signToken({ id: ownerId, role: "user" });
  const create = () => request("/orders", jsonRequest("POST", token, payload));
  const response = await create();
  assert.equal(response.status, 201);
  const { order } = await response.json();
  assert.equal(order.total, 6);
  assert.equal(order.status, "AWAITING_PAYMENT");
  assert.equal(order.ingredients[0].name, "Thin Crust");

  available = false;
  assert.equal((await create()).status, 409);
  assert.equal(save.mock.callCount(), 1);
});

test("concurrent admin updates append one order status and publish one event", async (t) => {
  const { events, request } = await startApi(t);
  const order = new Order({ _id: orderId, user: ownerId, status: "RECEIVED" });
  t.mock.method(Order, "findById", () => ({
    select: async () => ({ _id: order._id, status: "RECEIVED" }),
  }));
  t.mock.method(Order, "findOneAndUpdate", async (filter, update) => {
    assert.equal(filter._id.toString(), order.id);
    if (filter.status !== order.status) return null;
    order.set(update.$set);
    order.statusHistory.push(update.$push.statusHistory);
    return order;
  });

  const token = signToken({ id: adminId, role: "admin" });
  const update = () => request(`/admin/orders/${orderId}/status`, jsonRequest("PATCH", token, { status: "IN_KITCHEN" }));
  const responses = await Promise.all([update(), update()]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
  assert.deepEqual(order.statusHistory.map(({ status }) => status), ["IN_KITCHEN"]);
  assert.deepEqual(events, [{
    room: `order:${orderId}`,
    event: "order.statusChanged",
    payload: { orderId: order.id, status: "IN_KITCHEN" },
  }]);
});

test("checkout reuses the stored provider order and payment retries preserve fulfilment status", async (t) => {
  const previousSecret = process.env.RAZORPAY_KEY_SECRET;
  const previousKeyId = process.env.RAZORPAY_KEY_ID;
  process.env.RAZORPAY_KEY_SECRET = "payment-test-secret";
  process.env.RAZORPAY_KEY_ID = "rzp_test_checkout";
  t.after(() => {
    if (previousSecret === undefined) delete process.env.RAZORPAY_KEY_SECRET;
    else process.env.RAZORPAY_KEY_SECRET = previousSecret;
    if (previousKeyId === undefined) delete process.env.RAZORPAY_KEY_ID;
    else process.env.RAZORPAY_KEY_ID = previousKeyId;
  });

  const { events, request } = await startApi(t);
  const order = new Order({ _id: orderId, user: ownerId, total: 3, currency: "USD" });
  const createProviderOrder = t.mock.fn(async (fields) => {
    assert.deepEqual(fields, { amount: 300, currency: "USD", receipt: order.id });
    return { id: "order_saved" };
  });
  t.mock.method(Razorpay.prototype, "addResources", function () {
    this.orders = { create: createProviderOrder };
  });
  t.mock.method(Order, "findOne", async (filter) => {
    assert.equal(filter._id, order.id);
    assert.equal(filter.user, ownerId);
    if (filter.razorpayPaymentId && filter.razorpayPaymentId !== order.razorpayPaymentId) return null;
    return new Order(order.toObject());
  });
  const update = t.mock.method(Order, "findOneAndUpdate", async (filter, fields) => {
    if (fields.$set.razorpayOrderId) {
      assert.equal(filter.razorpayOrderId, null);
      assert.equal(filter.status, order.status);
      assert.equal(order.razorpayOrderId, undefined);
      order.set(fields.$set);
      return order;
    }
    assert.equal(filter.razorpayOrderId, order.razorpayOrderId);
    assert.equal(filter.razorpayPaymentId, null);
    if (filter.status !== order.status) return null;
    order.set(fields.$set);
    order.statusHistory.push(fields.$push.statusHistory);
    return order;
  });
  const token = signToken({ id: ownerId, role: "user" });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const checkout = await request("/payments/create", jsonRequest("POST", token, { orderId }));
    assert.equal(checkout.status, 200);
    assert.deepEqual(await checkout.json(), {
      keyId: "rzp_test_checkout", paymentOrderId: "order_saved", amount: 300, currency: "USD",
    });
  }
  assert.equal(createProviderOrder.mock.callCount(), 1);

  const paymentId = "pay_test";
  const verify = (razorpayOrderId) => request("/payments/verify", jsonRequest("POST", token, {
    orderId,
    razorpayOrderId,
    razorpayPaymentId: paymentId,
    razorpaySignature: createHmac("sha256", "payment-test-secret").update(`${razorpayOrderId}|${paymentId}`).digest("hex"),
  }));
  assert.equal((await verify("order_unrelated")).status, 400);
  assert.equal(update.mock.callCount(), 1);
  const confirmed = await Promise.all([verify("order_saved"), verify("order_saved")]);
  assert.deepEqual(confirmed.map(({ status }) => status), [200, 200]);
  order.status = "IN_KITCHEN";
  const retry = await verify("order_saved");
  assert.equal(retry.status, 200);
  assert.equal((await retry.json()).order.status, "IN_KITCHEN");
  assert.deepEqual(order.statusHistory.map(({ status }) => status), ["RECEIVED"]);
  assert.equal(events.length, 1);
});

test("order subscription checks ownership and permits admin access", async (t) => {
  const httpServer = createServer();
  const io = attachOrderSockets(httpServer, createApp(), "http://localhost:5173");
  t.after(() => io.close());
  const lookup = t.mock.method(Order, "exists", async ({ _id, user }) =>
    _id === orderId.toString() && (user === undefined || user === ownerId) ? { _id: orderId } : null,
  );

  async function subscribe(user, id) {
    const joined = [];
    const namespace = io.of("/");
    const [connect] = namespace.listeners("connection");
    let joinOrder;
    connect({
      connected: true,
      data: { user },
      on: (_event, handler) => { joinOrder = handler; },
      join: (room) => joined.push(room),
    });
    await joinOrder(id);
    return joined;
  }

  assert.deepEqual(await subscribe({ id: ownerId, role: "user" }, "invalid-id"), []);
  assert.equal(lookup.mock.callCount(), 0);
  assert.deepEqual(await subscribe({ id: adminId, role: "user" }, orderId.toString()), []);
  assert.deepEqual(await subscribe({ id: ownerId, role: "user" }, orderId.toString()), [`order:${orderId}`]);
  assert.deepEqual(await subscribe({ id: adminId, role: "admin" }, orderId.toString()), [`order:${orderId}`]);
});
