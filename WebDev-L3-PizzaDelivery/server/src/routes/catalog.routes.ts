import { Router } from "express";
import { asyncHandler } from "../middleware/errors.js";
import { Inventory } from "../models/Inventory.js";

export const catalogRouter = Router();

catalogRouter.get("/", asyncHandler(async (_request, response) => {
  const items = await Inventory.find({ isActive: true }).sort({ type: 1, name: 1 });
  response.json({ items });
}));
