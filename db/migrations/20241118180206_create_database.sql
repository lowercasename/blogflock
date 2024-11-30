-- migrate:up
create table users (
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
);

create table blogs (
    id integer primary key autoincrement,
    feedUrl text not null unique,
    siteUrl text,
    autoTitle text,
    autoDescription text,
    autoImageUrl text,
    lastFetchedAt timestamp,
    createdAt timestamp default current_timestamp
);

create table lists (
    id integer primary key autoincrement,
    userId integer not null,
    name text not null,
    description text,
    isPrivate boolean default false,
    createdAt timestamp default current_timestamp,
    foreign key (userId) references users(id) on delete cascade
);

create table list_blogs (
    listId integer not null,
    blogId integer not null,
    customTitle text,
    customDescription text,
    customImageUrl text,
    createdAt timestamp default currentTimestamp,
    primary key (listId, blogId),
    foreign key (listId) references lists(id) on delete cascade,
    foreign key (blogId) references blogs(id) on delete cascade
);

create table list_followers (
    userId integer not null,
    listId integer not null,
    createdAt timestamp default current_timestamp,
    primary key (userId, listId),
    foreign key (userId) references users(id) on delete cascade,
    foreign key (listId) references lists(id) on delete cascade
);

create table posts (
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

create table comments (
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

create index idx_posts_published_at on posts(publishedAt);
create index idx_posts_blog_id on posts(blogId);
create index idx_comments_post_id on comments(postId);
create index idx_list_blogs_blog_id on list_blogs(blogId);
create index idx_list_followers_user_id on list_followers(userId);

-- migrate:down
drop table if exists users;
drop table if exists blogs;
drop table if exists lists;
drop table if exists list_blogs;
drop table if exists list_followers;
drop table if exists posts;
drop table if exists comments;

