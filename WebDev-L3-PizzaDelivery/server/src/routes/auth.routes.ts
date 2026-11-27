import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../middleware/errors.js";
import {
  login, registerAccount, requestPasswordReset, resendVerification, resetPassword, verifyEmail,
} from "../services/accounts.js";

const passwordSchema = z.string().min(8);
const emailSchema = z.object({ email: z.string().email().toLowerCase() });
const loginSchema = emailSchema.extend({ password: passwordSchema });
const registrationSchema = loginSchema.extend({ name: z.string().trim().min(2) });
const verificationSchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) });
const resetSchema = z.object({ token: z.string().min(1), password: passwordSchema });

export const authRouter = Router();

authRouter.post("/register", asyncHandler(async (request, response) => {
  const parsed = registrationSchema.safeParse(request.body);
  if (!parsed.success) {
    throw new HttpError(400, "Name, valid email, and an 8-character password are required");
  }
  response.status(201).json(await registerAccount(parsed.data));
}));

authRouter.post("/login", asyncHandler(async (request, response) => {
  const parsed = loginSchema.safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, "Invalid login data");
  response.json(await login(parsed.data.email, parsed.data.password));
}));

authRouter.post("/verify-email", asyncHandler(async (request, response) => {
  const parsed = verificationSchema.safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, "Verification token is required");
  await verifyEmail(parsed.data.token);
  response.json({ message: "Email verified" });
}));

authRouter.post("/resend-verification", requireAuth, asyncHandler(async (request: AuthRequest, response) => {
  response.json(await resendVerification(request.user!.id));
}));

authRouter.post("/forgot-password", asyncHandler(async (request, response) => {
  const parsed = emailSchema.safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, "Valid email is required");
  await requestPasswordReset(parsed.data.email);
  response.json({ message: "If the email exists, a password reset link will be sent" });
}));

authRouter.post("/reset-password", asyncHandler(async (request, response) => {
  const parsed = resetSchema.safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, "Token and a valid password are required");
  await resetPassword(parsed.data.token, parsed.data.password);
  response.json({ message: "Password updated" });
}));
