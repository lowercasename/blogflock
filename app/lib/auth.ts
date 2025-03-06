import { Context, Next } from "hono";
import { getSignedCookie } from "hono/cookie";
import { verify } from "hono/jwt";
import { getUserById } from "../models/User.ts";

export const jwtAuthMiddleware = async (c: Context, next: Next) => {
  const authCookie = await getSignedCookie(
    c,
    Deno.env.get("SIGNED_COOKIE_SECRET")!,
    "auth",
  );
  if (!authCookie) {
    return c.redirect("/login");
  }
  try {
    const { email, id } = await verify(
      authCookie,
      Deno.env.get("JWT_SECRET")!,
    );
    if (!email || !id || typeof email !== "string" || typeof id !== "number") {
      return c.redirect("/login");
    }
    const user = await getUserById(id);
    if (!user) {
      return c.redirect("/login");
    }
    c.set("user", user);
    await next();
  } catch (e: unknown) {
    console.log(e);
    return c.redirect("/login");
  }
};

export const redirectIfAuthenticated = async (c: Context, next: Next) => {
  const authCookie = await getSignedCookie(
    c,
    Deno.env.get("SIGNED_COOKIE_SECRET")!,
    "auth",
  );
  if (authCookie) {
    return c.redirect("/");
  }
  await next();
};

export const getAuthenticatedUser = async (c: Context) => {
  const authCookie = await getSignedCookie(
    c,
    Deno.env.get("SIGNED_COOKIE_SECRET")!,
    "auth",
  );
  if (!authCookie) {
    return null;
  }
  try {
    const { email, id } = await verify(
      authCookie,
      Deno.env.get("JWT_SECRET")!,
    );
    if (!email || !id || typeof email !== "string" || typeof id !== "number") {
      return null;
    }
    const user = await getUserById(id);
    if (!user) {
      return null;
    }
    return user;
  } catch (e: unknown) {
    console.log(e);
    return null;
  }
};

export const tokenAuthMiddleware = async (c: Context, next: Next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  if (!authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const token = authHeader.split(" ")[1];
  if (token !== Deno.env.get("API_TOKEN")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
};
