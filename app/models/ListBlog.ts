import z from "https://deno.land/x/zod@v3.23.8/index.ts";
import { RowObject } from "https://deno.land/x/sqlite@v3.8/mod.ts";
import { db } from "../lib/db.ts";
import { BlogSchema } from "./Blog.ts";
import { ListSchema } from "./List.ts";
import { DOMParser } from "jsr:@b-fuze/deno-dom";

export const ListBlogSchema = z.object({
    listId: z.number(),
    blogId: z.number(),
    customTitle: z.string().nullable(),
    customDescription: z.string().nullable(),
    customImageUrl: z.string().nullable(),
    customAuthor: z.string().nullable(),
    createdAt: z.coerce.date(),
    blog: BlogSchema,
}).transform(data => ({
    ...data,
    title: data.customTitle || data.blog.autoTitle,
    description: data.customDescription || data.blog.autoDescription,
    imageUrl: data.customImageUrl || data.blog.autoImageUrl,
    author: data.customAuthor || data.blog.autoAuthor,
  }));

export const ListBlogWithRelationsSchema = z.object({
    listId: z.number(),
    blogId: z.number(),
    customTitle: z.string().nullable(),
    customDescription: z.string().nullable(),
    customImageUrl: z.string().nullable(),
    customAuthor: z.string().nullable(),
    createdAt: z.coerce.date(),
    blog: BlogSchema,
    list: z.lazy(() => ListSchema),
}).transform(data => ({
    ...data,
    title: data.customTitle || data.blog.autoTitle || (data.blog.siteUrl ? new URL(data.blog.siteUrl).hostname : "Untitled Blog"),
    description: data.customDescription || data.blog.autoDescription,
    imageUrl: data.customImageUrl || data.blog.autoImageUrl,
    author: data.customAuthor || data.blog.autoAuthor,
  }));

export type ListBlogObject = z.infer<typeof ListBlogSchema>;
export type ListBlogWithRelationsObject = z.infer<typeof ListBlogWithRelationsSchema>;

export interface ListBlog extends ListBlogObject, RowObject {}
export interface ListBlogWithRelations extends ListBlogWithRelationsObject, RowObject {}

export type CreateListBlog = Partial<
    Pick<
        ListBlog,
        | "listId"
        | "blogId"
        | "customTitle"
        | "customDescription"
        | "customImageUrl"
        | "customAuthor"
    >
>;

export type UpdateListBlog = Pick<
    ListBlog,
    "customTitle" | "customDescription" | "customImageUrl" | "customAuthor"
>;

const query = `
    SELECT 
        lb.*,
        lf.userId as lf_userId,
        lf.listId as lf_listId,
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
    FROM lists l
    LEFT JOIN users u ON l.userId = u.id
    LEFT JOIN list_blogs lb ON l.id = lb.listId
    LEFT JOIN list_followers lf ON l.id = lf.listId
    LEFT JOIN blogs b ON lb.blogId = b.id
`;

const buildListBlogResponse = (rows: RowObject[]): ListBlog[] | null => {
    if (!rows) {
        return null;
    }
    const resultMaps = [
        {
            mapId: "listBlogMap",
            idProperty: "id",
            properties: ["listId", "blogId", "customTitle", "customDescription", "customImageUrl", "customAuthor", "createdAt"],
            associations: [
                { name: "blog", mapId: "blogMap", columnPrefix: "blog_" },
                { name: "list", mapId: "listMap", columnPrefix: "list_" },
            ],
        },
        {
            mapId: "blogMap",
            idProperty: "id",
            properties: ["id", "hashId", "feedUrl", "siteUrl", "autoTitle", "autoDescription", "autoAuthor", "autoImageUrl", "lastFetchedAt", "createdAt"],
        },
        {
            mapId: "listMap",
            idProperty: "id",
            properties: ["id", "hashId", "userId", "name", "description", "isPrivate", "createdAt"],
            associations: [
                { name: "user", mapId: "userMap", columnPrefix: "user_" },
            ],
        },
        {
            mapId: "userMap",
            idProperty: "id",
            properties: ["id", "hashId", "username", "avatarUrl", "bio"],
        },
    ]
    const result = joinjs.default.map(rows, resultMaps, "listBlogMap", "");
    return z.array(ListBlogSchema).parse(result);
};


export const addBlogToList = (listBlog: CreateListBlog): ListBlog => {
    db.query(
        `INSERT INTO list_blogs (listId, blogId, customTitle, customDescription, customImageUrl, createdAt) VALUES (?, ?, ?, ?, ?, ?)`,
        [
            listBlog.listId,
            listBlog.blogId,
            listBlog.customTitle,
            listBlog.customDescription,
            listBlog.customImageUrl,
            new Date().toISOString(),
        ],
    );
    return db.queryEntries<ListBlog>(
        `SELECT * FROM list_blogs WHERE listId = ? AND blogId = ?`,
        [
            listBlog.listId,
            listBlog.blogId,
        ],
    )[0];
};

export const removeBlogFromList = (listId: number, blogId: number): void => {
    db.query(`DELETE FROM list_blogs WHERE listId = ? AND blogId = ?`, [
        listId,
        blogId,
    ]);
};

export const updateBlogInList = (listId: number, blogId: number, listBlog: UpdateListBlog): ListBlog | null => {
    db.query(
        `UPDATE list_blogs SET customTitle = ?, customDescription = ?, customImageUrl = ?, customAuthor = ? WHERE listId = ? AND blogId = ?`,
        [
            listBlog.customTitle,
            listBlog.customDescription,
            listBlog.customImageUrl,
            listBlog.customAuthor,
            listId,
            blogId,
        ],
    );
    return db.queryEntries<ListBlog>(
        `SELECT * FROM list_blogs WHERE listId = ? AND blogId = ?`,
        [
            listId,
            blogId,
        ],
    )[0];
}