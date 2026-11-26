import { Schema, model } from "mongoose";

const inventorySchema = new Schema(
  {
    type: { type: String, enum: ["base", "sauce", "cheese", "vegetable"], required: true },
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0, default: 0 },
    threshold: { type: Number, required: true, min: 0, default: 20 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

inventorySchema.index({ type: 1, name: 1 }, { unique: true });

export const Inventory = model("Inventory", inventorySchema);
