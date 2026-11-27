import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../middleware/errors.js";
import { publishOrderStatus } from "../realtime/orders.js";
import { objectIdSchema } from "../schemas/ids.js";
import { confirmPayment, createCheckout, handlePaymentWebhook } from "../services/payments.js";

const checkoutSchema = z.object({ orderId: objectIdSchema });
const verificationSchema = checkoutSchema.extend({
  razorpayPaymentId: z.string().min(1),
  razorpayOrderId: z.string().min(1),
  razorpaySignature: z.string().regex(/^[a-f0-9]{64}$/i),
});

export const paymentRouter = Router();
paymentRouter.use(requireAuth);

export const paymentWebhook = asyncHandler(async (request, response) => {
  const order = await handlePaymentWebhook(request.body, request.get("X-Razorpay-Signature") ?? "");
  if (order) publishOrderStatus(request.app, order);
  response.sendStatus(204);
});

paymentRouter.post("/create", asyncHandler(async (request: AuthRequest, response) => {
  const parsed = checkoutSchema.safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, "Order ID is required");
  response.json(await createCheckout(parsed.data.orderId, request.user!.id));
}));

paymentRouter.post("/verify", asyncHandler(async (request: AuthRequest, response) => {
  const parsed = verificationSchema.safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, "Invalid payment verification payload");
  const { orderId, ...payment } = parsed.data;
  const { order, changed } = await confirmPayment(orderId, request.user!.id, payment);
  if (changed) publishOrderStatus(request.app, order);
  response.json({ order });
}));
