---
name: pizza-payments
description: Implement Razorpay test checkout and server-side payment verification.
---

# Pizza Payments Skill

## Apply this skill when

- creating Razorpay payment orders
- verifying payment callbacks
- processing Razorpay webhooks
- handling payment failures or cancellation

## Rules

- Create and validate payment amounts on the server.
- Verify Razorpay signatures with the secret key.
- Verify webhook signatures before processing events.
- Treat the server webhook as authoritative.
- Use idempotency keys or a unique payment event identifier.
- Reserve or decrement inventory transactionally.
- Do not mark an order paid based only on browser UI success.
