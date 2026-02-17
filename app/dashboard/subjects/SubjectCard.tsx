"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { StudyUnitItem } from "./StudyUnitItem";

interface Subject {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  study_units?: StudyUnit[];
}

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

interface SubjectCardProps {
  subject: Subject;
  onDeleteSubject: (subjectId: string) => void;
  onStudyUnitsChange: () => void;
}

export function SubjectCard({ subject, onDeleteSubject, onStudyUnitsChange }: SubjectCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAddingUnit, setIsAddingUnit] = useState(false);
  const [unitTitle, setUnitTitle] = useState("");
  const [estimatedMinutes, setEstimatedMinutes] = useState(60);
  const [unitDeadline, setUnitDeadline] = useState("");
  const [priority, setPriority] = useState(3);

  const studyUnits = subject.study_units || [];
  const totalStudyTime = studyUnits.reduce(
    (acc, unit) => acc + unit.estimated_minutes,
    0
  );

  const handleAddStudyUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitTitle.trim()) return;

    setIsAddingUnit(true);

    try {
      const { error } = await supabase.from("study_units").insert({
        user_id: subject.user_id,
        subject_id: subject.id,
        title: unitTitle.trim(),
        estimated_minutes: estimatedMinutes,
        deadline: unitDeadline || null,
        priority,
      });

      if (error) {
        console.error("Error adding study unit:", error);
        return;
      }

      setUnitTitle("");
      setEstimatedMinutes(60);
      setUnitDeadline("");
      setPriority(3);
      onStudyUnitsChange();
    } catch (error) {
      console.error("Error adding study unit:", error);
    } finally {
      setIsAddingUnit(false);
    }
  };

  return (
    <div
      className="
        bg-neutral-900/40 backdrop-blur-sm border border-neutral-800/50 
        rounded-xl transition-all duration-300 hover:bg-neutral-900/60 
        hover:border-neutral-700/50 hover:shadow-lg hover:shadow-black/20
        overflow-hidden
      "
    >
      {/* Subject Header */}
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-medium text-neutral-100 mb-2">
              {subject.name}
            </h3>

            <div className="flex items-center gap-4 text-sm text-neutral-400">
              <span className="flex items-center gap-1.5">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                </svg>
                {studyUnits.length} {studyUnits.length === 1 ? "unit" : "units"}
              </span>

              {totalStudyTime > 0 && (
                <span className="flex items-center gap-1.5">
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
                  {Math.round(totalStudyTime / 60)}h {totalStudyTime % 60}m total
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="
                p-2 rounded-lg text-neutral-400 hover:text-neutral-200 
                hover:bg-neutral-800/50 transition-all duration-200
              "
              aria-label={isExpanded ? "Collapse" : "Expand"}
            >
              <svg
                className={`w-5 h-5 transition-transform duration-300 ${
                  isExpanded ? "rotate-180" : ""
                }`}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
            <button
              onClick={() => onDeleteSubject(subject.id)}
              className="
                p-2 rounded-lg text-neutral-500 hover:text-red-400 
                hover:bg-red-500/10 transition-all duration-200
              "
              aria-label="Delete subject"
            >
              <svg
                className="w-5 h-5"
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
      </div>

      {/* Expandable Study Units Section */}
      <div
        className={`
          overflow-hidden transition-all duration-300 ease-in-out
          ${isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"}
        `}
      >
        <div className="px-5 sm:px-6 pb-6 border-t border-neutral-800/50 pt-6">
          {/* Add Study Unit Form */}
          <form onSubmit={handleAddStudyUnit} className="mb-6 space-y-4">
            <div>
              <input
                type="text"
                placeholder="Study unit title (e.g., Chapter 1: Introduction)"
                value={unitTitle}
                onChange={(e) => setUnitTitle(e.target.value)}
                className="
                  w-full px-4 py-3 bg-neutral-900/50 border border-neutral-800 
                  rounded-lg text-neutral-100 placeholder-neutral-600 text-sm
                  focus:outline-none focus:ring-2 focus:ring-neutral-700 focus:border-transparent
                  transition-all duration-200
                "
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-neutral-500 mb-1.5">Estimated Minutes</label>
                <input
                  type="number"
                  min="1"
                  value={estimatedMinutes}
                  onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                  className="
                    w-full px-3 py-2 bg-neutral-900/50 border border-neutral-800 
                    rounded-lg text-neutral-100 text-sm
                    focus:outline-none focus:ring-2 focus:ring-neutral-700 focus:border-transparent
                    transition-all duration-200
                  "
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1.5">Deadline (Optional)</label>
                <input
                  type="date"
                  value={unitDeadline}
                  onChange={(e) => setUnitDeadline(e.target.value)}
                  className="
                    w-full px-3 py-2 bg-neutral-900/50 border border-neutral-800 
                    rounded-lg text-neutral-100 text-sm
                    focus:outline-none focus:ring-2 focus:ring-neutral-700 focus:border-transparent
                    transition-all duration-200
                  "
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1.5">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                  className="
                    w-full px-3 py-2 bg-neutral-900/50 border border-neutral-800 
                    rounded-lg text-neutral-100 text-sm
                    focus:outline-none focus:ring-2 focus:ring-neutral-700 focus:border-transparent
                    transition-all duration-200 cursor-pointer
                  "
                >
                  <option value={1}>High</option>
                  <option value={2}>Medium-High</option>
                  <option value={3}>Medium</option>
                  <option value={4}>Medium-Low</option>
                  <option value={5}>Low</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={!unitTitle.trim() || isAddingUnit}
              className="
                px-4 py-2 bg-neutral-800 text-neutral-200 rounded-lg text-sm font-medium
                hover:bg-neutral-700 transition-all duration-200
                disabled:opacity-40 disabled:cursor-not-allowed
              "
            >
              {isAddingUnit ? "Adding..." : "Add Study Unit"}
            </button>
          </form>

          {/* Study Units List */}
          {studyUnits.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-neutral-500 text-sm">
                No study units yet. Add your first unit above to start planning.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {studyUnits.map((unit) => (
                <StudyUnitItem
                  key={unit.id}
                  unit={unit}
                  subjectId={subject.id}
                  onDelete={() => onStudyUnitsChange()}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}