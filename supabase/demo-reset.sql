-- The demo resets itself every 30 minutes. Every app row goes back to the
-- seed taken when this file first ran, and the shared demo account gets back
-- its published email and password. Its open sessions are kept.
-- Run it in the SQL editor as postgres. Running it again is safe: it keeps
-- the first snapshot and the one schedule.

create extension if not exists pg_cron with schema pg_catalog;

create schema if not exists demo_admin;
revoke all on schema demo_admin from anon, authenticated, public;

create table if not exists demo_admin.seed_products as select * from symplr_fc6b8a25_5e49_4a7a_a920_acfdf58fb896.products;
create table if not exists demo_admin.seed_menus as select * from symplr_fc6b8a25_5e49_4a7a_a920_acfdf58fb896.menus;
create table if not exists demo_admin.seed_profiles as select * from symplr_fc6b8a25_5e49_4a7a_a920_acfdf58fb896.profiles;
create table if not exists demo_admin.seed_saved_locations as select * from symplr_fc6b8a25_5e49_4a7a_a920_acfdf58fb896.saved_locations;
create table if not exists demo_admin.seed_orders as select * from symplr_fc6b8a25_5e49_4a7a_a920_acfdf58fb896.orders;
create table if not exists demo_admin.seed_order_items as select * from symplr_fc6b8a25_5e49_4a7a_a920_acfdf58fb896.order_items;
create table if not exists demo_admin.seed_cart_items as select * from symplr_fc6b8a25_5e49_4a7a_a920_acfdf58fb896.cart_items;

create or replace function demo_admin.reset() returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from symplr_fc6b8a25_5e49_4a7a_a920_acfdf58fb896.order_items;
  delete from symplr_fc6b8a25_5e49_4a7a_a920_acfdf58fb896.cart_items;
  delete from symplr_fc6b8a25_5e49_4a7a_a920_acfdf58fb896.orders;
  delete from symplr_fc6b8a25_5e49_4a7a_a920_acfdf58fb896.saved_locations;
  delete from symplr_fc6b8a25_5e49_4a7a_a920_acfdf58fb896.profiles;
  delete from symplr_fc6b8a25_5e49_4a7a_a920_acfdf58fb896.menus;
  delete from symplr_fc6b8a25_5e49_4a7a_a920_acfdf58fb896.products;
  insert into symplr_fc6b8a25_5e49_4a7a_a920_acfdf58fb896.products select * from demo_admin.seed_products;
  insert into symplr_fc6b8a25_5e49_4a7a_a920_acfdf58fb896.menus select * from demo_admin.seed_menus;
  insert into symplr_fc6b8a25_5e49_4a7a_a920_acfdf58fb896.profiles select * from demo_admin.seed_profiles;
  insert into symplr_fc6b8a25_5e49_4a7a_a920_acfdf58fb896.saved_locations select * from demo_admin.seed_saved_locations;
  insert into symplr_fc6b8a25_5e49_4a7a_a920_acfdf58fb896.orders select * from demo_admin.seed_orders;
  insert into symplr_fc6b8a25_5e49_4a7a_a920_acfdf58fb896.order_items select * from demo_admin.seed_order_items;
  insert into symplr_fc6b8a25_5e49_4a7a_a920_acfdf58fb896.cart_items select * from demo_admin.seed_cart_items;
  update auth.users
     set encrypted_password = extensions.crypt('Demo-oGOPNuE_gFVt', extensions.gen_salt('bf')),
         email = 'demo@symplr.io', email_change = '', email_change_token_new = ''
   where id = 'dc9b81c8-0d95-4fec-9aeb-7bdb5a3f36dc';
end $$;
revoke all on function demo_admin.reset() from public, anon, authenticated;

select cron.unschedule('demo-reset') where exists (select 1 from cron.job where jobname = 'demo-reset');
select cron.schedule('demo-reset', '*/30 * * * *', $$select demo_admin.reset()$$);
