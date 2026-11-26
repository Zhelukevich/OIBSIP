import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  user?: { id: string; role: "user" | "admin" };
}

export function requireAuth(request: AuthRequest, response: Response, next: NextFunction) {
  const bearer = request.headers.authorization?.startsWith("Bearer ")
    ? request.headers.authorization.slice(7)
    : undefined;
  const token = bearer;

  if (!token) {
    response.status(401).json({ message: "Authentication required" });
    return;
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "development-secret") as {
      id: string;
      role: "user" | "admin";
    };
    request.user = payload;
    next();
  } catch {
    response.status(401).json({ message: "Invalid or expired token" });
  }
}

export function requireAdmin(request: AuthRequest, response: Response, next: NextFunction) {
  if (request.user?.role !== "admin") {
    response.status(403).json({ message: "Admin access required" });
    return;
  }
  next();
}
