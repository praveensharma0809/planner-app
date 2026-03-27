


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."commit_plan_atomic"("p_user_id" "uuid", "p_tasks" "jsonb", "p_snapshot_summary" "text" DEFAULT NULL::"text", "p_config_snapshot" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_today date := CURRENT_DATE;
  v_snapshot_id uuid := gen_random_uuid();
  v_task_count integer;
BEGIN
  -- Delete future generated tasks
  DELETE FROM tasks
  WHERE user_id = p_user_id
    AND scheduled_date >= v_today
    AND is_plan_generated = true;

  -- Create snapshot first so we have the ID
  INSERT INTO plan_snapshots (id, user_id, task_count, schedule_json, config_snapshot, summary)
  VALUES (v_snapshot_id, p_user_id, 0, p_tasks, p_config_snapshot, p_snapshot_summary);

  -- Insert new tasks (now includes session_number + total_sessions)
  INSERT INTO tasks (
    user_id, subject_id, topic_id, title, scheduled_date,
    duration_minutes, session_type, priority,
    session_number, total_sessions,
    completed, is_plan_generated, plan_version
  )
  SELECT
    p_user_id,
    (t->>'subject_id')::uuid,
    (t->>'topic_id')::uuid,
    t->>'title',
    (t->>'scheduled_date')::date,
    (t->>'duration_minutes')::integer,
    COALESCE(t->>'session_type', 'core'),
    COALESCE((t->>'priority')::integer, 3),
    COALESCE((t->>'session_number')::integer, 0),
    COALESCE((t->>'total_sessions')::integer, 0),
    false,
    true,
    v_snapshot_id
  FROM jsonb_array_elements(p_tasks) AS t
  WHERE (t->>'scheduled_date')::date >= v_today;

  GET DIAGNOSTICS v_task_count = ROW_COUNT;

  -- Update snapshot with actual count
  UPDATE plan_snapshots
  SET task_count = v_task_count
  WHERE id = v_snapshot_id;

  RETURN jsonb_build_object(
    'status', 'SUCCESS',
    'task_count', v_task_count,
    'snapshot_id', v_snapshot_id
  );
END;
$$;


ALTER FUNCTION "public"."commit_plan_atomic"("p_user_id" "uuid", "p_tasks" "jsonb", "p_snapshot_summary" "text", "p_config_snapshot" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."commit_plan_atomic"("p_user_id" "uuid", "p_tasks" "jsonb", "p_snapshot_summary" "text" DEFAULT NULL::"text", "p_config_snapshot" "jsonb" DEFAULT '{}'::"jsonb", "p_keep_mode" "text" DEFAULT 'future'::"text", "p_new_plan_start_date" "date" DEFAULT NULL::"date") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_today        date := CURRENT_DATE;
  v_snapshot_id  uuid := gen_random_uuid();
  v_task_count   integer;
BEGIN

  -- ── Deletion phase: controlled by keep_mode ─────────────────────────────

  IF p_keep_mode = 'none' THEN
    -- Delete ALL previous generated tasks (including completed past ones)
    DELETE FROM tasks
    WHERE user_id = p_user_id
      AND is_plan_generated = true;

  ELSIF p_keep_mode = 'until' AND p_new_plan_start_date IS NOT NULL THEN
    -- Keep generated tasks only BEFORE the new plan's start date
    DELETE FROM tasks
    WHERE user_id        = p_user_id
      AND is_plan_generated = true
      AND scheduled_date >= p_new_plan_start_date;

  ELSIF p_keep_mode = 'merge' THEN
    -- Keep ALL existing generated tasks — no deletion performed.
    -- New sessions are inserted alongside existing ones.
    NULL;

  ELSE
    -- Default 'future': delete generated tasks from today onwards,
    -- keep past (completed or upcoming-within-today) tasks.
    DELETE FROM tasks
    WHERE user_id        = p_user_id
      AND scheduled_date >= v_today
      AND is_plan_generated = true;
  END IF;

  -- ── Snapshot ─────────────────────────────────────────────────────────────

  INSERT INTO plan_snapshots (id, user_id, task_count, schedule_json, config_snapshot, summary)
  VALUES (v_snapshot_id, p_user_id, 0, p_tasks, p_config_snapshot, p_snapshot_summary);

  -- ── Insert new tasks ──────────────────────────────────────────────────────
  -- Merge mode keeps all existing tasks and only inserts sessions when the
  -- same topic/date/session_type slot does not already exist for the user.

  INSERT INTO tasks (
    user_id, subject_id, topic_id, title, scheduled_date,
    duration_minutes, session_type, priority,
    session_number, total_sessions,
    completed, is_plan_generated, plan_version
  )
  SELECT
    p_user_id,
    incoming.subject_id,
    incoming.topic_id,
    incoming.title,
    incoming.scheduled_date,
    incoming.duration_minutes,
    incoming.session_type,
    incoming.priority,
    incoming.session_number,
    incoming.total_sessions,
    false,
    true,
    v_snapshot_id
  FROM (
    SELECT
      (t->>'subject_id')::uuid AS subject_id,
      (t->>'topic_id')::uuid AS topic_id,
      t->>'title' AS title,
      (t->>'scheduled_date')::date AS scheduled_date,
      (t->>'duration_minutes')::integer AS duration_minutes,
      COALESCE(t->>'session_type', 'core') AS session_type,
      COALESCE((t->>'priority')::integer, 3) AS priority,
      COALESCE((t->>'session_number')::integer, 0) AS session_number,
      COALESCE((t->>'total_sessions')::integer, 0) AS total_sessions
    FROM jsonb_array_elements(p_tasks) AS t
  ) AS incoming
  WHERE p_keep_mode <> 'merge'
    OR NOT EXISTS (
      SELECT 1
      FROM tasks existing
      WHERE existing.user_id = p_user_id
        AND existing.scheduled_date = incoming.scheduled_date
        AND existing.topic_id IS NOT DISTINCT FROM incoming.topic_id
        AND existing.session_type = incoming.session_type
    );

  GET DIAGNOSTICS v_task_count = ROW_COUNT;

  -- Update snapshot with actual inserted count
  UPDATE plan_snapshots
  SET task_count = v_task_count
  WHERE id = v_snapshot_id;

  RETURN jsonb_build_object(
    'status',      'SUCCESS',
    'task_count',  v_task_count,
    'snapshot_id', v_snapshot_id
  );
END;
$$;


ALTER FUNCTION "public"."commit_plan_atomic"("p_user_id" "uuid", "p_tasks" "jsonb", "p_snapshot_summary" "text", "p_config_snapshot" "jsonb", "p_keep_mode" "text", "p_new_plan_start_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."export_database_full_json"() RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $_$
    declare
      rec record;
      v_columns jsonb;
      v_constraints jsonb;
      v_indexes jsonb;
      v_triggers jsonb;
      v_policies jsonb;
      v_rows jsonb;
      v_tables jsonb := '{}'::jsonb;
      v_views jsonb;
      v_functions jsonb;
      v_sequences jsonb;
    begin
      for rec in
        select
          c.oid as relid,
          n.nspname as schema_name,
          c.relname as table_name,
          obj_description(c.oid, 'pg_class') as table_comment,
          c.relrowsecurity as rls_enabled
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where c.relkind = 'r'
          and n.nspname not in ('pg_catalog', 'information_schema')
          and n.nspname not like 'pg_toast%'
        order by n.nspname, c.relname
      loop
        execute format($q$
          select coalesce(
            jsonb_agg(
              jsonb_build_object(
                'name', a.attname,
                'type', format_type(a.atttypid, a.atttypmod),
                'not_null', a.attnotnull,
                'default', pg_get_expr(ad.adbin, ad.adrelid),
                'identity', a.attidentity,
                'generated', a.attgenerated,
                'comment', col_description(a.attrelid, a.attnum),
                'position', a.attnum
              )
              order by a.attnum
            ),
            '[]'::jsonb
          )
          from pg_attribute a
          left join pg_attrdef ad
            on ad.adrelid = a.attrelid
           and ad.adnum = a.attnum
          where a.attrelid = %s
            and a.attnum > 0
            and not a.attisdropped
        $q$, rec.relid)
        into v_columns;
    
        execute format($q$
          select coalesce(
            jsonb_agg(
              jsonb_build_object(
                'name', conname,
                'type', contype,
                'definition', pg_get_constraintdef(oid, true),
                'validated', convalidated,
                'deferrable', condeferrable,
                'deferred', condeferred
              )
              order by conname
            ),
            '[]'::jsonb
          )
          from pg_constraint
          where conrelid = %s
        $q$, rec.relid)
        into v_constraints;
    
        execute format($q$
          select coalesce(
            jsonb_agg(
              jsonb_build_object(
                'name', i.relname,
                'is_primary', ix.indisprimary,
                'is_unique', ix.indisunique,
                'is_valid', ix.indisvalid,
                'definition', pg_get_indexdef(i.oid)
              )
              order by i.relname
            ),
            '[]'::jsonb
          )
          from pg_index ix
          join pg_class i on i.oid = ix.indexrelid
          where ix.indrelid = %s
        $q$, rec.relid)
        into v_indexes;
    
        execute format($q$
          select coalesce(
            jsonb_agg(
              jsonb_build_object(
                'name', tgname,
                'enabled', tgenabled,
                'definition', pg_get_triggerdef(oid, true)
              )
              order by tgname
            ),
            '[]'::jsonb
          )
          from pg_trigger
          where tgrelid = %s
            and not tgisinternal
        $q$, rec.relid)
        into v_triggers;
    
        execute format($q$
          select coalesce(
            jsonb_agg(
              jsonb_build_object(
                'name', policyname,
                'command', cmd,
                'roles', roles,
                'using', qual,
                'with_check', with_check
              )
              order by policyname
            ),
            '[]'::jsonb
          )
          from pg_policies
          where schemaname = %L
            and tablename = %L
        $q$, rec.schema_name, rec.table_name)
        into v_policies;
    
        execute format(
          'select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) from %I.%I t',
          rec.schema_name,
          rec.table_name
        )
        into v_rows;
    
        v_tables := v_tables || jsonb_build_object(
          format('%I.%I', rec.schema_name, rec.table_name),
          jsonb_build_object(
            'schema', rec.schema_name,
            'table', rec.table_name,
            'table_comment', rec.table_comment,
            'rls_enabled', rec.rls_enabled,
            'columns', v_columns,
            'constraints', v_constraints,
            'indexes', v_indexes,
            'triggers', v_triggers,
            'policies', v_policies,
            'row_count', coalesce(jsonb_array_length(v_rows), 0),
            'rows', v_rows
          )
        );
      end loop;
    
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'schema', schemaname,
            'view', viewname,
            'definition', definition
          )
          order by schemaname, viewname
        ),
        '[]'::jsonb
      )
      into v_views
      from pg_views
      where schemaname not in ('pg_catalog', 'information_schema');
    
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'schema', n.nspname,
            'name', p.proname,
            'args', pg_get_function_identity_arguments(p.oid),
            'returns', pg_get_function_result(p.oid),
            'language', l.lanname,
            'definition', pg_get_functiondef(p.oid)
          )
          order by n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)
        ),
        '[]'::jsonb
      )
      into v_functions
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      join pg_language l on l.oid = p.prolang
      where n.nspname not in ('pg_catalog', 'information_schema')
        and n.nspname not like 'pg_toast%';
    
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'schema', n.nspname,
            'sequence', c.relname
          )
          order by n.nspname, c.relname
        ),
        '[]'::jsonb
      )
      into v_sequences
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where c.relkind = 'S'
        and n.nspname not in ('pg_catalog', 'information_schema')
        and n.nspname not like 'pg_toast%';
    
      return jsonb_build_object(
        'database', current_database(),
        'generated_at_utc', timezone('utc', now()),
        'tables', v_tables,
        'views', v_views,
        'functions', v_functions,
        'sequences', v_sequences
      );
    end;
    $_$;


