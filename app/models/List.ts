import z from "https://deno.land/x/zod@v3.23.8/index.ts";
import { RowObject } from "https://deno.land/x/sqlite@v3.8/mod.ts";
import { db } from "../lib/db.ts";
import { decode, encode } from "../lib/hashids.ts";
import joinjs from "npm:join-js";
import { PublicUserFieldsSchema } from "./User.ts";
import { shuffleArray } from "../lib/util.ts";
import { ListBlogSchema } from "./ListBlog.ts";
import { Atom } from "jsr:@feed/feed";
import { getPostsForListsIds } from "./Post.ts";

export const ListSchema = z.object({
    id: z.number(),
    hashId: z.string(),
    userId: z.number(),
    name: z.string(),
    description: z.string().nullable(),
    isPrivate: z.coerce.boolean(),
    createdAt: z.coerce.date(),
    user: PublicUserFieldsSchema,
    listFollowers: z.array(
        PublicUserFieldsSchema.pick({ id: true, username: true, hashId: true }),
    ).optional(),
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
        u.id as user_id,
        u.hashId as user_hashId,
        u.username as user_username,
        u.avatarUrl as user_avatarUrl,
        u.bio as user_bio,
        follower.id as follower_id,
        follower.hashId as follower_hashId,
        follower.username as follower_username,
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
    LEFT JOIN users follower ON lf.userId = follower.id
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
                    columnPrefix: "follower_",
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
            idProperty: "id",
            properties: ["hashId", "username", "id"],
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
        ORDER BY blog_lastFetchedAt DESC`,
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

export const listToAtomFeed = async (list: List): Promise<string> => {
    const atomFeed = new Atom({
        title: `${list.name} - BlogFlock`,
        description: list.description || "",
        link: `https://blogflock.com/lists/${list.hashId}`,
        authors: [
            {
                name: list.listBlogs?.map((lb) => lb.author || lb.title)
                    .filter((author) => author)
                    .join(", ") || "",
                email: "",
            },
        ],
        id: `https://blogflock.com/lists/${list.hashId}`,
        generator: "BlogFlock",
    });

    // Retrieve the 20 most recent posts from the list
    const [posts] = getPostsForListsIds([list.id], 20, 0);
    posts.forEach((post) => {
        atomFeed.addItem({
            title: `${post.title} - ${post.listBlog.title}`,
            link: post.url,
            id: post.guid,
            updated: post.publishedAt,
            summary: "",
            content: {
                body: post.content,
                type: "html",
            },
        });
    });

    return atomFeed.build();
};

export const listToOpml = (list: List): string => {
    const opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
    <head>
        <title>${list.name} - BlogFlock</title>
        <dateCreated>${list.createdAt.toISOString()}</dateCreated>
        <dateModified>${(list.listBlogs?.reduce((acc, lb) => { return acc > lb.createdAt ? acc : lb.createdAt; }, new Date(0)).toISOString()) || new Date().toISOString()}</dateModified>
        <ownerName>${list.user.username}</ownerName>
        <ownerId>https://blogflock.com/list/${list.hashId}</ownerId>
    </head>
    <body>
        ${list.listBlogs?.map((lb) => `
            <outline text="${lb.title}" title="${lb.title}" description="${lb.description}" type="rss" xmlUrl="${lb.blog.feedUrl}" htmlUrl="${lb.blog.siteUrl}" />
        `).join("")}
    </body>
</opml>`;

    return opml;
}