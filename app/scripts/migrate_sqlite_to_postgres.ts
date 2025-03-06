// migrate-data.ts
import { DB } from "https://deno.land/x/sqlite@v3.9.1/mod.ts";
import { Client } from "https://deno.land/x/postgres/mod.ts";
import { parse } from "https://deno.land/std@0.192.0/flags/mod.ts";

const flags = parse(Deno.args, {
  boolean: ["help"],
  string: ["sqlite", "pg-host", "pg-port", "pg-user", "pg-password", "pg-db"],
  default: {
    sqlite: "../../db/database.sqlite3",
    "pg-host": "localhost",
    "pg-port": "5400",
    "pg-user": "blogflock",
    "pg-password": "blogflock",
    "pg-db": "blogflock",
  },
  alias: {
    h: "help",
  },
});

if (flags.help) {
  console.log(`
Usage: deno run --allow-net --allow-read migrate-data.ts [OPTIONS]

Options:
  --sqlite=FILE          Path to SQLite database file (default: "../db/database.sqlite3")
  --pg-host=HOST         PostgreSQL host (default: "localhost")
  --pg-port=PORT         PostgreSQL port (default: "5432")
  --pg-user=USER         PostgreSQL username (default: "postgres")
  --pg-password=PASSWORD PostgreSQL password (default: "postgres")
  --pg-db=DATABASE       PostgreSQL database name (default: "blogflock")
  -h, --help             Show this help message and exit
  `);
  Deno.exit(0);
}

