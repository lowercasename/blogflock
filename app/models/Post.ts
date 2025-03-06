import z from "https://deno.land/x/zod@v3.23.8/index.ts";
import { db, queryOne } from "../lib/db.ts";
import joinjs from "npm:join-js";
import { excerpt, hash } from "../lib/text.ts";
import { ListBlogWithRelationsSchema } from "./ListBlog.ts";

export const PostSchema = z.object({
  id: z.number(),
  blog_id: z.number(),
  title: z.string(),
  content: z.string(),
  url: z.string(),
  published_at: z.coerce.date(),
  created_at: z.coerce.date(),
  guid: z.string(),
  list_blog: ListBlogWithRelationsSchema,
}).transform((post) => ({
  ...post,
  title: post.title || `Post on ${post.list_blog.title}`,
  short_content: excerpt(post.content, 50),
}));

export type PostObject = z.infer<typeof PostSchema>;
export type Post = PostObject;

export type CreatePost = Pick<
  Post,
  "blog_id" | "title" | "content" | "url" | "published_at" | "guid"
>;

export type UpdatePost = Pick<
  Post,
  "title" | "content" | "url" | "published_at" | "guid"
>;

export const generatePostGuid = async (
  post: { guid?: string; url?: string; title: string; published_at: Date },
): Promise<string> => {
  // If there isn't a GUID, try the URL, and if that doesn't exist, hash the title and date
  return post.guid || post.url ||
    (await hash(post.title + post.published_at.getTime()));
};

export const sanitizePostPublishedAt = (v?: string | Date | null): string => {
  if (!v) {
    return new Date().toISOString();
  }
  let published_at: string;
  try {
    const date = new Date(v);
    if (isNaN(date.getTime())) {
      published_at = new Date().toISOString();
    } else {
      published_at = date.toISOString();
    }
  } catch {
    published_at = new Date().toISOString();
  }
  return published_at;
};

export const getPostById = async (id: number): Promise<Post | null> => {
  return await queryOne<Post>`SELECT * FROM posts WHERE id = ${id}`;
};

export const getPostByGuid = async (
  guid: string,
  blogId: number,
): Promise<Post | null> => {
  return await queryOne<Post>`
        SELECT * FROM posts 
        WHERE guid = ${guid} AND blog_id = ${blogId}
    `;
};

export const createPost = async (post: CreatePost): Promise<Post | null> => {
  const result = await queryOne<{ id: number }>`
        INSERT INTO posts (
            blog_id, 
            title, 
            content, 
            url, 
            published_at, 
            guid, 
            created_at
        ) 
        VALUES (
            ${post.blog_id},
            ${post.title},
            ${post.content},
            ${post.url},
            ${sanitizePostPublishedAt(post.published_at)},
            ${await generatePostGuid(post)},
            ${new Date().toISOString()}
        )
        RETURNING id
    `;

  if (!result) {
    return null;
  }

  return await getPostById(result.id);
};

const postQuery = `
    SELECT
        p.id as post_id,
        p.blog_id as post_blog_id,
        p.title as post_title,
        p.content as post_content,
        p.url as post_url,
        p.published_at as post_published_at,
        p.created_at as post_created_at,
        p.guid as post_guid,
        lb.list_id as lb_list_id,
        lb.blog_id as lb_blog_id,
        lb.custom_title as lb_custom_title,
        lb.custom_description as lb_custom_description,
        lb.custom_image_url as lb_custom_image_url,
        lb.custom_author as lb_custom_author,
        lb.created_at as lb_created_at,
        l.id as list_id,
        l.hash_id as list_hash_id,
        l.user_id as list_user_id,
        l.name as list_name,
        l.description as list_description,
        l.is_private as list_is_private,
        l.created_at as list_created_at,
        u.id as user_id,
        u.hash_id as user_hash_id,
        u.username as user_username,
        u.avatar_url as user_avatar_url,
        u.bio as user_bio,
        b.id as blog_id,
        b.hash_id as blog_hash_id,
        b.feed_url as blog_feed_url,
        b.site_url as blog_site_url,
        b.auto_title as blog_auto_title,
        b.auto_description as blog_auto_description,
        b.auto_author as blog_auto_author,
        b.auto_image_url as blog_auto_image_url,
        b.last_fetched_at as blog_last_fetched_at,
        b.created_at as blog_created_at
    FROM posts p
    LEFT JOIN blogs b ON p.blog_id = b.id
    LEFT JOIN list_blogs lb on lb.blog_id = b.id
    LEFT JOIN lists l ON lb.list_id = l.id
    LEFT JOIN users u ON l.user_id = u.id
`;

const buildPostsResponse = (rows: unknown[]): Post[] | null => {
  if (!rows || rows.length === 0) {
    return null;
  }
  const resultMaps = [
    {
      mapId: "postMap",
      idProperty: "id",
      properties: [
        "id",
        "blog_id",
        "title",
        "content",
        "url",
        "published_at",
        "created_at",
        "guid",
      ],
      associations: [
        { name: "list_blog", mapId: "listBlogMap", columnPrefix: "lb_" },
      ],
    },
    {
      mapId: "listBlogMap",
      idProperty: "id",
      properties: [
        "list_id",
        "blog_id",
        "custom_title",
        "custom_description",
        "custom_image_url",
        "custom_author",
        "created_at",
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
        "hash_id",
        "feed_url",
        "site_url",
        "auto_title",
        "auto_description",
        "auto_author",
        "auto_image_url",
        "last_fetched_at",
        "created_at",
      ],
    },
    {
      mapId: "listMap",
      idProperty: "id",
      properties: [
        "id",
        "hash_id",
        "user_id",
        "name",
        "description",
        "is_private",
        "created_at",
      ],
      associations: [
        { name: "user", mapId: "userMap", columnPrefix: "user_" },
      ],
    },
    {
      mapId: "userMap",
      idProperty: "id",
      properties: ["id", "hash_id", "username", "avatar_url", "bio"],
    },
  ];
  const result = joinjs.default.map(rows, resultMaps, "postMap", "post_");
  return z.array(PostSchema).parse(result);
};

export const getPostsForListsIds = async (
  listIds: number[],
  limit: number,
  offset: number,
): Promise<[Post[], boolean]> => {
  const { rows } = await db.queryObject(
    postQuery +
      "WHERE lb.list_id = ANY($1) ORDER BY p.published_at DESC LIMIT $2 OFFSET $3",
    [listIds, limit + 1, offset],
  );
  const posts = buildPostsResponse(rows);
  if (!posts) {
    return [[], false];
  }

  const hasMore = posts.length > limit;
  const postsToReturn = hasMore ? posts.slice(0, limit) : posts;

  return [postsToReturn, hasMore];
};

export const getPostsForFollowedListsByUserId = async (
  userId: number,
  limit: number,
  offset: number,
): Promise<[Post[], boolean]> => {
  const { rows } = await db.queryObject(
    postQuery +
      "JOIN list_followers lf ON lb.list_id = lf.list_id WHERE lf.user_id = $1 ORDER BY p.published_at DESC LIMIT $2 OFFSET $3",
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
