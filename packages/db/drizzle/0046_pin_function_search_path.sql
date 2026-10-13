-- Pin search_path on the functions added in 0044/0045 so object resolution can't be redirected
-- by a caller's search_path (Supabase linter 0011).
ALTER FUNCTION public.enforce_rls_on_new_tables() SET search_path = pg_catalog, public;
--> statement-breakpoint
ALTER FUNCTION public.activity_ledger_set_organization() SET search_path = pg_catalog, public;
