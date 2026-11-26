# Pizza Delivery - Implementation Plan

## Goal

Build a MERN pizza delivery platform with separate user and admin roles, a pizza customizer, Razorpay test checkout, inventory management, email notifications, and real-time order status updates.

## Technology decisions

- Frontend: React 18, TypeScript, Vite, React Router, Tailwind CSS, React Hook Form, Zod
- Backend: Node.js, Express, TypeScript
- Database: MongoDB Atlas Free Tier with Mongoose
- Real-time: Socket.IO
- Authentication: JWT access tokens and role-based middleware
- Payments: Razorpay test mode with server-side webhook verification
- Email: Nodemailer with Gmail SMTP or Resend
- Scheduled jobs: `node-cron` or an external free cron service
- API validation: Zod
- Testing: Vitest, React Testing Library, Node test runner, Playwright
- Deployment: Vercel or Netlify for the client, Render or Railway for the server
- CI/CD: GitHub Actions

## Free-tier deployment

| Component | Free-tier option |
|---|---|
| React client | Vercel or Netlify |
| Express server | Render or Railway |
| MongoDB | MongoDB Atlas |
| Email | Resend or Gmail SMTP |
| Cron | `node-cron` with an always-on server, or cron-job.org |
| Secrets | Platform environment variables |

Use one backend instance initially. A Redis Socket.IO adapter is not required for the free-tier MVP.

## Application structure

```text
client/src/
  components/
  hooks/
  pages/
  routes/
  services/
  store/
  types/
  utils/

server/src/
  config/
  controllers/
  jobs/
  middleware/
  models/
  routes/
  services/
  types/
  utils/
```

## Domain models

### User

- name
- email
- passwordHash
- role: `user | admin`
- emailVerified
- emailVerificationTokenHash
- passwordResetTokenHash
- passwordResetExpires

### InventoryItem

- type: `base | sauce | cheese | vegetable`
- name
- quantity
- threshold
- isActive

### Order

- user
- ingredients
- total
- status
- payment
- statusHistory
- Razorpay identifiers

Status flow:

```text
AWAITING_PAYMENT -> RECEIVED -> IN_KITCHEN -> SENT_TO_DELIVERY -> DELIVERED
```

Terminal states: `CANCELLED` and `PAYMENT_FAILED`.

## API groups

- `/api/auth/*`: register, verify email, login, forgot password, reset password
- `/api/catalog/*`: available ingredients
- `/api/orders/*`: create, list, details
- `/api/admin/inventory/*`: list and update inventory
- `/api/admin/orders/*`: list and change status
- `/api/payments/*`: create Razorpay order, verify signature, webhook

## Authentication and authorization

- Passwords are hashed with bcrypt.
- JWT access tokens are short-lived.
- Protected API routes read the Bearer token.
- Admin accounts are seeded separately and are not exposed through user registration.
- Every admin route requires authentication and `role=admin`.
- Email verification and password reset links contain hashed single-use tokens.

## Checkout and inventory

1. Validate the cart and current inventory.
2. Start a MongoDB transaction.
3. Reserve inventory using an atomic quantity check.
4. Create a payment order with Razorpay.
5. Persist the order with `AWAITING_PAYMENT`.
6. Verify the Razorpay signature on the server.
7. Use the Razorpay webhook as the authoritative payment confirmation.
8. Change the order to `RECEIVED` and publish a Socket.IO event.
9. Release reservations when payment fails or expires.

Use conditional MongoDB updates to prevent inventory overselling.

## Real-time status

- The server emits `order.statusChanged` after a valid admin status transition.
- A user joins only their own order room after authentication.
- The client falls back to polling while Socket.IO is unavailable.

## Low-stock notifications

- Run a configurable cron schedule, for example every hour.
- Aggregate inventory below its configured threshold.
- Send one grouped admin email instead of one email per item.
- Add a manual inventory check endpoint for testing and operations.

## Security

- Zod validation for every external request and payment payload.
- CORS allowlist and request size limits.
- Rate-limit authentication and password reset endpoints.
- Razorpay webhook signature verification.
- Secrets only in environment variables or the hosting provider's secret store.
- Do not log passwords, tokens, payment secrets, or complete payment payloads.

## Implementation sequence

1. Shared environment and database connection
2. User model, auth routes, email verification, password reset
3. Admin seed and role middleware
4. Catalog and inventory models
5. Atomic reservation and order creation
6. Razorpay payment verification and webhook
7. Socket.IO rooms and status updates
8. React auth, catalog, builder, checkout, and order pages
9. Admin inventory and order pages
10. Low-stock cron and email
11. Tests and free-tier deployment

## Validation checkpoints

- User cannot register with an existing email.
- Unverified users cannot access protected actions.
- Admin pages are inaccessible to users and unauthenticated visitors.
- Orders cannot oversell inventory.
- Payment success cannot rely only on a client callback.
- Admin status changes create valid state transitions and status history.
- User receives the status change in real time.
- Low-stock email is sent once per configured scheduled check.
