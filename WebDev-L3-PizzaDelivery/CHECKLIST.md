# 🍕 Pizza Delivery Full-Stack Application

## 🎯 Objective
Build a production-grade, full-stack pizza ordering and inventory management platform with separate **Admin** and **User** roles, real-time order tracking, payment integration, and automated stock notifications.

---

## 🛠️ Tech Stack

| Component | Technology |
| :--- | :--- |
| **Frontend** | React.js |
| **Backend** | Node.js + Express.js |
| **Database** | MongoDB |
| **Payment** | Razorpay *(test mode)* |

---

## ✅ Feature Checklist

Audit on 2026-11-27. Checked items have a complete implementation for the checklist requirement in the repository. Unchecked items include any remaining work. Local verification results and development priorities are in the [implementation plan](docs/IMPLEMENTATION_PLAN.md).

### 👤 User Side
- [x] User registration with email verification. The flow includes expiring links and a resend action. [Auth routes](server/src/routes/auth.routes.ts)
- [x] User login with JWT-based authorisation. [Auth middleware](server/src/middleware/auth.ts)
- [ ] Forgot password flow *(email reset link)*. The API issues and accepts reset tokens. The email needs a clickable URL, and the client needs recovery and reset pages. [Auth routes](server/src/routes/auth.routes.ts)
- [ ] Dashboard displaying available pizza varieties. The home page displays ingredient options for custom pizzas. A menu of available pizza varieties is pending. [App](client/src/App.tsx)
- [ ] Custom pizza builder flow. Ingredient sections share a single screen. Finish the four-step flow and vegetable multi-select. [App](client/src/App.tsx)
  - [x] **Step 1:** Choose a pizza base *(5 options seeded)*.
  - [x] **Step 2:** Choose a sauce *(5 options seeded)*.
  - [x] **Step 3:** Choose a cheese type.
  - [ ] **Step 4:** Choose vegetables *(multiple select)*. The current selection stores one vegetable.
- [x] Order summary page before payment. The order details page shows the ingredients and total before opening checkout. [Tracking page](client/src/pages/TrackingPage.tsx)
- [ ] Razorpay checkout integration *(test mode — clicking "Success" confirms the order)*. Checkout and signature verification are implemented. Bind verification to the order’s stored Razorpay ID, make confirmation idempotent, and verify the test-mode flow. [Payment routes](server/src/routes/payment.routes.ts)
- [ ] Real-time order status display on user dashboard (`Order Received` → `In Kitchen` → `Sent to Delivery`). The order details page updates via Socket.IO and polling. The orders list fetches once. [App](client/src/App.tsx), [tracking page](client/src/pages/TrackingPage.tsx)

---

### 🛡️ Admin Side
- [ ] Separate admin login *(not accessible from the user registration flow)*. Admin accounts are seeded separately, and admin routes check the role. Both roles still share the same login page and endpoint. [Server](server/src/server.ts), [app](client/src/App.tsx)
- [x] Inventory dashboard showing current stock of **pizza bases**, **sauces**, **cheeses**, and **vegetables**. [Admin page](client/src/pages/AdminPage.tsx)
- [ ] Stock automatically decremented after each order. Order creation reserves stock in a transaction. A failed or abandoned payment needs to release its reservation. [Order routes](server/src/routes/order.routes.ts)
- [x] Manual stock update capability for each inventory item. [Admin page](client/src/pages/AdminPage.tsx), [admin routes](server/src/routes/admin.routes.ts)
- [x] Automated email notification to admin when inventory falls below a configurable threshold. An hourly `node-cron` job sends a grouped email using per-item thresholds and configured SMTP. [Low-stock job](server/src/jobs/lowStock.ts)
- [x] Order management panel to view incoming orders and update their status. The API validates transitions and records status history. [Admin page](client/src/pages/AdminPage.tsx), [admin routes](server/src/routes/admin.routes.ts)
- [ ] Status change reflected in real-time on the user's dashboard *(use polling or WebSockets)*. Admin updates trigger refreshes on the order details page. Add list refresh and restrict Socket.IO rooms to authorised viewers. [Admin routes](server/src/routes/admin.routes.ts), [server](server/src/server.ts)
