import z from "https://deno.land/x/zod@v3.23.8/index.ts";
import { query, queryOne } from "../lib/db.ts";
import { parseFeed } from "https://deno.land/x/rss@1.1.1/mod.ts";
import feedFinder from "npm:feed-finder";
import { encode } from "../lib/hashids.ts";
import { sanitizeUrl } from "../lib/url.ts";
import { connect } from "https://deno.land/x/amqp@v0.24.0/mod.ts";

export const BlogSchema = z.object({
  id: z.number(),
  hash_id: z.string(),
  feed_url: z.string(),
  site_url: z.string().nullable(),
  auto_title: z.string().nullable(),
  auto_description: z.string().nullable(),
  auto_image_url: z.string().nullable(),
  auto_author: z.string().nullable(),
  last_fetched_at: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
  posts_last_month: z.number().nullable(),
});

export type BlogObject = z.infer<typeof BlogSchema>;
export type Blog = BlogObject;

export type CreateBlog = Pick<Blog, "feed_url">;

export type UpdateBlog = Pick<
  Blog,
  | "feed_url"
  | "site_url"
  | "auto_title"
  | "auto_description"
  | "auto_image_url"
  | "auto_author"
>;

export const getBlogs = async (
  skipOrphans: boolean = false,
): Promise<Blog[]> => {
  // If skipOrphans is true, only return blogs that are connected to a list
  if (skipOrphans) {
    return await query<
      Blog
    >`SELECT * FROM blogs WHERE id IN (SELECT DISTINCT blog_id FROM list_blogs)`;
  }
  return query<Blog>`SELECT * FROM blogs`;
};

export const getBlogById = async (id: number): Promise<Blog | null> => {
  return await queryOne<Blog>`SELECT * FROM blogs WHERE id = ${id}`;
};

export const getBlogByUrl = async (url: string): Promise<Blog | null> => {
  const sanitizedUrl = sanitizeUrl(url, false);
  return await queryOne<
    Blog
  >`SELECT * FROM blogs WHERE feed_url = ${sanitizedUrl} OR site_url = ${sanitizedUrl}`;
};

// TODO: DRY this (cf. main.ts)
const sendBlogToQueue = async (blog: Blog): Promise<void> => {
  // Send a message to the feed queue with the new feed to fetch its posts
  const connection = await connect({
    hostname: Deno.env.get("RABBITMQ_HOST") || "localhost",
    username: Deno.env.get("RABBITMQ_USER") || "guest",
    password: Deno.env.get("RABBITMQ_PASSWORD") || "guest",
  });
  const channel = await connection.openChannel();
  await channel.declareQueue({
    queue: "feed_queue",
    durable: true,
  });
  await channel.publish(
    { routingKey: "feed_queue" },
    { contentType: "application/json" },
    new TextEncoder().encode(JSON.stringify(blog)),
  );
  console.log("Feed added to queue for fetching");
  await connection.close();
};

function isProbablyFeed(content: string): boolean {
  const str = content.trim();

  if (!str.match(/^\s*(?:<\?xml|<rss|<feed)/i)) {
    return false;
  }

  return true;
}

export const getBlogFeedUrlFromUrl = async (
  url: string,
): Promise<string | null> => {
  const autodiscoverFeedUrl = async () => {
    const timeout = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));
    const res = await Promise.race([
      new Promise<string | null>((resolve) => {
        feedFinder(url, (err: unknown, feedUrls: string[]) => {
          if (err) {
            console.error(err);
            resolve(null);
          } else {
            resolve(feedUrls[0]);
          }
        });
      }),
      timeout(15000),
    ]);
    if (!res || typeof res !== "string") {
      console.log("Failed to autodiscover feed URL");
      return null;
    }
    console.log("Autodiscovered feed URL:", res);
    return res;
  };
  try {
    // Is this a valid URL?
    new URL(url);
  } catch (_: unknown) {
    return null;
  }
  try {
    // Attempt to fetch feed from the URL directly (in case it's a feed URL)
    const res = await fetch(url);
    if (!res.ok) {
      return autodiscoverFeedUrl();
    }
    const maybeXml = await res.text();
    if (isProbablyFeed(maybeXml)) {
      return url;
    }
    return autodiscoverFeedUrl();
  } catch (_: unknown) {
    return autodiscoverFeedUrl();
  }
};

export const createBlog = async (blog: CreateBlog): Promise<Blog | null> => {
  try {
    const feedUrl = await getBlogFeedUrlFromUrl(blog.feed_url);
    if (!feedUrl) {
      return null;
    }
    const existingBlog = await getBlogByUrl(feedUrl);
    if (existingBlog) {
      console.log("Blog already exists in database");
      await sendBlogToQueue(existingBlog);
      return existingBlog;
    }
    const res = await fetch(feedUrl);
    if (!res.ok) {
      return null;
    }
    const xml = await res.text();
    const feed = await parseFeed(xml);
    if (!feed) {
      return null;
    }
    console.log("Feed parsed successfully");
    // Create the blog in the database
    const newBlogId = await queryOne<{ id: number }>`
            INSERT INTO blogs (feed_url, site_url, auto_title, auto_description, auto_image_url, auto_author)
            VALUES (
                ${feedUrl},
                ${sanitizeUrl(feed.links?.[0], true) || null},
                ${feed.title?.value || null},
                ${feed.description || null},
                ${feed.image?.url || null},
                ${feed.author?.name || null}
            )
            RETURNING id`;
    if (!newBlogId) {
      throw new Error("Failed to create blog");
    }
    await query`UPDATE blogs SET hash_id = ${
      encode(newBlogId.id)
    } WHERE id = ${newBlogId.id}`;
    const newBlog = await getBlogById(newBlogId.id);
    if (!newBlog) {
      throw new Error("Failed to create blog");
    }

    await sendBlogToQueue(newBlog);

    return newBlog;
  } catch (e: unknown) {
    console.error(e);
    return null;
  }
};

export const updateBlog = async (
  id: number,
  blog: UpdateBlog,
): Promise<Blog | null> => {
  await query`UPDATE blogs
        SET
            feed_url = ${blog.feed_url},
            site_url = ${blog.site_url},
            auto_title = ${blog.auto_title},
            auto_description = ${blog.auto_description},
            auto_image_url = ${blog.auto_image_url},
            auto_author = ${blog.auto_author}
        WHERE id = ${id}`;
  return getBlogById(id);
};

export const updateBlogLastFetchedAt = async (id: number): Promise<void> => {
  await query`UPDATE blogs SET last_fetched_at = ${
    new Date().toISOString()
  } WHERE id = ${id}`;
};

export const updateBlogPostsLastMonth = async (blogId: number): Promise<void> => {
  await query`UPDATE blogs
        SET posts_last_month = (
            SELECT COUNT(*)
            FROM posts
            WHERE blog_id = ${blogId}
            AND published_at >= (CURRENT_TIMESTAMP - INTERVAL '1 month')
        )
        WHERE id = ${blogId}`;
};

export const updateBlogStats = async (blogId: number): Promise<void> => {
  await updateBlogLastFetchedAt(blogId);
  await updateBlogPostsLastMonth(blogId);
};

export const deleteBlog = async (id: number): Promise<void> => {
  await query`DELETE FROM blogs WHERE id = ${id}`;
};
