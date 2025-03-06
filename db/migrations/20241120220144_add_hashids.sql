-- migrate:up
ALTER TABLE users ADD COLUMN hash_id TEXT;
ALTER TABLE blogs ADD COLUMN hash_id TEXT;
ALTER TABLE lists ADD COLUMN hash_id TEXT;

-- migrate:down
ALTER TABLE users DROP COLUMN hash_id;
ALTER TABLE blogs DROP COLUMN hash_id;
ALTER TABLE lists DROP COLUMN hash_id;