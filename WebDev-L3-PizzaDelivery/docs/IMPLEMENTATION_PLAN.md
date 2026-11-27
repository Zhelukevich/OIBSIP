# Pizza Delivery Implementation Plan

Status audited on 2026-11-27. The [feature checklist](../CHECKLIST.md) records what is implemented. The plan below covers the remaining development and acceptance checks.

## Backend

1. **P0 · Payment confirmation and stock reservations.** Order creation reserves ingredients in a MongoDB transaction. Unpaid reservations expire after 15 minutes. The expiry job checks Razorpay before restoring stock, and signed capture events trigger a refund if expiry already released the reservation. Verify checkout and late refunds in Razorpay Test Mode. [Order service](../server/src/services/orders.ts), [payment service](../server/src/services/payments.ts)
2. **P0 · Verify tracking subscriptions end to end.** Socket.IO checks order ownership or admin access before joining a room. Verify live delivery with two customer accounts and confirm that the authenticated order endpoints provide the polling fallback. [Order sockets](../server/src/realtime/orders.ts), [order routes](../server/src/routes/order.routes.ts)
3. **P1 · Separate admin login.** Password recovery consumes an expiring email token atomically. Production requires a configured JWT secret, and seeding requires an explicit password for a new administrator. Add a dedicated admin login endpoint that checks the account role and shares credential validation with user login. [Auth routes](../server/src/routes/auth.routes.ts), [seeding service](../server/src/services/seed.ts)
4. **P1 · Validate recipes on the server.** The storefront resolves menu recipes against the active inventory in the catalog. Extend order validation to check ingredient types and quantities for each pizza. A custom pizza must accept one base, one sauce, one cheese, and multiple distinct vegetables. [Catalog routes](../server/src/routes/catalog.routes.ts), [order routes](../server/src/routes/order.routes.ts)
5. **P2 · Verify stock notifications.** Test inventory at and below the configured threshold, delivery of a grouped email, and handling of SMTP failures. Keep the scheduled check and per-item threshold configuration. [Low-stock job](../server/src/jobs/lowStock.ts)

## Frontend

1. **P1 · Add recovery and admin sign-in.** Add a “Forgot password” action and screens to request a link and set a new password. Show expired-link and success states. Add an admin sign-in page that uses the dedicated endpoint and retains the admin route guard. Refresh the signed-in user's verification state after email confirmation. [App](../client/src/App.tsx), [verification page](../client/src/pages/VerifyEmailPage.tsx)
2. **P1 · Verify the menu and customiser in the full order flow.** Exercise the stock-backed menu and four-step builder, including back navigation, vegetable multi-select and adjusting the cart after an order API stock conflict. [App](../client/src/App.tsx)
3. **P0 · Complete checkout states.** Use the existing order summary to display the server total and chosen ingredients before payment. Keep checkout disabled while an attempt is in progress. Show pending verification, success, cancellation, failure and expiry, and use the order returned by the server to decide whether to offer a retry. Integrate against the backend payment contract in step 1. [Tracking page](../client/src/pages/TrackingPage.tsx)
4. **P0 · Update the orders list and details.** Refresh both views while open. Use polling for the list and keep socket updates with polling fallback for details. Configure the socket origin or proxy for the deployment and clean up connections and timers when leaving a page. In the admin panel, show permitted status transitions and feedback for failed stock and status updates. [App](../client/src/App.tsx), [tracking page](../client/src/pages/TrackingPage.tsx), [admin page](../client/src/pages/AdminPage.tsx)
5. **P2 · Add client coverage.** Use the existing Vitest setup for multi-select and checkout state tests. Exercise password reset, customer and admin sign-in, and the complete order flow in the browser. Follow the existing [UI guidance](../client/DESIGN.md) for new screens.

## Acceptance checks

- **Accounts.** Register and verify an email, request a password reset through a received link, and sign in with the new password. Confirm that a registered user cannot access admin routes.
- **Catalog and checkout.** Open an available pizza from the menu, build a custom pizza with two vegetables, review the server total, and complete a Razorpay Test Mode payment. A successful payment transitions the order once and leaves the right stock balance. A failed or expired reservation restores the right amounts.
- **Fulfilment.** The admin moves the order from `Order Received` through `In Kitchen` to `Sent to Delivery`. The customer sees updates on both order pages without refreshing and cannot subscribe to another customer's order.
- **Inventory.** Update an ingredient's stock and threshold from the admin panel. At the next scheduled run, verify that an item below its threshold is included in the admin email.

## Verification on 2026-11-27

| Check | Result |
| --- | --- |
| TypeScript and production build | Client and server compiled, and Vite produced the client bundle. Rollup emitted warnings about annotations in Zod. |
| Server tests | 3 passed. The tests exercise email verification and access checks through HTTP using mocked database and mail calls. |
| Client tests | Vitest exited with code 1 because there are no client test files. |
| End-to-end integration | The local API health request timed out and Docker Engine access was denied. Live MongoDB, SMTP delivery and Razorpay Test Mode were unverified. |

The `npm.cmd` launcher failed with `EPERM` when resolving the Windows user directory. Compilation and tests ran through the installed TypeScript, Vite and Vitest entry points and Node's test runner.
