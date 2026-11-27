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
- [x] Forgot password flow *(email reset link)*. Users can request a clickable, single-use link that expires after one hour and choose a new password. [Auth routes](server/src/routes/auth.routes.ts), [recovery pages](client/src/pages/PasswordRecoveryPage.tsx)
- [x] Dashboard displaying available pizza varieties. The home page shows three ready-made pizzas with prices and availability based on ingredient stock. Customers can add available pizzas to the cart or open the custom pizza builder. [Storefront](client/src/pages/StorefrontPage.tsx)
- [x] Custom pizza builder flow. The dedicated page guides customers through four steps and shows the recipe and running total before adding the pizza to the cart. [Builder page](client/src/pages/BuilderPage.tsx)
  - [x] **Step 1:** Choose a pizza base *(5 options seeded)*.
  - [x] **Step 2:** Choose a sauce *(5 options seeded)*.
  - [x] **Step 3:** Choose a cheese type.
  - [x] **Step 4:** Choose vegetables *(multiple select)*.
- [x] Order summary page before payment. The order details page shows the ingredients and total before opening checkout. [Tracking page](client/src/pages/TrackingPage.tsx)
- [ ] Razorpay checkout integration *(test mode — clicking "Success" confirms the order)*. Retries reuse the stored Razorpay order, and signature verification updates the order once. Verify the test-mode flow. [Payment routes](server/src/routes/payment.routes.ts)
- [x] Real-time order status display on user dashboard (`Order Received` → `In Kitchen` → `Sent to Delivery`). The order details page updates via Socket.IO and polling. The orders list refreshes every 15 seconds after each request completes. [Orders list](client/src/pages/OrdersPage.tsx), [tracking page](client/src/pages/TrackingPage.tsx)

---

### 🛡️ Admin Side
- [x] Admin accounts are seeded separately, public registration creates customer accounts, and admin routes check the role. Customers and administrators sign in through the shared login page and endpoint. [Server](server/src/server.ts), [app](client/src/App.tsx)
- [x] Inventory dashboard showing current stock of **pizza bases**, **sauces**, **cheeses**, and **vegetables**. [Admin page](client/src/pages/AdminPage.tsx)
- [x] Stock automatically decremented after each order. Order creation reserves stock in a transaction. Failed or abandoned payments release reserved stock after 15 minutes. [Order service](server/src/services/orders.ts), [reservation job](server/src/jobs/reservations.ts)
- [x] Manual stock update capability for each inventory item. [Admin page](client/src/pages/AdminPage.tsx), [admin routes](server/src/routes/admin.routes.ts)
- [x] Automated email notification to admin when inventory falls below a configurable threshold. An hourly `node-cron` job sends a grouped email using per-item thresholds and configured SMTP. [Low-stock job](server/src/jobs/lowStock.ts)
- [x] Order management panel to view incoming orders and update their status. The API validates transitions and records status history. [Admin page](client/src/pages/AdminPage.tsx), [admin routes](server/src/routes/admin.routes.ts)
- [x] Status changes appear on the user's dashboard. Admin updates trigger refreshes on the order details page, and Socket.IO checks order ownership or admin access before each subscription. The orders list polls for updated statuses. [Orders list](client/src/pages/OrdersPage.tsx), [admin routes](server/src/routes/admin.routes.ts), [order sockets](server/src/realtime/orders.ts)
