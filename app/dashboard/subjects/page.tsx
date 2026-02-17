"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { SubjectCard } from "./SubjectCard";

interface User {
  id: string;
  email?: string;
}

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

export default function SubjectsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingSubject, setIsAddingSubject] = useState(false);
  
  // Form state
  const [subjectName, setSubjectName] = useState("");

  const fetchSubjects = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("subjects")
      .select(`
        *,
        study_units (
          id,
          title,
          estimated_minutes,
          deadline,
          priority
        )
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching subjects:", error);
      return;
    }

    if (data) {
      setSubjects(data as Subject[]);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return;
      }

      setUser(user as User);
      await fetchSubjects(user.id);
      setLoading(false);
    };

    init();
  }, [fetchSubjects]);

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectName.trim() || !user) return;

    setIsAddingSubject(true);

    try {
      const { error } = await supabase.from("subjects").insert({
        user_id: user.id,
        name: subjectName.trim(),
      });

      if (error) {
        console.error("Error adding subject:", error);
        return;
      }

      setSubjectName("");
      await fetchSubjects(user.id);
    } catch (error) {
      console.error("Error adding subject:", error);
    } finally {
      setIsAddingSubject(false);
    }
  };

  const handleDeleteSubject = async (subjectId: string) => {
    if (!confirm("Are you sure you want to delete this subject? All study units will also be deleted.")) {
      return;
    }

    try {
      // Delete study units first (due to foreign key constraint)
      await supabase
        .from("study_units")
        .delete()
        .eq("subject_id", subjectId);

      // Then delete the subject
      const { error } = await supabase
        .from("subjects")
        .delete()
        .eq("id", subjectId);

      if (error) {
        console.error("Error deleting subject:", error);
        return;
      }

      if (user) {
        await fetchSubjects(user.id);
      }
    } catch (error) {
      console.error("Error deleting subject:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-neutral-700 border-t-neutral-400 rounded-full animate-spin"></div>
          <p className="text-neutral-400 text-sm">Loading your subjects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="max-w-4xl mx-auto px-6 py-12 sm:px-8 lg:py-16">
        <header className="mb-12">
          <h1 className="text-4xl sm:text-5xl font-light text-neutral-100 tracking-tight mb-4">
            Study Subjects
          </h1>
          <p className="text-neutral-400 text-lg">
            Organize your subjects and plan your study units effectively
          </p>
        </header>

        <div className="space-y-8">
          {/* Add New Subject Form */}
          <div className="bg-neutral-900/30 backdrop-blur-sm border border-neutral-800/50 rounded-2xl p-6 sm:p-8 shadow-xl">
            <h2 className="text-lg font-medium text-neutral-200 mb-6">Add New Subject</h2>
            
            <form onSubmit={handleAddSubject} className="space-y-6">
              <div>
                <label className="block text-sm text-neutral-400 mb-2">Subject Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Mathematics, Physics, History"
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  required
                  className="
                    w-full px-4 py-3 bg-neutral-900/50 border border-neutral-800 
                    rounded-lg text-neutral-100 placeholder-neutral-600
                    focus:outline-none focus:ring-2 focus:ring-neutral-700 focus:border-transparent
                    transition-all duration-200
                  "
                />
              </div>

              <button
                type="submit"
                disabled={!subjectName.trim() || isAddingSubject}
                className="
                  px-8 py-3 bg-neutral-100 text-neutral-900 
                  rounded-lg font-medium
                  hover:bg-white transition-all duration-200
                  disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-neutral-100
                  shadow-lg shadow-black/10 hover:shadow-xl hover:shadow-black/20
                  transform hover:scale-[1.02] active:scale-[0.98]
                "
              >
                {isAddingSubject ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin"></div>
                    Adding...
                  </span>
                ) : (
                  "Add Subject"
                )}
              </button>
            </form>
          </div>

          {/* Subjects List */}
          <div>
            {subjects.length === 0 ? (
              <div className="bg-neutral-900/20 backdrop-blur-sm border border-neutral-800/30 rounded-2xl p-12 text-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-neutral-800/50 flex items-center justify-center">
                    <svg
                      className="w-8 h-8 text-neutral-600"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-medium text-neutral-300 mb-2">
                      No subjects yet
                    </h3>
                    <p className="text-neutral-500 text-sm max-w-md mx-auto">
                      Start by adding your first subject above. You can also add study units for each subject to plan your learning progress.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {subjects.map((subject) => (
                  <SubjectCard
                    key={subject.id}
                    subject={subject}
                    onDeleteSubject={handleDeleteSubject}
                    onStudyUnitsChange={() => user && fetchSubjects(user.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}