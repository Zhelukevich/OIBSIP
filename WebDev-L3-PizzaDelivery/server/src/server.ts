import "./env.js";
import cors from "cors";
import express, { type Express } from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { createServer } from "node:http";
import { Server as SocketServer } from "socket.io";
import jwt from "jsonwebtoken";
import { authRouter } from "./routes/auth.routes.js";
import { catalogRouter } from "./routes/catalog.routes.js";
import { orderRouter } from "./routes/order.routes.js";
import { adminRouter } from "./routes/admin.routes.js";
import { paymentRouter } from "./routes/payment.routes.js";
import { startLowStockJob } from "./jobs/lowStock.js";
import { User } from "./models/User.js";
import { Inventory } from "./models/Inventory.js";

async function seedApplication() {
  const catalog = [
    ["base", "Classic Hand Tossed", 100],
    ["base", "Thin Crust", 100],
    ["base", "Cheesy Crust", 100],
    ["base", "Whole Wheat", 100],
    ["base", "Gluten Free", 100],
    ["sauce", "Tomato Basil", 100],
    ["sauce", "Barbecue", 100],
    ["sauce", "Pesto", 100],
    ["sauce", "Hot Garlic", 100],
    ["sauce", "White Garlic", 100],
    ["cheese", "Mozzarella", 100],
    ["cheese", "Cheddar", 100],
    ["cheese", "Parmesan", 100],
    ["vegetable", "Onion", 100],
    ["vegetable", "Bell Pepper", 100],
    ["vegetable", "Mushroom", 100],
    ["vegetable", "Olive", 100],
    ["vegetable", "Corn", 100],
  ] as const;
  await Promise.all(catalog.map(([type, name, quantity]) =>
    Inventory.updateOne(
      { type, name },
      { $setOnInsert: { type, name, quantity, threshold: 20, isActive: true } },
      { upsert: true },
    ),
  ));

  if (process.env.ADMIN_EMAIL) {
    const existing = await User.findOne({ email: process.env.ADMIN_EMAIL.toLowerCase() });
    if (!existing) {
      await User.create({
        name: "Administrator",
        email: process.env.ADMIN_EMAIL.toLowerCase(),
        passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD || "Admin123!", 12),
        role: "admin",
        emailVerified: true,
      });
    }
  }
}

async function start() {
  await mongoose.connect(
    process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/pizza-delivery?replicaSet=rs0&directConnection=true",
  );
  await User.init();
  await seedApplication();
  startLowStockJob();

  const app: Express = express();
  app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173", credentials: true }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_request, response) => {
    response.json({ status: "ok", database: mongoose.connection.readyState === 1 ? "connected" : "disconnected" });
  });
  app.use("/api/auth", authRouter);
  app.use("/api/catalog", catalogRouter);
  app.use("/api/orders", orderRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/payments", paymentRouter);

  const httpServer = createServer(app);
  const io = new SocketServer(httpServer, {
    cors: { origin: process.env.CLIENT_URL || "http://localhost:5173", credentials: true },
  });
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("Authentication required"));
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || "development-secret") as { id: string };
      socket.data.userId = payload.id;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });
  io.on("connection", (socket) => {
    socket.on("order:join", (orderId: string) => socket.join(`order:${orderId}`));
  });

  app.set("io", io);
  const port = Number(process.env.PORT) || 5000;
  httpServer.listen(port, () => console.log(`Server listening on port ${port}`));
}

start().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
