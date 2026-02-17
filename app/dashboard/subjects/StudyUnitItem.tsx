"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

interface StudyUnit {
  id: string;
  user_id: string;
  subject_id: string;
  title: string;
  total_lectures: number;
  average_duration_minutes: number;
  created_at: string;
}

interface StudyUnitItemProps {
  unit: StudyUnit;
  subjectId: string;
  onDelete: () => void;
}

export function StudyUnitItem({ unit, onDelete }: StudyUnitItemProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const totalDuration = unit.total_lectures * unit.average_duration_minutes;
  const hours = Math.floor(totalDuration / 60);
  const minutes = totalDuration % 60;

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
        <h4 className="text-neutral-200 font-medium mb-1 truncate">
          {unit.title}
        </h4>
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
              <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
            </svg>
            {unit.total_lectures} {unit.total_lectures === 1 ? "lecture" : "lectures"}
          </span>
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
            {hours > 0 ? `${hours}h ` : ""}{minutes}m total
          </span>
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