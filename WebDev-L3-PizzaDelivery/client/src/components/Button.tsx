import type { ComponentPropsWithoutRef } from "react";
import { Link, type LinkProps } from "react-router-dom";

const variants = {
  primary: "border-transparent bg-action text-white hover:not-disabled:bg-action-hover",
  outline: "border-line bg-transparent text-action hover:not-disabled:bg-action-soft",
  hero: "border-transparent bg-hero-action text-hero-ink hover:bg-hero-action-hover focus-visible:outline-hero-action",
};

type ButtonStyle = {
  variant?: keyof typeof variants;
  className?: string;
};

function buttonClasses(variant: keyof typeof variants, className: string) {
  return `inline-flex min-h-11 items-center justify-center gap-2 rounded-buttons border px-5 py-2 text-body font-bold transition-colors ${variants[variant]} ${className}`;
}

export function Button({
  variant = "primary", className = "", type = "button", ...props
}: ComponentPropsWithoutRef<"button"> & ButtonStyle) {
  return <button {...props} type={type} className={buttonClasses(variant, className)} />;
}

export function ButtonLink({ variant = "primary", className = "", ...props }: LinkProps & ButtonStyle) {
  return <Link {...props} className={buttonClasses(variant, className)} />;
}
