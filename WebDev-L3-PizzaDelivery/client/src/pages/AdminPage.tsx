import { useEffect, useState } from "react";
import { Button } from "../components/Button";
import { fieldControlClass, FormField } from "../components/FormField";
import { PageContainer } from "../components/PageContainer";
import { api, apiErrorMessage } from "../services/api";
import type { InventoryItem, Order } from "../types";

function StockField({ label, savedValue, onSave }: {
  label: string;
  savedValue: number;
  onSave: (value: number) => Promise<void>;
}) {
  const [draft, setDraft] = useState(() => String(savedValue));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(value: number) {
    if (saving) return;
    if (!Number.isSafeInteger(value) || value < 0) {
      setError("Enter a whole number of 0 or more.");
      return;
    }
    setDraft(String(value));
    setError("");
    if (value === savedValue) return;

    setSaving(true);
    try {
      await onSave(value);
    } catch (caught) {
      setError(apiErrorMessage(caught, "Could not save. Edit the value or leave the field to try again."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-30">
      <FormField
        label={label}
        type="number"
        min={0}
        step={1}
        value={draft}
        readOnly={saving}
        error={error}
        onChange={(event) => {
          setDraft(event.currentTarget.value);
          setError("");
        }}
        onBlur={(event) => void save(event.currentTarget.valueAsNumber)}
      />
      {saving && <p className="mt-1 text-sm text-muted" role="status">Saving…</p>}
    </div>
  );
}

export function AdminPage() {
  const [tab, setTab] = useState<"inventory" | "orders">("inventory");
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");

  async function load() {
    try {
      const [inventory, orderData] = await Promise.all([
        api.get<{ items: InventoryItem[] }>("/admin/inventory"),
        api.get<{ orders: Order[] }>("/admin/orders"),
      ]);
      setItems(inventory.data.items);
      setOrders(orderData.data.orders);
    } catch {
      setError("Could not load admin data");
    }
  }

  useEffect(() => { void load(); }, []);

  async function updateItem(id: string, field: "quantity" | "threshold", value: number) {
    const { data } = await api.patch<{ item: InventoryItem }>(`/admin/inventory/${id}`, { [field]: value });
    setItems((current) => current.map((item) => (
      item._id === id ? { ...item, [field]: data.item[field] } : item
    )));
  }

  async function updateStatus(id: string, status: string) {
    setError("");
    try {
      const { data } = await api.patch<{ order: Order }>(`/admin/orders/${id}/status`, { status });
      setOrders((current) => current.map((order) => (
        order._id === id ? { ...order, status: data.order.status, statusHistory: data.order.statusHistory } : order
      )));
    } catch (caught) {
      setError(apiErrorMessage(caught, "Could not update status"));
    }
  }

  return (
    <PageContainer className="py-10">
      <h1 className="mb-6 text-heading font-bold">Admin dashboard</h1>
      <div className="mb-6 flex gap-2">
        <Button variant={tab === "inventory" ? "primary" : "outline"} aria-pressed={tab === "inventory"} onClick={() => setTab("inventory")}>Inventory</Button>
        <Button variant={tab === "orders" ? "primary" : "outline"} aria-pressed={tab === "orders"} onClick={() => setTab("orders")}>Orders</Button>
      </div>
      {error && <p className="mb-4 text-danger" role="alert">{error}</p>}
      {tab === "inventory" ? (
        <div className="grid gap-3">
          {items.map((item) => (
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-cards border border-line bg-surface p-4" key={item._id}>
              <div><strong>{item.name}</strong><span className="ml-2 text-sm text-muted">{item.type}</span></div>
              <div className="flex flex-wrap items-start gap-2">
                <StockField label="Stock" savedValue={item.quantity} onSave={(value) => updateItem(item._id, "quantity", value)} />
                <StockField label="Threshold" savedValue={item.threshold} onSave={(value) => updateItem(item._id, "threshold", value)} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-3">
          {orders.map((order) => (
            <div className="rounded-cards border border-line bg-surface p-4" key={order._id}>
              <div className="flex flex-wrap justify-between gap-3">
                <div><strong>#{order._id.slice(-6)}</strong><span className="ml-3 text-sm text-muted">{typeof order.user === "object" ? order.user.name : ""}</span></div>
                <div className="w-48">
                  <select
                    className={fieldControlClass}
                    aria-label={`Status of order ${order._id.slice(-6)}`}
                    value={order.status}
                    onChange={(event) => void updateStatus(order._id, event.target.value)}
                  >
                    {["AWAITING_PAYMENT", "RECEIVED", "IN_KITCHEN", "SENT_TO_DELIVERY", "DELIVERED", "CANCELLED"].map((status) => (
                      <option key={status} value={status}>{status.replaceAll("_", " ")}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
