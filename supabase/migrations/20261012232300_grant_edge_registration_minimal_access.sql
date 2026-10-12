grant select on public.locations to service_role;
grant select, insert on public.profiles to service_role;
grant select, insert on public.registration_rate_limits to service_role;
grant usage, select on sequence public.profiles_id_seq, public.registration_rate_limits_id_seq to service_role;
