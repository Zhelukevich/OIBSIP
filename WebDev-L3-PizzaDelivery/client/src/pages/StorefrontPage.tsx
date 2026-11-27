import { Link } from "react-router-dom";
import { describePizza, formatPrice, getCartOrder, menu } from "../storefront";
import type { PizzaSelection } from "../storefront";
import type { InventoryItem } from "../types";

export function BagIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 8h14l1.5 13h-17L5 8Z" />
      <path d="M9 9V6a3 3 0 0 1 6 0v3" />
    </svg>
  );
}

export function StorefrontPage({ catalog, canAdd, onAdd, catalogError, onRetry }: {
  catalog: InventoryItem[] | null;
  canAdd: (pizza: PizzaSelection) => boolean;
  onAdd: (pizza: PizzaSelection) => void;
  catalogError: boolean;
  onRetry: () => void;
}) {
  return (
    <main className="store-container storefront">
      <section className="store-hero" aria-labelledby="hero-title">
        <div className="store-hero__content">
          <h1 id="hero-title">Good pizza.<br /><em>Great night.</em></h1>
          <p>Hand-tossed crusts, generous toppings, and a pizza worth staying in for.</p>
          <Link className="store-button" to="/#menu">Explore the menu <span aria-hidden="true">↓</span></Link>
        </div>
      </section>

      <section className="store-menu" id="menu" aria-labelledby="menu-title">
        <div className="store-section-heading">
          <h2 id="menu-title">The pizza menu</h2>
          <Link className="store-text-link" to="/build">Build your own <span aria-hidden="true">↗</span></Link>
        </div>
        {catalogError && (
          <p className="store-notice" role="alert">
            We couldn’t check ingredient availability. <button className="store-text-link" onClick={onRetry}>Try again</button>
          </p>
        )}
        {!catalog && !catalogError && <p className="sr-only" role="status">Checking pizza availability…</p>}
        <div className="store-menu__grid">
          {menu.map(({ id }) => {
            const pizza = { kind: "menu", id } as const;
            const item = describePizza(pizza, catalog ?? []);
            const available = Boolean(catalog && getCartOrder([{ pizza, quantity: 1 }], catalog));
            const addable = available && canAdd(pizza);
            return (
              <article className="pizza-card" key={id}>
                <img src={item.image} alt={item.name + " pizza"} width="640" height="420" />
                <div className="pizza-card__content">
                  <h3>{item.name}</h3>
                  <p>{item.details}</p>
                  <div className="pizza-card__action">
                    <strong>{formatPrice(item.price)}</strong>
                    <button className="store-button store-button--outline" disabled={!addable} onClick={() => onAdd(pizza)} aria-label={addable ? `Add ${item.name} to cart` : undefined}>
                      {addable ? "Add to cart" : available ? "Cart limit" : catalog ? "Sold out" : catalogError ? "Unavailable" : "Checking…"}{addable && <span aria-hidden="true">+</span>}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        <aside className="store-build-link">
          <div>
            <h2>Make it yours.</h2>
            <p>Pick your crust, sauce, cheese, and toppings.</p>
          </div>
          <Link className="store-button store-button--outline" to="/build">Build your own <span aria-hidden="true">↗</span></Link>
        </aside>
      </section>
    </main>
  );
}
