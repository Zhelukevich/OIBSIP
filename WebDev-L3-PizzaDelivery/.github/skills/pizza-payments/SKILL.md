---
name: pizza-payments
description: Work on Razorpay checkout, payment confirmation, signed webhooks, or payment-related inventory reservations in the pizza server.
---

# Pizza Payments Skill

Start with [payment routes](../../../server/src/routes/payment.routes.ts), [the payment service](../../../server/src/services/payments.ts), and the [order model](../../../server/src/models/Order.ts). Check the [implementation plan](../../../docs/IMPLEMENTATION_PLAN.md) for work still pending on provider events and unpaid reservations.

## Checkout and confirmation

- Derive amount in minor units and currency from the stored order. Require ownership and an order awaiting payment before checkout. Reuse the saved Razorpay order on subsequent checkout requests.
- Verify checkout HMAC using the Razorpay order ID stored on the server. Compare the signature in constant time and reject a mismatched order ID before the write.
- Condition the confirmation write on the expected order, payment state, and provider order ID. Update payment fields, status, and history together. A retry of the recorded payment returns the current order and leaves fulfilment history intact.
- For webhook work, preserve the raw request body for signature verification, then parse and validate the payload. Bind the event to the stored provider references and verify amount and currency. Process verified events idempotently and use them as the source of truth for final provider state.
- For expiry or cancellation work, reconcile any late successful payment before choosing the release rule. Test that reservations are released at most once and that the operation remains consistent with a concurrent confirmation.

Use [Razorpay's checkout integration guide](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/) for the provider contract. Distinguish mocked checkout tests from a successful Razorpay Test Mode payment.
