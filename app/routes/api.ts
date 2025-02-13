import { Context, Hono } from "hono";
import {
  getBlogs,
  updateBlogStats,
} from "../models/Blog.ts";
import { tokenAuthMiddleware } from "../lib/auth.ts";
import z from "https://deno.land/x/zod@v3.23.8/index.ts";
import { validateRequest } from "../lib/validateRequest.ts";
import { createPost, getPostByGuid } from "../models/Post.ts";

const app = new Hono();

const createPostSchema = z.object({
  title: z.string().trim().min(1, { message: "Title must not be empty" }),
  content: z.string().trim().optional(),
  url: z.string().trim().url({ message: "Invalid URL" }),
  publishedAt: z.coerce.date(),
  guid: z.string().trim(),
  blogId: z.coerce.number(),
});

app.get("/blogs", async (c: Context) => {
  const skipOrphans = c.req.query("skipOrphans") === "true";
  const blogs = await getBlogs(skipOrphans);
  return c.json(blogs);
});

app.post(
  "/posts",
  tokenAuthMiddleware,
  validateRequest(createPostSchema, {
    redirectTo: "/api/posts",
    parseBody: true,
  }),
  async (c: Context) => {
    const json = c.get("formData");
    const existingPost = await getPostByGuid(json.guid, Number(json.blogId));
    if (existingPost) {
      updateBlogStats(Number(json.blogId));
      return c.json({ message: "Post already exists" });
    }
    const newPost = await createPost({
      blog_id: Number(json.blogId),
      title: json.title,
      content: json.content,
      url: json.url,
      published_at: new Date(json.publishedAt),
      guid: json.guid,
    });
    updateBlogStats(Number(json.blogId));
    return c.json(newPost);
  },
);

export default app;
