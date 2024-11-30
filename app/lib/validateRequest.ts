import { Context, Next } from "hono";
import { z } from "https://deno.land/x/zod/mod.ts";
import { setFlash } from "./flash.ts";
import { zodSafeParseErrorToFlash } from "./zod.ts";

type ValidationOptions = {
  redirectTo?: string;
  parseBody?: boolean;
};

export const validateRequest = <T extends z.ZodType>(
  schema: T,
  options: ValidationOptions,
) => {
  return async (c: Context, next: Next) => {
    try {
      // Parse either form-data, JSON, or query parameters
      const data = options.parseBody
        ? c.req.header("content-type") === "application/json"
          ? await c.req.json()
          : await c.req.parseBody()
        : c.req.query();

      const parseResult = schema.safeParse(data);

      if (!parseResult.success) {
        if (options.redirectTo) {
          setFlash(c, zodSafeParseErrorToFlash(c, parseResult));
          return c.redirect(options.redirectTo);
        } else {
          c.set("flash", zodSafeParseErrorToFlash(c, parseResult));
          return await next();
        }
      }
      // Add the body to the context for the next middleware/handler
      c.set("formData", parseResult.data);
      await next();
    } catch (error) {
      console.error("Validation middleware error:", error);
      if (options.redirectTo) {
        setFlash(c, {
          message: "An unexpected error occurred. Please try again.",
          type: "error",
        });
        return c.redirect(options.redirectTo);
      } else {
        c.set("flash", [{
          message: "An unexpected error occurred. Please try again.",
          type: "error",
        }]);
        return await next();
      }
    }
  };
};
