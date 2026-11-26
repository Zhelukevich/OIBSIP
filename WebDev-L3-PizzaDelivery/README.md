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

Copy `.env.example` to `.env` and configure MongoDB, JWT, email, and Razorpay values.
