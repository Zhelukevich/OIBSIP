import type { Application } from "express";
import type { Server as HttpServer } from "node:http";
import type { Types } from "mongoose";
import { Server } from "socket.io";
import { logFailure } from "../middleware/errors.js";
import { Order, type OrderStatus } from "../models/Order.js";
import { objectIdSchema } from "../schemas/ids.js";
import { verifyToken, type Identity } from "../services/tokens.js";

type ClientEvents = { "order:join": (orderId: unknown) => void };
type ServerEvents = { "order.statusChanged": (event: { orderId: string; status: OrderStatus }) => void };
type OrderSocket = Server<ClientEvents, ServerEvents, Record<never, never>, { user: Identity }>;

export function attachOrderSockets(httpServer: HttpServer, app: Application, clientOrigin: string) {
  const io: OrderSocket = new Server(httpServer, {
    cors: { origin: clientOrigin, credentials: true },
  });
  app.set("io", io);
  io.use((socket, next) => {
    const token: unknown = socket.handshake.auth.token;
    if (typeof token !== "string" || !token) return next(new Error("Authentication required"));
    try {
      socket.data.user = verifyToken(token);
    } catch {
      return next(new Error("Invalid token"));
    }
    next();
  });
  io.on("connection", (socket) => {
    socket.on("order:join", async (orderId) => {
      const parsed = objectIdSchema.safeParse(orderId);
      if (!parsed.success) return;
      const user = socket.data.user;
      const filter = user.role === "admin" ? { _id: parsed.data } : { _id: parsed.data, user: user.id };
      try {
        const order = await Order.exists(filter);
        if (order && socket.connected) await socket.join(`order:${order._id}`);
      } catch (error) {
        logFailure("Failed to join order room", error);
      }
    });
  });
  return io;
}

export function publishOrderStatus(app: Application, order: { _id: Types.ObjectId; status?: OrderStatus | null }) {
  const io: OrderSocket | undefined = app.get("io");
  if (order.status) {
    const orderId = order._id.toString();
    io?.to(`order:${orderId}`).emit("order.statusChanged", { orderId, status: order.status });
  }
}
