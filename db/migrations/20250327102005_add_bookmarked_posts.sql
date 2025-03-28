-- migrate:up
create table bookmarked_posts (
    id serial primary key,
    user_id integer not null,
    post_id integer not null,
    created_at timestamp not null default current_timestamp
);
create unique index bookmarked_posts_user_id_post_id_index on bookmarked_posts (user_id, post_id);

-- migrate:down
drop table bookmarked_posts;
