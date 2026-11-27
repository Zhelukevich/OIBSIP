import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import { getClientUrl } from "./config.js";
import { handleError } from "./middleware/errors.js";
import { adminRouter } from "./routes/admin.routes.js";
import { authRouter } from "./routes/auth.routes.js";
import { catalogRouter } from "./routes/catalog.routes.js";
import { orderRouter } from "./routes/order.routes.js";
import { paymentRouter } from "./routes/payment.routes.js";

export function createApp(clientOrigin = new URL(getClientUrl()).origin) {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors({ origin: clientOrigin, credentials: true }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_request, response) => {
    response.json({ status: "ok", database: mongoose.connection.readyState === 1 ? "connected" : "disconnected" });
  });
  app.use("/api/auth", authRouter);
  app.use("/api/catalog", catalogRouter);
  app.use("/api/orders", orderRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/payments", paymentRouter);
  app.use((_request, response) => {
    response.status(404).json({ message: "Route not found" });
  });
  app.use(handleError);
  return app;
}
