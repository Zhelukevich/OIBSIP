---
name: pizza-realtime
description: Implement secure Socket.IO order status updates with a polling fallback.
---

# Pizza Realtime Skill

## Apply this skill when

- adding order status events
- creating or leaving Socket.IO rooms
- updating the user order dashboard
- implementing Redis scaling support

## Rules

- Authenticate socket connections.
- Join only rooms for orders owned by the user or visible to an admin.
- Publish an event only after the database status transition commits.
- Preserve status history.
- Reject invalid status transitions.
- Add polling fallback for reconnections or unavailable WebSockets.
