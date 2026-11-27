import bcrypt from "bcryptjs";
import { ConfigurationError, getAdminEmail } from "../config.js";
import { isDuplicateKey } from "../middleware/errors.js";
import { Inventory } from "../models/Inventory.js";
import { User } from "../models/User.js";

export async function seedInventory() {
  const catalog = [
    ["base", "Classic Hand Tossed", 100],
    ["base", "Thin Crust", 100],
    ["base", "Cheesy Crust", 100],
    ["base", "Whole Wheat", 100],
    ["base", "Gluten Free", 100],
    ["sauce", "Tomato Basil", 100],
    ["sauce", "Barbecue", 100],
    ["sauce", "Pesto", 100],
    ["sauce", "Hot Garlic", 100],
    ["sauce", "White Garlic", 100],
    ["cheese", "Mozzarella", 100],
    ["cheese", "Cheddar", 100],
    ["cheese", "Parmesan", 100],
    ["vegetable", "Onion", 100],
    ["vegetable", "Bell Pepper", 100],
    ["vegetable", "Mushroom", 100],
    ["vegetable", "Olive", 100],
    ["vegetable", "Corn", 100],
  ] as const;
  await Promise.all(catalog.map(([type, name, quantity]) =>
    Inventory.updateOne(
      { type, name },
      { $setOnInsert: { type, name, quantity, threshold: 20, isActive: true } },
      { upsert: true },
    ),
  ));
}

export async function seedAdministrator() {
  const email = getAdminEmail();
  if (!email) return;

  const conflictMessage = "ADMIN_EMAIL belongs to a customer account. Configure a different administrator email.";
  const existing = await User.findOne({ email }).select("role");
  if (existing) {
    if (existing.role !== "admin") throw new ConfigurationError(conflictMessage);
    return;
  }

  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 8 || password === "Admin123!") {
    throw new ConfigurationError("Set an explicit ADMIN_PASSWORD of at least 8 characters before creating the initial administrator");
  }
  try {
    await User.create({
      name: "Administrator",
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role: "admin",
      emailVerified: true,
    });
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    if (!await User.exists({ email, role: "admin" })) throw new ConfigurationError(conflictMessage);
  }
}
