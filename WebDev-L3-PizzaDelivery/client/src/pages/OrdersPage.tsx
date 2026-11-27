import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/Button";
import { PageContainer } from "../components/PageContainer";
import { api } from "../services/api";
import { formatPrice } from "../storefront";
import type { Order } from "../types";

type OrdersState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "loaded"; orders: Order[] };

export function OrderHistory({ state, onRetry }: { state: OrdersState; onRetry: () => void }) {
  if (state.status === "loading") return <p className="text-muted" role="status">Loading orders…</p>;
  if (state.status === "error") {
    return (
      <div className="grid justify-items-start gap-3">
        <p className="text-danger" role="alert">Could not load your orders.</p>
        <Button variant="outline" onClick={onRetry}>Try again</Button>
      </div>
    );
  }
  if (!state.orders.length) return <p className="text-muted">No orders yet.</p>;

  return (
    <ul className="grid gap-4" aria-label="Your orders">
      {state.orders.map((order) => (
        <li key={order._id}>
          <Link to={`/orders/${order._id}`} className="block rounded-cards border border-line bg-surface p-5 hover:border-action">
            <div className="flex flex-wrap justify-between gap-2">
              <strong>Order #{order._id.slice(-6)}</strong>
              <span>{order.status.replaceAll("_", " ")}</span>
            </div>
            <div className="mt-2 text-sm text-muted">{formatPrice(order.total, order.currency ?? "INR")}</div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function OrdersPage() {
  const [state, setState] = useState<OrdersState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api.get<{ orders: Order[] }>("/orders/mine", { signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted) setState({ status: "loaded", orders: data.orders });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: "error" });
      });
    return () => controller.abort();
  }, [attempt]);

  function retry() {
    setState({ status: "loading" });
    setAttempt((previous) => previous + 1);
  }

  return (
    <PageContainer className="py-10">
      <h1 className="mb-6 text-heading font-bold">My orders</h1>
      <OrderHistory state={state} onRetry={retry} />
    </PageContainer>
  );
}
