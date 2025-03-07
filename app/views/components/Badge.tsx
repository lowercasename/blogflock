import { PropsWithChildren } from "hono/jsx";

const sizeToClasses = {
  sm: "text-sm gap-0.5 px-2",
  md: "text-md gap-2 px-3",
  lg: "text-lg gap-3 px-4",
};

const sizeToIconSize = {
  sm: "size-3",
  md: "size-5",
  lg: "size-6",
};

export const Badge = (
  { children, size = "sm", icon, className }: PropsWithChildren<
    // deno-lint-ignore no-explicit-any
    { size?: "sm" | "md" | "lg"; icon?: any; className?: string }
  >,
) => (
  <span
    class={`inline-flex items-center gap-1 rounded-full bg-stone-100 text-stone-600 ${
      sizeToClasses[size]
    } ${className}`}
  >
    {icon && (
      <div class={`${sizeToIconSize[size]}`}>
        {icon}
      </div>
    )}
    <span>
      {children}
    </span>
  </span>
);
