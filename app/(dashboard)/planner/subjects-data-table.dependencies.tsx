import { useRef } from "react"
import { Button, Input, Modal } from "@/app/components/ui"

type DependencyScope = "subject" | "chapter"

interface DependencyManagerModalProps {
  dependencyModalOpen: boolean
  dependencyScope: DependencyScope
  dependencyTargetOptions: Array<{ id: string; label: string }>
  dependencySearch: string
  dependencyCandidates: Array<{ id: string; name: string; subjectName: string }>
  dependencySelectedIds: Set<string>
  dependencyBusy: "loading" | "saving" | null
  isMutating: boolean
  dependencyTargetChapterId: string
  setDependencyModalOpen: (open: boolean) => void
  setDependencySearch: (value: string) => void
  toggleDependencySelection: (id: string) => void
  setDependencySelectedIds: (value: Set<string>) => void
  handleSaveDependencies: () => void
}

export function DependencyManagerModal({
  dependencyModalOpen,
  dependencyScope,
  dependencyTargetOptions,
  dependencySearch,
  dependencyCandidates,
  dependencySelectedIds,
  dependencyBusy,
  isMutating,
  dependencyTargetChapterId,
  setDependencyModalOpen,
  setDependencySearch,
  toggleDependencySelection,
  setDependencySelectedIds,
  handleSaveDependencies,
}: DependencyManagerModalProps) {
  const searchInputRef = useRef<HTMLInputElement>(null)
  return (
    <Modal
      open={dependencyModalOpen}
      onClose={() => {
        if (isMutating || dependencyBusy === "saving") return
        setDependencyModalOpen(false)
      }}
      title={dependencyScope === "subject" ? "Set Dependencies (Subject)" : "Set Dependencies (Chapter)"}
      size="md"
      initialFocusRef={searchInputRef}
    >
      <div className="space-y-4">
        {dependencyTargetOptions[0] ? (
          <p className="text-xs" style={{ color: "var(--sh-text-secondary)" }}>
            {dependencyScope === "subject" ? "Target Subject: " : "Target: "}
            {dependencyTargetOptions[0].label}
          </p>
        ) : null}

        <Input
          ref={searchInputRef}
          label={dependencyScope === "subject" ? "Search Subjects" : "Search Chapters"}
          value={dependencySearch}
          onChange={(event) => setDependencySearch(event.target.value)}
          placeholder={dependencyScope === "subject" ? "Filter by subject" : "Filter by subject or chapter"}
        />

        <div
          className="max-h-[280px] space-y-1.5 overflow-y-auto rounded-lg border p-2"
          style={{ borderColor: "var(--sh-border)", background: "rgba(255,255,255,0.02)" }}
        >
          {dependencyBusy === "loading" ? (
            <p className="px-1 py-2 text-xs" style={{ color: "var(--sh-text-muted)" }}>
              {dependencyScope === "subject" ? "Loading subject parameters..." : "Loading chapter parameters..."}
            </p>
          ) : dependencyCandidates.length === 0 ? (
            <p className="px-1 py-2 text-xs" style={{ color: "var(--sh-text-muted)" }}>
              {dependencyScope === "subject" ? "No other subjects available." : "No candidate chapters found."}
            </p>
          ) : (
            dependencyCandidates.map((candidate) => {
              const selected = dependencySelectedIds.has(candidate.id)

              return (
                <button
                  key={`dependency-candidate-${candidate.id}`}
                  type="button"
                  onClick={() => toggleDependencySelection(candidate.id)}
                  className="w-full rounded-md border px-2 py-1.5 text-left transition-colors"
                  style={{
                    borderColor: selected ? "var(--sh-primary-glow)" : "var(--sh-border)",
                    background: selected ? "var(--sh-primary-muted)" : "transparent",
                  }}
                  disabled={isMutating || dependencyBusy === "saving"}
                >
                  <p
                    className="text-sm font-semibold"
                    style={{ color: selected ? "var(--sh-primary-light)" : "var(--sh-text-primary)" }}
                  >
                    {candidate.name}
                  </p>
                  {candidate.subjectName ? (
                    <p className="text-[11px]" style={{ color: "var(--sh-text-muted)" }}>
                      {candidate.subjectName}
                    </p>
                  ) : null}
                </button>
              )
            })
          )}
        </div>

        <p className="text-xs" style={{ color: "var(--sh-text-muted)" }}>
          Selected prerequisites: {dependencySelectedIds.size}
        </p>

        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setDependencySelectedIds(new Set())}
            disabled={isMutating || dependencyBusy === "saving" || dependencySelectedIds.size === 0}
          >
            Clear
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDependencyModalOpen(false)}
              disabled={isMutating || dependencyBusy !== null}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => {
                void handleSaveDependencies()
              }}
              disabled={isMutating || dependencyBusy !== null || !dependencyTargetChapterId}
            >
              {dependencyBusy === "saving" ? "Saving..." : "Save Dependencies"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
