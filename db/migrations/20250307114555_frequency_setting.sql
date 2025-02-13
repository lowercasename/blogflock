-- migrate:up
create type posting_frequency as enum ('quiet', 'occasional', 'frequent');
alter table users add column setting_posting_frequency posting_frequency default 'frequent';

-- migrate:down
alter table users drop column setting_posting_frequency;
