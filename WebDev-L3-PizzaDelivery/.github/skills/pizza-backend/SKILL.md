---
name: pizza-backend
description: Implement or refactor the pizza server using Express 4, TypeScript, Zod, and Mongoose. Use for HTTP routes, accounts, orders, inventory, email jobs, or server lifecycle changes.
---

# Pizza Backend Skill

Follow the request from the Express route to the service and persistence operation. Check [the feature checklist](../../../CHECKLIST.md) and [implementation plan](../../../docs/IMPLEMENTATION_PLAN.md) when behavior or scope is unclear.

## Server boundaries

- Compose HTTP middleware and routes in [app.ts](../../../server/src/app.ts). Keep MongoDB connections, seeding, Socket.IO attachment, and job startup and shutdown in [server.ts](../../../server/src/server.ts). HTTP tests can use `createApp()` with mocked dependencies.
- Parse inputs with Zod at the route boundary, including MongoDB IDs. Wrap async Express 4 handlers with `asyncHandler` and use `HttpError` for expected failures. Keep unexpected error details and credentials out of JSON responses and logs.
- Keep routes focused on HTTP and put reusable operations and state transitions in `services/`. Check caller expectations in `client/src/services/api.ts` and the relevant page before changing a response shape, HTTP status, or event name.
- Use `requireAuth`, `requireAdmin`, and `requireVerifiedEmail` where the operation requires them. Scope customer queries to the authenticated owner. Reuse the shared JWT helpers for HTTP and Socket.IO.
- Create reservations and orders in one MongoDB transaction. Pass the session to every participating write and use a stock predicate for each decrement. Keep order status and its history entry in the same conditional update. Publish status changes after the write commits.
- Reuse the shared email service. Keep verification and reset tokens hashed at rest with an expiry. Consume reset tokens atomically and keep raw reset tokens out of responses and logs. Preserve the existing local email-verification flow.

## Verification

Run `npm test` from the repository root for server changes. Add a focused test when existing coverage misses a changed contract or state invariant. For transaction behavior, use the [MongoDB replica-set setup](../../../docs/DOCKER.md) when a live test is needed. Report mocked and live checks separately.

For Razorpay and payment-related stock changes, read [pizza-payments](../pizza-payments/SKILL.md). For order subscriptions and status events, read [pizza-realtime](../pizza-realtime/SKILL.md).
