import cron from "node-cron";
import nodemailer from "nodemailer";
import { Inventory } from "../models/Inventory.js";

export function startLowStockJob() {
  cron.schedule("0 * * * *", async () => {
    const lowStock = await Inventory.find({ $expr: { $lt: ["$quantity", "$threshold"] } }).sort({ type: 1 });
    if (!lowStock.length) return;

    if (!process.env.SMTP_HOST || !process.env.ADMIN_EMAIL) {
      console.warn("Low-stock alert skipped: SMTP or ADMIN_EMAIL is not configured");
      return;
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
    });
    const lines = lowStock.map((item) => `${item.name}: ${item.quantity} (threshold ${item.threshold})`);
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to: process.env.ADMIN_EMAIL,
      subject: "Pizza delivery: low inventory alert",
      text: lines.join("\n"),
    });
  });
}
