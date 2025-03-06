-- migrate:up
ALTER TABLE blogs ADD COLUMN auto_author TEXT;
ALTER TABLE list_blogs ADD COLUMN custom_author TEXT;

UPDATE blogs SET auto_author = '';
UPDATE list_blogs SET custom_author = '';

-- migrate:down
ALTER TABLE blogs DROP COLUMN auto_author;
ALTER TABLE list_blogs DROP COLUMN custom_author;