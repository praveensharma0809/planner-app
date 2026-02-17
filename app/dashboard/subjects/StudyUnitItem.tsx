"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

interface StudyUnit {
  id: string;
  user_id: string;
  subject_id: string;
  title: string;
  estimated_minutes: number;
  deadline: string | null;
  priority: number;
  created_at: string;
}

interface StudyUnitItemProps {
  unit: StudyUnit;
  subjectId: string;
  onDelete: () => void;
}

const priorityConfig = {
  1: { label: "High", className: "bg-red-500/10 text-red-400 border-red-500/20" },
  2: { label: "Medium-High", className: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  3: { label: "Medium", className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  4: { label: "Medium-Low", className: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  5: { label: "Low", className: "bg-gray-500/10 text-gray-400 border-gray-500/20" },
};

export function StudyUnitItem({ unit, onDelete }: StudyUnitItemProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const priorityStyle = priorityConfig[unit.priority as keyof typeof priorityConfig];
  const hours = Math.floor(unit.estimated_minutes / 60);
  const minutes = unit.estimated_minutes % 60;

  const formatDeadline = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    }).format(date);
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this study unit?")) {
      return;
    }

    setIsDeleting(true);

    try {
      const { error } = await supabase
        .from("study_units")
        .delete()
        .eq("id", unit.id);

      if (error) {
        console.error("Error deleting study unit:", error);
        return;
      }

      onDelete();
    } catch (error) {
      console.error("Error deleting study unit:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="
        group flex items-center justify-between gap-4 p-4 
        bg-neutral-900/30 border border-neutral-800/30 rounded-lg
        transition-all duration-200 hover:bg-neutral-900/50 hover:border-neutral-700/30
      "
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 mb-1">
          <h4 className="text-neutral-200 font-medium truncate">
            {unit.title}
          </h4>
          <span
            className={`
              text-xs px-2 py-1 rounded-full border font-medium flex-shrink-0
              ${priorityStyle.className}
            `}
          >
            {priorityStyle.label}
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm text-neutral-500">
          <span className="flex items-center gap-1">
            <svg
              className="w-3.5 h-3.5"
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
            {hours > 0 ? `${hours}h ` : ""}{minutes}m
          </span>
          {unit.deadline && (
            <span className="flex items-center gap-1">
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              {formatDeadline(unit.deadline)}
            </span>
          )}
        </div>
      </div>

      <button
        onClick={handleDelete}
        disabled={isDeleting}
        className="
          flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200
          p-2 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-red-500/10
          disabled:opacity-40 disabled:cursor-not-allowed
        "
        aria-label="Delete study unit"
      >
        {isDeleting ? (
          <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin"></div>
        ) : (
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
        )}
      </button>
    </div>
  );
}