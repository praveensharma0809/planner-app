import { Task } from "@/lib/types/db"

interface TaskCardProps {
  task: Task
  onToggleComplete: (taskId: string, currentValue: boolean) => void
  onDelete: (taskId: string) => void
}

const priorityConfig = {
  1: { label: "High", className: "bg-red-500/10 text-red-400 border-red-500/20" },
  2: { label: "Medium-High", className: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  3: { label: "Medium", className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  4: { label: "Medium-Low", className: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  5: { label: "Low", className: "bg-gray-500/10 text-gray-400 border-gray-500/20" },
}

export function TaskCard({ task, onToggleComplete, onDelete }: TaskCardProps) {
  const priorityStyle = priorityConfig[task.priority as keyof typeof priorityConfig]

  return (
    <div
      className={`
        group relative bg-neutral-900/40 backdrop-blur-sm border border-neutral-800/50 
        rounded-xl p-5 transition-all duration-300 hover:bg-neutral-900/60 
        hover:border-neutral-700/50 hover:shadow-lg hover:shadow-black/20
        ${task.completed ? "opacity-60" : "opacity-100"}
      `}
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 pt-1">
          <button
            onClick={() => onToggleComplete(task.id, task.completed)}
            className={`
              w-5 h-5 rounded border-2 transition-all duration-200
              flex items-center justify-center
              ${
                task.completed
                  ? "bg-emerald-500/20 border-emerald-500/50"
                  : "bg-transparent border-neutral-600 hover:border-neutral-500"
              }
            `}
            aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
          >
            {task.completed && (
              <svg
                className="w-3 h-3 text-emerald-400"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="3"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            )}
          </button>
        </div>

        <div className="flex-1 min-w-0">
          <h3
            className={`
              text-lg font-medium mb-2 transition-all duration-300
              ${task.completed ? "line-through text-neutral-500" : "text-neutral-100"}
            `}
          >
            {task.title}
          </h3>

          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-neutral-400 flex items-center gap-1.5">
              <svg
                className="w-4 h-4"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              {task.duration_minutes} min
            </span>

            <span
              className={`
                text-xs px-2.5 py-1 rounded-full border font-medium
                ${priorityStyle.className}
              `}
            >
              {priorityStyle.label}
            </span>
          </div>
        </div>

        <button
          onClick={() => onDelete(task.id)}
          className="
            flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200
            p-2 rounded-lg hover:bg-red-500/10 text-neutral-500 hover:text-red-400
          "
          aria-label="Delete task"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            <line x1="10" y1="11" x2="10" y2="17"></line>
            <line x1="14" y1="11" x2="14" y2="17"></line>
          </svg>
        </button>
      </div>
    </div>
  )
}
