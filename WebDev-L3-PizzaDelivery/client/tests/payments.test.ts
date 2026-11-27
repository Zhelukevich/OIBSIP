import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../src/services/api";
import { openPayment, verifyPayment, type PaymentResponse } from "../src/services/payments";

const payment: PaymentResponse = {
  razorpay_payment_id: "payment-id",
  razorpay_order_id: "checkout-id",
  razorpay_signature: "signature",
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("payment checkout", () => {
  it.each(["success", "dismissal"] as const)("waits for checkout %s before settling", async (outcome) => {
    type Options = ConstructorParameters<NonNullable<Window["Razorpay"]>>[0];
    const open = vi.fn();
    let options: Options | undefined;
    vi.stubGlobal("window", {
      Razorpay: class {
        constructor(checkoutOptions: Options) {
          options = checkoutOptions;
        }
        open = open;
      },
    });
    vi.spyOn(api, "post").mockResolvedValue({
      data: { keyId: "key", paymentOrderId: "checkout-id", amount: 1000, currency: "USD" },
    });

    const onSettled = vi.fn();
    const result = openPayment("order-id", new AbortController().signal).then(onSettled);
    await vi.waitFor(() => expect(open).toHaveBeenCalledOnce());
    expect(onSettled).not.toHaveBeenCalled();

    if (outcome === "success") options?.handler(payment);
    options?.modal.ondismiss();
    await result;
    expect(onSettled).toHaveBeenCalledWith(outcome === "success" ? payment : null);
  });

  it("lets the tracking page handle a rejected verification", async () => {
    const error = new Error("Verification unavailable");
    const post = vi.spyOn(api, "post").mockRejectedValue(error);

    await expect(verifyPayment("order-id", payment)).rejects.toThrow(error);
    expect(post).toHaveBeenCalledWith("/payments/verify", {
      orderId: "order-id",
      razorpayPaymentId: "payment-id",
      razorpayOrderId: "checkout-id",
      razorpaySignature: "signature",
    });
  });
});
