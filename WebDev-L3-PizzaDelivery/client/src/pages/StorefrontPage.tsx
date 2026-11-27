import { Link } from "react-router-dom";
import { Button, ButtonLink } from "../components/Button";
import { PageContainer } from "../components/PageContainer";
import { describePizza, formatPrice, getCartOrder, menu } from "../storefront";
import type { PizzaSelection } from "../storefront";
import type { InventoryItem } from "../types";

export function StorefrontPage({ catalog, canAdd, onAdd, catalogError, onRetry }: {
  catalog: InventoryItem[] | null;
  canAdd: (pizza: PizzaSelection) => boolean;
  onAdd: (pizza: PizzaSelection) => void;
  catalogError: boolean;
  onRetry: () => void;
}) {
  return (
    <PageContainer className="storefront">
      <section className="store-hero" aria-labelledby="hero-title">
        <div className="store-hero__content">
          <h1 id="hero-title">Good pizza.<br /><em>Great night.</em></h1>
          <p>Hand-tossed crusts, generous toppings, and a pizza worth staying in for.</p>
          <ButtonLink variant="hero" to="/#menu">Explore the menu <span aria-hidden="true">↓</span></ButtonLink>
        </div>
      </section>

      <section className="store-menu" id="menu" aria-labelledby="menu-title">
        <div className="store-section-heading">
          <h2 id="menu-title">The pizza menu</h2>
          <Link className="action-link" to="/build">Build your own <span aria-hidden="true">↗</span></Link>
        </div>
        {catalogError && (
          <p className="store-notice" role="alert">
            We couldn’t check ingredient availability. <button className="action-link" onClick={onRetry}>Try again</button>
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
                    <Button variant="outline" disabled={!addable} onClick={() => onAdd(pizza)} aria-label={addable ? `Add ${item.name} to cart` : undefined}>
                      {addable ? "Add to cart" : available ? "Cart limit" : catalog ? "Sold out" : catalogError ? "Unavailable" : "Checking…"}{addable && <span aria-hidden="true">+</span>}
                    </Button>
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
          <ButtonLink variant="outline" to="/build">Build your own <span aria-hidden="true">↗</span></ButtonLink>
        </aside>
      </section>
    </PageContainer>
  );
}
