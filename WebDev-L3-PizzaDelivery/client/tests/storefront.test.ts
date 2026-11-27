import { describe, expect, it } from "vitest";
import { getCartOrder, menu, updateCart } from "../src/storefront";
import type { CartLine, PizzaSelection } from "../src/storefront";
import type { InventoryItem } from "../src/types";

function makeCatalog(): InventoryItem[] {
  const recipes = menu.flatMap(({ recipe }) => recipe);
  return [...new Map(recipes.map((item) => [item.name, item])).values()]
    .map((item) => ({ ...item, _id: item.name, quantity: 8, threshold: 1, isActive: true }));
}

describe("storefront cart", () => {
  it("combines shared stock across menu and custom pizzas in one order", () => {
    const cart: CartLine[] = [
      { pizza: { kind: "menu", id: "classic" }, quantity: 2 },
      { pizza: { kind: "custom", ingredientIds: ["Thin Crust", "Tomato Basil", "Mozzarella", "Mushroom"] }, quantity: 1 },
    ];
    const catalog = makeCatalog();
    const order = getCartOrder(cart, catalog);
    expect(order).toContainEqual({ inventoryItem: "Mozzarella", quantity: 3 });
    expect(order?.reduce((total, { quantity }) => total + quantity, 0)).toBe(12);

    const lowStock = catalog.map((item) => item.name === "Mozzarella" ? { ...item, quantity: 2 } : item);
    expect(getCartOrder(cart, lowStock)).toBeNull();
    expect(getCartOrder(cart, catalog.filter((item) => item.name !== "Olive"))).toBeNull();
  });

  it("groups the same custom pizza regardless of topping selection order", () => {
    const pizza: PizzaSelection = { kind: "custom", ingredientIds: ["Thin Crust", "Pesto", "Mozzarella", "Olive", "Mushroom"] };
    const reordered: PizzaSelection = { kind: "custom", ingredientIds: [...pizza.ingredientIds].reverse() };
    const cart = updateCart(updateCart([], pizza, 1), reordered, 1);
    expect(cart).toEqual([{ pizza: reordered, quantity: 2 }]);
    expect(updateCart(cart, pizza, -2)).toEqual([]);
  });
});
