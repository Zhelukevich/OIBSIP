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

Route `/api` to Express. For live order updates, route `/socket.io` to Express with WebSocket upgrades enabled, or set `VITE_SOCKET_ORIGIN` to the public Express origin when building the client. Vite proxies both paths during local development.

## Local development

From the repository root, install dependencies and create the local configuration if `server/.env.development` is missing.

```powershell
npm ci --prefix client
npm ci --prefix server
if (!(Test-Path server/.env.development)) {
  Copy-Item .env.development.example server/.env.development
}
```

Start the local MongoDB replica set using [the Docker guide](docs/DOCKER.md). Run `npm run dev:server` and `npm run dev:client` in separate terminals. Open `http://localhost:5173`. Vite forwards `/api` and `/socket.io` to Express on port `5000`, so keep `CLIENT_URL=http://localhost:5173` and `PORT=5000` with the default Vite settings.

Use Razorpay test keys for local checkout and Mailpit for local email. Leaving `SMTP_HOST` empty enables the local email-verification link described below.

## Production configuration

Set the backend variables from [the production template](.env.production.example) in your hosting provider's environment settings. For a self-hosted deployment, you can copy the template to `server/.env.production` and fill it in there. Server process variables take precedence over file values. Git ignores the real environment files.

| Variable | Production value |
| --- | --- |
| `CLIENT_URL` | The public frontend origin, such as `https://pizza.example.com`. Express and Socket.IO use it for CORS, and account emails use it for links. |
| `MONGODB_URI` | A separate production MongoDB database on a replica set, such as MongoDB Atlas. Orders use transactions. |
| `JWT_SECRET` | A unique random secret of at least 32 characters. Generate it with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. |
| `PORT` | The port supplied by your hosting provider, or `5000` by default. |

Configure SMTP for registration and password recovery, and configure `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` for checkout. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` to create the initial administrator. The password must have at least eight characters.

From the root, run `npm run build`, deploy `client/dist` as static files, and start the backend with `npm start`. The start command selects production and reads only the production environment file when present. Configure the frontend host to serve `index.html` for client routes and forward `/api` and `/socket.io` to Express as described above. Keep backend credentials in the server environment. Vite variables prefixed with `VITE_` are public and embedded at build time.

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
