import type { FormEvent } from "react"
import { Button, Input, Modal } from "@/app/components/ui"

type TaskCreateMode = "single" | "bulk"

interface TaskComposerModalProps {
  open: boolean
  isMutating: boolean
  saving: boolean
  taskCreateMode: TaskCreateMode
  singleTaskTitle: string
  bulkBaseName: string
  bulkCount: string
  bulkPreview: string[]
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onTaskCreateModeChange: (mode: TaskCreateMode) => void
  onSingleTaskTitleChange: (value: string) => void
  onBulkBaseNameChange: (value: string) => void
  onBulkCountChange: (value: string) => void
}

export function TaskComposerModal({
  open,
  isMutating,
  saving,
  taskCreateMode,
  singleTaskTitle,
  bulkBaseName,
  bulkCount,
  bulkPreview,
  onClose,
  onSubmit,
  onTaskCreateModeChange,
  onSingleTaskTitleChange,
  onBulkBaseNameChange,
  onBulkCountChange,
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
      <form className="flex max-h-[calc(100vh-13rem)] flex-col" onSubmit={onSubmit}>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onTaskCreateModeChange("single")}
              className="rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors"
              style={{
                borderColor:
                  taskCreateMode === "single" ? "var(--sh-primary-glow)" : "var(--sh-border)",
                color:
                  taskCreateMode === "single" ? "var(--sh-primary-light)" : "var(--sh-text-secondary)",
                background:
                  taskCreateMode === "single" ? "var(--sh-primary-muted)" : "transparent",
              }}
              disabled={isMutating || saving}
            >
              Single Task
            </button>

            <button
              type="button"
              onClick={() => onTaskCreateModeChange("bulk")}
              className="rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors"
              style={{
                borderColor:
                  taskCreateMode === "bulk" ? "var(--sh-primary-glow)" : "var(--sh-border)",
                color:
                  taskCreateMode === "bulk" ? "var(--sh-primary-light)" : "var(--sh-text-secondary)",
                background:
                  taskCreateMode === "bulk" ? "var(--sh-primary-muted)" : "transparent",
              }}
              disabled={isMutating || saving}
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

              <Input
                required
                label="Count"
                type="number"
                min={1}
                max={100}
                value={bulkCount}
                onChange={(event) => onBulkCountChange(event.target.value)}
              />

              {bulkPreview.length > 0 && (
                <div
                  className="rounded-md border p-2.5"
                  style={{ borderColor: "var(--sh-border)", background: "rgba(255,255,255,0.015)" }}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--sh-text-muted)" }}>
                    Preview
                  </p>
                  <p className="mt-1 text-xs" style={{ color: "var(--sh-text-secondary)" }}>
                    {bulkPreview.join("  |  ")}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-end gap-2 border-t pt-3" style={{ borderColor: "var(--sh-border)" }}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onClose()
            }}
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
