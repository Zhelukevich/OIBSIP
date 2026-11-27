import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { formatPrice, ingredientPrice } from "../storefront";
import type { PizzaSelection } from "../storefront";
import type { InventoryItem } from "../types";

const steps = [
  { type: "base", label: "Crust", title: "Choose a crust" },
  { type: "sauce", label: "Sauce", title: "Choose a sauce" },
  { type: "cheese", label: "Cheese", title: "Choose a cheese" },
  { type: "vegetable", label: "Toppings", title: "Pick your toppings" },
] as const;

export function BuilderPage({ catalog, catalogError, onRetry, canAdd, onAdd }: {
  catalog: InventoryItem[] | null;
  catalogError: boolean;
  onRetry: () => void;
  canAdd: (pizza: PizzaSelection) => boolean;
  onAdd: (pizza: PizzaSelection) => void;
}) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<string[][]>([[], [], [], []]);
  const finalStep = step === steps.length - 1;
  const ingredientIds = selected.flat();
  const pizza = { kind: "custom", ingredientIds } as const;
  const active = steps[step];
  const currentChoices = selected[step];
  const addable = selected.every((choices) => choices.length > 0) && canAdd(pizza);

  function choose(id: string) {
    setSelected((previous) => previous.map((choices, index) => {
      if (index !== step) return choices;
      if (active.type !== "vegetable") return [id];
      return choices.includes(id) ? choices.filter((choice) => choice !== id) : [...choices, id];
    }));
  }

  return (
    <main className="store-container builder">
      <Link className="store-text-link" to="/">← Back to menu</Link>
      <h1>Build your own</h1>
      {catalogError && <p className="store-notice" role="alert">We couldn’t load the ingredients. <button className="store-text-link" onClick={onRetry}>Try again</button></p>}
      {!catalog && !catalogError && <p role="status">Loading ingredients…</p>}
      {catalog && (
        <section className="builder-panel" aria-labelledby="builder-step">
          <ol className="builder-steps" aria-label="Pizza builder steps">
            {steps.map(({ type, label }, index) => (
              <li key={type} aria-current={step === index ? "step" : undefined}>{label}</li>
            ))}
          </ol>
          <h2 id="builder-step">{active.title}</h2>
          {finalStep && <p>Choose one or more vegetables.</p>}
          <div className="builder-options" role="group" aria-labelledby="builder-step">
            {catalog.filter(({ type }) => type === active.type).map((item) => (
              <button key={item._id} aria-pressed={currentChoices.includes(item._id)} disabled={item.quantity < 1} onClick={() => choose(item._id)}>
                <strong>{item.name}</strong>
                <span>{item.quantity > 0 ? formatPrice(ingredientPrice) : "Sold out"}</span>
              </button>
            ))}
          </div>
          {finalStep && currentChoices.length > 0 && !addable && <p className="store-notice" role="alert">These ingredients are unavailable for another pizza. Check your cart or adjust your selections.</p>}
          <div className="builder-actions">
            <strong>{formatPrice(ingredientIds.length * ingredientPrice)}</strong>
            <div>
              {step > 0 && <button className="store-button store-button--outline" onClick={() => setStep(step - 1)}>Back</button>}
              {finalStep ? (
                <button className="store-button" disabled={!addable} onClick={() => { onAdd(pizza); navigate("/checkout"); }}>Add to cart <span aria-hidden="true">+</span></button>
              ) : (
                <button className="store-button" disabled={!currentChoices.length} onClick={() => setStep(step + 1)}>Continue <span aria-hidden="true">→</span></button>
              )}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
