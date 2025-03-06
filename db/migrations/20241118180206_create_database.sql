-- migrate:up
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    avatar_url TEXT,
    bio TEXT,
    email_verified BOOLEAN DEFAULT FALSE,
    email_verification_token TEXT,
    email_verification_token_expires_at TIMESTAMP,
    password_reset_token TEXT,
    password_reset_token_expires_at TIMESTAMP
);

CREATE TABLE blogs (
    id SERIAL PRIMARY KEY,
    feed_url TEXT NOT NULL UNIQUE,
    site_url TEXT,
    auto_title TEXT,
    auto_description TEXT,
    auto_image_url TEXT,
    last_fetched_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE lists (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_private BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE list_blogs (
    list_id INTEGER NOT NULL,
    blog_id INTEGER NOT NULL,
    custom_title TEXT,
    custom_description TEXT,
    custom_image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (list_id, blog_id),
    FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE,
    FOREIGN KEY (blog_id) REFERENCES blogs(id) ON DELETE CASCADE
);

CREATE TABLE list_followers (
    user_id INTEGER NOT NULL,
    list_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, list_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE
);

CREATE TABLE posts (
    id SERIAL PRIMARY KEY,
    blog_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    url TEXT NOT NULL,
    published_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    guid TEXT NOT NULL,
    FOREIGN KEY (blog_id) REFERENCES blogs(id) ON DELETE CASCADE,
    UNIQUE (blog_id, guid)
);

CREATE TABLE comments (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    parent_comment_id INTEGER,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_comment_id) REFERENCES comments(id) ON DELETE CASCADE
);

CREATE INDEX idx_posts_published_at ON posts(published_at);
CREATE INDEX idx_posts_blog_id ON posts(blog_id);
CREATE INDEX idx_comments_post_id ON comments(post_id);
CREATE INDEX idx_list_blogs_blog_id ON list_blogs(blog_id);
CREATE INDEX idx_list_followers_user_id ON list_followers(user_id);

-- migrate:down
DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS posts;
DROP TABLE IF EXISTS list_followers;
DROP TABLE IF EXISTS list_blogs;
DROP TABLE IF EXISTS lists;
DROP TABLE IF EXISTS blogs;
DROP TABLE IF EXISTS users;