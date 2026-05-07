import { Hono } from "hono";
import auth from "./routes/auth.ts";
import client from "./routes/client.ts";
import lists from "./routes/lists.ts";
import { initDB } from "./lib/db.ts";
import api from "./routes/api.ts";
import { User } from "./models/User.ts";
import posts from "./routes/posts.ts";
import { Flash } from "./lib/flash.ts";
import users from "./routes/users.ts";
import { serveStatic } from "hono/deno";
import billing from "./routes/billing.ts";
import { startPoller } from "./lib/poller.ts";

declare module "hono" {
  interface ContextVariableMap {
    result: string;
    formData: Record<string, string>;
    user: User;
    flash: Flash[];
  }
}

initDB();
startPoller();

const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok" }));

app.use("/static/*", serveStatic({ root: "./" }));

app.route("/auth", auth);
app.route("/lists", lists);
app.route("/api/billing", billing);
app.route("/api", api);
app.route("/posts", posts);
app.route("/users", users);
app.route("/", client);

Deno.serve({ port: 8021, hostname: "0.0.0.0" }, app.fetch);