ALTER FUNCTION "public"."export_database_full_json"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."execution_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "month_start" "date" NOT NULL,
    "name" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."execution_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."execution_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "entry_date" "date" NOT NULL,
    "completed" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."execution_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."execution_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "series_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "month_start" "date" NOT NULL,
    "title" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."execution_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."off_days" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."off_days" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ops_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "event_name" "text" NOT NULL,
    "event_status" "text" NOT NULL,
    "duration_ms" integer,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ops_events_duration_ms_check" CHECK ((("duration_ms" IS NULL) OR ("duration_ms" >= 0))),
    CONSTRAINT "ops_events_event_status_check" CHECK (("event_status" = ANY (ARRAY['started'::"text", 'success'::"text", 'error'::"text", 'warning'::"text"])))
);


ALTER TABLE "public"."ops_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plan_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "study_start_date" "date" NOT NULL,
    "exam_date" "date" NOT NULL,
    "weekday_capacity_minutes" integer NOT NULL,
    "weekend_capacity_minutes" integer NOT NULL,
    "session_length_minutes" integer DEFAULT 45 NOT NULL,
    "final_revision_days" integer DEFAULT 0 NOT NULL,
    "buffer_percentage" integer DEFAULT 10 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "plan_order" "text" DEFAULT 'balanced'::"text" NOT NULL,
    "max_active_subjects" integer DEFAULT 0 NOT NULL,
    "day_of_week_capacity" "jsonb",
    "custom_day_capacity" "jsonb",
    "plan_order_stack" "jsonb",
    "flexibility_minutes" integer DEFAULT 0,
    "max_daily_minutes" integer DEFAULT 480,
    "max_topics_per_subject_per_day" integer DEFAULT 1,
    "min_subject_gap_days" integer DEFAULT 0,
    "subject_ordering" "jsonb",
    "flexible_threshold" "jsonb",
    CONSTRAINT "plan_config_buffer_percentage_check" CHECK ((("buffer_percentage" >= 0) AND ("buffer_percentage" <= 50))),
    CONSTRAINT "plan_config_final_revision_days_check" CHECK (("final_revision_days" >= 0)),
    CONSTRAINT "plan_config_flexibility_minutes_check" CHECK (("flexibility_minutes" >= 0)),
    CONSTRAINT "plan_config_max_daily_minutes_check" CHECK ((("max_daily_minutes" >= 30) AND ("max_daily_minutes" <= 720))),
    CONSTRAINT "plan_config_max_topics_per_subject_per_day_check" CHECK (("max_topics_per_subject_per_day" >= 1)),
    CONSTRAINT "plan_config_min_subject_gap_days_check" CHECK (("min_subject_gap_days" >= 0)),
    CONSTRAINT "plan_config_session_length_minutes_check" CHECK (("session_length_minutes" > 0)),
    CONSTRAINT "plan_config_weekday_capacity_minutes_check" CHECK (("weekday_capacity_minutes" >= 0)),
    CONSTRAINT "plan_config_weekend_capacity_minutes_check" CHECK (("weekend_capacity_minutes" >= 0)),
    CONSTRAINT "plan_order_valid" CHECK (("plan_order" = ANY (ARRAY['priority'::"text", 'deadline'::"text", 'subject'::"text", 'balanced'::"text"])))
);


