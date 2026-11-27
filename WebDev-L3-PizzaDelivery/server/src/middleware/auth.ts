import type { NextFunction, Request, Response } from "express";
import { User } from "../models/User.js";
import { verifyToken, type Identity } from "../services/tokens.js";
import { asyncHandler } from "./errors.js";

export interface AuthRequest extends Request {
  user?: Identity;
}

export function requireAuth(request: AuthRequest, response: Response, next: NextFunction) {
  const token = request.headers.authorization?.startsWith("Bearer ")
    ? request.headers.authorization.slice(7)
    : undefined;
  if (!token) {
    response.status(401).json({ message: "Authentication required" });
    return;
  }

  try {
    request.user = verifyToken(token);
  } catch {
    response.status(401).json({ message: "Invalid or expired token" });
    return;
  }
  next();
}

export function requireAdmin(request: AuthRequest, response: Response, next: NextFunction) {
  if (request.user?.role !== "admin") {
    response.status(403).json({ message: "Admin access required" });
    return;
  }
  next();
}

export const requireVerifiedEmail = asyncHandler(async (request: AuthRequest, response, next) => {
  const verified = await User.exists({ _id: request.user!.id, emailVerified: true });
  if (!verified) {
    response.status(403).json({ message: "Verify your email before placing an order" });
    return;
  }
  next();
});
