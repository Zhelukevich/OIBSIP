import mongoose, { type Types } from "mongoose";
import { HttpError } from "../middleware/errors.js";
import { Inventory } from "../models/Inventory.js";
import { Order, type OrderStatus } from "../models/Order.js";

const ingredientPrice = 3;
const reservationDurationMs = 15 * 60 * 1000;

export function reservationCutoff(now = Date.now()) {
  return new Date(now - reservationDurationMs);
}

export async function createOrder(userId: string, ingredients: { inventoryItem: string; quantity: number }[]) {
  return mongoose.connection.transaction(async (session) => {
    const resolved = [];
    let total = 0;
    for (const { inventoryItem, quantity } of ingredients) {
      const item = await Inventory.findOneAndUpdate(
        { _id: inventoryItem, quantity: { $gte: quantity }, isActive: true },
        { $inc: { quantity: -quantity } },
        { session },
      );
      if (!item) {
        throw new HttpError(409, "One or more selected ingredients are unavailable");
      }
      resolved.push({ inventoryItem: item._id, name: item.name, quantity });
      total += quantity * ingredientPrice;
    }
    const [order] = await Order.create([{
      user: userId,
      ingredients: resolved,
      total,
      currency: "USD",
      status: "AWAITING_PAYMENT",
      statusHistory: [{ status: "AWAITING_PAYMENT" }],
    }], { session });
    return order;
  });
}

export async function releaseExpiredReservation(
  orderId: Types.ObjectId,
  razorpayOrderId: string | null | undefined,
  cutoff: Date,
) {
  return mongoose.connection.transaction(async (session) => {
    const order = await Order.findOneAndUpdate({
      _id: orderId,
      status: "AWAITING_PAYMENT",
      createdAt: { $lte: cutoff },
      razorpayOrderId: razorpayOrderId ?? null,
      razorpayPaymentId: null,
    }, {
      $set: { status: "PAYMENT_FAILED" },
      $push: { statusHistory: { status: "PAYMENT_FAILED", changedAt: new Date() } },
    }, { session, new: true, runValidators: true });
    if (!order) return null;

    for (const { inventoryItem, quantity } of order.ingredients) {
      const result = await Inventory.updateOne({ _id: inventoryItem }, { $inc: { quantity } }, { session });
      if (result.matchedCount !== 1) throw new Error("Reserved inventory item is missing");
    }
    return order;
  });
}

const allowedTransitions: Partial<Record<OrderStatus, readonly OrderStatus[]>> = {
  RECEIVED: ["IN_KITCHEN", "CANCELLED"],
  IN_KITCHEN: ["SENT_TO_DELIVERY", "CANCELLED"],
  SENT_TO_DELIVERY: ["DELIVERED", "CANCELLED"],
};

export async function changeOrderStatus(orderId: string, status: OrderStatus) {
  const current = await Order.findById(orderId).select("status");
  if (!current) throw new HttpError(404, "Order not found");
  if (!current.status || !allowedTransitions[current.status]?.includes(status)) {
    throw new HttpError(409, `Cannot change ${current.status} to ${status}`);
  }
  const order = await Order.findOneAndUpdate(
    { _id: current._id, status: current.status },
    { $set: { status }, $push: { statusHistory: { status, changedAt: new Date() } } },
    { new: true, runValidators: true },
  );
  if (!order) throw new HttpError(409, "Order status changed. Refresh and try again");
  return order;
}