ALTER TABLE "public"."plan_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plan_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "task_count" integer DEFAULT 0 NOT NULL,
    "schedule_json" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "config_snapshot" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "summary" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."plan_snapshots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "age" integer,
    "qualification" "text",
    "phone" "text",
    "primary_exam" "text" NOT NULL,
    "exam_date" "date",
    "daily_available_minutes" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "streak_current" integer DEFAULT 0 NOT NULL,
    "streak_longest" integer DEFAULT 0 NOT NULL,
    "streak_last_completed_date" "date",
    CONSTRAINT "daily_minutes_positive" CHECK (("daily_available_minutes" > 0))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subjects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archived" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "deadline" "date"
);


ALTER TABLE "public"."subjects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subtopics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "topic_id" "uuid" NOT NULL
);


ALTER TABLE "public"."subtopics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "scheduled_date" "date" NOT NULL,
    "duration_minutes" integer NOT NULL,
    "priority" integer DEFAULT 3 NOT NULL,
    "completed" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "subject_id" "uuid" NOT NULL,
    "is_plan_generated" boolean DEFAULT true NOT NULL,
    "topic_id" "uuid",
    "session_type" "text" DEFAULT 'core'::"text" NOT NULL,
    "plan_version" "uuid",
    "session_number" integer DEFAULT 0 NOT NULL,
    "total_sessions" integer DEFAULT 0 NOT NULL,
    "subtopic_id" "uuid",
    "sort_order" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "duration_positive" CHECK (("duration_minutes" > 0)),
    CONSTRAINT "tasks_session_type_check" CHECK (("session_type" = ANY (ARRAY['core'::"text", 'revision'::"text", 'practice'::"text"])))
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."topic_params" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "topic_id" "uuid" NOT NULL,
    "estimated_hours" numeric(6,1) NOT NULL,
    "priority" integer DEFAULT 3 NOT NULL,
    "deadline" "date",
    "earliest_start" "date",
    "depends_on" "uuid"[] DEFAULT '{}'::"uuid"[],
    "revision_sessions" integer DEFAULT 0 NOT NULL,
    "practice_sessions" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "session_length_minutes" integer DEFAULT 60 NOT NULL,
    "rest_after_days" integer DEFAULT 0 NOT NULL,
    "max_sessions_per_day" integer DEFAULT 0 NOT NULL,
    "study_frequency" "text" DEFAULT 'daily'::"text" NOT NULL,
    "tier" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "topic_params_max_sessions_per_day_check" CHECK (("max_sessions_per_day" >= 0)),
    CONSTRAINT "topic_params_practice_sessions_check" CHECK (("practice_sessions" >= 0)),
    CONSTRAINT "topic_params_priority_check" CHECK ((("priority" >= 1) AND ("priority" <= 5))),
    CONSTRAINT "topic_params_rest_after_days_check" CHECK (("rest_after_days" >= 0)),
    CONSTRAINT "topic_params_revision_sessions_check" CHECK (("revision_sessions" >= 0)),
    CONSTRAINT "topic_params_study_frequency_check" CHECK (("study_frequency" = ANY (ARRAY['daily'::"text", 'spaced'::"text", 'dense'::"text"]))),
    CONSTRAINT "topic_params_tier_check" CHECK (("tier" >= 0))
);


