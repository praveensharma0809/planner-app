import type { FormEvent } from "react"
import type { ArchivedChapterListItem } from "@/app/actions/subjects/chapters"
import { Button, Input, Modal } from "@/app/components/ui"

type TaskCreateMode = "single" | "bulk"
type NumberPlacement = "suffix" | "prefix"
type NameDialogMode = "create" | "edit"

type ChapterEditorModalProps = {
  open: boolean
  isMutating: boolean
  chapterDialogSaving: boolean
  chapterArchiveSaving: boolean
  mode: NameDialogMode
  targetId: string | null
  value: string
  earliestStart: string
  deadline: string
  restAfterDays: string
  onClose: () => void
  onValueChange: (value: string) => void
  onEarliestStartChange: (value: string) => void
  onDeadlineChange: (value: string) => void
  onRestAfterDaysChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onArchive: () => void
  onDelete: (targetId: string, targetName: string) => void
}

export function ChapterEditorModal({
  open,
  isMutating,
  chapterDialogSaving,
  chapterArchiveSaving,
  mode,
  targetId,
  value,
  earliestStart,
  deadline,
  restAfterDays,
  onClose,
  onValueChange,
  onEarliestStartChange,
  onDeadlineChange,
  onRestAfterDaysChange,
  onSubmit,
  onArchive,
  onDelete,
}: ChapterEditorModalProps) {
  return (
    <Modal
      open={open}
      onClose={() => {
        if (isMutating || chapterDialogSaving || chapterArchiveSaving) return
        onClose()
      }}
      title={mode === "create" ? "Add Chapter" : "Edit Chapter"}
      size="md"
    >
      <form id="chapter-form" className="space-y-4" onSubmit={onSubmit}>
        <Input
          autoFocus
          required
          label="Chapter Name"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          placeholder="e.g. Limits and Continuity"
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            type="date"
            label="Start Date"
            value={earliestStart}
            onChange={(event) => onEarliestStartChange(event.target.value)}
          />
          <Input
            type="date"
            label="Deadline"
            value={deadline}
            onChange={(event) => onDeadlineChange(event.target.value)}
          />
        </div>

        <Input
          type="number"
          min={0}
          label="Rest After Days"
          value={restAfterDays}
          onChange={(event) => onRestAfterDaysChange(event.target.value)}
        />

        {mode === "edit" && targetId && (
          <div className="rounded-xl border border-pastel-rose/40 p-3 bg-pastel-rose/30">
            <p className="text-xs font-semibold uppercase tracking-wide text-pastel-rose-text">Danger Zone</p>
            <p className="mt-1 text-xs text-pastel-rose-text/80">
              Delete chapter and detach related tasks from this chapter.
            </p>
            <Button
              type="button"
              variant="danger"
              size="sm"
              className="mt-2"
              onClick={() => {
                const nextTargetName = value.trim() || "Untitled chapter"
                onClose()
                onDelete(targetId, nextTargetName)
              }}
              disabled={isMutating || chapterDialogSaving}
            >
              Delete Chapter
            </Button>
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isMutating || chapterDialogSaving || chapterArchiveSaving}
          >
            Cancel
          </Button>
          {mode === "edit" && targetId && (
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={onArchive}
              disabled={isMutating || chapterDialogSaving || chapterArchiveSaving}
            >
              {chapterArchiveSaving ? "Archiving..." : "Archive Chapter"}
            </Button>
          )}
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={isMutating || chapterDialogSaving || chapterArchiveSaving}
          >
            {chapterDialogSaving
              ? "Saving..."
              : mode === "create"
                ? "Add Chapter"
                : "Save Changes"}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

type ArchivedChaptersModalProps = {
  open: boolean
  isMutating: boolean
  loading: boolean
  pendingId: string | null
  subjectTitle: string | null
  rows: ArchivedChapterListItem[]
  onClose: () => void
  onRestore: (chapterId: string) => void
  onDelete: (chapterId: string, chapterName: string) => void
}

export function ArchivedChaptersModal({
  open,
  isMutating,
  loading,
  pendingId,
  subjectTitle,
  rows,
  onClose,
  onRestore,
  onDelete,
}: ArchivedChaptersModalProps) {
  return (
    <Modal
      open={open}
      onClose={() => {
        if (isMutating || loading || pendingId) return
        onClose()
      }}
      title={subjectTitle
        ? `Archived Chapters (${rows.length})`
        : "Archived Chapters"}
      size="md"
    >
      <div className="space-y-3">
        {loading ? (
          <div className="rounded-xl border border-dashed border-border-hairline px-3 py-4 text-sm text-text-muted">
            Loading archived chapters...
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-hairline px-3 py-4 text-sm text-text-muted">
            No archived chapters for this subject.
          </div>
        ) : (
          <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
            {rows.map((chapter) => {
              const isPending = pendingId === chapter.id

              return (
                <div
                  key={chapter.id}
                  className="rounded-xl border border-border-hairline bg-surface-panel-muted p-2"
                >
                  <div className="flex items-center gap-2">
                    <p
                      className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary"
                      title={chapter.name}
                    >
                      {chapter.name}
                    </p>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isMutating || isPending || loading}
                      onClick={() => onRestore(chapter.id)}
                    >
                      Restore
                    </Button>

                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      disabled={isMutating || isPending || loading}
                      onClick={() => onDelete(chapter.id, chapter.name)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isMutating || !!pendingId}
          >
            Close
          </Button>
        </div>
      </div>
    </Modal>
  )
}

type TaskComposerModalProps = {
  open: boolean
  isMutating: boolean
  saving: boolean
  taskCreateMode: TaskCreateMode
  singleTaskTitle: string
  bulkBaseName: string
  bulkCount: string
  bulkStartAt: string
  bulkNumberPadding: string
  bulkPlacement: NumberPlacement
  bulkSeparator: string
  bulkPreview: string[]
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onTaskCreateModeChange: (mode: TaskCreateMode) => void
  onSingleTaskTitleChange: (value: string) => void
  onBulkBaseNameChange: (value: string) => void
  onBulkCountChange: (value: string) => void
  onBulkStartAtChange: (value: string) => void
  onBulkNumberPaddingChange: (value: string) => void
  onBulkPlacementChange: (placement: NumberPlacement) => void
  onBulkSeparatorChange: (separator: string) => void
}

export function TaskComposerModal({
  open,
  isMutating,
  saving,
  taskCreateMode,
  singleTaskTitle,
  bulkBaseName,
  bulkCount,
  bulkStartAt,
  bulkNumberPadding,
  bulkPlacement,
  bulkSeparator,
  bulkPreview,
  onClose,
  onSubmit,
  onTaskCreateModeChange,
  onSingleTaskTitleChange,
  onBulkBaseNameChange,
  onBulkCountChange,
  onBulkStartAtChange,
  onBulkNumberPaddingChange,
  onBulkPlacementChange,
  onBulkSeparatorChange,
}: TaskComposerModalProps) {
  return (
    <Modal
      open={open}
      onClose={() => {
        if (saving || isMutating) return
        onClose()
      }}
      title="Add Tasks"
      size="md"
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onTaskCreateModeChange("single")}
            disabled={isMutating || saving}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40 ${taskCreateMode === "single" ? "bg-black text-white" : "bg-transparent text-text-secondary border border-border-subtle hover:bg-surface-hover"}`}
          >
            Single Task
          </button>

          <button
            type="button"
            onClick={() => onTaskCreateModeChange("bulk")}
            disabled={isMutating || saving}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40 ${taskCreateMode === "bulk" ? "bg-black text-white" : "bg-transparent text-text-secondary border border-border-subtle hover:bg-surface-hover"}`}
          >
            Bulk Series
          </button>
        </div>

        {taskCreateMode === "single" ? (
          <Input
            required
            label="Task Title"
            value={singleTaskTitle}
            onChange={(event) => onSingleTaskTitleChange(event.target.value)}
            placeholder="e.g. Lecture review"
          />
        ) : (
          <div className="space-y-3">
            <Input
              required
              label="Base Name"
              value={bulkBaseName}
              onChange={(event) => onBulkBaseNameChange(event.target.value)}
              placeholder="e.g. Lecture"
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                required
                label="Count"
                type="number"
                min={1}
                max={100}
                value={bulkCount}
                onChange={(event) => onBulkCountChange(event.target.value)}
              />
              <Input
                required
                label="Start Number"
                type="number"
                min={1}
                max={10000}
                value={bulkStartAt}
                onChange={(event) => onBulkStartAtChange(event.target.value)}
              />
              <Input
                required
                label="Number Padding"
                type="number"
                min={0}
                max={6}
                value={bulkNumberPadding}
                onChange={(event) => onBulkNumberPaddingChange(event.target.value)}
                hint="Adds leading zeros: 0 -> Lecture-1, 1 -> Lecture-01, 2 -> Lecture-001"
              />

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-secondary">
                  Number Placement
                </label>
                <select
                  value={bulkPlacement}
                  onChange={(event) =>
                    onBulkPlacementChange(event.target.value === "prefix" ? "prefix" : "suffix")
                  }
                  className="ui-input"
                >
                  <option value="suffix">Lecture-1</option>
                  <option value="prefix">1-Lecture</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-xs font-semibold text-text-secondary">
                  Separator (what goes between name and number)
                </label>
                <select
                  value={bulkSeparator}
                  onChange={(event) => onBulkSeparatorChange(event.target.value)}
                  className="ui-input"
                >
                  <option value="-">Hyphen: Lecture-1</option>
                  <option value=" ">Space: Lecture 1</option>
                  <option value="_">Underscore: Lecture_1</option>
                  <option value="">None: Lecture1</option>
                  <option value="·">Dot: Lecture·1</option>
                </select>
              </div>
            </div>

            {bulkPreview.length > 0 && (
              <div className="rounded-xl border border-border-hairline bg-surface-panel-muted p-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                  Preview
                </p>
                <p className="mt-1 text-xs text-text-secondary">
                  {bulkPreview.join("  |  ")}
                </p>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isMutating || saving}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" disabled={isMutating || saving}>
            {saving
              ? "Saving..."
              : taskCreateMode === "single"
                ? "Add Task"
                : "Create Series"}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
