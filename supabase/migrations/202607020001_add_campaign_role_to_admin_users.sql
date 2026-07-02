alter table public.admin_users
    add column if not exists campaign_role text;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'admin_users_campaign_role_check'
    ) then
        alter table public.admin_users
            add constraint admin_users_campaign_role_check
            check (campaign_role is null or campaign_role in ('campaign_editor'));
    end if;
end $$;
