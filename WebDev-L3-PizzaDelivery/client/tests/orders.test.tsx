import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { OrderHistory } from "../src/pages/OrdersPage";
import type { Order } from "../src/types";

describe("order history", () => {
  it("shows a loading status while orders are being fetched", () => {
    const html = renderToStaticMarkup(<OrderHistory state={{ status: "loading" }} onRetry={vi.fn()} />);
    expect(html).toContain('role="status"');
    expect(html).toContain("Loading orders");
    expect(html).not.toContain("No orders yet.");
  });

  it("shows a retry button when the request fails", () => {
    const html = renderToStaticMarkup(<OrderHistory state={{ status: "error" }} onRetry={vi.fn()} />);
    expect(html).toContain('role="alert"');
    expect(html).toMatch(/<button[^>]*>Try again<\/button>/);
    expect(html).not.toContain("No orders yet.");
  });

  it("shows an empty message after a successful empty response", () => {
    const html = renderToStaticMarkup(<OrderHistory state={{ status: "loaded", orders: [] }} onRetry={vi.fn()} />);
    expect(html).toContain("No orders yet.");
  });

  it("links each loaded order to its tracking page", () => {
    const order: Order = {
      _id: "order123456", status: "IN_KITCHEN", total: 10, currency: "USD",
      ingredients: [], statusHistory: [], createdAt: "2026-11-27",
    };
    const html = renderToStaticMarkup(
      <StaticRouter location="/orders">
        <OrderHistory
          state={{ status: "loaded", orders: [order] }}
          onRetry={vi.fn()}
        />
      </StaticRouter>,
    );
    expect(html).toContain('href="/orders/order123456"');
    expect(html).toContain("Order #123456");
    expect(html).toContain("IN KITCHEN");
  });
});
