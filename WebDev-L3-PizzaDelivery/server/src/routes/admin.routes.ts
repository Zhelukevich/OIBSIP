import { Router } from "express";
import { z } from "zod";
import { requireAdmin, requireAuth, type AuthRequest } from "../middleware/auth.js";
import { Inventory } from "../models/Inventory.js";
import { Order, orderStatuses } from "../models/Order.js";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);

adminRouter.get("/inventory", async (_request, response) => {
  const items = await Inventory.find().sort({ type: 1, name: 1 });
  response.json({ items });
});

adminRouter.patch("/inventory/:id", async (request, response) => {
  const parsed = z.object({
    quantity: z.number().int().min(0).optional(),
    threshold: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  }).safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Invalid inventory update", errors: parsed.error.flatten() });
    return;
  }
  const item = await Inventory.findByIdAndUpdate(request.params.id, parsed.data, { new: true });
  if (!item) {
    response.status(404).json({ message: "Inventory item not found" });
    return;
  }
  response.json({ item });
});

adminRouter.post("/inventory", async (request, response) => {
  const parsed = z.object({
    type: z.enum(["base", "sauce", "cheese", "vegetable"]),
    name: z.string().trim().min(2),
    quantity: z.number().int().min(0),
    threshold: z.number().int().min(0).default(20),
  }).safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Invalid inventory item", errors: parsed.error.flatten() });
    return;
  }
  const item = await Inventory.create(parsed.data);
  response.status(201).json({ item });
});

adminRouter.get("/orders", async (_request, response) => {
  const orders = await Order.find().populate("user", "name email").sort({ createdAt: -1 });
  response.json({ orders });
});

adminRouter.patch("/orders/:id/status", async (request: AuthRequest & { io?: any }, response) => {
  const parsed = z.object({ status: z.enum(orderStatuses) }).safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Invalid order status" });
    return;
  }

  const allowed: Record<string, string[]> = {
    RECEIVED: ["IN_KITCHEN", "CANCELLED"],
    IN_KITCHEN: ["SENT_TO_DELIVERY", "CANCELLED"],
    SENT_TO_DELIVERY: ["DELIVERED", "CANCELLED"],
  };
  const order = await Order.findById(request.params.id);
  if (!order) {
    response.status(404).json({ message: "Order not found" });
    return;
  }
  if (!allowed[order.status]?.includes(parsed.data.status)) {
    response.status(409).json({ message: `Cannot change ${order.status} to ${parsed.data.status}` });
    return;
  }

  order.status = parsed.data.status;
  order.statusHistory.push({ status: parsed.data.status, changedAt: new Date() });
  await order.save();
  response.app.get("io")?.to(`order:${order._id}`).emit("order.statusChanged", {
    orderId: order._id,
    status: order.status,
  });
  response.json({ order });
});
