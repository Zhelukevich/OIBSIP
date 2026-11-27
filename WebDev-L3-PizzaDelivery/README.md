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
- Email: Gmail SMTP

## Start

```bash
cd client
npm install
npm run dev

cd ../server
npm install
npm run dev
```

Copy `.env.development.example` to `server/.env.development` and configure MongoDB, JWT, and Razorpay as needed. `npm run dev:server` loads that file.

For a file-based production setup, copy `.env.production.example` to `server/.env.production`. After building the server, `npm --prefix server start` loads that file. Variables set by the hosting provider take precedence over values in the file. Both environment files are ignored by Git.

## Email configuration

### Local development with Mailpit

Start Mailpit and use these values in `server/.env.development`.

```powershell
docker run -d --name mailpit -p 127.0.0.1:8025:8025 -p 127.0.0.1:1025:1025 axllent/mailpit
```

```env
CLIENT_URL=http://localhost:5173
SMTP_HOST=127.0.0.1
SMTP_PORT=1025
SMTP_USER=
SMTP_PASSWORD=
EMAIL_FROM=pizza@example.test
```

Open the Mailpit inbox at `http://localhost:8025`. To restart an existing container, run `docker start mailpit`.

### Production with Gmail SMTP

Set these environment variables on the deployed **backend** or in `server/.env.production` when using a file-based setup. Set `CLIENT_URL` to the public frontend URL so email links open the deployed site.

```env
NODE_ENV=production
CLIENT_URL=https://your-frontend.example.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-address@gmail.com
EMAIL_FROM=your-address@gmail.com
```

Set `SMTP_PASSWORD` in the hosting provider's secret settings to a Google app password, with the display spaces removed. Creating an app password requires 2-Step Verification. [Google app passwords](https://support.google.com/accounts/answer/185833)

## Email verification

In local development without SMTP, registration exposes a local verification link in the UI.

Verification links expire after 24 hours. Users can sign in to request a new link from `/verify-email`. Creating an order requires a confirmed email address.

## Password recovery

Password recovery uses the same SMTP settings and `CLIENT_URL`. On the sign-in page, choose **Forgot your password?** and enter the account email. The email links to `/reset-password` on the frontend. The link expires after one hour and can be used once. Local end-to-end testing requires an SMTP inbox or a local SMTP capture service.
