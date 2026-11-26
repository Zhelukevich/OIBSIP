# Pizza Delivery Workspace Instructions

- Use TypeScript for all new source code.
- Keep Express routes thin and put business logic in controllers/services.
- Use Zod for external input validation.
- Use Mongoose schemas and explicit TypeScript types.
- Use atomic MongoDB updates for inventory and order transitions.
- Never trust a Razorpay client callback; verify signatures and webhooks on the server.
- Keep user and admin authorization on the server, not only in React routes.
- Emit Socket.IO status events only after a database transaction succeeds.
- Use the existing package scripts and Vitest/Node test setup.
- Add focused tests for auth, inventory overselling, payment verification, and status transitions.
- Keep secrets in environment variables and update `.env.example` when new variables are introduced.
