-- migrate:up
alter table blogs
  add column last_modified_at timestamp;

-- migrate:down
alter table blogs
  drop column last_modified_at;

