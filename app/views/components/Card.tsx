import { PropsWithChildren } from "https://jsr.io/@hono/hono/4.6.10/src/jsx/types.ts";

interface Props {
  title?: unknown;
  controls?: unknown;
  href?: string;
  className?: string;
  id?: string;
  padding?: boolean;
}

export function Card(
  { title, href, controls, children, className, id, padding = true }:
    PropsWithChildren<
      Props
    >,
) {
  return (
    <div
      class={`shadow-sharp rounded-lg bg-white overflow-hidden ${
        padding ? "p-4" : ""
      } w-full ${className || ""}`}
      id={id}
    >
      {title && (
        <div class="flex justify-between items-start mb-2">
          <h2 class="text-xl font-semibold text-orange-900">
            {href ? <a href={href} class="hover:underline">{title}</a> : title}
          </h2>
          {controls}
        </div>
      )}
      {children}
    </div>
  );
}
