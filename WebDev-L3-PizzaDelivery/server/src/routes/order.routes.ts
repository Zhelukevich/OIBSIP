import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireVerifiedEmail, type AuthRequest } from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../middleware/errors.js";
import { Order } from "../models/Order.js";
import { objectIdSchema } from "../schemas/ids.js";
import { createOrder } from "../services/orders.js";

export const orderRouter = Router();

const createOrderSchema = z.object({
  ingredients: z.array(z.object({
    inventoryItem: objectIdSchema,
    quantity: z.number().int().positive().default(1),
  })).min(1),
});

orderRouter.use(requireAuth);

orderRouter.post("/", requireVerifiedEmail, asyncHandler(async (request: AuthRequest, response) => {
  const parsed = createOrderSchema.safeParse(request.body);
  if (!parsed.success) {
    throw new HttpError(400, "Choose at least one inventory item", parsed.error.flatten());
  }
  const order = await createOrder(request.user!.id, parsed.data.ingredients);
  response.status(201).json({ order });
}));

orderRouter.get("/mine", asyncHandler(async (request: AuthRequest, response) => {
  const orders = await Order.find({ user: request.user!.id }).sort({ createdAt: -1 });
  response.json({ orders });
}));

orderRouter.get("/:id", asyncHandler(async (request: AuthRequest, response) => {
  const id = objectIdSchema.safeParse(request.params.id);
  if (!id.success) throw new HttpError(400, "Invalid order ID");
  const order = await Order.findOne({ _id: id.data, user: request.user!.id });
  if (!order) throw new HttpError(404, "Order not found");
  response.json({ order });
}));
