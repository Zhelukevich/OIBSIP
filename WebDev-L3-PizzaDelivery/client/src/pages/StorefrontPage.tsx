import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button, ButtonLink } from "../components/Button";
import { PageContainer } from "../components/PageContainer";
import { describePizza, formatPrice, getCartOrder, menu } from "../storefront";
import type { CartLine, PizzaSelection } from "../storefront";
import type { InventoryItem } from "../types";

export function StorefrontPage({ catalog, cart, canAdd, onAdd, catalogError, onRetry }: {
  catalog: InventoryItem[] | null;
  cart: CartLine[];
  canAdd: (pizza: PizzaSelection) => boolean;
  onAdd: (pizza: PizzaSelection) => void;
  catalogError: boolean;
  onRetry: () => void;
}) {
  const [availableOnly, setAvailableOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const products = menu.map(({ id, recipe }) => {
    const pizza = { kind: "menu", id } as const;
    const item = describePizza(pizza, catalog ?? []);
    const available = Boolean(catalog && getCartOrder([{ pizza, quantity: 1 }], catalog));
    const addable = available && canAdd(pizza);
    const quantity = cart.find((line) => line.pizza.kind === "menu" && line.pizza.id === id)?.quantity ?? 0;
    const action = addable ? "Add to cart" : available ? "Cart limit" : catalog ? "Sold out" : catalogError ? "Unavailable" : "Checking…";
    return { pizza, item, recipe, available, addable, quantity, action };
  });
  const visible = availableOnly && catalog ? products.filter(({ available }) => available) : products;
  const detail = products.find(({ pizza }) => pizza.id === selectedId);

  useEffect(() => {
    if (selectedId && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [selectedId]);

  return (
    <PageContainer className="storefront">
      <section className="store-hero" aria-labelledby="hero-title">
        <div className="store-hero__content">
          <h1 id="hero-title">Good pizza.<br /><em>Great night.</em></h1>
          <p>Hand-tossed crusts, generous toppings, and a pizza worth staying in for.</p>
          <ButtonLink to="/#menu">Explore the menu <span aria-hidden="true">↓</span></ButtonLink>
        </div>
        <picture className="store-hero__photo">
          <source media="(max-width: 600px)" srcSet="/pizza/hero-mobile.webp" />
          <img src="/pizza/hero.webp" alt="" width="1400" height="933" fetchPriority="high" />
        </picture>
      </section>

      <section className="store-menu" id="menu" aria-labelledby="menu-title">
        <div className="store-section-heading">
          <h2 id="menu-title" tabIndex={-1}>The pizza menu</h2>
          <Link className="action-link" to="/build">Build your own <span aria-hidden="true">↗</span></Link>
        </div>
        <div className="store-filters" role="group" aria-label="Filter pizzas">
          <Button variant="filter" aria-pressed={!availableOnly} onClick={() => setAvailableOnly(false)}>All pizzas</Button>
          <Button variant="filter" disabled={!catalog} aria-pressed={availableOnly} onClick={() => setAvailableOnly(true)}>Available now</Button>
        </div>
        {catalogError && <p className="store-notice" role="alert">We couldn’t check ingredient availability. <button className="action-link" onClick={onRetry}>Try again</button></p>}
        <p className="sr-only" role="status">{catalog ? `${visible.length} ${visible.length === 1 ? "pizza" : "pizzas"} shown` : !catalogError && "Checking pizza availability…"}</p>
        {!visible.length && <p className="counter-panel p-5">No pizzas are in stock right now.</p>}
        <ul className="store-menu__grid">
          {visible.map(({ pizza, item, addable, quantity, action }, index) => (
            <li className="pizza-card" key={pizza.id}>
              <button type="button" className="pizza-card__photo" aria-label={`View ${item.name} details`} aria-haspopup="dialog"
                onClick={(event) => {
                  trigger.current = event.currentTarget;
                  setSelectedId(pizza.id);
                }}>
                <img src={item.image} alt="" width="720" height="480" loading={index === 0 ? "eager" : "lazy"} decoding="async" />
                <span aria-hidden="true">↗</span>
              </button>
              <div className="pizza-card__content">
                <h3>{item.name}</h3>
                <p>{item.details}</p>
                <div className="pizza-card__action">
                  <div className="pizza-card__price">
                    <strong>{formatPrice(item.price)}</strong>
                    {quantity > 0 && <span key={quantity}>{quantity} in cart</span>}
                  </div>
                  <Button variant="outline" disabled={!addable} onClick={() => onAdd(pizza)} aria-label={addable ? `Add ${item.name} to cart` : undefined}>
                    {action}{addable && <span aria-hidden="true">+</span>}
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <aside className="store-build-link">
        <div>
          <h2>Make it yours.</h2>
          <p>Pick your crust, sauce, cheese, and toppings.</p>
        </div>
        <ButtonLink to="/build">Build your own <span aria-hidden="true">↗</span></ButtonLink>
      </aside>

      {detail && (
        <dialog className="pizza-dialog" aria-labelledby="pizza-detail-title"
          ref={dialog}
          onClose={() => {
            setSelectedId(undefined);
            if (trigger.current?.isConnected) trigger.current.focus();
            else document.getElementById("menu-title")?.focus();
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) dialog.current?.close();
          }}>
          <div className="pizza-dialog__panel">
            <button type="button" className="pizza-dialog__close" aria-label="Close details" onClick={() => dialog.current?.close()}>×</button>
            <img src={detail.item.image} alt="" width="720" height="480" />
            <div className="pizza-dialog__content">
              <h2 id="pizza-detail-title">{detail.item.name}</h2>
              <p>{detail.item.details}</p>
              <ul className="pizza-ingredients" aria-label="Ingredients">
                {detail.recipe.map(({ name }) => <li key={name}>{name}</li>)}
              </ul>
              <div className="pizza-card__action">
                <div className="pizza-card__price">
                  <strong>{formatPrice(detail.item.price)}</strong>
                  <span role="status">{detail.quantity > 0 && `${detail.quantity} in cart`}</span>
                </div>
                <Button disabled={!detail.addable} onClick={() => onAdd(detail.pizza)}>
                  {detail.action}{detail.addable && <span aria-hidden="true">+</span>}
                </Button>
              </div>
            </div>
          </div>
        </dialog>
      )}
    </PageContainer>
  );
}
