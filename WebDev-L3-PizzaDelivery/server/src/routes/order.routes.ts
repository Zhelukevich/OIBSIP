import { Router } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { requireAuth, requireVerifiedEmail, type AuthRequest } from "../middleware/auth.js";
import { Inventory } from "../models/Inventory.js";
import { Order } from "../models/Order.js";

export const orderRouter = Router();

const ingredientPrice = 3;
const createOrderSchema = z.object({
  ingredients: z.array(z.object({
    inventoryItem: z.string(),
    quantity: z.number().int().positive().default(1),
  })).min(1),
});

orderRouter.use(requireAuth);

orderRouter.post("/", requireVerifiedEmail, async (request: AuthRequest, response) => {
  const parsed = createOrderSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Choose at least one inventory item", errors: parsed.error.flatten() });
    return;
  }

  const session = await (await import("mongoose")).default.startSession();
  try {
    let createdOrderId: Types.ObjectId | undefined;
    await session.withTransaction(async () => {
      const resolved = [];
      let total = 0;

      for (const selected of parsed.data.ingredients) {
        const item = await Inventory.findOneAndUpdate(
          { _id: selected.inventoryItem, quantity: { $gte: selected.quantity }, isActive: true },
          { $inc: { quantity: -selected.quantity } },
          { new: true, session },
        );
        if (!item) {
          throw new Error("One or more selected ingredients are unavailable");
        }
        resolved.push({ inventoryItem: item._id, name: item.name, quantity: selected.quantity });
        total += selected.quantity * ingredientPrice;
      }

      const [order] = await Order.create([{
        user: request.user!.id,
        ingredients: resolved,
        total,
        currency: "USD",
        status: "AWAITING_PAYMENT",
        statusHistory: [{ status: "AWAITING_PAYMENT" }],
      }], { session });
      createdOrderId = order._id;
    });

    const order = await Order.findById(createdOrderId);
    response.status(201).json({ order });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create order";
    response.status(409).json({ message });
  } finally {
    await session.endSession();
  }
});

orderRouter.get("/mine", async (request: AuthRequest, response) => {
  const orders = await Order.find({ user: request.user!.id }).sort({ createdAt: -1 });
  response.json({ orders });
});

orderRouter.get("/:id", async (request: AuthRequest, response) => {
  const order = await Order.findOne({ _id: request.params.id, user: request.user!.id });
  if (!order) {
    response.status(404).json({ message: "Order not found" });
    return;
  }
  response.json({ order });
});
