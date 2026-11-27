import { createHmac, timingSafeEqual } from "node:crypto";
import Razorpay from "razorpay";
import { HttpError, logFailure } from "../middleware/errors.js";
import { Order } from "../models/Order.js";

type Payment = {
  razorpayPaymentId: string;
  razorpayOrderId: string;
  razorpaySignature: string;
};

export async function createCheckout(orderId: string, userId: string) {
  const filter = { _id: orderId, user: userId };
  const order = await Order.findOne(filter);
  if (!order) throw new HttpError(404, "Order not found");
  if (order.status !== "AWAITING_PAYMENT") throw new HttpError(409, "Order is not awaiting payment");
  const keyId = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !secret) throw new HttpError(503, "Razorpay is not configured");

  const amount = Math.round(order.total * 100);
  const currency = order.currency ?? "INR";
  if (order.razorpayOrderId) {
    return { keyId, paymentOrderId: order.razorpayOrderId, amount, currency };
  }

  const razorpay = new Razorpay({ key_id: keyId, key_secret: secret });
  let paymentOrderId: string;
  try {
    const paymentOrder = await razorpay.orders.create({ amount, currency, receipt: order._id.toString() });
    paymentOrderId = paymentOrder.id;
  } catch (error) {
    logFailure("Razorpay order creation failed", error);
    throw new HttpError(502, "Unable to start payment. Try again later.");
  }
  const updated = await Order.findOneAndUpdate(
    { ...filter, status: "AWAITING_PAYMENT", razorpayOrderId: null },
    { $set: { razorpayOrderId: paymentOrderId } },
    { new: true },
  );
  if (updated) return { keyId, paymentOrderId, amount, currency };

  const current = await Order.findOne({ ...filter, status: "AWAITING_PAYMENT" });
  if (!current?.razorpayOrderId) throw new HttpError(409, "Order is not awaiting payment");
  return { keyId, paymentOrderId: current.razorpayOrderId, amount, currency };
}

export async function confirmPayment(orderId: string, userId: string, payment: Payment) {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) throw new HttpError(503, "Razorpay is not configured");
  const filter = { _id: orderId, user: userId };
  const order = await Order.findOne(filter);
  if (!order) throw new HttpError(404, "Order not found");

  if (!order.razorpayOrderId || order.razorpayOrderId !== payment.razorpayOrderId) {
    throw new HttpError(400, "Invalid payment signature");
  }
  const expected = createHmac("sha256", secret)
    .update(`${order.razorpayOrderId}|${payment.razorpayPaymentId}`)
    .digest();
  const signature = Buffer.from(payment.razorpaySignature, "hex");
  if (signature.length !== expected.length || !timingSafeEqual(expected, signature)) {
    throw new HttpError(400, "Invalid payment signature");
  }

  if (order.razorpayPaymentId === payment.razorpayPaymentId) return { order, changed: false };
  const updated = await Order.findOneAndUpdate({
    ...filter,
    status: "AWAITING_PAYMENT",
    razorpayOrderId: order.razorpayOrderId,
    razorpayPaymentId: null,
  }, {
    $set: { status: "RECEIVED", razorpayPaymentId: payment.razorpayPaymentId },
    $push: { statusHistory: { status: "RECEIVED", changedAt: new Date() } },
  }, { new: true, runValidators: true });
  if (updated) return { order: updated, changed: true };

  const recorded = await Order.findOne({ ...filter, razorpayPaymentId: payment.razorpayPaymentId });
  if (!recorded) throw new HttpError(409, "Order is not awaiting payment");
  return { order: recorded, changed: false };
}
