"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Subject {
  id: string;
  name: string;
}

interface StudyUnit {
  id: string;
  title: string;
  estimated_minutes: number;
  deadline: string | null;
  priority: number;
}

export default function PlannerPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [studyUnits, setStudyUnits] = useState<StudyUnit[]>([]);

  const [title, setTitle] = useState("");
  const [estimatedMinutes, setEstimatedMinutes] = useState("");
  const [deadline, setDeadline] = useState("");
  const [priority, setPriority] = useState("3");
  const [subjectId, setSubjectId] = useState("");

  useEffect(() => {
    fetchSubjects();
    fetchStudyUnits();
  }, []);

  const fetchSubjects = async () => {
    const { data } = await supabase.from("subjects").select("*");
    if (data) setSubjects(data);
  };

  const fetchStudyUnits = async () => {
    const { data } = await supabase
      .from("study_units")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) setStudyUnits(data);
  };

  const handleAddStudyUnit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return;

    const { error } = await supabase.from("study_units").insert({
      user_id: user.id,
      subject_id: subjectId,
      title,
      estimated_minutes: parseInt(estimatedMinutes),
      deadline: deadline || null,
      priority: parseInt(priority),
    });

    if (!error) {
      setTitle("");
      setEstimatedMinutes("");
      setDeadline("");
      setPriority("3");
      setSubjectId("");
      fetchStudyUnits();
    } else {
      alert(error.message);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <h1 className="text-3xl font-bold mb-6">Planner</h1>

      {/* Add Study Unit Form */}
      <form
        onSubmit={handleAddStudyUnit}
        className="bg-neutral-900 p-6 rounded-xl mb-8 space-y-4"
      >
        <input
          type="text"
          placeholder="Title"
          className="w-full p-3 bg-neutral-800 rounded-lg border border-neutral-700"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <input
          type="number"
          placeholder="Estimated Minutes"
          className="w-full p-3 bg-neutral-800 rounded-lg border border-neutral-700"
          value={estimatedMinutes}
          onChange={(e) => setEstimatedMinutes(e.target.value)}
          required
        />

        <input
          type="date"
          className="w-full p-3 bg-neutral-800 rounded-lg border border-neutral-700"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        />

        <select
          className="w-full p-3 bg-neutral-800 rounded-lg border border-neutral-700"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        >
          <option value="1">Priority 1 (High)</option>
          <option value="2">Priority 2</option>
          <option value="3">Priority 3</option>
          <option value="4">Priority 4</option>
          <option value="5">Priority 5 (Low)</option>
        </select>

        <select
          className="w-full p-3 bg-neutral-800 rounded-lg border border-neutral-700"
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          required
        >
          <option value="">Select Subject</option>
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.name}
            </option>
          ))}
        </select>

        <button
          type="submit"
          className="w-full p-3 bg-white text-black rounded-lg"
        >
          Add Study Unit
        </button>
      </form>

      {/* Study Units List */}
      <div className="space-y-4">
        {studyUnits.map((unit) => (
          <div
            key={unit.id}
            className="p-4 bg-neutral-900 rounded-lg"
          >
            <h3 className="font-semibold">{unit.title}</h3>
            <p>Minutes: {unit.estimated_minutes}</p>
            <p>Deadline: {unit.deadline || "None"}</p>
            <p>Priority: {unit.priority}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
