import z from "https://deno.land/x/zod@v3.23.8/index.ts";
import { query, queryOne } from "../lib/db.ts";

export const ListFollowerSchema = z.object({
  user_id: z.number(),
  list_id: z.number(),
  created_at: z.coerce.date().optional(),
});

export type ListFollowerObject = z.infer<typeof ListFollowerSchema>;
export type ListFollower = ListFollowerObject;

export type CreateListFollower = Pick<ListFollower, "user_id" | "list_id">;

export const addListFollower = async (
  listFollower: CreateListFollower,
): Promise<ListFollower> => {
  await query`
        INSERT INTO list_followers (user_id, list_id, created_at) 
        VALUES (${listFollower.user_id}, ${listFollower.list_id}, ${
    new Date().toISOString()
  })
    `;

  const result = await queryOne<ListFollower>`
        SELECT * FROM list_followers 
        WHERE user_id = ${listFollower.user_id} AND list_id = ${listFollower.list_id}
    `;

  if (!result) {
    throw new Error("Failed to add list follower");
  }

  return result;
};

export const removeListFollower = async (
  userId: number,
  listId: number,
): Promise<void> => {
  await query`
        DELETE FROM list_followers 
        WHERE user_id = ${userId} AND list_id = ${listId}
    `;
};
