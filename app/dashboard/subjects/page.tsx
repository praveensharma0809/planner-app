"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Subject {
  id: string;
  name: string;
}

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [newSubject, setNewSubject] = useState("");

  const fetchSubjects = async () => {
    const { data } = await supabase.from("subjects").select("*");
    if (data) setSubjects(data);
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return;

    const { error } = await supabase.from("subjects").insert({
      user_id: user.id,
      name: newSubject,
    });

    if (!error) {
      setNewSubject("");
      fetchSubjects();
    } else {
      alert(error.message);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Subjects</h1>

      <form onSubmit={handleAddSubject} className="mb-6 flex gap-3">
        <input
          type="text"
          placeholder="New Subject"
          className="p-3 bg-neutral-800 rounded-lg border border-neutral-700"
          value={newSubject}
          onChange={(e) => setNewSubject(e.target.value)}
          required
        />
        <button
          type="submit"
          className="px-4 py-3 bg-white text-black rounded-lg"
        >
          Add
        </button>
      </form>

      <ul className="space-y-3">
        {subjects.map((subject) => (
          <li
            key={subject.id}
            className="p-4 bg-neutral-800 rounded-lg"
          >
            {subject.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
