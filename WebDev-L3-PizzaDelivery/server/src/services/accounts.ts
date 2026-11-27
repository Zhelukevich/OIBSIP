import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { getAdminEmail, getClientUrl } from "../config.js";
import { HttpError, isDuplicateKey, logFailure } from "../middleware/errors.js";
import { User } from "../models/User.js";
import { canSendEmail, sendEmail } from "./email.js";
import { createEmailVerification, hashVerificationToken, sendVerificationEmail } from "./emailVerification.js";
import { signToken } from "./tokens.js";

function requireVerificationDelivery() {
  if (process.env.NODE_ENV === "production" && !canSendEmail()) {
    throw new HttpError(503, "Email verification is unavailable");
  }
}

export async function registerAccount({ name, email, password }: { name: string; email: string; password: string }) {
  if (email === getAdminEmail()) throw new HttpError(409, "Email is already registered");
  requireVerificationDelivery();
  const verification = createEmailVerification();
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    await User.create({ name, email, passwordHash, role: "user", ...verification.fields });
  } catch (error) {
    if (isDuplicateKey(error)) throw new HttpError(409, "Email is already registered");
    throw error;
  }
  try {
    const delivery = await sendVerificationEmail(email, verification);
    return { message: "Registration successful", ...delivery };
  } catch (error) {
    logFailure("Registration verification email failed", error);
    return {
      message: "Account created. Sign in to request another verification email.",
      verificationDeliveryFailed: true,
    };
  }
}

export async function login(email: string, password: string) {
  const user = await User.findOne({ email }).select("+passwordHash");
  if (!user || !(await user.comparePassword(password))) {
    throw new HttpError(401, "Invalid email or password");
  }
  return {
    token: signToken({ id: user._id.toString(), role: user.role }),
    user: { id: user._id, name: user.name, email: user.email, role: user.role, emailVerified: user.emailVerified },
  };
}

export async function verifyEmail(token: string) {
  const result = await User.updateOne({
    emailVerified: false,
    emailVerificationTokenHash: hashVerificationToken(token),
    emailVerificationExpires: { $gt: new Date() },
  }, {
    $set: { emailVerified: true },
    $unset: { emailVerificationTokenHash: 1, emailVerificationExpires: 1 },
  });
  if (result.modifiedCount === 0) throw new HttpError(400, "Invalid or expired verification token");
}

export async function resendVerification(userId: string) {
  requireVerificationDelivery();
  const verification = createEmailVerification();
  const user = await User.findOneAndUpdate(
    { _id: userId, emailVerified: false },
    { $set: verification.fields },
  );
  if (!user) throw new HttpError(409, "There is no pending email verification for this account");
  try {
    const delivery = await sendVerificationEmail(user.email, verification);
    return { message: "Verification email requested", ...delivery };
  } catch (error) {
    logFailure("Verification email could not be sent", error);
    throw new HttpError(503, "Verification email could not be sent. Try again later.");
  }
}

function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function requestPasswordReset(email: string) {
  if (!canSendEmail()) {
    throw new HttpError(503, "Password reset email is unavailable. Try again later.");
  }
  const token = randomBytes(32).toString("hex");
  const resetUrl = new URL("/reset-password", getClientUrl());
  resetUrl.hash = new URLSearchParams({ token }).toString();
  const result = await User.updateOne({ email }, {
    $set: {
      passwordResetTokenHash: hashResetToken(token),
      passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  if (result.matchedCount === 0) return;
  try {
    await sendEmail({
      to: email,
      subject: "Reset your Slice Pizza password",
      text: `Reset your password: ${resetUrl}\n\nThis link expires in 1 hour.`,
      html: `<p><a href="${resetUrl}">Reset your password</a></p><p>This link expires in 1 hour.</p>`,
    });
  } catch (error) {
    logFailure("Password reset email could not be sent", error);
  }
}

export async function resetPassword(token: string, password: string) {
  const passwordResetTokenHash = hashResetToken(token);
  const matchActiveToken = () => ({
    passwordResetTokenHash,
    passwordResetExpires: { $gt: new Date() },
  });
  if (!await User.exists(matchActiveToken())) throw new HttpError(400, "Invalid or expired reset token");
  const passwordHash = await bcrypt.hash(password, 12);
  const result = await User.updateOne(matchActiveToken(), {
    $set: { passwordHash },
    $unset: { passwordResetTokenHash: 1, passwordResetExpires: 1 },
  });
  if (result.modifiedCount === 0) throw new HttpError(400, "Invalid or expired reset token");
}
