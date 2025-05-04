import z from "https://deno.land/x/zod@v3.23.8/index.ts";
import { db, query, queryOne } from "../lib/db.ts";
import { decode, encode } from "../lib/hashids.ts";
import joinjs from "npm:join-js";
import { PublicUserFieldsSchema } from "./User.ts";
import { shuffleArray } from "../lib/util.ts";
import { ListBlogSchema } from "./ListBlog.ts";
import { Atom } from "jsr:@feed/feed";
import { getPostsForListsIds } from "./Post.ts";
import { markdownToHtml } from "../lib/text.ts";
import { SortValue } from "../views/ListSearchPage.tsx";

export const ListSchema = z.object({
  id: z.number(),
  hash_id: z.string(),
  user_id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  is_private: z.coerce.boolean(),
  created_at: z.coerce.date(),
  user: PublicUserFieldsSchema,
  list_followers: z.array(
    PublicUserFieldsSchema.pick({
      id: true,
      username: true,
      hash_id: true,
    }),
  ).optional(),
  list_blogs: z.array(ListBlogSchema).optional(),
}).transform(async (data) => ({
  ...data,
  rendered_description: data.description
    ? await markdownToHtml(data.description)
    : "",
}));

export type ListObject = z.infer<typeof ListSchema>;
export type List = ListObject;

export type CreateList = Pick<List, "name" | "description">;
export type UpdateList = Pick<List, "name" | "description">;

const listQuery = `
    SELECT
        l.id as list_id,
        l.hash_id as list_hash_id,
        l.user_id as list_user_id,
        l.name as list_name,
        l.description as list_description,
        l.is_private as list_is_private,
        l.created_at as list_created_at,
        lb.list_id as lb_list_id,
        lb.blog_id as lb_blog_id,
        lb.custom_title as lb_custom_title,
        lb.custom_description as lb_custom_description,
        lb.custom_image_url as lb_custom_image_url,
        lb.custom_author as lb_custom_author,
        lb.created_at as lb_created_at,
        u.id as user_id,
        u.hash_id as user_hash_id,
        u.username as user_username,
        u.avatar_url as user_avatar_url,
        u.bio as user_bio,
        follower.id as follower_id,
        follower.hash_id as follower_hash_id,
        follower.username as follower_username,
        b.id as blog_id,
        b.hash_id as blog_hash_id,
        b.feed_url as blog_feed_url,
        b.site_url as blog_site_url,
        b.auto_title as blog_auto_title,
        b.auto_description as blog_auto_description,
        b.auto_author as blog_auto_author,
        b.auto_image_url as blog_auto_image_url,
        b.posts_last_month as blog_posts_last_month,
        b.last_fetched_at as blog_last_fetched_at,
        b.last_published_at as blog_last_published_at,
        b.created_at as blog_created_at
    FROM lists l
    LEFT JOIN users u ON l.user_id = u.id
    LEFT JOIN list_blogs lb ON l.id = lb.list_id
    LEFT JOIN list_followers lf ON l.id = lf.list_id
    LEFT JOIN users follower ON lf.user_id = follower.id
    LEFT JOIN blogs b ON lb.blog_id = b.id
`;

