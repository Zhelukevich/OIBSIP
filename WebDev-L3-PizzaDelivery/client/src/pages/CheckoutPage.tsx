import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, apiErrorMessage } from "../services/api";
import { describePizza, formatPrice, getCartOrder, pizzaKey, updateCart } from "../storefront";
import type { CartLine, PizzaSelection } from "../storefront";
import type { InventoryItem, Order, User } from "../types";
import { BagIcon } from "../components/BagIcon";
import { Button, ButtonLink } from "../components/Button";
import { PageContainer } from "../components/PageContainer";

export function CheckoutPage({ cart, catalog, catalogError, user, onChange, onOrdered, onRetry }: {
  cart: CartLine[];
  catalog: InventoryItem[] | null;
  catalogError: boolean;
  user: User | null;
  onChange: (pizza: PizzaSelection, amount: number) => void;
  onOrdered: (ordered: CartLine[]) => void;
  onRetry: () => void;
}) {
  const navigate = useNavigate();
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lines = cart.map((line) => ({ ...line, ...describePizza(line.pizza, catalog ?? []) }));
  const total = lines.reduce((sum, line) => sum + line.quantity * line.price, 0);
  const ingredients = catalog && getCartOrder(cart, catalog);

  async function placeOrder() {
    if (inFlight.current || !ingredients?.length || !user?.emailVerified) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post<{ order: Order }>("/orders", { ingredients });
      if (!data.order?._id) throw new Error("Order creation failed");
      onOrdered(cart);
      navigate(`/orders/${data.order._id}`);
    } catch (caught) {
      setError(apiErrorMessage(caught, "Could not create your order. Please try again."));
      onRetry();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <PageContainer className="checkout">
      <Link className="action-link" to="/#menu"><span aria-hidden="true">←</span> Back to menu</Link>
      <h1 className="counter-title">Your cart</h1>
      {!lines.length ? (
        <section className="checkout-empty counter-panel">
          <BagIcon />
          <h2>Your cart is empty</h2>
          <ButtonLink to="/#menu">Browse pizzas <span aria-hidden="true">→</span></ButtonLink>
        </section>
      ) : (
        <div className="checkout-grid">
          <ul className="checkout-lines" aria-label="Pizzas in your cart">
            {lines.map((line) => (
              <li key={pizzaKey(line.pizza)} className="checkout-line counter-panel">
                {line.image && <img src={line.image} alt="" width="104" height="84" />}
                <div className="checkout-line__content">
                  <h2>{line.name}</h2>
                  {line.details && <p>{line.details}</p>}
                  <div className="checkout-line__actions">
                    <div className="checkout-quantity" role="group" aria-label={`Quantity for ${line.name}`}>
                      <button disabled={busy} onClick={() => onChange(line.pizza, -1)} aria-label={line.quantity === 1 ? `Remove ${line.name}` : `Decrease ${line.name} quantity`}>−</button>
                      <span>{line.quantity}</span>
                      <button disabled={busy || !catalog || !getCartOrder(updateCart(cart, line.pizza, 1), catalog)} onClick={() => onChange(line.pizza, 1)} aria-label={`Increase ${line.name} quantity`}>+</button>
                    </div>
                    <strong>{formatPrice(line.quantity * line.price)}</strong>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <section className="checkout-summary counter-panel" aria-labelledby="summary-title">
            <h2 id="summary-title">Order summary</h2>
            <p className="checkout-total"><span>Total</span><strong>{formatPrice(total)}</strong></p>
            <p className="checkout-next">
              {!user ? "Sign in to continue with this cart." : !user.emailVerified ? "Confirm your email before you pay." : "Review your order, then continue to secure payment."}
            </p>
            {catalog && !ingredients && <p className="store-notice" role="alert">Some ingredients are out of stock. Adjust your cart to continue.</p>}
            {!catalog && (catalogError ? (
              <p className="store-notice" role="alert">We couldn’t check availability. <button className="action-link" onClick={onRetry}>Try again</button></p>
            ) : <p role="status">Checking availability…</p>)}
            {error && <p className="store-notice" role="alert">{error}</p>}
            {!user ? (
              <ButtonLink className="w-full" to="/login" state={{ returnTo: "/checkout" }}>Sign in to continue <span aria-hidden="true">→</span></ButtonLink>
            ) : !user.emailVerified ? (
              <ButtonLink className="w-full" to="/verify-email" state={{ returnTo: "/checkout" }}>Confirm your email <span aria-hidden="true">→</span></ButtonLink>
            ) : (
              <Button className="w-full" disabled={busy || !ingredients} onClick={placeOrder}>
                {busy ? "Creating your order…" : "Continue to payment"} <span aria-hidden="true">→</span>
              </Button>
            )}
          </section>
        </div>
      )}
    </PageContainer>
  );
}
