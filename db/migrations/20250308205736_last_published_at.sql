-- migrate:up
alter table blogs
add column last_published_at timestamp with time zone;

update blogs
set last_published_at = (
  select max(published_at)
  from posts
  where posts.blog_id = blogs.id
);

-- migrate:down
alter table blogs
drop column last_published_at;
