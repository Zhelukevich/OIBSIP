import { lazy, Suspense, useEffect, useState } from "react";
import { Link, matchPath, NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { api } from "./services/api";
import type { InventoryItem, User } from "./types";
import { BuilderPage } from "./pages/BuilderPage";
import { CheckoutPage } from "./pages/CheckoutPage";
import { StorefrontPage } from "./pages/StorefrontPage";
import { BagIcon } from "./components/BagIcon";
import { PageContainer } from "./components/PageContainer";
import { getCartOrder, readCart, saveCart, updateCart } from "./storefront";
import type { CartLine, PizzaSelection } from "./storefront";
import "./styles/storefront.css";

const AuthPage = lazy(() => import("./pages/AuthPage").then(({ AuthPage }) => ({ default: AuthPage })));
const VerifyEmailPage = lazy(() => import("./pages/VerifyEmailPage").then(({ VerifyEmailPage }) => ({ default: VerifyEmailPage })));
const ForgotPasswordPage = lazy(() => import("./pages/PasswordRecoveryPage").then(({ ForgotPasswordPage }) => ({ default: ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import("./pages/PasswordRecoveryPage").then(({ ResetPasswordPage }) => ({ default: ResetPasswordPage })));
const OrdersPage = lazy(() => import("./pages/OrdersPage").then(({ OrdersPage }) => ({ default: OrdersPage })));
const TrackingPage = lazy(() => import("./pages/TrackingPage").then(({ TrackingPage }) => ({ default: TrackingPage })));
const AdminPage = lazy(() => import("./pages/AdminPage").then(({ AdminPage }) => ({ default: AdminPage })));

function Wordmark() {
  return (
    <Link to="/" className="store-brand" aria-label="Slice Pizza home">
      <span className="store-brand__mark" aria-hidden="true" />
      <span>slice<span className="store-brand__dot">.</span></span>
    </Link>
  );
}

function Shell({ user, cartCount, onLogout, children }: { user: User | null; cartCount: number; onLogout: () => void; children: React.ReactNode }) {
  const { pathname } = useLocation();
  return (
    <div className="store-shell">
      <a className="store-skip-link" href="#main-content" onClick={(event) => {
        const main = document.getElementById("main-content");
        if (!main) return;
        event.preventDefault();
        main.focus();
      }}>Skip to content</a>
      <header className="store-header">
        <PageContainer as="div" className="store-header__inner">
          <Wordmark />
          <nav className="store-nav" aria-label="Menu">
            <Link to="/#menu" aria-current={pathname === "/" ? "page" : undefined}>Menu</Link>
            <NavLink to="/build">Build your own</NavLink>
          </nav>
          <nav className="store-account" aria-label="Account and cart">
            {user ? (
              <AccountMenu isAdmin={user.role === "admin"} onLogout={onLogout} />
            ) : (
              <NavLink to="/login">Sign in</NavLink>
            )}
            <NavLink to="/checkout" className="store-cart-link" aria-label={`Cart, ${cartCount} ${cartCount === 1 ? "pizza" : "pizzas"}`}>
              <BagIcon /><span>Cart</span><strong key={cartCount}>{cartCount}</strong>
            </NavLink>
            <span className="sr-only" role="status">{cartCount} {cartCount === 1 ? "pizza" : "pizzas"} in your cart</span>
          </nav>
        </PageContainer>
      </header>
      {children}
      <footer className="store-footer">
        <PageContainer as="div" className="store-footer__inner">
          <Wordmark />
          <Link className="action-link" to="/#menu">Menu</Link>
        </PageContainer>
      </footer>
    </div>
  );
}

function AccountMenu({ isAdmin, onLogout }: { isAdmin: boolean; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <details className="store-account-menu" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          setOpen(false);
          event.currentTarget.querySelector("summary")?.focus();
        }
      }}>
      <summary>Account</summary>
      <div className="store-account-menu__panel">
        <NavLink to="/orders" onClick={() => setOpen(false)}>My orders</NavLink>
        {isAdmin && <NavLink to="/admin" onClick={() => setOpen(false)}>Admin</NavLink>}
        <button type="button" onClick={onLogout}>Sign out</button>
      </div>
    </details>
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
    if (location.hash === "#menu") {
      document.getElementById("menu-title")?.focus({ preventScroll: true });
      document.getElementById("menu")?.scrollIntoView();
    } else {
      window.scrollTo(0, 0);
    }
  }, [location.pathname, location.hash, location.key]);

  useEffect(() => { saveCart(cart); }, [cart]);

  useEffect(() => {
    if (!["/", "/build", "/checkout"].some((path) => matchPath(path, location.pathname))) return;

    setCatalog(null);
    setCatalogError(false);
    const controller = new AbortController();
    api.get<{ items: InventoryItem[] }>("/catalog", { signal: controller.signal })
      .then(({ data }) => {
        if (!Array.isArray(data.items)) throw new Error("Invalid catalog");
        if (!controller.signal.aborted) setCatalog(data.items);
      })
      .catch(() => {
        if (!controller.signal.aborted) setCatalogError(true);
      });
    return () => controller.abort();
  }, [catalogRevision, location.pathname]);

  function refreshCatalog() {
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
      <Suspense fallback={<PageContainer className="py-8"><p role="status">Loading page…</p></PageContainer>}>
        <Routes>
          <Route path="/" element={<StorefrontPage cart={cart} catalog={catalog} catalogError={catalogError} onRetry={refreshCatalog} canAdd={canAdd} onAdd={(pizza) => changeCart(pizza, 1)} />} />
          <Route path="/build" element={<BuilderPage catalog={catalog} catalogError={catalogError} onRetry={refreshCatalog} canAdd={canAdd} onAdd={(pizza) => changeCart(pizza, 1)} />} />
          <Route path="/checkout" element={<CheckoutPage cart={cart} catalog={catalog} catalogError={catalogError} user={user} onChange={changeCart} onOrdered={onOrdered} onRetry={refreshCatalog} />} />
          <Route path="/login" element={<AuthPage key="login" mode="login" onAuth={onAuth} />} />
          <Route path="/register" element={<AuthPage key="register" mode="register" onAuth={onAuth} />} />
          <Route path="/verify-email" element={<VerifyEmailPage signedIn={Boolean(user)} />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage key={location.hash} />} />
          <Route path="/orders" element={user ? <OrdersPage /> : <Navigate to="/login" />} />
          <Route path="/orders/:id" element={user ? <TrackingPage /> : <Navigate to="/login" />} />
          <Route path="/admin" element={user?.role === "admin" ? <AdminPage /> : <Navigate to={user ? "/" : "/login"} replace />} />
        </Routes>
      </Suspense>
    </Shell>
  );
}
