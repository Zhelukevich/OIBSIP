import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { z } from "zod";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { User } from "../models/User.js";
import { canSendEmail, sendEmail } from "../services/email.js";
import { createEmailVerification, hashVerificationToken, sendVerificationEmail } from "../services/emailVerification.js";

export const authRouter = Router();

const credentialsSchema = z.object({
  name: z.string().trim().min(2).optional(),
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8),
});

authRouter.post("/register", async (request, response, next) => {
  const parsed = credentialsSchema.safeParse(request.body);
  if (!parsed.success || !parsed.data.name) {
    response.status(400).json({ message: "Name, valid email, and an 8-character password are required" });
    return;
  }
  if (process.env.NODE_ENV === "production" && !canSendEmail()) {
    response.status(503).json({ message: "Email verification is unavailable" });
    return;
  }

  try {
    const verification = createEmailVerification();
    const user = await User.create({
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: await bcrypt.hash(parsed.data.password, 12),
      ...verification.fields,
    });

    try {
      const delivery = await sendVerificationEmail(user.email, verification);
      response.status(201).json({ message: "Registration successful", ...delivery });
    } catch {
      response.status(201).json({
        message: "Account created. Sign in to request another verification email.",
        verificationDeliveryFailed: true,
      });
    }
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      response.status(409).json({ message: "Email is already registered" });
      return;
    }
    next(error);
  }
});

authRouter.post("/login", async (request, response) => {
  const parsed = credentialsSchema.omit({ name: true }).safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Invalid login data" });
    return;
  }
  const user = await User.findOne({ email: parsed.data.email }).select("+passwordHash");
  if (!user || !(await user.comparePassword(parsed.data.password))) {
    response.status(401).json({ message: "Invalid email or password" });
    return;
  }

  const token = jwt.sign(
    { id: user._id.toString(), role: user.role },
    process.env.JWT_SECRET || "development-secret",
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" } as jwt.SignOptions,
  );
  response.json({
    token,
    user: { id: user._id, name: user.name, email: user.email, role: user.role, emailVerified: user.emailVerified },
  });
});

authRouter.post("/verify-email", async (request, response, next) => {
  const parsed = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Verification token is required" });
    return;
  }
  try {
    const result = await User.updateOne({
      emailVerified: false,
      emailVerificationTokenHash: hashVerificationToken(parsed.data.token),
      emailVerificationExpires: { $gt: new Date() },
    }, {
      $set: { emailVerified: true },
      $unset: { emailVerificationTokenHash: 1, emailVerificationExpires: 1 },
    });
    if (result.modifiedCount === 0) {
      response.status(400).json({ message: "Invalid or expired verification token" });
      return;
    }
    response.json({ message: "Email verified" });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/resend-verification", requireAuth, async (request: AuthRequest, response, next) => {
  if (process.env.NODE_ENV === "production" && !canSendEmail()) {
    response.status(503).json({ message: "Email verification is unavailable" });
    return;
  }

  try {
    const verification = createEmailVerification();
    const user = await User.findOneAndUpdate(
      { _id: request.user!.id, emailVerified: false },
      { $set: verification.fields },
    );
    if (!user) {
      response.status(409).json({ message: "There is no pending email verification for this account" });
      return;
    }

    try {
      const delivery = await sendVerificationEmail(user.email, verification);
      response.json({ message: "Verification email requested", ...delivery });
    } catch {
      response.status(503).json({ message: "Verification email could not be sent. Try again later." });
    }
  } catch (error) {
    next(error);
  }
});

authRouter.post("/forgot-password", async (request, response, next) => {
  const parsed = credentialsSchema.pick({ email: true }).safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Valid email is required" });
    return;
  }

  if (!canSendEmail()) {
    response.status(503).json({ message: "Password reset email is unavailable. Try again later." });
    return;
  }

  try {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const resetUrl = new URL("/reset-password", process.env.CLIENT_URL || "http://localhost:5173");
    resetUrl.hash = new URLSearchParams({ token: rawToken }).toString();
    const result = await User.updateOne({ email: parsed.data.email }, {
      $set: {
        passwordResetTokenHash: crypto.createHash("sha256").update(rawToken).digest("hex"),
        passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    if (result.matchedCount === 1) {
      try {
        await sendEmail({
          to: parsed.data.email,
          subject: "Reset your Slice Pizza password",
          text: `Reset your password: ${resetUrl}\n\nThis link expires in 1 hour.`,
          html: `<p><a href="${resetUrl}">Reset your password</a></p><p>This link expires in 1 hour.</p>`,
        });
      } catch {
        console.error("Password reset email could not be sent");
      }
    }
    response.json({ message: "If the email exists, a password reset link will be sent" });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/reset-password", async (request, response, next) => {
  const parsed = z.object({
    token: z.string().min(1),
    password: z.string().min(8),
  }).safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Token and a valid password are required" });
    return;
  }

  try {
    const passwordResetTokenHash = crypto.createHash("sha256").update(parsed.data.token).digest("hex");
    const matchActiveToken = () => ({
      passwordResetTokenHash,
      passwordResetExpires: { $gt: new Date() },
    });
    if (!await User.exists(matchActiveToken())) {
      response.status(400).json({ message: "Invalid or expired reset token" });
      return;
    }
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const result = await User.updateOne(matchActiveToken(), {
      $set: { passwordHash },
      $unset: { passwordResetTokenHash: 1, passwordResetExpires: 1 },
    });
    if (result.modifiedCount === 0) {
      response.status(400).json({ message: "Invalid or expired reset token" });
      return;
    }
    response.json({ message: "Password updated" });
  } catch (error) {
    next(error);
  }
});
