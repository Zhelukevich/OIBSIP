import { Router } from "express";
import { z } from "zod";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../middleware/errors.js";
import { Inventory } from "../models/Inventory.js";
import { Order, orderStatuses } from "../models/Order.js";
import { publishOrderStatus } from "../realtime/orders.js";
import { objectIdSchema } from "../schemas/ids.js";
import { changeOrderStatus } from "../services/orders.js";

const stockQuantity = z.number().int().min(0);
const updateInventorySchema = z.object({
  quantity: stockQuantity.optional(),
  threshold: stockQuantity.optional(),
  isActive: z.boolean().optional(),
});
const createInventorySchema = z.object({
  type: z.enum(["base", "sauce", "cheese", "vegetable"]),
  name: z.string().trim().min(2),
  quantity: stockQuantity,
  threshold: stockQuantity.default(20),
});
const statusSchema = z.object({ status: z.enum(orderStatuses) });

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

adminRouter.get("/inventory", asyncHandler(async (_request, response) => {
  const items = await Inventory.find().sort({ type: 1, name: 1 });
  response.json({ items });
}));

adminRouter.patch("/inventory/:id", asyncHandler(async (request, response) => {
  const id = objectIdSchema.safeParse(request.params.id);
  if (!id.success) throw new HttpError(400, "Invalid inventory item ID");
  const parsed = updateInventorySchema.safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, "Invalid inventory update", parsed.error.flatten());
  const item = await Inventory.findByIdAndUpdate(id.data, parsed.data, { new: true, runValidators: true });
  if (!item) throw new HttpError(404, "Inventory item not found");
  response.json({ item });
}));

adminRouter.post("/inventory", asyncHandler(async (request, response) => {
  const parsed = createInventorySchema.safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, "Invalid inventory item", parsed.error.flatten());
  const item = await Inventory.create(parsed.data);
  response.status(201).json({ item });
}));

adminRouter.get("/orders", asyncHandler(async (_request, response) => {
  const orders = await Order.find().populate("user", "name email").sort({ createdAt: -1 });
  response.json({ orders });
}));

adminRouter.patch("/orders/:id/status", asyncHandler(async (request, response) => {
  const id = objectIdSchema.safeParse(request.params.id);
  if (!id.success) throw new HttpError(400, "Invalid order ID");
  const parsed = statusSchema.safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, "Invalid order status");

  const order = await changeOrderStatus(id.data, parsed.data.status);
  publishOrderStatus(request.app, order);
  response.json({ order });
}));
