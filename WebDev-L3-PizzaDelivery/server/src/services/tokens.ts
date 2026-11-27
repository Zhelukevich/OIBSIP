import jwt from "jsonwebtoken";
import { z } from "zod";
import { getJwtSecret } from "../config.js";
import { objectIdSchema } from "../schemas/ids.js";

const identitySchema = z.object({ id: objectIdSchema, role: z.enum(["user", "admin"]) });

export type Identity = z.infer<typeof identitySchema>;

export function signToken(identity: Identity) {
  return jwt.sign(identity, getJwtSecret(), {
    algorithm: "HS256",
    expiresIn: (process.env.JWT_EXPIRES_IN || "7d") as jwt.SignOptions["expiresIn"],
  });
}

export function verifyToken(token: string) {
  return identitySchema.parse(jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] }));
}
