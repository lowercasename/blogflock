import { Context, Next } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";

export interface Flash {
  message: string;
  type: "success" | "error";
}

export const flash = createMiddleware((c: Context, next: Next) => {
  const flashCookie = getCookie(c, "flash");
  if (flashCookie) {
    deleteCookie(c, "flash");
    c.set("flash", JSON.parse(flashCookie) as Flash[]);
  }
  return next();
});

export const setFlash = (c: Context, flash: Flash[] | Flash) => {
  if (!Array.isArray(flash)) {
    flash = [flash];
  }
  setCookie(c, "flash", JSON.stringify(flash));
};
