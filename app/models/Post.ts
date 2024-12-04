import z from "https://deno.land/x/zod@v3.23.8/index.ts";
import { RowObject } from "https://deno.land/x/sqlite@v3.8/mod.ts";
import { db } from "../lib/db.ts";
import joinjs from "npm:join-js";
import { excerpt, hash } from "../lib/text.ts";
import { ListBlogWithRelationsSchema } from "./ListBlog.ts";

export const PostSchema = z.object({
    id: z.number(),
    blogId: z.number(),
    title: z.string(),
    content: z.string(),
    url: z.string(),
    publishedAt: z.coerce.date(),
    createdAt: z.coerce.date(),
    guid: z.string(),
    listBlog: ListBlogWithRelationsSchema,
}).transform(({ content, ...rest }) => ({
    ...rest,
    shortContent: excerpt(content, 50),
}));

export type PostObject = z.infer<typeof PostSchema>;

export interface Post extends PostObject, RowObject { }

export type CreatePost = Pick<
    Post,
    "blogId" | "title" | "content" | "url" | "publishedAt" | "guid"
>;

export type UpdatePost = Pick<
    Post,
    "title" | "content" | "url" | "publishedAt" | "guid"
>;

export const generatePostGuid = async (
    post: { guid?: string; url?: string; title: string; publishedAt: Date },
): Promise<string> => {
    // If there isn't a GUID, try the URL, and if that doesn't exist, hash the title and date
    return post.guid || post.url ||
        (await hash(post.title + post.publishedAt.getTime()));
};

export const sanitizePostPublishedAt = (v?: string | Date | null): string => {
    if (!v) {
        return new Date().toISOString();
    }
    let publishedAt: string;
    try {
        const date = new Date(v);
        if (isNaN(date.getTime())) {
            publishedAt = new Date().toISOString();
        } else {
            publishedAt = date.toISOString();
        }
    } catch {
        publishedAt = new Date().toISOString();
    }
    return publishedAt;
};

export const getPostById = (id: number): Post | null => {
    return db.queryEntries<Post>(`SELECT * FROM posts WHERE id = ?`, [id])?.[0];
};

export const getPostByGuid = (guid: string, blogId: number): Post | null => {
    return db.queryEntries<Post>(
        `SELECT * FROM posts WHERE guid = ? AND blogId = ?`,
        [guid, blogId],
    )?.[0];
};

export const createPost = async (post: CreatePost): Promise<Post> => {
    db.query(
        `INSERT INTO posts (blogId, title, content, url, publishedAt, guid, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            post.blogId,
            post.title,
            post.content,
            post.url,
            sanitizePostPublishedAt(post.publishedAt),
            await generatePostGuid(post),
            new Date().toISOString(),
        ],
    );
    return db.queryEntries<Post>(`SELECT * FROM posts WHERE id = ?`, [
        db.lastInsertRowId,
    ])[0];
};

const query = `
    SELECT
        p.*,
		lb.listId as lb_listId,
        lb.blogId as lb_blogId,
        lb.customTitle as lb_customTitle,
        lb.customDescription as lb_customDescription,
        lb.customImageUrl as lb_customImageUrl,
        lb.customAuthor as lb_customAuthor,
        lb.createdAt as lb_createdAt,
        l.id as list_id,
        l.hashId as list_hashId,
        l.userId as list_userId,
        l.name as list_name,
        l.description as list_description,
        l.isPrivate as list_isPrivate,
        l.createdAt as list_createdAt,
        u.id as user_id,
        u.hashId as user_hashId,
        u.username as user_username,
        u.avatarUrl as user_avatarUrl,
        u.bio as user_bio,
        b.id as blog_id,
        b.hashId as blog_hashId,
        b.feedUrl as blog_feedUrl,
        b.siteUrl as blog_siteUrl,
        b.autoTitle as blog_autoTitle,
        b.autoDescription as blog_autoDescription,
        b.autoAuthor as blog_autoAuthor,
        b.autoImageUrl as blog_autoImageUrl,
        b.lastFetchedAt as blog_lastFetchedAt,
        b.createdAt as blog_createdAt
    FROM posts p
    LEFT JOIN blogs b ON p.blogId = b.id
	LEFT JOIN list_blogs lb on lb.blogId = b.id
    LEFT JOIN lists l ON lb.listId = l.id
    LEFT JOIN users u ON l.userId = u.id
`;

const buildPostsResponse = (rows: RowObject[]): Post[] | null => {
    if (!rows) {
        return null;
    }
    const resultMaps = [
        {
            mapId: "postMap",
            idProperty: "id",
            properties: [
                "id",
                "blogId",
                "title",
                "content",
                "url",
                "publishedAt",
                "createdAt",
                "guid",
            ],
            associations: [
                { name: "listBlog", mapId: "listBlogMap", columnPrefix: "lb_" },
            ],
        },
        {
            mapId: "listBlogMap",
            idProperty: "id",
            properties: [
                "listId",
                "blogId",
                "customTitle",
                "customDescription",
                "customImageUrl",
                "customAuthor",
                "createdAt",
            ],
            associations: [
                { name: "blog", mapId: "blogMap", columnPrefix: "blog_" },
                { name: "list", mapId: "listMap", columnPrefix: "list_" },
            ],
        },
        {
            mapId: "blogMap",
            idProperty: "id",
            properties: [
                "id",
                "hashId",
                "feedUrl",
                "siteUrl",
                "autoTitle",
                "autoDescription",
                "autoAuthor",
                "autoImageUrl",
                "lastFetchedAt",
                "createdAt",
            ],
        },
        {
            mapId: "listMap",
            idProperty: "id",
            properties: [
                "id",
                "hashId",
                "userId",
                "name",
                "description",
                "isPrivate",
                "createdAt",
            ],
            associations: [
                { name: "user", mapId: "userMap", columnPrefix: "user_" },
            ],
        },
        {
            mapId: "userMap",
            idProperty: "id",
            properties: ["id", "hashId", "username", "avatarUrl", "bio"],
        },
    ];
    const result = joinjs.default.map(rows, resultMaps, "postMap", "");
    return z.array(PostSchema).parse(result);
};

export const getPostsForListsIds = (
    listIds: number[],
    limit: number,
    offset: number,
): [Post[], boolean] => {
    const rows = db.queryEntries(
        `${query} WHERE lb.listId IN (${listIds.join(",")
        }) ORDER BY p.publishedAt DESC LIMIT ? OFFSET ?`,
        [limit + 1, offset],
    );
    const posts = buildPostsResponse(rows);
    if (!posts) {
        return [[], false];
    }
    if (posts.length <= limit) {
        return [posts, false];
    }
    const hasMore = posts.length > limit;
    const postsToReturn = hasMore ? posts.slice(0, limit) : posts;

    return [postsToReturn, hasMore];
};

export const getPostsForFollowedListsByUserId = (
    userId: number,
    limit: number,
    offset: number,
): [Post[], boolean] => {
    const rows = db.queryEntries(
        `
        ${query}
        JOIN list_followers lf ON lb.listId = lf.listId
        WHERE lf.userId = ?
        ORDER BY p.publishedAt DESC
        LIMIT ? OFFSET ?
    `,
        [userId, limit + 1, offset],
    );
    const posts = buildPostsResponse(rows);
    if (!posts) {
        return [[], false];
    }
    const hasMore = posts.length > limit;
    const postsToReturn = hasMore ? posts.slice(0, limit) : posts;

    return [postsToReturn, hasMore];
};
