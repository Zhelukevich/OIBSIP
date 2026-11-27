import { useState } from "react";
import { Button } from "../../components/Button";
import type { InventoryItem } from "../../types";

type PreviewMode = "pizza" | "photo";

export function PizzaPreview({ ingredients }: { ingredients: InventoryItem[] }) {
  const [preferredMode, setPreferredMode] = useState<PreviewMode | null>(null);
  const crust = ingredients.find(({ type }) => type === "base");
  const sauce = ingredients.find(({ type }) => type === "sauce");
  const cheese = ingredients.find(({ type }) => type === "cheese");
  const toppings = ingredients.filter(({ type }) => type === "vegetable");
  const mode = preferredMode ?? (crust ? "pizza" : "photo");

  return (
    <div className="pizza-preview">
      <div className="pizza-preview__controls" role="group" aria-label="Pizza preview">
        <Button variant="filter" aria-pressed={mode === "pizza"} onClick={() => setPreferredMode("pizza")}>Live preview</Button>
        <Button variant="filter" aria-pressed={mode === "photo"} onClick={() => setPreferredMode("photo")}>Photo</Button>
      </div>
      {mode === "photo" ? (
        <figure className="pizza-preview__photo">
          <img src="/pizza/auth.webp" alt="A slice being lifted from a baked pizza" width="560" height="840" decoding="async" />
          <figcaption>Serving inspiration</figcaption>
        </figure>
      ) : (
        <figure className="pizza-preview__figure">
          <div className="pizza-preview__board">
            {crust ? (
              <div className="pizza-preview__pie" role="img" aria-label={`Pizza with ${ingredients.map(({ name }) => name).join(", ")}`}
                data-crust={crust.name}>
                {sauce && <div className="pizza-preview__sauce" data-sauce={sauce.name} aria-hidden="true" />}
                {cheese && <div className="pizza-preview__cheese" data-cheese={cheese.name} aria-hidden="true" />}
                {toppings.map(({ _id, name }) => (
                  <div className="pizza-preview__toppings" data-topping={name} key={_id} aria-hidden="true">
                    <span /><span /><span /><span /><span /><span />
                  </div>
                ))}
              </div>
            ) : <p>Choose a crust to start.</p>}
          </div>
          <figcaption>Illustration of your selections</figcaption>
        </figure>
      )}
    </div>
  );
}
