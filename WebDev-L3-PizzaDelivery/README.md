# Pizza Delivery Full-Stack Application

## Structure

- `client/` - React frontend
- `server/` - Express/MongoDB backend
- `CHECKLIST.md` - feature requirements
- `DESIGN.md` - visual design reference

## Planned modules

### Frontend

- Authentication and password recovery
- User dashboard and pizza builder
- Order summary and payment
- Real-time order tracking
- Admin inventory and order management

### Backend

- JWT authentication and role-based access
- User, inventory, and order models
- Razorpay payment integration
- Email verification and password reset
- Scheduled low-stock notifications
- Polling or WebSocket order status updates

## Architecture and implementation

- Technical implementation plan: `docs/IMPLEMENTATION_PLAN.md`
- Docker and MongoDB setup: `docs/DOCKER.md`
- Feature requirements: `CHECKLIST.md`
- Visual design reference: `client/DESIGN.md`
- Workspace instructions: `.github/copilot-instructions.md`
- Specialist agents: `.github/agents/`
- Reusable implementation skills: `.github/skills/`

## Free-tier deployment

- Client: Vercel or Netlify
- Server: Render or Railway
- Database: MongoDB Atlas Free Tier
- Email: Resend or Gmail SMTP

## Start

```bash
cd client
npm install
npm run dev

cd ../server
npm install
npm run dev
```

Copy `.env.example` to `server/.env` and configure MongoDB, JWT, email, and Razorpay values.

## Email verification

Set `CLIENT_URL` to the frontend origin and configure `SMTP_HOST`, `SMTP_PORT`, and a sender through `EMAIL_FROM` or `SMTP_USER` in `server/.env`. Set `SMTP_PASSWORD` when SMTP authentication is required. In local development without SMTP, registration exposes a local verification link in the UI.

Verification links expire after 24 hours. Users can sign in to request a new link from `/verify-email`. Creating an order requires a confirmed email address.

## Password recovery

Password recovery uses the same SMTP settings and `CLIENT_URL`. On the sign-in page, choose **Forgot your password?** and enter the account email. The email links to `/reset-password` on the frontend. The link expires after one hour and can be used once. Local end-to-end testing requires an SMTP inbox or a local SMTP capture service.