ALTER TABLE "public"."topic_params" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."topics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "subject_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archived" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."topics" OWNER TO "postgres";


ALTER TABLE ONLY "public"."execution_categories"
    ADD CONSTRAINT "execution_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."execution_entries"
    ADD CONSTRAINT "execution_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."execution_entries"
    ADD CONSTRAINT "execution_entries_unique" UNIQUE ("user_id", "item_id", "entry_date");



ALTER TABLE ONLY "public"."execution_items"
    ADD CONSTRAINT "execution_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."off_days"
    ADD CONSTRAINT "off_days_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."off_days"
    ADD CONSTRAINT "off_days_user_date_unique" UNIQUE ("user_id", "date");



ALTER TABLE ONLY "public"."ops_events"
    ADD CONSTRAINT "ops_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plan_config"
    ADD CONSTRAINT "plan_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plan_config"
    ADD CONSTRAINT "plan_config_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."plan_snapshots"
    ADD CONSTRAINT "plan_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subjects"
    ADD CONSTRAINT "subjects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subtopics"
    ADD CONSTRAINT "subtopics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."topic_params"
    ADD CONSTRAINT "topic_params_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."topic_params"
    ADD CONSTRAINT "topic_params_topic_id_key" UNIQUE ("topic_id");



ALTER TABLE ONLY "public"."topics"
    ADD CONSTRAINT "topics_pkey" PRIMARY KEY ("id");



