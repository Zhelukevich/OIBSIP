import crypto from "node:crypto";
import { Router } from "express";
import Razorpay from "razorpay";
import { z } from "zod";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { Order } from "../models/Order.js";

export const paymentRouter = Router();

paymentRouter.use(requireAuth);

paymentRouter.post("/create", async (request: AuthRequest, response) => {
  const parsed = z.object({ orderId: z.string() }).safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Order ID is required" });
    return;
  }
  const order = await Order.findOne({ _id: parsed.data.orderId, user: request.user!.id });
  if (!order) {
    response.status(404).json({ message: "Order not found" });
    return;
  }
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    response.status(503).json({ message: "Razorpay is not configured" });
    return;
  }

  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
  const paymentOrder = await razorpay.orders.create({
    amount: Math.round(order.total * 100),
    currency: "INR",
    receipt: order._id.toString(),
  });
  order.razorpayOrderId = paymentOrder.id;
  await order.save();
  response.json({
    keyId: process.env.RAZORPAY_KEY_ID,
    paymentOrderId: paymentOrder.id,
    amount: paymentOrder.amount,
  });
});

paymentRouter.post("/verify", async (request: AuthRequest, response) => {
  const parsed = z.object({
    orderId: z.string(),
    razorpayPaymentId: z.string(),
    razorpayOrderId: z.string(),
    razorpaySignature: z.string(),
  }).safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Invalid payment verification payload" });
    return;
  }
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    response.status(503).json({ message: "Razorpay is not configured" });
    return;
  }
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${parsed.data.razorpayOrderId}|${parsed.data.razorpayPaymentId}`)
    .digest("hex");
  if (expected !== parsed.data.razorpaySignature) {
    response.status(400).json({ message: "Invalid payment signature" });
    return;
  }

  const order = await Order.findOne({ _id: parsed.data.orderId, user: request.user!.id });
  if (!order) {
    response.status(404).json({ message: "Order not found" });
    return;
  }
  order.razorpayPaymentId = parsed.data.razorpayPaymentId;
  order.status = "RECEIVED";
  order.statusHistory.push({ status: "RECEIVED", changedAt: new Date() });
  await order.save();
  response.app.get("io")?.to(`order:${order._id}`).emit("order.statusChanged", {
    orderId: order._id,
    status: order.status,
  });
  response.json({ order });
});
