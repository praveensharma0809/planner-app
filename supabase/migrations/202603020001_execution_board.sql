-- Monthly Execution Board schema
-- Generated on 2026-03-02

BEGIN;

CREATE TABLE IF NOT EXISTS public.execution_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month_start date NOT NULL,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.execution_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.execution_categories(id) ON DELETE CASCADE,
  series_id uuid NOT NULL DEFAULT gen_random_uuid(),
  month_start date NOT NULL,
  title text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.execution_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.execution_items(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  completed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT execution_entries_unique UNIQUE (user_id, item_id, entry_date)
);

CREATE INDEX IF NOT EXISTS execution_categories_user_month_idx
  ON public.execution_categories (user_id, month_start);

CREATE INDEX IF NOT EXISTS execution_items_user_month_idx
  ON public.execution_items (user_id, month_start);

CREATE INDEX IF NOT EXISTS execution_items_category_idx
  ON public.execution_items (category_id, sort_order);

CREATE INDEX IF NOT EXISTS execution_items_series_idx
  ON public.execution_items (user_id, series_id);

CREATE INDEX IF NOT EXISTS execution_entries_user_date_idx
  ON public.execution_entries (user_id, entry_date);

CREATE INDEX IF NOT EXISTS execution_entries_item_date_idx
  ON public.execution_entries (item_id, entry_date);

ALTER TABLE public.execution_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execution_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execution_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS execution_categories_select_own ON public.execution_categories;
CREATE POLICY execution_categories_select_own ON public.execution_categories
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS execution_categories_insert_own ON public.execution_categories;
CREATE POLICY execution_categories_insert_own ON public.execution_categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS execution_categories_update_own ON public.execution_categories;
CREATE POLICY execution_categories_update_own ON public.execution_categories
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS execution_categories_delete_own ON public.execution_categories;
CREATE POLICY execution_categories_delete_own ON public.execution_categories
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS execution_items_select_own ON public.execution_items;
CREATE POLICY execution_items_select_own ON public.execution_items
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS execution_items_insert_own ON public.execution_items;
CREATE POLICY execution_items_insert_own ON public.execution_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS execution_items_update_own ON public.execution_items;
CREATE POLICY execution_items_update_own ON public.execution_items
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS execution_items_delete_own ON public.execution_items;
CREATE POLICY execution_items_delete_own ON public.execution_items
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS execution_entries_select_own ON public.execution_entries;
CREATE POLICY execution_entries_select_own ON public.execution_entries
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS execution_entries_insert_own ON public.execution_entries;
CREATE POLICY execution_entries_insert_own ON public.execution_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS execution_entries_update_own ON public.execution_entries;
CREATE POLICY execution_entries_update_own ON public.execution_entries
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS execution_entries_delete_own ON public.execution_entries;
CREATE POLICY execution_entries_delete_own ON public.execution_entries
  FOR DELETE USING (auth.uid() = user_id);

COMMIT;
