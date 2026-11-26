import { Router } from "express";
import { Inventory } from "../models/Inventory.js";

export const catalogRouter = Router();

catalogRouter.get("/", async (_request, response) => {
  const items = await Inventory.find({ isActive: true }).sort({ type: 1, name: 1 });
  response.json({ items });
});
