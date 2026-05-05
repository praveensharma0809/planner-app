import type { FormEvent } from "react"
import { Button, Input, Modal } from "@/app/components/ui"

type TaskCreateMode = "single" | "bulk"
type NumberPlacement = "suffix" | "prefix"

interface TaskComposerModalProps {
  open: boolean
  saving: boolean
  taskCreateMode: TaskCreateMode
  singleTaskTitle: string
  bulkBaseName: string
  bulkCount: string
  bulkStartAt: string
  bulkNumberPadding: string
  bulkSeparator: string
  bulkPlacement: NumberPlacement
  bulkPreview: string[]
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onTaskCreateModeChange: (mode: TaskCreateMode) => void
  onSingleTaskTitleChange: (value: string) => void
  onBulkBaseNameChange: (value: string) => void
  onBulkCountChange: (value: string) => void
  onBulkStartAtChange: (value: string) => void
  onBulkNumberPaddingChange: (value: string) => void
  onBulkSeparatorChange: (value: string) => void
  onBulkPlacementChange: (value: NumberPlacement) => void
}

export function TaskComposerModal({
  open,
  saving,
  taskCreateMode,
  singleTaskTitle,
  bulkBaseName,
  bulkCount,
  bulkStartAt,
  bulkNumberPadding,
  bulkSeparator,
  bulkPlacement,
  bulkPreview,
  onClose,
  onSubmit,
  onTaskCreateModeChange,
  onSingleTaskTitleChange,
  onBulkBaseNameChange,
  onBulkCountChange,
  onBulkStartAtChange,
  onBulkNumberPaddingChange,
  onBulkSeparatorChange,
  onBulkPlacementChange,
}: TaskComposerModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Tasks"
      size="md"
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onTaskCreateModeChange("single")}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${taskCreateMode === "single" ? "bg-black text-white" : "bg-transparent text-text-secondary border border-border-subtle hover:bg-surface-hover"}`}
          >
            Single Task
          </button>

          <button
            type="button"
            onClick={() => onTaskCreateModeChange("bulk")}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${taskCreateMode === "bulk" ? "bg-black text-white" : "bg-transparent text-text-secondary border border-border-subtle hover:bg-surface-hover"}`}
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
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="md" disabled={saving}>
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