const buildListsResponse = async (rows: unknown[]): Promise<List[] | null> => {
  if (!rows || rows.length === 0) {
    return null;
  }
  const resultMaps = [
    {
      mapId: "listMap",
      idProperty: "id",
      properties: [
        "hash_id",
        "user_id",
        "name",
        "description",
        "is_private",
        "created_at",
      ],
      collections: [
        {
          name: "list_blogs",
          mapId: "listBlogMap",
          columnPrefix: "lb_",
        },
        {
          name: "list_followers",
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
      idProperty: "blog_id",
      properties: [
        "custom_title",
        "custom_description",
        "custom_image_url",
        "custom_author",
        "created_at",
        "list_id",
        "blog_id",
      ],
      associations: [
        { name: "blog", mapId: "blogMap", columnPrefix: "blog_" },
      ],
    },
    {
      mapId: "blogMap",
      idProperty: "id",
      properties: [
        "feed_url",
        "site_url",
        "auto_title",
        "auto_description",
        "auto_image_url",
        "auto_author",
        "posts_last_month",
        "last_fetched_at",
        "last_published_at",
        "created_at",
        "hash_id",
      ],
    },
    {
      mapId: "listFollowerMap",
      idProperty: "id",
      properties: ["hash_id", "username", "id"],
    },
    {
      mapId: "userMap",
      idProperty: "id",
      properties: ["username", "id", "avatar_url", "bio", "hash_id"],
    },
  ];
  const result = joinjs.default.map(rows, resultMaps, "listMap", "list_");
  console.log(result);
  return await z.array(ListSchema).parseAsync(result);
};

export const getListById = async (id: number): Promise<List | null> => {
  const { rows } = await db.queryObject(listQuery + " WHERE l.id = $1", [id]);
  const lists = await buildListsResponse(rows);
  return lists ? lists[0] : null;
};

export const getCreatedListsByUserId = async (
  userId: number,
): Promise<List[]> => {
  const { rows } = await db.queryObject(
    listQuery
    + " WHERE l.user_id = $1"
    + " ORDER BY l.name ASC",
    [userId],
  );
  return await buildListsResponse(rows) || [];
};

export const getAllListsContainingBlog = async (
  blogId: number,
): Promise<List[]> => {
  const { rows } = await db.queryObject(
    listQuery + " WHERE lb.blog_id = $1"
    + " ORDER BY l.name ASC",
    [blogId],
  );
  return await buildListsResponse(rows) || [];
};

export const getFollowedListsByUserId = async (
  userId: number,
): Promise<List[]> => {
  const { rows } = await db.queryObject(
    "WITH followed_lists AS (SELECT DISTINCT list_id FROM list_followers WHERE user_id = $1)"
    + listQuery
    + " WHERE l.id IN (SELECT list_id FROM followed_lists)"
    + " ORDER BY l.name ASC",
    [userId],
  );
  return await buildListsResponse(rows) || [];
};

export const getAllLists = async (): Promise<List[]> => {
  const { rows } = await db.queryObject(listQuery);
  return await buildListsResponse(rows) || [];
};

export const getAllListsByFilter = async (
  filter: string,
  limit: number,
  offset: number,
  sort: SortValue,
): Promise<[List[], boolean]> => {
  const { rows } = await db.queryObject(
    listQuery +
      "WHERE l.name ILIKE $1 OR l.description ILIKE $2",
    [`%${filter}%`, `%${filter}%`],
  );
  let lists = await buildListsResponse(rows);
  if (!lists) {
    return [[], false];
  }
  if (sort === "most_followed") {
    // Subsequently sort by the number of followers
    lists.sort((a, b) => {
      const aFollowers = a.list_followers?.length || 0;
      const bFollowers = b.list_followers?.length || 0;
      return bFollowers - aFollowers;
    });
  } else if (sort === "most_blogs") {
    // Subsequently sort by the number of blogs
    lists.sort((a, b) => {
      const aBlogs = a.list_blogs?.length || 0;
      const bBlogs = b.list_blogs?.length || 0;
      return bBlogs - aBlogs;
    });
  } else if (sort === "last_created") {
    // Subsequently sort by the last created date of list
    lists.sort((a, b) => {
      const aCreatedAt = a.created_at || new Date(0);
      const bCreatedAt = b.created_at || new Date(0);
      return bCreatedAt.getTime() - aCreatedAt.getTime();
    });
  } else if (sort === "last_updated") {
    // Subsequently sort by the last published blog
    const listsWithDates = lists.map((list) => {
      const lastPublishedAt = list.list_blogs?.reduce((acc, lb) => {
        if (!lb.blog.last_published_at) {
          return acc;
        }
        return lb.blog.last_published_at > acc
          ? lb.blog.last_published_at
          : acc;
      }, new Date(0)) || new Date(0);

      return {
        ...list,
        lastPublishedAt: lastPublishedAt.getTime(),
      };
    });
    listsWithDates.sort((a, b) => b.lastPublishedAt - a.lastPublishedAt);
    lists = listsWithDates;
  }
  const pagedLists = lists.slice(offset, offset + limit);
  return [pagedLists, lists.length > offset + limit];
};

export const getRandomLists = async (limit: number): Promise<List[]> => {
  const allLists = await getAllLists();
  return shuffleArray(allLists).slice(0, limit);
};

export const getListByHashId = async (hashId: string): Promise<List | null> => {
  const id = decode(hashId);
  return await getListById(id);
};

export const getAllListsByUserId = async (
  userId: number,
): Promise<List[]> => {
  const { rows } = await db.queryObject(
    listQuery + " WHERE l.user_id = $1"
      + " ORDER BY l.name ASC",
    [userId],
  );
  const lists = await buildListsResponse(rows);
  return lists || [];
};

export const createList = async (
  list: CreateList,
  userId: number,
): Promise<List | null> => {
  const result = await queryOne<{ id: number }>`
        INSERT INTO lists (user_id, name, description, is_private, created_at)
        VALUES (${userId}, ${list.name}, ${list.description}, false, ${
    new Date().toISOString()
  })
        RETURNING id
    `;

  if (!result) {
    return null;
  }

  await query`UPDATE lists SET hash_id = ${
    encode(result.id)
  } WHERE id = ${result.id}`;
  return await getListById(result.id);
};

export const updateList = async (
  id: number,
  list: UpdateList,
): Promise<List | null> => {
  await query`
        UPDATE lists
        SET
            name = ${list.name},
            description = ${list.description}
        WHERE id = ${id}
    `;
  return await getListById(id);
};

export const deleteList = async (id: number): Promise<boolean> => {
  await query`DELETE FROM lists WHERE id = ${id}`;
  return true;
};

export const listToAtomFeed = async (list: List): Promise<string> => {
  const atomFeed = new Atom({
    title: `${list.name} - BlogFlock`,
    description: list.description || "",
    link: `https://blogflock.com/lists/${list.hash_id}`,
    authors: [
      {
        name: list.list_blogs?.map((lb) => lb.author || lb.title)
          .filter((author) => author)
          .join(", ") || "",
        email: "",
      },
    ],
    id: `https://blogflock.com/lists/${list.hash_id}`,
    generator: "BlogFlock",
  });

  // Retrieve the 20 most recent posts from the list
  const [posts] = await getPostsForListsIds([list.id], 20, 0);
  posts.forEach((post) => {
    atomFeed.addItem({
      title: `${post.title} - ${post.list_blog.title}`,
      link: post.url,
      id: post.guid,
      updated: post.published_at,
      summary: "",
      content: {
        body: post.content,
        type: "html",
      },
    });
  });

  return atomFeed.build();
};
