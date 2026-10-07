"use strict";
/* ============================================================
   SUPABASE CONNECTION (shared by every device)
   The anon key is safe to publish ONLY because the database policies
   allow logged-in users alone (see supabase-setup.sql).
   ============================================================ */
const SUPABASE_URL = "https://gamnwecmnqadyhnbrbli.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhbW53ZWNtbnFhZHlobmJyYmxpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2Nzk4NTQsImV4cCI6MjA5NzI1NTg1NH0.s2vLBuIdn6HzNsqcO0tW8vKIPM4NCm8LmYpCx4nxxdk";
