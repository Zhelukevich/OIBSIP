import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { io } from "socket.io-client";
import { Button } from "../components/Button";
import { PageContainer } from "../components/PageContainer";
import { api, apiErrorMessage } from "../services/api";
import { openPayment, verifyPayment, type PaymentResponse } from "../services/payments";
import { formatPrice } from "../storefront";
import type { Order } from "../types";

const statusSteps = [
  { id: "RECEIVED", label: "Order received" },
  { id: "IN_KITCHEN", label: "In the kitchen" },
  { id: "SENT_TO_DELIVERY", label: "Out for delivery" },
  { id: "DELIVERED", label: "Delivered" },
];

export function TrackingPage() {
  const { id } = useParams();
  return id ? <TrackingOrder key={id} id={id} /> : null;
}

function TrackingOrder({ id }: { id: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loadError, setLoadError] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [paymentPhase, setPaymentPhase] = useState<"checkout" | "verification" | null>(null);
  const [pendingPayment, setPendingPayment] = useState<PaymentResponse | null>(null);
  const orderRequest = useRef<AbortController | null>(null);
  const page = useRef<AbortController | null>(null);
  const inFlight = useRef(false);

  const orderUrl = "/orders/" + id;

  const loadOrder = useCallback(async () => {
    if (orderRequest.current) return;

    const request = new AbortController();
    orderRequest.current = request;
    try {
      const { data } = await api.get<{ order: Order }>(orderUrl, { signal: request.signal });
      if (!request.signal.aborted) {
        setOrder(data.order);
        setLoadError("");
      }
    } catch {
      if (!request.signal.aborted) setLoadError("Could not load this order.");
    } finally {
      if (orderRequest.current === request) orderRequest.current = null;
    }
  }, [orderUrl]);

  useEffect(() => {
    const controller = new AbortController();
    page.current = controller;
    void loadOrder();

    const socket = io(import.meta.env.VITE_SOCKET_ORIGIN || window.location.origin, {
      auth: { token: localStorage.getItem("pizza_token") },
    });
    socket.on("connect", () => socket.emit("order:join", id));
    socket.on("order.statusChanged", () => {
      orderRequest.current?.abort();
      orderRequest.current = null;
      void loadOrder();
    });
    const poll = window.setInterval(loadOrder, 15000);
    return () => {
      controller.abort();
      orderRequest.current?.abort();
      orderRequest.current = null;
      socket.disconnect();
      window.clearInterval(poll);
    };
  }, [id, loadOrder]);

  async function pay() {
    const signal = page.current?.signal;
    if (!signal || signal.aborted || inFlight.current) return;

    inFlight.current = true;
    setPaymentError("");
    setPaymentPhase(pendingPayment ? "verification" : "checkout");
    let payment = pendingPayment;
    try {
      if (payment) {
        // A previous verification may have succeeded before its response was lost.
        const { data } = await api.get<{ order: Order }>(orderUrl, { signal });
        if (data.order.status !== "AWAITING_PAYMENT") {
          orderRequest.current?.abort();
          setOrder(data.order);
          setLoadError("");
          setPendingPayment(null);
          return;
        }
      } else {
        payment = await openPayment(id, signal);
        if (!payment) return;
        if (!signal.aborted) setPendingPayment(payment);
      }

      if (!signal.aborted) setPaymentPhase("verification");
      const verifiedOrder = await verifyPayment(id, payment);
      if (!signal.aborted) {
        orderRequest.current?.abort();
        setOrder(verifiedOrder);
        setLoadError("");
        setPendingPayment(null);
      }
    } catch (caught) {
      if (!signal.aborted) {
        const fallback = payment ? "Could not confirm your payment. Try confirming it again." : "Payment could not be started.";
        setPaymentError(apiErrorMessage(caught, fallback));
        if (payment) void loadOrder();
      }
    } finally {
      inFlight.current = false;
      if (!signal.aborted) setPaymentPhase(null);
    }
  }

  if (!order) {
    return (
      <PageContainer width="reading" className="py-8">
        <Link className="action-link" to="/orders">← My orders</Link>
        <h1 className="counter-title">Track your order</h1>
        {loadError ? (
          <div className="counter-panel p-5">
            <p className="mb-4 text-danger" role="alert">{loadError}</p>
            <Button variant="outline" onClick={() => { setLoadError(""); void loadOrder(); }}>Try again</Button>
          </div>
        ) : <p role="status">Loading order…</p>}
      </PageContainer>
    );
  }

  const currentIndex = statusSteps.findIndex(({ id }) => id === order.status);

  return (
    <PageContainer width="reading" className="py-8">
      <Link className="action-link" to="/orders">← My orders</Link>
      <h1 className="counter-title">Order #{order._id.slice(-6)}</h1>
      <p className="mb-4 text-muted">Total <strong className="text-ink">{formatPrice(order.total, order.currency ?? "INR")}</strong></p>
      {order.status === "AWAITING_PAYMENT" && (
        <section className="counter-panel mb-5 grid justify-items-start gap-3 p-5" aria-labelledby="payment-status">
          <h2 id="payment-status" className="font-bold">Awaiting payment</h2>
          {paymentError && <p className="text-danger" role="alert">{paymentError}</p>}
          <Button onClick={() => void pay()} disabled={paymentPhase !== null}>
            {paymentPhase === "checkout" ? "Checkout in progress…"
              : paymentPhase === "verification" ? "Confirming payment…"
              : pendingPayment ? "Retry payment confirmation" : "Pay with Razorpay"}
          </Button>
        </section>
      )}
      {loadError && <p className="mb-4 text-danger" role="alert">{loadError}</p>}
      {order.status === "CANCELLED" && <p className="mb-4 font-bold text-danger">Order cancelled</p>}
      <ol className="counter-panel p-5" aria-label="Order progress">
        {statusSteps.map(({ id, label }, index) => (
          <li className="relative flex items-center gap-4 pb-6 last:pb-0" key={id} aria-current={index === currentIndex ? "step" : undefined}>
            {index < statusSteps.length - 1 && <span className={`absolute left-[11px] top-6 bottom-0 w-0.5 ${index < currentIndex ? "bg-action" : "bg-line"}`} />}
            <span className={`relative z-10 h-6 w-6 rounded-full border-4 ${index <= currentIndex ? "border-action bg-surface" : "border-line bg-surface"}`} />
            <div>
              <strong>{label}</strong>
              {index === currentIndex && <span className="ml-3 text-sm text-action">Current</span>}
            </div>
          </li>
        ))}
      </ol>
      <section className="counter-panel mt-5 p-5">
        <h2 className="mb-3 font-bold">Ingredients</h2>
        {order.ingredients.map((ingredient, index) => (
          <p key={`${ingredient.inventoryItem}-${index}`} className="flex justify-between gap-4 text-sm text-muted">
            <span>{ingredient.name}</span><span>× {ingredient.quantity}</span>
          </p>
        ))}
      </section>
    </PageContainer>
  );
}
