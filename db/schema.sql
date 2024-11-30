CREATE TABLE IF NOT EXISTS "schema_migrations" (version varchar(128) primary key);
CREATE TABLE users (
    id integer primary key autoincrement,
    username text not null unique,
    email text not null unique,
    passwordHash text not null,
    createdAt timestamp default current_timestamp,
    avatarUrl text,
    bio text,
    emailVerified boolean default false,
    emailVerificationToken text,
    emailVerificationTokenExpiresAt timestamp,
    passwordResetToken text,
    passwordResetTokenExpiresAt timestamp
, hashId text);
CREATE TABLE blogs (
    id integer primary key autoincrement,
    feedUrl text not null unique,
    siteUrl text,
    autoTitle text,
    autoDescription text,
    autoImageUrl text,
    lastFetchedAt timestamp,
    createdAt timestamp default current_timestamp
, hashId text, autoAuthor text);
CREATE TABLE lists (
    id integer primary key autoincrement,
    userId integer not null,
    name text not null,
    description text,
    isPrivate boolean default false,
    createdAt timestamp default current_timestamp, hashId text,
    foreign key (userId) references users(id) on delete cascade
);
CREATE TABLE list_blogs (
    listId integer not null,
    blogId integer not null,
    customTitle text,
    customDescription text,
    customImageUrl text,
    createdAt timestamp default currentTimestamp, customAuthor text,
    primary key (listId, blogId),
    foreign key (listId) references lists(id) on delete cascade,
    foreign key (blogId) references blogs(id) on delete cascade
);
CREATE TABLE list_followers (
    userId integer not null,
    listId integer not null,
    createdAt timestamp default current_timestamp,
    primary key (userId, listId),
    foreign key (userId) references users(id) on delete cascade,
    foreign key (listId) references lists(id) on delete cascade
);
CREATE TABLE posts (
    id integer primary key autoincrement,
    blogId integer not null,
    title text not null,
    content text not null,
    url text not null,
    publishedAt timestamp not null,
    createdAt timestamp default current_timestamp,
    guid text not null,
    foreign key (blogId) references blogs(id) on delete cascade,
    unique (blogId, guid)
);
CREATE TABLE comments (
    id integer primary key autoincrement,
    postId integer not null,
    userId integer not null,
    content text not null,
    createdAt timestamp default current_timestamp,
    parentCommentId integer,
    foreign key (postId) references posts(id) on delete cascade,
    foreign key (userId) references users(id) on delete cascade,
    foreign key (parentCommentId) references comments(id) on delete cascade
);
CREATE INDEX idx_posts_published_at on posts(publishedAt);
CREATE INDEX idx_posts_blog_id on posts(blogId);
CREATE INDEX idx_comments_post_id on comments(postId);
CREATE INDEX idx_list_blogs_blog_id on list_blogs(blogId);
CREATE INDEX idx_list_followers_user_id on list_followers(userId);
-- Dbmate schema migrations
INSERT INTO "schema_migrations" (version) VALUES
  ('20241118180206'),
  ('20241120220144'),
  ('20241125093802');
