import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { io } from "socket.io-client";
import { api } from "../services/api";
import type { Order } from "../types";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open(): void };
  }
}

const statusSteps = ["RECEIVED", "IN_KITCHEN", "SENT_TO_DELIVERY", "DELIVERED"];

export function TrackingPage() {
  const { id } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [paying, setPaying] = useState(false);

  async function loadOrder() {
    try {
      const { data } = await api.get(`/orders/${id}`);
      setOrder(data.order);
    } catch {
      setError("Could not load this order");
    }
  }

  useEffect(() => {
    void loadOrder();
    const socket = io("http://localhost:5000", {
      auth: { token: localStorage.getItem("pizza_token") },
    });
    socket.on("connect", () => socket.emit("order:join", id));
    socket.on("order.statusChanged", () => void loadOrder());
    const poll = window.setInterval(() => void loadOrder(), 15000);
    return () => {
      socket.disconnect();
      window.clearInterval(poll);
    };
  }, [id]);

  async function pay() {
    setError("");
    setPaying(true);
    try {
      const { data } = await api.post("/payments/create", { orderId: id });
      if (!window.Razorpay) {
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        document.body.appendChild(script);
        await new Promise<void>((resolve, reject) => {
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Could not load Razorpay"));
        });
      }
      const razorpay = new window.Razorpay!({
        key: data.keyId,
        amount: data.amount,
        order_id: data.paymentOrderId,
        name: "Slice Pizza",
        description: "Pizza order",
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          await api.post("/payments/verify", {
            orderId: id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpayOrderId: response.razorpay_order_id,
            razorpaySignature: response.razorpay_signature,
          });
          await loadOrder();
        },
        modal: { ondismiss: () => setPaying(false) },
      });
      razorpay.open();
    } catch (caught) {
      setError((caught as { response?: { data?: { message?: string } } }).response?.data?.message || "Payment could not be started");
    } finally {
      setPaying(false);
    }
  }

  if (!order) return <main className="mx-auto max-w-[1200px] px-5 py-10">{error || "Loading order..."}</main>;
  const currentIndex = statusSteps.indexOf(order.status);

  return (
    <main className="mx-auto max-w-[800px] px-5 py-10">
      <h1 className="mb-2 text-heading font-bold">Order #{order._id.slice(-6)}</h1>
      <p className="mb-8 text-smoke">₹{order.total}</p>
      {order.status === "AWAITING_PAYMENT" && (
        <button className="mb-8 rounded-buttons bg-ember-orange px-6 py-3 font-bold text-white" onClick={pay} disabled={paying}>
          {paying ? "Opening checkout..." : "Pay with Razorpay"}
        </button>
      )}
      {error && <p className="form-error mb-4">{error}</p>}
      <div className="rounded-cards border border-hairline bg-paper-white p-6">
        {statusSteps.map((status, index) => (
          <div className="relative flex items-center gap-4 pb-6 last:pb-0" key={status}>
            {index < statusSteps.length - 1 && <span className={`absolute left-[11px] top-6 h-full w-0.5 ${index < currentIndex ? "bg-ember-orange" : "bg-hairline"}`} />}
            <span className={`relative z-10 h-6 w-6 rounded-full border-4 ${index <= currentIndex ? "border-ember-orange bg-paper-white" : "border-hairline bg-paper-white"}`} />
            <div>
              <strong>{status.replaceAll("_", " ")}</strong>
              {index === currentIndex && <span className="ml-3 text-sm text-ember-orange">Current</span>}
            </div>
          </div>
        ))}
      </div>
      <section className="mt-6 rounded-cards border border-hairline bg-paper-white p-6">
        <h2 className="mb-3 font-bold">Ingredients</h2>
        {order.ingredients.map((ingredient, index) => (
          <p key={`${ingredient.inventoryItem}-${index}`} className="flex justify-between gap-4 text-sm text-smoke">
            <span>{ingredient.name}</span><span>× {ingredient.quantity}</span>
          </p>
        ))}
      </section>
    </main>
  );
}
