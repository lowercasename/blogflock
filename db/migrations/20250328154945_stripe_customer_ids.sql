-- migrate:up
alter table users
add column stripe_customer_id text null,
add column blogflock_supporter_subscription_active boolean default false;

-- migrate:down
alter table users
drop column stripe_customer_id,
drop column blogflock_supporter_subscription_active;

