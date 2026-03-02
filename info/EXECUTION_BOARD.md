# Monthly Execution Board (Exam Mode)

## Overview
The Monthly Execution Board is a spreadsheet-style execution grid for a single month. It is intentionally separate from the planner engine and uses server actions for all data access. The board supports custom categories, up to 50 execution items per month, and checkbox-only daily tracking. All database access is done server-side with Supabase RLS enforced by `auth.uid()`.

Primary entry points:
- Page: [app/execution/page.tsx](app/execution/page.tsx)
- UI: [app/execution/ExecutionBoard.tsx](app/execution/ExecutionBoard.tsx)
- Data loader: [app/actions/execution/getExecutionMonth.ts](app/actions/execution/getExecutionMonth.ts)
- Toggle action: [app/actions/execution/toggleExecutionEntry.ts](app/actions/execution/toggleExecutionEntry.ts)

Navigation integration:
- Sidebar link: [app/dashboard/Sidebar.tsx](app/dashboard/Sidebar.tsx)

## Architecture Summary
- Next.js App Router with server actions for all database operations.
- Server-side fetch of the month data, including categories, items, entries, and metrics.
- Client-side grid with optimistic checkbox updates, drag reorder, and undo buffer.
- Supabase RLS policies on all tables to scope reads and writes to the authenticated user.

## Data Model (Tables)
Defined in migration: [supabase/migrations/202603020001_execution_board.sql](supabase/migrations/202603020001_execution_board.sql)

### execution_categories
Represents a category of execution items for a specific month.
- `id` uuid primary key
- `user_id` uuid (auth users)
- `month_start` date
- `name` text
- `sort_order` integer
- `deleted_at` timestamptz (soft delete)
- `created_at` timestamptz
- `updated_at` timestamptz

### execution_items
Represents an item tracked daily within a month. Each item has a `series_id` so streaks can continue across months.
- `id` uuid primary key
- `user_id` uuid (auth users)
- `category_id` uuid (execution_categories)
- `series_id` uuid (logical series across months)
- `month_start` date
- `title` text
- `sort_order` integer
- `deleted_at` timestamptz (soft delete)
- `created_at` timestamptz
- `updated_at` timestamptz

### execution_entries
Represents a completed checkbox for a given day and item.
- `id` uuid primary key
- `user_id` uuid (auth users)
- `item_id` uuid (execution_items)
- `entry_date` date
- `completed` boolean
- `created_at` timestamptz
- `updated_at` timestamptz
- unique constraint on `(user_id, item_id, entry_date)` for idempotent upserts

### Indexes
- Categories: `(user_id, month_start)`
- Items: `(user_id, month_start)`, `(category_id, sort_order)`, `(user_id, series_id)`
- Entries: `(user_id, entry_date)`, `(item_id, entry_date)`

### RLS Policies
All three tables enable RLS and allow CRUD only when `auth.uid()` matches `user_id`. Policies are defined in the migration for select, insert, update, delete.

## Types
Shared types are defined in [lib/types/db.ts](lib/types/db.ts):
- `ExecutionCategory`
- `ExecutionItem` (includes `series_id`)
- `ExecutionEntry`

## Month Loading and Cloning
Implemented in [app/actions/execution/getExecutionMonth.ts](app/actions/execution/getExecutionMonth.ts).

### Month Resolution
- Uses `monthKey` in `YYYY-MM` format; falls back to current UTC month.
- Calculates `month_start`, `month_end`, `days_in_month`, and `month_label`.

### Clone Behavior
If the current month has no categories:
1. Finds the most recent prior month that has categories.
2. Clones categories into the target month.
3. Clones items and preserves `series_id` so streaks can span months.
4. Entries are not cloned.

This supports consistent structure month over month without mutating past data.

## Metrics and Streak Logic
Computed in [app/actions/execution/getExecutionMonth.ts](app/actions/execution/getExecutionMonth.ts).

### Per-item metrics
- Monthly completion percent: `(completed days in month / days_in_month) * 100`.
- Current streak: computed over all entries for the item series across months.

### Global metrics
- Global streak: at least one completed entry per day, across all items.
- Monthly completion percent: total completed entries in the month divided by `items * days_in_month`.
- Today completion count: total completed entries for the current date in the month.

### Streak computation
`calculateCurrentStreak()` walks backward from today, counting consecutive dates present in a set of completed dates.

For item streaks:
- The system gathers all items with matching `series_id`.
- It loads all completed entry dates for those items up to today.
- It computes the streak from that combined set of dates.

## Server Actions
All actions use Supabase server client and revalidate `/execution` after mutations.

### getExecutionMonth
- File: [app/actions/execution/getExecutionMonth.ts](app/actions/execution/getExecutionMonth.ts)
- Returns full month data: categories, items, entries, and metrics.
- Triggers month cloning if needed.

