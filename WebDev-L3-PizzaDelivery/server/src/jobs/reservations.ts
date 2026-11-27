import type { Application } from "express";
import cron from "node-cron";
import { logFailure } from "../middleware/errors.js";
import { Order } from "../models/Order.js";
import { publishOrderStatus } from "../realtime/orders.js";
import { reservationCutoff } from "../services/orders.js";
import { reconcileExpiredReservation } from "../services/payments.js";

export function startReservationJob(app: Application) {
  let running: Promise<void> | undefined;
  let stopping = false;

  async function expireReservations() {
    const cutoff = reservationCutoff();
    const orders = Order.find({ status: "AWAITING_PAYMENT", createdAt: { $lte: cutoff } }).cursor();
    try {
      for await (const order of orders) {
        if (stopping) break;
        try {
          const updated = await reconcileExpiredReservation(order, cutoff);
          if (updated) publishOrderStatus(app, updated);
        } catch (error) {
          logFailure(`Failed to reconcile reservation for order ${order.id}`, error);
        }
      }
    } finally {
      await orders.close();
    }
  }

  function run() {
    running ??= expireReservations()
      .catch((error: unknown) => logFailure("Reservation expiry failed", error))
      .finally(() => { running = undefined; });
  }

  const task = cron.schedule("* * * * *", run);
  run();
  return async function stop() {
    stopping = true;
    task.stop();
    await running;
  };
}
