import type { ComponentPropsWithoutRef } from "react";

const widths = {
  page: "max-w-page",
  reading: "max-w-reading",
};

export function PageContainer({
  as: Element = "main", width = "page", className = "", ...props
}: ComponentPropsWithoutRef<"main"> & { as?: "main" | "div"; width?: keyof typeof widths }) {
  return <Element {...props} className={`mx-auto w-[calc(100%_-_48px)] max-[650px]:w-[calc(100%_-_28px)] ${widths[width]} ${className}`} />;
}
