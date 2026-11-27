import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { z } from "zod";
import nodemailer from "nodemailer";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { User } from "../models/User.js";
import { canSendVerificationEmail, createEmailVerification, hashVerificationToken, sendVerificationEmail } from "../services/emailVerification.js";

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
  if (process.env.NODE_ENV === "production" && !canSendVerificationEmail()) {
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
  if (process.env.NODE_ENV === "production" && !canSendVerificationEmail()) {
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

authRouter.post("/forgot-password", async (request, response) => {
  const parsed = z.object({ email: z.string().email() }).safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Valid email is required" });
    return;
  }

  const user = await User.findOne({ email: parsed.data.email.toLowerCase() }).select("+passwordResetTokenHash");
  if (user) {
    const rawToken = crypto.randomBytes(32).toString("hex");
    user.passwordResetTokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    if (process.env.SMTP_HOST) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
          : undefined,
      });
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.SMTP_USER,
        to: user.email,
        subject: "Reset your Slice Pizza password",
        text: `Reset token: ${rawToken}\nThis token expires in 1 hour.`,
      });
    }
  }

  response.json({ message: "If the email exists, a password reset link will be sent" });
});

authRouter.post("/reset-password", async (request, response) => {
  const parsed = z.object({
    token: z.string().min(1),
    password: z.string().min(8),
  }).safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Token and a valid password are required" });
    return;
  }

  const tokenHash = crypto.createHash("sha256").update(parsed.data.token).digest("hex");
  const user = await User.findOne({
    passwordResetTokenHash: tokenHash,
    passwordResetExpires: { $gt: new Date() },
  }).select("+passwordHash +passwordResetTokenHash");
  if (!user) {
    response.status(400).json({ message: "Invalid or expired reset token" });
    return;
  }

  user.passwordHash = await bcrypt.hash(parsed.data.password, 12);
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires = undefined;
  await user.save();
  response.json({ message: "Password updated" });
});
