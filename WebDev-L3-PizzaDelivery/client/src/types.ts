export type Role = "user" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  emailVerified: boolean;
}

export interface InventoryItem {
  _id: string;
  type: "base" | "sauce" | "cheese" | "vegetable";
  name: string;
  quantity: number;
  threshold: number;
  isActive: boolean;
}

export interface Order {
  _id: string;
  user?: { name: string; email: string } | string;
  ingredients: Array<{ inventoryItem: string; name: string; quantity: number }>;
  total: number;
  status: string;
  statusHistory: Array<{ status: string; changedAt: string }>;
  createdAt: string;
}
