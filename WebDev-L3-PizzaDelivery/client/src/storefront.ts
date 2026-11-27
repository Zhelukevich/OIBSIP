import type { Currency, InventoryItem } from "./types";

export const ingredientPrice = 3;
const cartKey = "slice_cart";
const money = {
  USD: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }),
  INR: new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }),
};

export function formatPrice(value: number, currency: Currency = "USD") {
  return money[currency].format(value);
}

type Ingredient = Pick<InventoryItem, "type" | "name">;

export const menu = [
  {
    id: "classic",
    name: "The Classic",
    description: "Tomato basil sauce, melted mozzarella and black olives on a hand-tossed crust.",
    recipe: [
      { type: "base", name: "Classic Hand Tossed" },
      { type: "sauce", name: "Tomato Basil" },
      { type: "cheese", name: "Mozzarella" },
      { type: "vegetable", name: "Olive" },
    ],
  },
  {
    id: "garden",
    name: "Market Garden",
    description: "Bell peppers, red onion and mushrooms with mozzarella and tomato basil sauce.",
    recipe: [
      { type: "base", name: "Classic Hand Tossed" },
      { type: "sauce", name: "Tomato Basil" },
      { type: "cheese", name: "Mozzarella" },
      { type: "vegetable", name: "Bell Pepper" },
      { type: "vegetable", name: "Onion" },
      { type: "vegetable", name: "Mushroom" },
    ],
  },
  {
    id: "pesto",
    name: "Pesto & Mushroom",
    description: "Basil pesto, mozzarella and roasted mushrooms on a crisp thin crust.",
    recipe: [
      { type: "base", name: "Thin Crust" },
      { type: "sauce", name: "Pesto" },
      { type: "cheese", name: "Mozzarella" },
      { type: "vegetable", name: "Mushroom" },
    ],
  },
] satisfies Array<{ id: string; name: string; description: string; recipe: Ingredient[] }>;

export type PizzaSelection =
  | { kind: "menu"; id: string }
  | { kind: "custom"; ingredientIds: string[] };

export type CartLine = { pizza: PizzaSelection; quantity: number };

export function pizzaKey(pizza: PizzaSelection) {
  return pizza.kind === "menu" ? pizza.id : `custom:${[...pizza.ingredientIds].sort().join(",")}`;
}

export function readCart(): CartLine[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(cartKey) ?? "[]");
    if (!Array.isArray(saved)) return [];
    return saved.filter((line): line is CartLine => {
      if (!Number.isSafeInteger(line?.quantity) || line.quantity < 1) return false;
      const pizza = line.pizza;
      return pizza?.kind === "menu"
        ? menu.some(({ id }) => id === pizza.id)
        : pizza?.kind === "custom" &&
          Array.isArray(pizza.ingredientIds) &&
          pizza.ingredientIds.length >= 4 &&
          pizza.ingredientIds.every((id: unknown) => typeof id === "string");
    });
  } catch {
    return [];
  }
}

export function saveCart(cart: CartLine[]) {
  try {
    localStorage.setItem(cartKey, JSON.stringify(cart));
  } catch {
    // The current cart is still available when browser storage is disabled.
  }
}

export function updateCart(cart: CartLine[], pizza: PizzaSelection, amount: number) {
  const key = pizzaKey(pizza);
  const previous = cart.find((line) => pizzaKey(line.pizza) === key);
  if (!previous) return amount > 0 ? [...cart, { pizza, quantity: amount }] : cart;
  const quantity = previous.quantity + amount;
  return cart.flatMap((line) => line === previous ? quantity > 0 ? [{ pizza, quantity }] : [] : [line]);
}

export function describePizza(pizza: PizzaSelection, catalog: InventoryItem[]) {
  if (pizza.kind === "menu") {
    const item = menu.find(({ id }) => id === pizza.id)!;
    return {
      name: item.name,
      price: item.recipe.length * ingredientPrice,
      image: `/pizza/${item.id}.webp`,
      details: item.description,
      ingredients: item.recipe.map(({ type, name }) => catalog.find((entry) => entry.type === type && entry.name === name)),
    };
  }
  const ingredients = pizza.ingredientIds.map((id) => catalog.find((entry) => entry._id === id));
  return {
    name: "Build Your Own",
    price: pizza.ingredientIds.length * ingredientPrice,
    image: undefined,
    details: ingredients.flatMap((entry) => entry ? [entry.name] : []).join(", "),
    ingredients,
  };
}

export function getCartOrder(lines: CartLine[], catalog: InventoryItem[]) {
  const order = new Map<string, number>();
  for (const { pizza, quantity } of lines) {
    for (const item of describePizza(pizza, catalog).ingredients) {
      if (!item?.isActive) return null;
      const count = (order.get(item._id) ?? 0) + quantity;
      if (count > item.quantity) return null;
      order.set(item._id, count);
    }
  }
  return [...order].map(([inventoryItem, quantity]) => ({ inventoryItem, quantity }));
}