CREATE INDEX "execution_categories_user_month_idx" ON "public"."execution_categories" USING "btree" ("user_id", "month_start");



CREATE INDEX "execution_entries_item_date_idx" ON "public"."execution_entries" USING "btree" ("item_id", "entry_date");



CREATE INDEX "execution_entries_user_date_idx" ON "public"."execution_entries" USING "btree" ("user_id", "entry_date");



CREATE INDEX "execution_items_category_idx" ON "public"."execution_items" USING "btree" ("category_id", "sort_order");



CREATE INDEX "execution_items_series_idx" ON "public"."execution_items" USING "btree" ("user_id", "series_id");



CREATE INDEX "execution_items_user_month_idx" ON "public"."execution_items" USING "btree" ("user_id", "month_start");



CREATE INDEX "idx_ops_events_created_at" ON "public"."ops_events" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_ops_events_name_created" ON "public"."ops_events" USING "btree" ("event_name", "created_at" DESC);



CREATE INDEX "idx_ops_events_user_created" ON "public"."ops_events" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_plan_snapshots_user" ON "public"."plan_snapshots" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_subjects_user" ON "public"."subjects" USING "btree" ("user_id");



CREATE INDEX "idx_subtopics_topic" ON "public"."subtopics" USING "btree" ("topic_id");



CREATE INDEX "idx_tasks_chapter_sort" ON "public"."tasks" USING "btree" ("topic_id", "sort_order");



