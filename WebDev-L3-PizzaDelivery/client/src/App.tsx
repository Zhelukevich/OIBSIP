import { useEffect, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { api } from "./services/api";
import type { InventoryItem, Order, User } from "./types";
import { AuthPage } from "./pages/AuthPage";
import { AdminPage } from "./pages/AdminPage";
import { TrackingPage } from "./pages/TrackingPage";
import { VerifyEmailPage } from "./pages/VerifyEmailPage";
import { BuilderPage } from "./pages/BuilderPage";
import { CheckoutPage } from "./pages/CheckoutPage";
import { BagIcon, StorefrontPage } from "./pages/StorefrontPage";
import { getCartOrder, readCart, saveCart, updateCart } from "./storefront";
import type { CartLine, PizzaSelection } from "./storefront";
import "./styles/storefront.css";

function Shell({ user, cartCount, onLogout, children }: { user: User | null; cartCount: number; onLogout: () => void; children: React.ReactNode }) {
  return (
    <div className="store-shell">
      <header className="store-header">
        <div className="store-container store-header__inner">
          <Link to="/" className="store-brand" aria-label="Slice Pizza home">slice<span>.</span></Link>
          <nav className="store-nav" aria-label="Menu">
            <Link to="/#menu">Menu</Link>
            <Link to="/build">Build your own</Link>
          </nav>
          <nav className="store-account" aria-label="Account and cart">
            {user && <Link to="/orders">My orders</Link>}
            {user?.role === "admin" && <Link to="/admin">Admin</Link>}
            {user ? (
              <button onClick={onLogout}>Sign out</button>
            ) : (
              <Link to="/login">Sign in</Link>
            )}
            <Link to="/checkout" className="store-cart-link" aria-label={`Cart, ${cartCount} ${cartCount === 1 ? "pizza" : "pizzas"}`}>
              <BagIcon /><span>Cart</span><strong>{cartCount}</strong>
            </Link>
            <span className="sr-only" role="status">{cartCount} {cartCount === 1 ? "pizza" : "pizzas"} in your cart</span>
          </nav>
        </div>
      </header>
      {children}
      <footer className="store-footer">
        <div className="store-container">
          <Link to="/" className="store-brand" aria-label="Slice Pizza home">slice<span>.</span></Link>
          <Link className="store-text-link" to="/#menu">Menu</Link>
        </div>
      </footer>
    </div>
  );
}

function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  useEffect(() => {
    api.get("/orders/mine").then(({ data }) => setOrders(data.orders));
  }, []);
  return (
    <main className="mx-auto max-w-[1200px] px-5 py-10">
      <h1 className="mb-6 text-heading font-bold">My orders</h1>
      <div className="grid gap-4">
        {orders.map((order) => (
          <Link key={order._id} to={`/orders/${order._id}`} className="rounded-cards border border-hairline bg-paper-white p-5">
            <div className="flex justify-between"><strong>Order #{order._id.slice(-6)}</strong><span>{order.status.replaceAll("_", " ")}</span></div>
            <div className="mt-2 text-sm text-smoke">₹{order.total}</div>
          </Link>
        ))}
        {!orders.length && <p className="text-smoke">No orders yet.</p>}
      </div>
    </main>
  );
}

export function App() {
  const location = useLocation();
  const [cart, setCart] = useState(readCart);
  const [catalog, setCatalog] = useState<InventoryItem[] | null>(null);
  const [catalogError, setCatalogError] = useState(false);
  const [catalogRevision, setCatalogRevision] = useState(0);
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem("pizza_user");
    return saved ? JSON.parse(saved) : null;
  });

  function onAuth(nextUser: User, token: string) {
    localStorage.setItem("pizza_token", token);
    localStorage.setItem("pizza_user", JSON.stringify(nextUser));
    setUser(nextUser);
  }
  function logout() {
    localStorage.removeItem("pizza_token");
    localStorage.removeItem("pizza_user");
    setUser(null);
  }

  useEffect(() => {
    if (location.hash === "#menu") document.getElementById("menu")?.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [location.pathname, location.hash, location.key]);

  useEffect(() => { saveCart(cart); }, [cart]);

  useEffect(() => {
    const controller = new AbortController();
    api.get<{ items: InventoryItem[] }>("/catalog", { signal: controller.signal })
      .then(({ data }) => {
        if (!Array.isArray(data.items)) throw new Error("Invalid catalog");
        if (!controller.signal.aborted) setCatalog(data.items);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setCatalog(null);
          setCatalogError(true);
        }
      });
    return () => controller.abort();
  }, [catalogRevision]);

  function refreshCatalog() {
    setCatalogError(false);
    setCatalogRevision((revision) => revision + 1);
  }

  function canAdd(pizza: PizzaSelection) {
    return Boolean(catalog && getCartOrder(updateCart(cart, pizza, 1), catalog));
  }

  function changeCart(pizza: PizzaSelection, amount: number) {
    setCart((current) => {
      const next = updateCart(current, pizza, amount);
      return amount < 0 || (catalog && getCartOrder(next, catalog)) ? next : current;
    });
  }

  function onOrdered(ordered: CartLine[]) {
    setCart((current) => ordered.reduce((remaining, { pizza, quantity }) => updateCart(remaining, pizza, -quantity), current));
    refreshCatalog();
  }

  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <Shell user={user} cartCount={cartCount} onLogout={logout}>
      <Routes>
        <Route path="/" element={<StorefrontPage catalog={catalog} catalogError={catalogError} onRetry={refreshCatalog} canAdd={canAdd} onAdd={(pizza) => changeCart(pizza, 1)} />} />
        <Route path="/build" element={<BuilderPage catalog={catalog} catalogError={catalogError} onRetry={refreshCatalog} canAdd={canAdd} onAdd={(pizza) => changeCart(pizza, 1)} />} />
        <Route path="/checkout" element={<CheckoutPage cart={cart} catalog={catalog} catalogError={catalogError} user={user} onChange={changeCart} onOrdered={onOrdered} onRetry={refreshCatalog} />} />
        <Route path="/login" element={<AuthPage key="login" mode="login" onAuth={onAuth} />} />
        <Route path="/register" element={<AuthPage key="register" mode="register" onAuth={onAuth} />} />
        <Route path="/verify-email" element={<VerifyEmailPage signedIn={Boolean(user)} />} />
        <Route path="/orders" element={user ? <OrdersPage /> : <Navigate to="/login" />} />
        <Route path="/orders/:id" element={user ? <TrackingPage /> : <Navigate to="/login" />} />
        <Route path="/admin" element={user?.role === "admin" ? <AdminPage /> : <Navigate to="/" />} />
      </Routes>
    </Shell>
  );
}
