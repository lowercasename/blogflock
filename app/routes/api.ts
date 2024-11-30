import { Context, Hono } from "hono";
import { getBlogs, updateBlog, updateBlogLastFetchedAt } from "../models/Blog.ts";
import { tokenAuthMiddleware } from "../lib/auth.ts";
import z from "https://deno.land/x/zod@v3.23.8/index.ts";
import { validateRequest } from "../lib/validateRequest.ts";
import { createPost, getPostByGuid } from "../models/Post.ts";

const app = new Hono();

const createPostSchema = z.object({
    title: z.string().min(1, { message: "Title must not be empty" }),
    content: z.string().optional(),
    url: z.string().url({ message: "Invalid URL" }),
    publishedAt: z.coerce.date(),
    guid: z.string(),
    blogId: z.coerce.number(),
});

app.get("/blogs", (c: Context) => {
    const blogs = getBlogs();
    return c.json(blogs);
});

app.post("/posts", tokenAuthMiddleware, validateRequest(createPostSchema, { redirectTo: "/api/posts", parseBody: true }), (c: Context) => {
    const json = c.get("formData");
    const existingPost = getPostByGuid(json.guid);
    if (existingPost) {
        console.log('Post already exists');
        updateBlogLastFetchedAt(Number(json.blogId));
        return c.json({ message: "Post already exists" });
    }
    const newPost = createPost({
        blogId: Number(json.blogId),
        title: json.title,
        content: json.content,
        url: json.url,
        publishedAt: new Date(json.publishedAt),
        guid: json.guid,
    })
    updateBlogLastFetchedAt(Number(json.blogId));
    return c.json(newPost);
});

export default app;