CREATE INDEX "idx_tasks_plan_version" ON "public"."tasks" USING "btree" ("plan_version");



CREATE INDEX "idx_tasks_subject" ON "public"."tasks" USING "btree" ("subject_id");



CREATE INDEX "idx_tasks_subtopic" ON "public"."tasks" USING "btree" ("subtopic_id");



CREATE INDEX "idx_tasks_topic" ON "public"."tasks" USING "btree" ("topic_id");



CREATE INDEX "idx_tasks_user_date" ON "public"."tasks" USING "btree" ("user_id", "scheduled_date");



CREATE INDEX "idx_tasks_user_topic_sort" ON "public"."tasks" USING "btree" ("user_id", "topic_id", "sort_order", "created_at");



CREATE INDEX "idx_topic_params_topic" ON "public"."topic_params" USING "btree" ("topic_id");



CREATE INDEX "idx_topic_params_user" ON "public"."topic_params" USING "btree" ("user_id");



CREATE INDEX "idx_topics_archived" ON "public"."topics" USING "btree" ("archived");



CREATE INDEX "idx_topics_subject" ON "public"."topics" USING "btree" ("subject_id");



CREATE INDEX "idx_topics_user" ON "public"."topics" USING "btree" ("user_id");



CREATE INDEX "off_days_user_id_idx" ON "public"."off_days" USING "btree" ("user_id", "date");



CREATE INDEX "subjects_archived_idx" ON "public"."subjects" USING "btree" ("user_id", "archived");



ALTER TABLE ONLY "public"."execution_categories"
    ADD CONSTRAINT "execution_categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."execution_entries"
    ADD CONSTRAINT "execution_entries_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."execution_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."execution_entries"
    ADD CONSTRAINT "execution_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."execution_items"
    ADD CONSTRAINT "execution_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."execution_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."execution_items"
    ADD CONSTRAINT "execution_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."off_days"
    ADD CONSTRAINT "off_days_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ops_events"
    ADD CONSTRAINT "ops_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."plan_config"
    ADD CONSTRAINT "plan_config_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plan_snapshots"
    ADD CONSTRAINT "plan_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subjects"
    ADD CONSTRAINT "subjects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subtopics"
    ADD CONSTRAINT "subtopics_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subtopics"
    ADD CONSTRAINT "subtopics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_subtopic_id_fkey" FOREIGN KEY ("subtopic_id") REFERENCES "public"."subtopics"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."topic_params"
    ADD CONSTRAINT "topic_params_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."topic_params"
    ADD CONSTRAINT "topic_params_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."topics"
    ADD CONSTRAINT "topics_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."topics"
    ADD CONSTRAINT "topics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Service role can insert ops events" ON "public"."ops_events" FOR INSERT WITH CHECK ((("auth"."role"() = 'service_role'::"text") OR ("user_id" = "auth"."uid"())));



