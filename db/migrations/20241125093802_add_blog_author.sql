-- migrate:up
alter table blogs add column autoAuthor text;
alter table list_blogs add column customAuthor text;

update blogs set autoAuthor = '';
update list_blogs set customAuthor = '';

-- migrate:down
alter table blogs drop column autoAuthor;
alter table list_blogs drop column customAuthor;
