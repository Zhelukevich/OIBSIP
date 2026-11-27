import { api } from "./api";
import type { Currency, Order } from "../types";

export type PaymentResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type CheckoutOptions = {
  key: string;
  amount: number;
  currency: Currency;
  order_id: string;
  name: string;
  description: string;
  handler: (payment: PaymentResponse) => void;
  modal: { ondismiss: () => void };
};
type Checkout = new (options: CheckoutOptions) => { open(): void };

declare global {
  interface Window {
    Razorpay?: Checkout;
  }
}

let checkoutScript: Promise<Checkout> | undefined;

function loadCheckout() {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);

  checkoutScript ??= new Promise<Checkout>((resolve, reject) => {
    const script = document.createElement("script");
    const fail = () => {
      script.remove();
      reject(new Error("Could not load Razorpay"));
    };
    script.onload = () => {
      if (window.Razorpay) resolve(window.Razorpay);
      else fail();
    };
    script.onerror = fail;
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    checkoutScript = undefined;
    throw error;
  });
  return checkoutScript;
}

export async function openPayment(orderId: string, signal: AbortSignal) {
  const RazorpayCheckout = await loadCheckout();
  signal.throwIfAborted();
  const { data } = await api.post<{ keyId: string; paymentOrderId: string; amount: number; currency: Currency }>(
    "/payments/create", { orderId }, { signal },
  );
  signal.throwIfAborted();

  return new Promise<PaymentResponse | null>((resolve) => {
    const checkout = new RazorpayCheckout({
      key: data.keyId,
      amount: data.amount,
      currency: data.currency,
      order_id: data.paymentOrderId,
      name: "Slice Pizza",
      description: "Pizza order",
      handler: resolve,
      modal: { ondismiss: () => resolve(null) },
    });
    checkout.open();
  });
}

export async function verifyPayment(orderId: string, payment: PaymentResponse) {
  const { data } = await api.post<{ order: Order }>("/payments/verify", {
    orderId,
    razorpayPaymentId: payment.razorpay_payment_id,
    razorpayOrderId: payment.razorpay_order_id,
    razorpaySignature: payment.razorpay_signature,
  });
  return data.order;
}
