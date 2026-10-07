-- ============================================================
-- Express Logistics billing — Supabase setup
-- Run this whole file once in Supabase → SQL Editor → New query → Run.
-- Safe to re-run. Existing data is NOT touched.
-- ============================================================

-- Tables (skipped if they already exist)
CREATE TABLE IF NOT EXISTS public.customers (
  id text PRIMARY KEY,
  name text,
  addr text,
  gst text,
  phone text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS phone text;

CREATE TABLE IF NOT EXISTS public.bills (
  id text PRIMARY KEY,
  data jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.backups (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  name text,
  data jsonb
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backups   ENABLE ROW LEVEL SECURITY;

-- Remove the old "anyone with the key" rules
DROP POLICY IF EXISTS "Allow anon full access to customers" ON public.customers;
DROP POLICY IF EXISTS "Allow anon full access to bills"     ON public.bills;
DROP POLICY IF EXISTS "Allow anon full access to backups"   ON public.backups;

-- Only logged-in users can read or change data
DROP POLICY IF EXISTS "Logged-in users full access" ON public.customers;
DROP POLICY IF EXISTS "Logged-in users full access" ON public.bills;
DROP POLICY IF EXISTS "Logged-in users full access" ON public.backups;
CREATE POLICY "Logged-in users full access" ON public.customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Logged-in users full access" ON public.bills     FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Logged-in users full access" ON public.backups   FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Check: lists every policy on these tables. Any policy whose roles are NOT {authenticated}
-- (e.g. {public} or {anon}) still lets people in without logging in — drop it.
SELECT tablename, policyname, roles FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('customers','bills','backups');
