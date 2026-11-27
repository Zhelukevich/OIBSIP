import { createHash, randomBytes } from "node:crypto";
import { getClientUrl } from "../config.js";
import { canSendEmail, sendEmail } from "./email.js";

export function hashVerificationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createEmailVerification() {
  const token = randomBytes(32).toString("hex");
  const url = new URL("/verify-email", getClientUrl());
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

export async function sendVerificationEmail(email: string, verification: ReturnType<typeof createEmailVerification>) {
  if (!canSendEmail() && process.env.NODE_ENV !== "production") {
    return { verificationToken: verification.token, verificationUrl: verification.url };
  }

  await sendEmail({
    to: email,
    subject: "Verify your Slice Pizza email",
    text: `Confirm your email address: ${verification.url}\n\nThis link expires in 24 hours.`,
  });
  return {};
}
