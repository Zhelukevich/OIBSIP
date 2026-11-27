---
name: pizza-backend-review
description: Review pizza server changes for contract regressions, authorization, state consistency, and gaps in verification. Use for code reviews and regression checks of Express routes, services, Mongoose writes, and background jobs.
---

# Pizza Backend Review

Read the diff, affected routes and services, and nearby server tests. Trace each changed operation through its normal entry point. Use the matching checks below to decide what could regress.

- **API contract.** Compare request validation, response shape, and status codes with the caller. Check that async failures pass through the shared error handler. Inspect [the HTTP app](../../../server/src/app.ts) for middleware order when the change affects authentication, parsing, or error handling.
- **Access control.** Check which identity and role the operation requires. Look for an owner filter in customer reads and writes, and for an ownership or admin check on order-room subscriptions.
- **Data consistency.** Identify the transaction or conditional update that guards the invariant. Check session propagation for stock reservations and the write predicate for concurrent status updates. Confirm that history and emitted events agree with the committed update.
- **Retries and dependencies.** Check duplicate checkout confirmations, account-token expiry and reuse, and how failed provider calls or interrupted jobs leave data. Read [pizza-payments](../pizza-payments/SKILL.md) or [pizza-realtime](../pizza-realtime/SKILL.md) when the diff touches those integrations.

Run the relevant server checks when available. Distinguish assertions exercised with mocks from behavior checked against live MongoDB, SMTP, Razorpay, or Socket.IO. Report concrete findings in severity order with file and line, the affected request or state transition, and its impact. If there are no findings, state which integration paths remain unverified.