async function main() {
  // Connect to SQLite
  console.log(`Opening SQLite database: ${flags.sqlite}`);
  const sqlite = new DB(flags.sqlite);

  // Connect to PostgreSQL
  console.log(
    `Connecting to PostgreSQL: ${flags["pg-host"]}:${flags["pg-port"]}/${
      flags["pg-db"]
    }`,
  );
  const client = new Client({
    hostname: flags["pg-host"],
    port: Number(flags["pg-port"]),
    user: flags["pg-user"],
    password: flags["pg-password"],
    database: flags["pg-db"],
  });

  // Get a client from the pool
  await client.connect();

  try {
    const transaction = client.createTransaction("migrate");
    await transaction.begin();

    // Migrate users
    console.log("Migrating users table...");
    const users = sqlite.queryEntries("SELECT * FROM users");
    for (const user of users) {
      await transaction.queryArray(
        `INSERT INTO users (id, username, email, "password_hash", "created_at", "avatar_url", "bio", 
                           "email_verified", "email_verification_token", "email_verification_token_expires_at", 
                           "password_reset_token", "password_reset_token_expires_at", "hash_id")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (id) DO NOTHING`,
        [
          user.id,
          user.username,
          user.email,
          user.passwordHash,
          user.createdAt ? new Date(user.createdAt as string) : new Date(),
          user.avatarUrl,
          user.bio,
          Boolean(user.emailVerified),
          user.emailVerificationToken,
          user.emailVerificationTokenExpiresAt
            ? new Date(user.emailVerificationTokenExpiresAt as string)
            : null,
          user.passwordResetToken,
          user.passwordResetTokenExpiresAt
            ? new Date(user.passwordResetTokenExpiresAt as string)
            : null,
          user.hashId,
        ],
      );
    }
    console.log(`Migrated ${users.length} users`);

    // Migrate blogs
    console.log("Migrating blogs table...");
    const blogs = sqlite.queryEntries("SELECT * FROM blogs");
    for (const blog of blogs) {
      await transaction.queryArray(
        `INSERT INTO blogs (id, "feed_url", "site_url", "auto_title", "auto_description", "auto_image_url", 
                           "auto_author", "last_fetched_at", "created_at", "hash_id")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO NOTHING`,
        [
          blog.id,
          blog.feedUrl,
          blog.siteUrl,
          blog.autoTitle,
          blog.autoDescription,
          blog.autoImageUrl,
          blog.autoAuthor,
          blog.lastFetchedAt ? new Date(blog.lastFetchedAt as string) : null,
          blog.createdAt ? new Date(blog.createdAt as string) : new Date(),
          blog.hashId,
        ],
      );
    }
    console.log(`Migrated ${blogs.length} blogs`);

    // Migrate lists
    console.log("Migrating lists table...");
    const lists = sqlite.queryEntries("SELECT * FROM lists");
    for (const list of lists) {
      await transaction.queryArray(
        `INSERT INTO lists (id, "user_id", name, description, "is_private", "created_at", "hash_id")
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [
          list.id,
          list.userId,
          list.name,
          list.description,
          Boolean(list.isPrivate),
          list.createdAt ? new Date(list.createdAt as string) : new Date(),
          list.hashId,
        ],
      );
    }
    console.log(`Migrated ${lists.length} lists`);

    // Migrate list_blogs
    console.log("Migrating list_blogs table...");
    const listBlogs = sqlite.queryEntries("SELECT * FROM list_blogs");
    for (const listBlog of listBlogs) {
      await transaction.queryArray(
        `INSERT INTO list_blogs ("list_id", "blog_id", "custom_title", "custom_description", 
                                "custom_image_url", "custom_author", "created_at")
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT ("list_id", "blog_id") DO NOTHING`,
        [
          listBlog.listId,
          listBlog.blogId,
          listBlog.customTitle,
          listBlog.customDescription,
          listBlog.customImageUrl,
          listBlog.customAuthor,
          listBlog.createdAt
            ? new Date(listBlog.createdAt as string)
            : new Date(),
        ],
      );
    }
    console.log(`Migrated ${listBlogs.length} list_blogs entries`);

    // Migrate list_followers
    console.log("Migrating list_followers table...");
    const listFollowers = sqlite.queryEntries("SELECT * FROM list_followers");
    for (const listFollower of listFollowers) {
      await transaction.queryArray(
        `INSERT INTO list_followers ("user_id", "list_id", "created_at")
         VALUES ($1, $2, $3)
         ON CONFLICT ("user_id", "list_id") DO NOTHING`,
        [
          listFollower.userId,
          listFollower.listId,
          listFollower.createdAt
            ? new Date(listFollower.createdAt as string)
            : new Date(),
        ],
      );
    }
    console.log(`Migrated ${listFollowers.length} list_followers entries`);

    // Migrate posts

    console.log("Migrating posts table...");
    const posts = sqlite.queryEntries("SELECT * FROM posts");
    for (const post of posts) {
      // Some of our posts have nonsense published at dates (0000-12-31T23:58:45.000-00:01)
      // so for dates beginning with 0000 we'll arbitrarily use 1900 instead
      const publishedAt =
        post.publishedAt && typeof post.publishedAt === "string" &&
          post.publishedAt.startsWith("0000")
          ? post.publishedAt.replace("0000", "1900")
          : post.createdAt;

      await transaction.queryArray(
        `INSERT INTO posts (id, "blog_id", title, content, url, "published_at", "created_at", guid)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING`,
        [
          post.id,
          post.blogId,
          post.title,
          post.content,
          post.url,
          publishedAt ? new Date(publishedAt as string) : null,
          post.createdAt ? new Date(post.createdAt as string) : new Date(),
          post.guid,
        ],
      );
    }
    console.log(`Migrated ${posts.length} posts`);

    // Migrate comments
    console.log("Migrating comments table...");
    const comments = sqlite.queryEntries("SELECT * FROM comments");
    for (const comment of comments) {
      await transaction.queryArray(
        `INSERT INTO comments (id, "post_id", "user_id", content, "created_at", "parent_comment_id")
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING`,
        [
          comment.id,
          comment.postId,
          comment.userId,
          comment.content,
          comment.createdAt
            ? new Date(comment.createdAt as string)
            : new Date(),
          comment.parentCommentId,
        ],
      );
    }
    console.log(`Migrated ${comments.length} comments`);

    // Reset PostgreSQL sequences
    console.log("Updating sequences...");
    const tables = ["users", "blogs", "lists", "posts", "comments"];
    for (const table of tables) {
      await transaction.queryArray(
        "SELECT setval(pg_get_serial_sequence('" + table +
          "', 'id'), COALESCE(MAX(id), 0) + 1, false) FROM " + table,
      );
    }

    await transaction.commit();
    console.log("Migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await client.end();
    sqlite.close();
  }
}

main();
