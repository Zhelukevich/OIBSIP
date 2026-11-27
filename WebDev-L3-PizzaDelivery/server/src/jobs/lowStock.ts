import cron from "node-cron";
import { logFailure } from "../middleware/errors.js";
import { Inventory } from "../models/Inventory.js";
import { canSendEmail, sendEmail } from "../services/email.js";

export function startLowStockJob() {
  let running: Promise<void> | undefined;
  const task = cron.schedule("0 * * * *", () => {
    running ??= sendLowStockAlert()
      .catch((error: unknown) => logFailure("Low-stock alert failed", error))
      .finally(() => { running = undefined; });
  });
  return async function stop() {
    task.stop();
    await running;
  };
}

async function sendLowStockAlert() {
  const lowStock = await Inventory.find({ $expr: { $lt: ["$quantity", "$threshold"] } }).sort({ type: 1 });
  if (!lowStock.length) return;

  const recipient = process.env.ADMIN_EMAIL;
  if (!recipient || !canSendEmail()) {
    console.warn("Low-stock alert skipped: SMTP or ADMIN_EMAIL is not configured");
    return;
  }
  const lines = lowStock.map((item) => `${item.name}: ${item.quantity} (threshold ${item.threshold})`);
  await sendEmail({ to: recipient, subject: "Pizza delivery: low inventory alert", text: lines.join("\n") });
}