CREATE POLICY "Users can delete their own profile" ON "public"."profiles" FOR DELETE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can delete their own subjects" ON "public"."subjects" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own tasks" ON "public"."tasks" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can insert their own subjects" ON "public"."subjects" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own tasks" ON "public"."tasks" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own ops events" ON "public"."ops_events" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own subjects" ON "public"."subjects" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own tasks" ON "public"."tasks" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view their own subjects" ON "public"."subjects" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own tasks" ON "public"."tasks" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users delete own plan_config" ON "public"."plan_config" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users delete own topic_params" ON "public"."topic_params" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users delete own topics" ON "public"."topics" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users insert own plan_config" ON "public"."plan_config" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users insert own plan_snapshots" ON "public"."plan_snapshots" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users insert own topic_params" ON "public"."topic_params" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users insert own topics" ON "public"."topics" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users manage own subtopics" ON "public"."subtopics" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users select own plan_config" ON "public"."plan_config" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users select own plan_snapshots" ON "public"."plan_snapshots" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users select own topic_params" ON "public"."topic_params" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users select own topics" ON "public"."topics" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users update own plan_config" ON "public"."plan_config" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users update own topic_params" ON "public"."topic_params" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users update own topics" ON "public"."topics" FOR UPDATE USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."execution_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "execution_categories_delete_own" ON "public"."execution_categories" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "execution_categories_insert_own" ON "public"."execution_categories" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "execution_categories_select_own" ON "public"."execution_categories" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "execution_categories_update_own" ON "public"."execution_categories" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."execution_entries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "execution_entries_delete_own" ON "public"."execution_entries" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "execution_entries_insert_own" ON "public"."execution_entries" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "execution_entries_select_own" ON "public"."execution_entries" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "execution_entries_update_own" ON "public"."execution_entries" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."execution_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "execution_items_delete_own" ON "public"."execution_items" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "execution_items_insert_own" ON "public"."execution_items" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "execution_items_select_own" ON "public"."execution_items" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "execution_items_update_own" ON "public"."execution_items" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."off_days" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "off_days_delete_own" ON "public"."off_days" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "off_days_insert_own" ON "public"."off_days" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "off_days_select_own" ON "public"."off_days" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "off_days_update_own" ON "public"."off_days" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."ops_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."plan_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."plan_snapshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subjects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subtopics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."topic_params" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."topics" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."commit_plan_atomic"("p_user_id" "uuid", "p_tasks" "jsonb", "p_snapshot_summary" "text", "p_config_snapshot" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."commit_plan_atomic"("p_user_id" "uuid", "p_tasks" "jsonb", "p_snapshot_summary" "text", "p_config_snapshot" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."commit_plan_atomic"("p_user_id" "uuid", "p_tasks" "jsonb", "p_snapshot_summary" "text", "p_config_snapshot" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."commit_plan_atomic"("p_user_id" "uuid", "p_tasks" "jsonb", "p_snapshot_summary" "text", "p_config_snapshot" "jsonb", "p_keep_mode" "text", "p_new_plan_start_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."commit_plan_atomic"("p_user_id" "uuid", "p_tasks" "jsonb", "p_snapshot_summary" "text", "p_config_snapshot" "jsonb", "p_keep_mode" "text", "p_new_plan_start_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."commit_plan_atomic"("p_user_id" "uuid", "p_tasks" "jsonb", "p_snapshot_summary" "text", "p_config_snapshot" "jsonb", "p_keep_mode" "text", "p_new_plan_start_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."export_database_full_json"() TO "anon";
GRANT ALL ON FUNCTION "public"."export_database_full_json"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."export_database_full_json"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";


















GRANT ALL ON TABLE "public"."execution_categories" TO "anon";
GRANT ALL ON TABLE "public"."execution_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."execution_categories" TO "service_role";



GRANT ALL ON TABLE "public"."execution_entries" TO "anon";
GRANT ALL ON TABLE "public"."execution_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."execution_entries" TO "service_role";



GRANT ALL ON TABLE "public"."execution_items" TO "anon";
GRANT ALL ON TABLE "public"."execution_items" TO "authenticated";
GRANT ALL ON TABLE "public"."execution_items" TO "service_role";



GRANT ALL ON TABLE "public"."off_days" TO "anon";
GRANT ALL ON TABLE "public"."off_days" TO "authenticated";
GRANT ALL ON TABLE "public"."off_days" TO "service_role";



GRANT ALL ON TABLE "public"."ops_events" TO "anon";
GRANT ALL ON TABLE "public"."ops_events" TO "authenticated";
GRANT ALL ON TABLE "public"."ops_events" TO "service_role";



GRANT ALL ON TABLE "public"."plan_config" TO "anon";
GRANT ALL ON TABLE "public"."plan_config" TO "authenticated";
GRANT ALL ON TABLE "public"."plan_config" TO "service_role";



GRANT ALL ON TABLE "public"."plan_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."plan_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."plan_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."subjects" TO "anon";
GRANT ALL ON TABLE "public"."subjects" TO "authenticated";
GRANT ALL ON TABLE "public"."subjects" TO "service_role";



GRANT ALL ON TABLE "public"."subtopics" TO "anon";
GRANT ALL ON TABLE "public"."subtopics" TO "authenticated";
GRANT ALL ON TABLE "public"."subtopics" TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



GRANT ALL ON TABLE "public"."topic_params" TO "anon";
GRANT ALL ON TABLE "public"."topic_params" TO "authenticated";
GRANT ALL ON TABLE "public"."topic_params" TO "service_role";



GRANT ALL ON TABLE "public"."topics" TO "anon";
GRANT ALL ON TABLE "public"."topics" TO "authenticated";
GRANT ALL ON TABLE "public"."topics" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































