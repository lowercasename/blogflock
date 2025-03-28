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

const colorToClasses = {
  grey: "bg-stone-100 text-stone-600",
  orange: "bg-orange-100 text-orange-700",
};

export const Badge = (
  { children, size = "sm", icon, className, color = "grey" }: PropsWithChildren<
    // deno-lint-ignore no-explicit-any
    {
      size?: "sm" | "md" | "lg";
      icon?: any;
      className?: string;
      color?: "grey" | "orange";
    }
  >,
) => (
  <span
    class={`inline-flex items-center gap-1 rounded-full ${
      colorToClasses[color]
    } ${sizeToClasses[size]} ${className}`}
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
