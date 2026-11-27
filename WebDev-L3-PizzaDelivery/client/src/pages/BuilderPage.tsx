import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { formatPrice, ingredientPrice } from "../storefront";
import type { PizzaSelection } from "../storefront";
import type { InventoryItem } from "../types";
import { Button } from "../components/Button";
import { PageContainer } from "../components/PageContainer";
import "../styles/builder.css";

const steps = [
  { type: "base", label: "Crust", title: "Choose your crust", hint: "Pick one base for your pizza." },
  { type: "sauce", label: "Sauce", title: "Choose your sauce", hint: "Pick one sauce for your base." },
  { type: "cheese", label: "Cheese", title: "Choose your cheese", hint: "Pick one cheese to melt over the sauce." },
  { type: "vegetable", label: "Toppings", title: "Pick your vegetables", hint: "Choose at least one topping. You can mix and match." },
] as const;

export function BuilderPage({ catalog, catalogError, onRetry, canAdd, onAdd }: {
  catalog: InventoryItem[] | null;
  catalogError: boolean;
  onRetry: () => void;
  canAdd: (pizza: PizzaSelection) => boolean;
  onAdd: (pizza: PizzaSelection) => void;
}) {
  const navigate = useNavigate();
  const heading = useRef<HTMLHeadingElement>(null);
  const [step, setStep] = useState(0);
  const [hasNavigated, setHasNavigated] = useState(false);
  const [recipeOpen, setRecipeOpen] = useState(() => window.matchMedia("(min-width: 781px)").matches);
  const [selected, setSelected] = useState<Record<InventoryItem["type"], string[]>>({
    base: [],
    sauce: [],
    cheese: [],
    vegetable: [],
  });

  const active = steps[step];
  const finalStep = active.type === "vegetable";
  const ingredients = new Map(catalog?.filter((item) => item.isActive).map((item) => [item._id, item]));
  const ingredientIds = steps.flatMap(({ type }) => selected[type]);
  const completed = steps.map(({ type }) => selected[type].length > 0 && selected[type].every((id) => (
    (ingredients.get(id)?.quantity ?? 0) > 0
  )));
  const pizza = { kind: "custom", ingredientIds } as const;
  const addable = completed.every(Boolean) && canAdd(pizza);
  const currentChoices = selected[active.type];
  const options = [...ingredients.values()].filter(({ type }) => type === active.type);
  const unavailable = ingredientIds.some((id) => (ingredients.get(id)?.quantity ?? 0) < 1);
  const total = formatPrice(ingredientIds.length * ingredientPrice);

  useEffect(() => {
    if (hasNavigated) heading.current?.focus();
  }, [step, hasNavigated]);

  function goToStep(next: number) {
    setHasNavigated(true);
    setStep(next);
  }

  function choose(id: string) {
    setSelected((previous) => {
      if (!finalStep) return { ...previous, [active.type]: [id] };
      const toppings = previous.vegetable;
      return {
        ...previous,
        vegetable: toppings.includes(id) ? toppings.filter((choice) => choice !== id) : [...toppings, id],
      };
    });
  }

  function addToCart() {
    if (!addable) return;
    onAdd(pizza);
    navigate("/checkout");
  }

  return (
    <PageContainer className="builder">
      <header className="builder-heading">
        <Link className="action-link" to="/#menu"><span aria-hidden="true">←</span> Back to menu</Link>
        <h1 className="counter-title">Build your own</h1>
        <p>Choose your crust, sauce, cheese, and toppings.</p>
      </header>
      {catalogError && <p className="store-notice" role="alert">We couldn’t load the ingredients. <button className="action-link" onClick={onRetry}>Try again</button></p>}
      {!catalog && !catalogError && <p role="status">Loading ingredients…</p>}
      {catalog && (
        <div className="builder-layout">
          <aside className="builder-summary counter-panel" aria-label="Your recipe">
            <details open={recipeOpen} onToggle={(event) => setRecipeOpen(event.currentTarget.open)}>
              <summary>Your recipe <strong>{total}</strong></summary>
              <dl>
                {steps.map(({ type, label }) => (
                  <div key={type}>
                    <dt>{label}</dt>
                    <dd>{selected[type].map((id) => ingredients.get(id)?.name ?? "Unavailable").join(", ") || "—"}</dd>
                  </div>
                ))}
              </dl>
            </details>
          </aside>
          <section className="builder-panel counter-panel" aria-labelledby="builder-step">
            <ol className="builder-steps" aria-label="Pizza builder steps">
              {steps.map(({ type, label }, index) => (
                <li key={type}>
                  <button
                    type="button"
                    aria-current={step === index ? "step" : undefined}
                    disabled={index > step && !completed.slice(0, index).every(Boolean)}
                    onClick={() => goToStep(index)}
                  >
                    <span aria-hidden="true">{completed[index] && step !== index ? "✓" : index + 1}</span>
                    {label}
                  </button>
                </li>
              ))}
            </ol>
            <div className="builder-step-heading">
              <div>
                <h2 id="builder-step" tabIndex={-1} ref={heading}>{active.title}</h2>
                <p id="builder-hint">{active.hint}</p>
              </div>
              {finalStep && <span className="builder-count" role="status">{currentChoices.length} selected</span>}
            </div>
            <fieldset className="builder-options" aria-labelledby="builder-step" aria-describedby="builder-hint" key={active.type}>
              {!options.length && <p>There are no options available for this step.</p>}
              {options.map((item) => {
                const checked = currentChoices.includes(item._id);
                const soldOut = item.quantity < 1;
                return (
                  <label className="builder-option" key={item._id}>
                    <input
                      type={finalStep ? "checkbox" : "radio"}
                      name={active.type}
                      checked={checked}
                      disabled={soldOut && !(finalStep && checked)}
                      onChange={() => choose(item._id)}
                    />
                    <strong>{item.name}</strong>
                    <span>{soldOut ? "Sold out" : `+${formatPrice(ingredientPrice)}`}</span>
                  </label>
                );
              })}
              {finalStep && currentChoices.filter((id) => !ingredients.has(id)).map((id) => (
                <label className="builder-option" key={id}>
                  <input type="checkbox" checked onChange={() => choose(id)} />
                  <strong>Unavailable topping</strong>
                  <span>Sold out</span>
                </label>
              ))}
            </fieldset>
            {unavailable && <p className="store-notice" role="alert">Some of your selections are sold out. Update your recipe to continue.</p>}
            {finalStep && completed.every(Boolean) && !addable && (
              <p className="store-notice" role="alert">There isn’t enough stock for this pizza and the items in your cart. Adjust your recipe or cart.</p>
            )}
            <div className="builder-actions">
              <p className="builder-total"><span>Pizza total</span><strong>{total}</strong></p>
              <div className="builder-buttons">
                {step > 0 && <Button variant="outline" onClick={() => goToStep(step - 1)}>Back</Button>}
                {finalStep ? (
                  <Button disabled={!addable} onClick={addToCart}>Add to cart <span aria-hidden="true">+</span></Button>
                ) : (
                  <Button disabled={!completed[step]} onClick={() => goToStep(step + 1)}>Continue <span aria-hidden="true">→</span></Button>
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </PageContainer>
  );
}
