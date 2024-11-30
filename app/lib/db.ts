import { hash } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";
import { DB } from "https://deno.land/x/sqlite@v3.9.1/mod.ts";
import { encode } from "./hashids.ts";

export const db = new DB("../db/database.sqlite3");

export const initDB = async () => {
    const hasUsers = db.query("SELECT COUNT(*) FROM users")[0][0];
    if (!hasUsers) {
        const password = await hash("demo");
        db.query(
            `
            INSERT INTO users (username, email, passwordHash, emailVerified, hashId)
            VALUES ('demo', 'mail+demo@raphaelkabo.com', ?, 1, ?)
        `,
            [password, encode(1)],
        );
    }
};

export const ensureHashIds = () => {
    const users = db.query("SELECT id FROM users");
    for (const user of users) {
        db.query("UPDATE users SET hashId = ? WHERE id = ?", [
            encode(user[0] as number),
            user[0] as number,
        ]);
    }
    const blogs = db.query("SELECT id FROM blogs");
    for (const blog of blogs) {
        db.query("UPDATE blogs SET hashId = ? WHERE id = ?", [
            encode(blog[0] as number),
            blog[0] as number,
        ]);
    }
    const lists = db.query("SELECT id FROM lists");
    for (const list of lists) {
        db.query("UPDATE lists SET hashId = ? WHERE id = ?", [
            encode(list[0] as number),
            list[0] as number,
        ]);
    }
};
