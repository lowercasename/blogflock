-- migrate:up
alter table users add column hashId text;
alter table blogs add column hashId text;
alter table lists add column hashId text;

-- migrate:down
alter table users drop column hashId;
alter table blogs drop column hashId;
alter table lists drop column hashId;
