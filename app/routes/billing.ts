import { Context, Hono } from "hono";
import { stripe } from "../lib/stripe.ts";
import { jwtAuthMiddleware } from "../lib/auth.ts";
import { db } from "../lib/db.ts";

const app = new Hono();

app.get("/complete", jwtAuthMiddleware, async (c: Context) => {
  const user = c.get("user");
  if (user.blogflock_supporter_subscription_active) {
    return c.redirect("/billing");
  }

  // Fallback behavior if the user's subscription hasn't activated via webhook yet
  const sessionId = c.req.query("session_id");
  if (!sessionId) {
    return c.redirect("/billing");
  }
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (!session || !session.customer) {
    return c.redirect("/billing");
  }
  await db.queryObject(
    "UPDATE users SET stripe_customer_id = $1, blogflock_supporter_subscription_active = true WHERE id = $2",
    [
      session.customer,
      user.id,
    ],
  );
  return c.redirect("/billing");
});

app.post("/events", async (c: Context) => {
  const sig = c.req.header("Stripe-Signature");
  const endpointSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!sig || !endpointSecret) {
    return c.text("Unauthorized", 401);
  }

  try {
    const body = await c.req.raw.text();
    if (!body) {
      return c.text("Bad Request", 400);
    }
    const event = await stripe.webhooks.constructEventAsync(
      body,
      sig,
      endpointSecret,
    );
    const eventType = event.type;

    if (eventType === "customer.subscription.updated") {
      const subscription = event.data.object;
      if (subscription.status === "active") {
        await db.queryObject(
          "UPDATE users SET blogflock_supporter_subscription_active = true WHERE stripe_customer_id = $1",
          [subscription.customer],
        );
      } else if (
        subscription.status === "canceled" || subscription.status === "paused"
      ) {
        await db.queryObject(
          "UPDATE users SET blogflock_supporter_subscription_active = false WHERE stripe_customer_id = $1",
          [subscription.customer],
        );
      }
    } else if (eventType === "customer.subscription.deleted") {
      const subscription = event.data.object;
      await db.queryObject(
        "UPDATE users SET blogflock_supporter_subscription_active = false WHERE stripe_customer_id = $1",
        [subscription.customer],
      );
    } else if (eventType === "customer.created") {
      const customer = event.data.object;
      const userId = customer.metadata.user_id;
      await db.queryObject(
        "UPDATE users SET stripe_customer_id = $1 WHERE id = $2",
        [customer.id, userId],
      );
    }
    return c.json({ received: true });
  } catch (err) {
    console.error(`Error processing webhook: ${err}`);
    return c.text("Bad Request", 400);
  }
});

export default app;
