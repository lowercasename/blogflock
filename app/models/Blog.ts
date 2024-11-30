import z from "https://deno.land/x/zod@v3.23.8/index.ts";
import { RowObject } from "https://deno.land/x/sqlite@v3.8/mod.ts";
import { db } from "../lib/db.ts";
import { parseFeed } from "https://deno.land/x/rss@1.1.1/mod.ts";
import feedFinder from "npm:feed-finder";
import { encode } from "../lib/hashids.ts";
import { sanitizeUrl } from "../lib/url.ts";
import { connect } from "https://deno.land/x/amqp@v0.24.0/mod.ts";

export const BlogSchema = z.object({
    id: z.number(),
    hashId: z.string(),
    feedUrl: z.string(),
    siteUrl: z.string().nullable(),
    autoTitle: z.string().nullable(),
    autoDescription: z.string().nullable(),
    autoImageUrl: z.string().nullable(),
    autoAuthor: z.string().nullable(),
    lastFetchedAt: z.coerce.date().nullable(),
    createdAt: z.coerce.date(),
});

export type BlogObject = z.infer<typeof BlogSchema>;

export interface Blog extends BlogObject, RowObject {}

export type CreateBlog = Pick<Blog, "feedUrl">;

export type UpdateBlog = Pick<
    Blog,
    | "feedUrl"
    | "siteUrl"
    | "autoTitle"
    | "autoDescription"
    | "autoImageUrl"
    | "autoAuthor"
>;

export const getBlogs = (): Blog[] => {
    return db.queryEntries<Blog>(`SELECT * FROM blogs`);
};

export const getBlogById = (id: number): Blog | null => {
    return db.queryEntries<Blog>(`SELECT * FROM blogs WHERE id = ?`, [id])?.[0];
};

export const getBlogByUrl = (url: string): Blog | null => {
    const sanitizedUrl = sanitizeUrl(url, false);
    return db.queryEntries<Blog>(
        `SELECT * FROM blogs WHERE feedUrl = ? or siteUrl = ?`,
        [sanitizedUrl, sanitizedUrl],
    )?.[0];
};

const sendBlogToQueue = async (blog: Blog): Promise<void> => {
    // Send a message to the feed queue with the new feed to fetch its posts
    const connection = await connect();
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
        const feedUrl = await getBlogFeedUrlFromUrl(blog.feedUrl);
        if (!feedUrl) {
            return null;
        }
        const existingBlog = getBlogByUrl(feedUrl);
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
        db.query(
            `INSERT INTO blogs (feedUrl, siteUrl, autoTitle, autoDescription, autoImageUrl, autoAuthor) VALUES (:feedUrl, :siteUrl, :autoTitle, :autoDescription, :autoImageUrl, :autoAuthor)`,
            {
                feedUrl,
                siteUrl: sanitizeUrl(feed.links?.[0], true) || null,
                autoTitle: feed.title?.value || null,
                autoDescription: feed.description || null,
                autoImageUrl: feed.image?.url || null,
                autoAuthor: feed.author?.name || null,
            },
        );
        const id = db.lastInsertRowId;
        db.query(`UPDATE blogs SET hashId = ? WHERE id = ?`, [
            encode(id),
            id,
        ]);
        const newBlog = getBlogById(id);
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

export const updateBlog = (id: number, blog: UpdateBlog): Blog | null => {
    db.query(
        `UPDATE blogs SET feedUrl = ?, siteUrl = ?, autoTitle = ?, autoDescription = ?, autoImageUrl = ? WHERE id = ?`,
        [
            blog.feedUrl,
            blog.siteUrl,
            blog.autoTitle,
            blog.autoDescription,
            blog.autoImageUrl,
            id,
        ],
    );
    return getBlogById(id);
};

export const updateBlogLastFetchedAt = (id: number): void => {
    db.query(`UPDATE blogs SET lastFetchedAt = ? WHERE id = ?`, [
        new Date().toISOString(),
        id,
    ]);
};

export const deleteBlog = (id: number): void => {
    db.query(`DELETE FROM blogs WHERE id = ?`, [id]);
};
