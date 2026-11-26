import { useEffect, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "./services/api";
import type { InventoryItem, Order, User } from "./types";
import { AdminPage } from "./pages/AdminPage";
import { TrackingPage } from "./pages/TrackingPage";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
const registerSchema = loginSchema.extend({
  name: z.string().trim().min(2),
});

function Shell({ user, onLogout, children }: { user: User | null; onLogout: () => void; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-warm-bone">
      <header className="border-b border-hairline bg-paper-white">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-5 py-4">
          <Link to="/" className="font-script text-4xl text-ember-orange">Slice</Link>
          <nav className="flex items-center gap-4 text-sm font-medium">
            {user && <Link to="/orders">My orders</Link>}
            {user?.role === "admin" && <Link to="/admin">Admin</Link>}
            {user ? (
              <button className="rounded-buttons border border-hairline px-4 py-2" onClick={onLogout}>Sign out</button>
            ) : (
              <Link className="rounded-buttons bg-indigo-bolt px-4 py-2 text-white" to="/login">Sign in</Link>
            )}
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}

function AuthPage({ mode, onAuth }: { mode: "login" | "register"; onAuth: (user: User, token: string) => void }) {
  const navigate = useNavigate();
  const register = mode === "register";
  const schema = register ? registerSchema : loginSchema;
  const { register: field, handleSubmit, formState: { errors } } = useForm<{ name: string; email: string; password: string }>();
  const [error, setError] = useState("");

  async function submit(values: { name: string; email: string; password: string }) {
    setError("");
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      setError("Please check the entered details");
      return;
    }
    try {
      if (register) {
        await api.post("/auth/register", parsed.data);
        navigate("/login");
        return;
      }
      const { data } = await api.post("/auth/login", parsed.data);
      onAuth(data.user, data.token);
      navigate(data.user.role === "admin" ? "/admin" : "/");
    } catch (caught) {
      setError((caught as { response?: { data?: { message?: string } } }).response?.data?.message || "Request failed");
    }
  }

  return (
    <main className="mx-auto max-w-md px-5 py-16">
      <form className="rounded-cards bg-paper-white p-8 shadow-sm" onSubmit={handleSubmit(submit)}>
        <h1 className="mb-6 text-heading-sm font-bold">{register ? "Create account" : "Welcome back"}</h1>
        {register && (
          <label className="form-label">Name
            <input className="form-input" {...field("name")} />
          </label>
        )}
        <label className="form-label">Email
          <input className="form-input" type="email" {...field("email")} />
        </label>
        <label className="form-label">Password
          <input className="form-input" type="password" {...field("password")} />
        </label>
        {"name" in errors && errors.name && <p className="form-error">Enter at least 2 characters</p>}
        {errors.email && <p className="form-error">Enter a valid email</p>}
        {errors.password && <p className="form-error">Password must contain at least 8 characters</p>}
        {error && <p className="form-error">{error}</p>}
        <button className="mt-5 w-full rounded-buttons bg-indigo-bolt px-5 py-3 font-bold text-white">
          {register ? "Register" : "Sign in"}
        </button>
        <Link className="mt-5 block text-center text-sm text-indigo-bolt" to={register ? "/login" : "/register"}>
          {register ? "Already have an account?" : "Create a new account"}
        </Link>
      </form>
    </main>
  );
}

function Builder({ user }: { user: User | null }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/catalog").then(({ data }) => setItems(data.items)).catch(() => setError("Could not load catalog"));
  }, []);

  async function checkout() {
    if (!user) return navigate("/login");
    const types = ["base", "sauce", "cheese", "vegetable"];
    if (types.some((type) => !selected[type])) {
      setError("Choose a base, sauce, cheese, and at least one vegetable");
      return;
    }
    setLoading(true);
    try {
      const ingredientIds = Object.values(selected).filter(Boolean);
      const { data } = await api.post("/orders", {
        ingredients: ingredientIds.map((inventoryItem) => ({ inventoryItem })),
      });
      const order = data.order as Order;
      if (!order?._id) throw new Error("Order creation failed");
      navigate(`/orders/${order._id}`);
    } catch (caught) {
      setError((caught as { response?: { data?: { message?: string } } }).response?.data?.message || "Could not create order");
    } finally {
      setLoading(false);
    }
  }

  const types: InventoryItem["type"][] = ["base", "sauce", "cheese", "vegetable"];
  return (
    <main className="mx-auto max-w-[1200px] px-5 py-10">
      <section className="mb-10 rounded-hero bg-lavender-mist p-8 md:p-12">
        <p className="mb-2 text-sm font-bold uppercase tracking-widest text-indigo-bolt">Made by you</p>
        <h1 className="max-w-xl text-heading font-bold">Build your perfect pizza</h1>
      </section>
      {types.map((type) => (
        <section className="mb-8" key={type}>
          <h2 className="mb-4 text-heading-sm font-bold capitalize">{type}</h2>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            {items.filter((item) => item.type === type).map((item) => (
              <button
                key={item._id}
                type="button"
                onClick={() => setSelected((current) => ({ ...current, [type]: item._id }))}
                className={`rounded-cards border p-4 text-left ${selected[type] === item._id ? "border-indigo-bolt ring-2 ring-indigo-bolt/20" : "border-hairline"}`}
                disabled={item.quantity < 1}
              >
                <span className="block font-bold">{item.name}</span>
                <span className="text-sm text-smoke">{item.quantity} available</span>
              </button>
            ))}
          </div>
        </section>
      ))}
      {error && <p className="form-error mb-4">{error}</p>}
      <button className="rounded-buttons bg-ember-orange px-7 py-4 font-bold text-white" onClick={checkout} disabled={loading}>
        {loading ? "Creating order..." : "Review & order"}
      </button>
    </main>
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

  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);

  return (
    <Shell user={user} onLogout={logout}>
      <Routes>
        <Route path="/" element={<Builder user={user} />} />
        <Route path="/login" element={<AuthPage key="login" mode="login" onAuth={onAuth} />} />
        <Route path="/register" element={<AuthPage key="register" mode="register" onAuth={onAuth} />} />
        <Route path="/orders" element={user ? <OrdersPage /> : <Navigate to="/login" />} />
        <Route path="/orders/:id" element={user ? <TrackingPage /> : <Navigate to="/login" />} />
        <Route path="/admin" element={user?.role === "admin" ? <AdminPage /> : <Navigate to="/" />} />
      </Routes>
    </Shell>
  );
}
