import { useEffect, useState } from "react";
import { api } from "../services/api";
import type { InventoryItem, Order } from "../types";

export function AdminPage() {
  const [tab, setTab] = useState<"inventory" | "orders">("inventory");
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");

  async function load() {
    try {
      const [inventory, orderData] = await Promise.all([
        api.get("/admin/inventory"),
        api.get("/admin/orders"),
      ]);
      setItems(inventory.data.items);
      setOrders(orderData.data.orders);
    } catch {
      setError("Could not load admin data");
    }
  }

  useEffect(() => { void load(); }, []);

  async function updateItem(id: string, changes: Partial<InventoryItem>) {
    await api.patch(`/admin/inventory/${id}`, changes);
    await load();
  }

  async function updateStatus(id: string, status: string) {
    try {
      await api.patch(`/admin/orders/${id}/status`, { status });
      await load();
    } catch (caught) {
      setError((caught as { response?: { data?: { message?: string } } }).response?.data?.message || "Could not update status");
    }
  }

  return (
    <main className="mx-auto max-w-[1200px] px-5 py-10">
      <h1 className="mb-6 text-heading font-bold">Admin dashboard</h1>
      <div className="mb-6 flex gap-2">
        <button className={`rounded-buttons px-5 py-2 ${tab === "inventory" ? "bg-indigo-bolt text-white" : "border border-hairline"}`} onClick={() => setTab("inventory")}>Inventory</button>
        <button className={`rounded-buttons px-5 py-2 ${tab === "orders" ? "bg-indigo-bolt text-white" : "border border-hairline"}`} onClick={() => setTab("orders")}>Orders</button>
      </div>
      {error && <p className="form-error mb-4">{error}</p>}
      {tab === "inventory" ? (
        <div className="grid gap-3">
          {items.map((item) => (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-cards border border-hairline bg-paper-white p-4" key={item._id}>
              <div><strong>{item.name}</strong><span className="ml-2 text-sm text-smoke">{item.type}</span></div>
              <div className="flex items-center gap-2">
                <label className="text-sm">Stock
                  <input className="admin-input" type="number" defaultValue={item.quantity} onBlur={(event) => updateItem(item._id, { quantity: Number(event.target.value) })} />
                </label>
                <label className="text-sm">Threshold
                  <input className="admin-input" type="number" defaultValue={item.threshold} onBlur={(event) => updateItem(item._id, { threshold: Number(event.target.value) })} />
                </label>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-3">
          {orders.map((order) => (
            <div className="rounded-cards border border-hairline bg-paper-white p-4" key={order._id}>
              <div className="flex flex-wrap justify-between gap-3">
                <div><strong>#{order._id.slice(-6)}</strong><span className="ml-3 text-sm text-smoke">{typeof order.user === "object" ? order.user.name : ""}</span></div>
                <select className="admin-input" value={order.status} onChange={(event) => updateStatus(order._id, event.target.value)}>
                  {["AWAITING_PAYMENT", "RECEIVED", "IN_KITCHEN", "SENT_TO_DELIVERY", "DELIVERED", "CANCELLED"].map((status) => (
                    <option key={status} value={status}>{status.replaceAll("_", " ")}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
