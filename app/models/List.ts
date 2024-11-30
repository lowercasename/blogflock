import z from "https://deno.land/x/zod@v3.23.8/index.ts";
import { RowObject } from "https://deno.land/x/sqlite@v3.8/mod.ts";
import { db } from "../lib/db.ts";
import { decode, encode } from "../lib/hashids.ts";
import joinjs from "npm:join-js";
import { ListFollowerSchema } from "./ListFollower.ts";
import { PublicUserFieldsSchema } from "./User.ts";
import { shuffleArray } from "../lib/util.ts";
import { ListBlogSchema } from "./ListBlog.ts";

export const ListSchema = z.object({
    id: z.number(),
    hashId: z.string(),
    userId: z.number(),
    name: z.string(),
    description: z.string().nullable(),
    isPrivate: z.coerce.boolean(),
    createdAt: z.coerce.date(),
    user: PublicUserFieldsSchema,
    listFollowers: z.array(ListFollowerSchema).optional(),
    listBlogs: z.array(ListBlogSchema).optional(),
});

export type ListObject = z.infer<typeof ListSchema>;

export interface List extends ListObject, RowObject {}

export type CreateList = Pick<List, "name" | "description">;

export type UpdateList = Pick<List, "name" | "description">;

const query = `
    SELECT 
        l.*,
        lb.listId as lb_listId,
        lb.blogId as lb_blogId,
        lb.customTitle as lb_customTitle,
        lb.customDescription as lb_customDescription,
        lb.customImageUrl as lb_customImageUrl,
        lb.customAuthor as lb_customAuthor,
        lb.createdAt as lb_createdAt,
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

const buildListsResponse = (rows: RowObject[]): List[] | null => {
    if (!rows) {
        return null;
    }
    const resultMaps = [
        {
            mapId: "listMap",
            idProperty: "id",
            properties: [
                "hashId",
                "userId",
                "name",
                "description",
                "isPrivate",
                "createdAt",
            ],
            collections: [
                {
                    name: "listBlogs",
                    mapId: "listBlogMap",
                    columnPrefix: "lb_",
                },
                {
                    name: "listFollowers",
                    mapId: "listFollowerMap",
                    columnPrefix: "lf_",
                },
            ],
            associations: [
                { name: "user", mapId: "userMap", columnPrefix: "user_" },
            ],
        },
        {
            mapId: "listBlogMap",
            idProperty: "blogId",
            properties: [
                "customTitle",
                "customDescription",
                "customImageUrl",
                "customAuthor",
                "createdAt",
                "listId",
                "blogId",
            ],
            associations: [
                { name: "blog", mapId: "blogMap", columnPrefix: "blog_" },
            ],
        },
        {
            mapId: "blogMap",
            idProperty: "id",
            properties: [
                "feedUrl",
                "siteUrl",
                "autoTitle",
                "autoDescription",
                "autoImageUrl",
                "autoAuthor",
                "lastFetchedAt",
                "createdAt",
                "hashId",
            ],
        },
        {
            mapId: "listFollowerMap",
            idProperty: "userId",
            properties: ["userId", "listId"],
        },
        {
            mapId: "userMap",
            idProperty: "id",
            properties: ["username", "id", "avatarUrl", "bio", "hashId"],
        },
    ];
    const result = joinjs.default.map(rows, resultMaps, "listMap", "");
    return z.array(ListSchema).parse(result);
};

export const getListById = (id: number): List | null => {
    const rows = db.queryEntries(query + " WHERE l.id = ?", [id]);
    const lists = buildListsResponse(rows);
    return lists ? lists[0] : null;
};

export const getCreatedListsByUserId = (userId: number): List[] => {
    const rows = db.queryEntries(query + " WHERE l.userId = ?", [userId]);
    return buildListsResponse(rows) || [];
};

export const getAllListsContainingBlog = (blogId: number): List[] => {
    const rows = db.queryEntries(
        query + " WHERE lb.blogId = ?",
        [blogId],
    );
    return buildListsResponse(rows) || [];
};

export const getFollowedListsByUserId = (userId: number): List[] => {
    const rows = db.queryEntries(
        query + " WHERE lf.userId = ?",
        [userId],
    );
    return buildListsResponse(rows) || [];
};

export const getAllLists = (): List[] => {
    const rows = db.queryEntries(query);
    return buildListsResponse(rows) || [];
};

export const getAllListsByFilter = (
    filter: string,
    limit: number,
    offset: number,
): [List[], boolean] => {
    const rows = db.queryEntries(
        `${query} WHERE l.name LIKE ? OR l.description LIKE ?
        ORDER BY l.createdAt DESC`,
        [`%${filter}%`, `%${filter}%`],
    );
    const lists = buildListsResponse(rows);
    if (!lists) {
        return [[], false];
    }
    const pagedLists = lists.slice(offset, offset + limit);
    return [pagedLists, lists.length > offset + limit];
};

export const getRandomLists = (limit: number): List[] => {
    return shuffleArray(getAllLists()).slice(0, limit);
};

export const getListByHashId = (hashId: string): List | null => {
    const id = decode(hashId);
    return getListById(id);
};

export const createList = (list: CreateList, userId: number): List | null => {
    db.query(
        `INSERT INTO lists (userId, name, description, isPrivate, createdAt) VALUES (?, ?, ?, ?, ?)`,
        [userId, list.name, list.description, false, new Date().toISOString()],
    );
    db.query("UPDATE lists SET hashId = ? WHERE id = ?", [
        encode(db.lastInsertRowId),
        db.lastInsertRowId,
    ]);
    return getListById(db.lastInsertRowId);
};

export const updateList = (id: number, list: UpdateList): List | null => {
    db.query(
        `UPDATE lists SET name = ?, description = ? WHERE id = ?`,
        [list.name, list.description, id],
    );
    return getListById(id);
};

export const deleteList = (id: number): boolean => {
    db.query(`DELETE FROM lists WHERE id = ?`, [id]);
    return true;
};
