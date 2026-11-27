import { Schema, model, Types } from "mongoose";

export const orderStatuses = [
  "AWAITING_PAYMENT",
  "PAYMENT_FAILED",
  "RECEIVED",
  "IN_KITCHEN",
  "SENT_TO_DELIVERY",
  "DELIVERED",
  "CANCELLED",
] as const;

const orderSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: "User", required: true, index: true },
    ingredients: [
      {
        inventoryItem: { type: Types.ObjectId, ref: "Inventory", required: true },
        name: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
      },
    ],
    total: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ["USD", "INR"] },
    status: { type: String, enum: orderStatuses, default: "AWAITING_PAYMENT", index: true },
    statusHistory: [
      {
        status: { type: String, enum: orderStatuses, required: true },
        changedAt: { type: Date, default: Date.now },
      },
    ],
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
  },
  { timestamps: true },
);

export const Order = model("Order", orderSchema);
