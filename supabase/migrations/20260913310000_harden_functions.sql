-- Security advisor follow-ups.
-- Trigger and helper functions must not be callable anonymously via /rest/v1/rpc.
revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.current_client_id() from anon, public;
revoke execute on function public.claim_client_profile() from anon, public;
alter function public.set_updated_at() set search_path = public;
