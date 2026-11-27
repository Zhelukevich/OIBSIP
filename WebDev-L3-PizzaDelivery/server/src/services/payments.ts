import { createHmac, timingSafeEqual } from "node:crypto";
import Razorpay from "razorpay";
import { z } from "zod";
import { HttpError, logFailure } from "../middleware/errors.js";
import { Order } from "../models/Order.js";
import { releaseExpiredReservation, reservationCutoff } from "./orders.js";

type Payment = {
  razorpayPaymentId: string;
  razorpayOrderId: string;
  razorpaySignature: string;
};

type StoredOrder = InstanceType<typeof Order>;

const capturedPaymentSchema = z.object({
  id: z.string().regex(/^pay_[a-zA-Z0-9]+$/),
  order_id: z.string().min(1),
  status: z.literal("captured"),
  amount: z.number().int().positive(),
  currency: z.string(),
  amount_refunded: z.number().int().nonnegative(),
});

type CapturedPayment = z.infer<typeof capturedPaymentSchema>;

async function razorpayRequest(path: string, options?: RequestInit): Promise<unknown> {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !secret) throw new HttpError(503, "Razorpay is not configured");
  const headers = new Headers(options?.headers);
  headers.set("Authorization", `Basic ${Buffer.from(`${keyId}:${secret}`).toString("base64")}`);
  try {
    const response = await fetch(`https://api.razorpay.com/v1/${path}`, {
      ...options, headers, signal: AbortSignal.timeout(5000), redirect: "error",
    });
    if (!response.ok) throw new Error(`Razorpay returned HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    logFailure("Razorpay request failed", error);
    throw new HttpError(502, "Razorpay request failed. Try again later.");
  }
}

function signatureMatches(body: string | Buffer, secret: string, signature: string) {
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(body).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}

function paymentAmount(order: StoredOrder) {
  return { amount: Math.round(order.total * 100), currency: order.currency ?? "INR" };
}

export async function createCheckout(orderId: string, userId: string) {
  const filter = { _id: orderId, user: userId };
  const order = await Order.findOne(filter);
  if (!order) throw new HttpError(404, "Order not found");
  if (order.status !== "AWAITING_PAYMENT") throw new HttpError(409, "Order is not awaiting payment");
  if (order.createdAt <= reservationCutoff()) throw new HttpError(409, "Order reservation has expired");
  const keyId = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !secret) throw new HttpError(503, "Razorpay is not configured");

  const { amount, currency } = paymentAmount(order);
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
    { ...filter, status: "AWAITING_PAYMENT", razorpayOrderId: null, createdAt: { $gt: reservationCutoff() } },
    { $set: { razorpayOrderId: paymentOrderId } },
    { new: true },
  );
  if (updated) return { keyId, paymentOrderId, amount, currency };

  const current = await Order.findOne({ ...filter, status: "AWAITING_PAYMENT", createdAt: { $gt: reservationCutoff() } });
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
  if (!signatureMatches(`${order.razorpayOrderId}|${payment.razorpayPaymentId}`, secret, payment.razorpaySignature)) {
    throw new HttpError(400, "Invalid payment signature");
  }

  if (order.razorpayPaymentId === payment.razorpayPaymentId) return { order, changed: false };
  const providerPayment = await razorpayRequest(`payments/${encodeURIComponent(payment.razorpayPaymentId)}`);
  const refunded = z.object({
    id: z.literal(payment.razorpayPaymentId), order_id: z.literal(order.razorpayOrderId), status: z.literal("refunded"),
  }).safeParse(providerPayment);
  if (order.status === "PAYMENT_FAILED" && refunded.success) {
    throw new HttpError(409, "The reservation expired and the payment was refunded");
  }
  const captured = capturedPaymentSchema.safeParse(providerPayment);
  if (!captured.success || captured.data.id !== payment.razorpayPaymentId) {
    throw new HttpError(409, "Razorpay has not confirmed the payment capture yet");
  }
  const result = await recordCapturedPayment(order, captured.data);
  if (result.order.status === "PAYMENT_FAILED") {
    throw new HttpError(409, "The reservation expired and a refund was requested");
  }
  return result;
}

async function recordCapturedPayment(order: StoredOrder, payment: CapturedPayment) {
  const { amount, currency } = paymentAmount(order);
  if (payment.order_id !== order.razorpayOrderId || payment.amount !== amount || payment.currency !== currency) {
    throw new HttpError(409, "Payment does not match the order");
  }
  if (order.razorpayPaymentId === payment.id) return { order, changed: false };
  if (payment.amount_refunded > 0) throw new HttpError(409, "Payment already has a refund");

  const filter = { _id: order._id, razorpayOrderId: payment.order_id };
  const updated = await Order.findOneAndUpdate({
    ...filter,
    status: "AWAITING_PAYMENT",
    razorpayPaymentId: null,
  }, {
    $set: { status: "RECEIVED", razorpayPaymentId: payment.id },
    $push: { statusHistory: { status: "RECEIVED", changedAt: new Date() } },
  }, { new: true, runValidators: true });
  if (updated) return { order: updated, changed: true };

  const current = await Order.findOne(filter);
  if (current?.razorpayPaymentId === payment.id) return { order: current, changed: false };
  if (current?.status !== "PAYMENT_FAILED") throw new HttpError(409, "Order is not awaiting payment");

  // A competing expiry committed first. Keep the released stock and refund the capture.
  const receipt = `expired_${payment.id}`;
  const refund = await razorpayRequest(`payments/${payment.id}/refund`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Refund-Idempotency": receipt },
    body: JSON.stringify({ amount, receipt }),
  });
  if (!z.object({ status: z.enum(["pending", "processed"]) }).safeParse(refund).success) {
    throw new HttpError(502, "Razorpay refund failed");
  }
  return { order: current, changed: false };
}

export async function reconcileExpiredReservation(order: StoredOrder, cutoff: Date) {
  if (order.razorpayOrderId) {
    const response = await razorpayRequest(`orders/${encodeURIComponent(order.razorpayOrderId)}/payments`);
    const { items } = z.object({
      items: z.array(z.looseObject({ status: z.string(), amount_refunded: z.number().nonnegative() })),
    }).parse(response);
    const captured = items.find((payment) => payment.status === "captured" && !payment.amount_refunded);
    if (captured) {
      const result = await recordCapturedPayment(order, capturedPaymentSchema.parse(captured));
      return result.changed ? result.order : null;
    }
  }
  return releaseExpiredReservation(order._id, order.razorpayOrderId, cutoff);
}

const capturedEventSchema = z.object({
  payload: z.object({ payment: z.object({ entity: z.looseObject({ order_id: z.string().min(1).nullish() }) }) }),
});

export async function handlePaymentWebhook(body: unknown, signature: string) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw new HttpError(503, "Razorpay webhook is not configured");
  if (!Buffer.isBuffer(body) || !signatureMatches(body, secret, signature)) {
    throw new HttpError(400, "Invalid webhook signature");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body.toString("utf8"));
  } catch {
    throw new HttpError(400, "Invalid webhook payload");
  }
  const event = z.object({ event: z.string() }).safeParse(payload);
  if (!event.success) throw new HttpError(400, "Invalid webhook payload");
  if (event.data.event !== "payment.captured") return null;

  const parsed = capturedEventSchema.safeParse(payload);
  if (!parsed.success) throw new HttpError(400, "Invalid captured payment payload");
  const entity = parsed.data.payload.payment.entity;
  if (!entity.order_id) return null;
  const order = await Order.findOne({ razorpayOrderId: entity.order_id });
  if (!order) return null;
  const payment = capturedPaymentSchema.safeParse(entity);
  if (!payment.success) throw new HttpError(400, "Invalid captured payment payload");
  const result = await recordCapturedPayment(order, payment.data);
  return result.changed ? result.order : null;
}
