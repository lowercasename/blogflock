import { Context, Hono } from "hono";
import { getBlogs } from "../models/Blog.ts";

const app = new Hono();

app.get("/blogs", async (c: Context) => {
  const skipOrphans = c.req.query("skipOrphans") === "true";
  const blogs = await getBlogs(skipOrphans);
  return c.json(blogs);
});

export default app;
