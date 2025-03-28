import z from "https://deno.land/x/zod@v3.23.8/index.ts";
import { queryOne } from "../lib/db.ts";
import { getPostWithAssociationsById, Post, PostSchema } from "./Post.ts";

export const BookmarkedPostSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  post_id: z.number(),
  created_at: z.coerce.date(),
  post: PostSchema,
});
export type BookmarkedPost = z.infer<typeof BookmarkedPostSchema>;

export type CreateBookmarkedPost = Pick<
  BookmarkedPost,
  "user_id" | "post_id"
>;
export type DeleteBookmarkedPost = Pick<
  BookmarkedPost,
  "user_id" | "post_id"
>;

export const createBookmarkedPost = async (
  bookmarkedPost: CreateBookmarkedPost,
): Promise<Post | null> => {
  const result = await queryOne<{ id: number }>`
    INSERT INTO bookmarked_posts (user_id, post_id)
    VALUES (${bookmarkedPost.user_id}, ${bookmarkedPost.post_id})
    RETURNING id;
  `;

  if (!result) {
    return null;
  }

  return await getPostWithAssociationsById(
    bookmarkedPost.post_id,
    bookmarkedPost.user_id,
  );
};

export const deleteBookmarkedPostByPostIdAndUserId = async (
  bookmarkedPost: DeleteBookmarkedPost,
): Promise<void> => {
  await queryOne<{ id: number }>`
    DELETE FROM bookmarked_posts
    WHERE post_id = ${bookmarkedPost.post_id} AND user_id = ${bookmarkedPost.user_id}
  `;
};
