import { createHash, randomBytes } from "node:crypto";
import nodemailer from "nodemailer";

export function hashVerificationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createEmailVerification() {
  const token = randomBytes(32).toString("hex");
  const url = new URL("/verify-email", process.env.CLIENT_URL || "http://localhost:5173");
  url.hash = new URLSearchParams({ token }).toString();
  return {
    token,
    url: url.toString(),
    fields: {
      emailVerificationTokenHash: hashVerificationToken(token),
      emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  };
}

export function canSendVerificationEmail() {
  return Boolean(process.env.SMTP_HOST && (process.env.EMAIL_FROM || process.env.SMTP_USER));
}

export async function sendVerificationEmail(email: string, verification: ReturnType<typeof createEmailVerification>) {
  if (!canSendVerificationEmail() && process.env.NODE_ENV !== "production") {
    return { verificationToken: verification.token, verificationUrl: verification.url };
  }

  const port = Number(process.env.SMTP_PORT) || 587;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to: email,
    subject: "Verify your Slice Pizza email",
    text: `Confirm your email address: ${verification.url}\n\nThis link expires in 24 hours.`,
  });
  return {};
}
