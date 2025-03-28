import { Hono } from "hono";
import auth from "./routes/auth.ts";
import client from "./routes/client.ts";
import lists from "./routes/lists.ts";
import { initDB } from "./lib/db.ts";
import api from "./routes/api.ts";
import { connect } from "https://deno.land/x/amqp/mod.ts";
import { User } from "./models/User.ts";
import posts from "./routes/posts.ts";
import { Flash } from "./lib/flash.ts";
import users from "./routes/users.ts";
import { serveStatic } from "hono/deno";
import { broadcastNewPost } from "./lib/websockets.ts";
import { getAllListsContainingBlog } from "./models/List.ts";
import z from "https://deno.land/x/zod@v3.23.8/index.ts";
import billing from "./routes/billing.ts";

declare module "hono" {
  interface ContextVariableMap {
    result: string;
    formData: Record<string, string>;
    user: User;
    flash: Flash[];
  }
}

initDB();

// AMQP queues
const PostQueuePayloadSchema = z.object({
  blog_id: z.number(),
  title: z.string(),
  content: z.string(),
  url: z.string(),
  published_at: z.coerce.date(),
  guid: z.string(),
});

try {
  const connection = await connect({
    hostname: Deno.env.get("RABBITMQ_HOST") || "localhost",
    username: Deno.env.get("RABBITMQ_USER") || "guest",
    password: Deno.env.get("RABBITMQ_PASSWORD") || "guest",
  });
  const channel = await connection.openChannel();
  await channel.declareQueue({
    queue: "post_queue",
    durable: true,
  });
  await channel.consume(
    { queue: "post_queue" },
    async (args, _props, data) => {
      const response = PostQueuePayloadSchema.safeParse(
        JSON.parse(new TextDecoder().decode(data)),
      );
      if (!response.success) {
        console.error("[AMQP:post_queue] Invalid payload", response.error);
        await channel.ack({ deliveryTag: args.deliveryTag });
        return;
      }
      const body = response.data;
      const lists = await getAllListsContainingBlog(body.blog_id);
      broadcastNewPost(lists);
      console.log(`[AMQP:post_queue] Post broadcast: ${body.title}`);
      await channel.ack({ deliveryTag: args.deliveryTag });
    },
  );
} catch (e) {
  console.error("[AMPQ] Failed to connect to AMQP server", e);
}

const app = new Hono();

app.use("/static/*", serveStatic({ root: "./" }));

app.route("/auth", auth);
app.route("/lists", lists);
app.route("/api/billing", billing);
app.route("/api", api);
app.route("/posts", posts);
app.route("/users", users);
app.route("/", client);

Deno.serve({ port: 8021, hostname: "0.0.0.0" }, app.fetch);
