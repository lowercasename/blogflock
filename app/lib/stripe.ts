import Stripe from "npm:stripe";

const secretKey = Deno.env.get("STRIPE_SECRET_KEY");
if (!secretKey) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

export const stripe = new Stripe(secretKey);
