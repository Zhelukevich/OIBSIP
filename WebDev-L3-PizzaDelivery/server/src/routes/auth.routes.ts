import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { z } from "zod";
import nodemailer from "nodemailer";
import { User } from "../models/User.js";

export const authRouter = Router();

const credentialsSchema = z.object({
  name: z.string().trim().min(2).optional(),
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8),
});

authRouter.post("/register", async (request, response) => {
  const parsed = credentialsSchema.safeParse(request.body);
  if (!parsed.success || !parsed.data.name) {
    response.status(400).json({ message: "Name, valid email, and an 8-character password are required" });
    return;
  }
  if (await User.exists({ email: parsed.data.email })) {
    response.status(409).json({ message: "Email is already registered" });
    return;
  }

  const rawVerificationToken = crypto.randomBytes(32).toString("hex");
  const user = await User.create({
    name: parsed.data.name,
    email: parsed.data.email,
    passwordHash: await bcrypt.hash(parsed.data.password, 12),
    emailVerificationTokenHash: crypto.createHash("sha256").update(rawVerificationToken).digest("hex"),
  });

  response.status(201).json({
    message: "Registration successful",
    verificationToken: process.env.NODE_ENV === "production" ? undefined : rawVerificationToken,
  });
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

authRouter.post("/verify-email", async (request, response) => {
  const token = z.string().min(1).safeParse(request.body.token);
  if (!token.success) {
    response.status(400).json({ message: "Verification token is required" });
    return;
  }
  const hash = crypto.createHash("sha256").update(token.data).digest("hex");
  const user = await User.findOne({ emailVerificationTokenHash: hash }).select("+emailVerificationTokenHash");
  if (!user) {
    response.status(400).json({ message: "Invalid or expired verification token" });
    return;
  }
  user.emailVerified = true;
  user.emailVerificationTokenHash = undefined;
  await user.save();
  response.json({ message: "Email verified" });
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
