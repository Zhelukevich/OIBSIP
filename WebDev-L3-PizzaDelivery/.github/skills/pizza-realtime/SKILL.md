---
name: pizza-realtime
description: Change or verify authenticated Socket.IO order subscriptions, status events, or the tracking page polling fallback in the pizza platform.
---

# Pizza Realtime Skill

Read [server-side order sockets](../../../server/src/realtime/orders.ts) and the [tracking page](../../../client/src/pages/TrackingPage.tsx) before changing the subscription or event contract.

- Authenticate the handshake with the shared JWT verifier. Validate the ID in `order:join` and look up access to the specific order before joining its `order:<orderId>` room. Allow the owner or an administrator.
- Emit `order.statusChanged` through `publishOrderStatus` after the status and history write commits. Keep the event payload compatible with the client.
- Preserve subscription on reconnect, the authenticated HTTP polling fallback, and cleanup when the order page unmounts.
- For a live check, use two customer accounts and an administrator. Verify that the owner and administrator can join the order room and that updates reach the intended recipients. Report mocked subscription checks separately from live delivery.
