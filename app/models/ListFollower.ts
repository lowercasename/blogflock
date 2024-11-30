import z from "https://deno.land/x/zod@v3.23.8/index.ts";
import { RowObject } from "https://deno.land/x/sqlite@v3.8/mod.ts";
import { db } from "../lib/db.ts";

export const ListFollowerSchema = z.object({
    userId: z.number(),
    listId: z.number(),
});

export type ListFollowerObject = z.infer<typeof ListFollowerSchema>;

export interface ListFollower extends ListFollowerObject, RowObject {}

export type CreateListFollower = Pick<ListFollower, "userId" | "listId">;

export const addListFollower = (listFollower: CreateListFollower): ListFollower => {
    db.query(
        `INSERT INTO list_followers (userId, listId) VALUES (?, ?)`,
        [listFollower.userId, listFollower.listId],
    );
    return db.queryEntries<ListFollower>(
        `SELECT * FROM list_followers WHERE userId = ? AND listId = ?`,
        [listFollower.userId, listFollower.listId],
    )[0];
};

export const removeListFollower = (userId: number, listId: number): void => {
    db.query(`DELETE FROM list_followers WHERE userId = ? AND listId = ?`, [userId, listId]);
};