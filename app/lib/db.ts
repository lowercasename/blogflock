import { hash } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";
import { Client } from "https://deno.land/x/postgres/mod.ts";
import { encode } from "./hashids.ts";

export const db = new Client({
  user: Deno.env.get("POSTGRES_USER"),
  password: Deno.env.get("POSTGRES_PASSWORD"),
  database: Deno.env.get("POSTGRES_DB"),
  hostname: Deno.env.get("POSTGRES_HOST"),
  port: Deno.env.get("POSTGRES_PORT"),
});
await db.connect();

export const query = async <T>(
  q: string | TemplateStringsArray,
  ...args: unknown[]
): Promise<T[]> => {
  if (typeof q === "string") {
    return (await db.queryObject<T>(q)).rows;
  }
  return (await db.queryObject<T>(q, ...args)).rows;
};

export const queryOne = async <T>(
  q: string | TemplateStringsArray,
  ...args: unknown[]
): Promise<T | null> => {
  const result = await query<T>(q, ...args);
  return result.length > 0 ? result[0] : null;
};

export const initDB = async () => {
  const hasUsers =
    (await db.queryObject("SELECT 1 FROM users LIMIT 1")).rows.length > 0;
  if (!hasUsers) {
    const password = await hash("demo");
    await db.queryObject`
            INSERT INTO users (username, email, password_hash, email_verified, hash_id)
            VALUES ('demo', 'demo@example.com', ${password}, TRUE, ${
      encode(1)
    });
        `;
  }
};

export const ensureHashIds = async () => {
  const users = await query<{ id: number }>("SELECT id FROM users");
  for (const user of users) {
    await db.queryObject`UPDATE users SET hash_id = ${
      encode(user.id)
    } WHERE id = ${user.id}`;
  }
  const blogs = await query<{ id: number }>("SELECT id FROM blogs");
  for (const blog of blogs) {
    await db.queryObject`UPDATE blogs SET hash_id = ${
      encode(blog.id)
    } WHERE id = ${blog.id}`;
  }
  const lists = await query<{ id: number }>("SELECT id FROM lists");
  for (const list of lists) {
    await db.queryObject`UPDATE lists SET hash_id = ${
      encode(list.id)
    } WHERE id = ${list.id}`;
  }
};
