-- migrate:up
ALTER TABLE blogs ADD COLUMN posts_last_month INTEGER DEFAULT 0;
UPDATE blogs
SET posts_last_month = (
    SELECT COUNT(*)
    FROM posts
    WHERE posts.blog_id = blogs.id
    AND published_at >= (CURRENT_TIMESTAMP - INTERVAL '1 month')
);

-- migrate:down
ALTER TABLE blogs DROP COLUMN posts_last_month;