### toggleExecutionEntry
- File: [app/actions/execution/toggleExecutionEntry.ts](app/actions/execution/toggleExecutionEntry.ts)
- Validates item, date format, and date bounds.
- Upserts entry by `(user_id, item_id, entry_date)` with `completed` flag.
- Used for checkbox autosave.

### createExecutionCategory
- File: [app/actions/execution/createCategory.ts](app/actions/execution/createCategory.ts)
- Validates name.
- Computes `sort_order` from last item in the month.

### createExecutionItem
- File: [app/actions/execution/createItem.ts](app/actions/execution/createItem.ts)
- Validates title.
- Enforces 50 items per month.
- Computes `sort_order` within a category.

### reorderExecutionItems
- File: [app/actions/execution/reorderItems.ts](app/actions/execution/reorderItems.ts)
- Validates item ids match the category.
- Updates `sort_order` for each item in the new order.

### soft delete and undo
- Delete category: [app/actions/execution/softDeleteCategory.ts](app/actions/execution/softDeleteCategory.ts)
- Delete item: [app/actions/execution/softDeleteItem.ts](app/actions/execution/softDeleteItem.ts)
- Undo category: [app/actions/execution/undoDeleteCategory.ts](app/actions/execution/undoDeleteCategory.ts)
- Undo item: [app/actions/execution/undoDeleteItem.ts](app/actions/execution/undoDeleteItem.ts)

Category deletion soft-deletes all active items in the category with the same timestamp to allow a targeted undo.

## UI and Interaction Model
Implemented in [app/execution/ExecutionBoard.tsx](app/execution/ExecutionBoard.tsx).

### Page shell
[app/execution/page.tsx](app/execution/page.tsx) renders:
- Month navigation with prev and next links.
- Warning banner for past months.
- Summary metrics (global streak, monthly completion, today completed, item count).
- The execution grid.

### Execution grid
- Sticky columns for Category, Item, Percent, Streak.
- Daily columns for 1 to 31 with locked dates.
- Horizontal scroll on small screens.
- Today column highlight if no completions today.

### Optimistic checkbox saves
- Click toggles UI state immediately.
- Server action persists state.
- If the server fails, UI state rolls back and a toast is shown.

### Drag reorder
- Enabled only in manual sort mode.
- Drag within a category to reorder items.
- Server action persists new order.

### Sorting
- Manual: by `sort_order`.
- By streak or percent: uses computed metrics from the server.

### Soft delete and undo
- Delete item or category triggers soft delete.
- Undo banner appears for 8 seconds.
- Undo restores soft-deleted records and refreshes the board.

## Key Constraints and Guarantees
- Max 50 execution items per month enforced server-side.
- Past months are editable but show a warning banner.
- No client-side DB access.
- No automatic mutation of past data.
- RLS ensures user scoping on all tables.

## File Map
- [app/execution/page.tsx](app/execution/page.tsx) - page wrapper and month navigation
- [app/execution/ExecutionBoard.tsx](app/execution/ExecutionBoard.tsx) - client grid and interactions
- [app/actions/execution/getExecutionMonth.ts](app/actions/execution/getExecutionMonth.ts) - data load, cloning, metrics
- [app/actions/execution/toggleExecutionEntry.ts](app/actions/execution/toggleExecutionEntry.ts) - checkbox autosave
- [app/actions/execution/createCategory.ts](app/actions/execution/createCategory.ts) - category create
- [app/actions/execution/createItem.ts](app/actions/execution/createItem.ts) - item create
- [app/actions/execution/reorderItems.ts](app/actions/execution/reorderItems.ts) - drag reorder
- [app/actions/execution/softDeleteCategory.ts](app/actions/execution/softDeleteCategory.ts) - soft delete category
- [app/actions/execution/softDeleteItem.ts](app/actions/execution/softDeleteItem.ts) - soft delete item
- [app/actions/execution/undoDeleteCategory.ts](app/actions/execution/undoDeleteCategory.ts) - undo category delete
- [app/actions/execution/undoDeleteItem.ts](app/actions/execution/undoDeleteItem.ts) - undo item delete
- [app/actions/execution/updateCategory.ts](app/actions/execution/updateCategory.ts) - category update
- [app/actions/execution/updateItem.ts](app/actions/execution/updateItem.ts) - item update
- [lib/types/db.ts](lib/types/db.ts) - TypeScript model types
- [supabase/migrations/202603020001_execution_board.sql](supabase/migrations/202603020001_execution_board.sql) - schema + RLS
- [app/dashboard/Sidebar.tsx](app/dashboard/Sidebar.tsx) - navigation link
