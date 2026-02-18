"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [primaryExam, setPrimaryExam] = useState("");
  const [dailyHours, setDailyHours] = useState("");
  const [loading, setLoading] = useState(true);

    useEffect(() => {
      const checkAuth = async () => {
        const { data } = await supabase.auth.getUser();
        const user = data.user;

        if (!user) {
          router.push("/auth/login");
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("id, full_name, primary_exam, qualification, phone, daily_available_minutes, exam_date, created_at")
          .eq("id", user.id)
          .single();

        if (profile) {
          router.push("/dashboard");
        } else {
          setLoading(false);
        }
      };

      checkAuth();
    }, [router]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) return;

    const dailyMinutes = parseInt(dailyHours) * 60;

    const { error } = await supabase.from("profiles").insert({
      id: user.id,
      full_name: fullName,
      primary_exam: primaryExam,
      daily_available_minutes: dailyMinutes,
    });

    if (error) {
      alert(error.message);
    } else {
      router.push("/dashboard");
    }
  };

  if (loading) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="w-full max-w-lg bg-neutral-900 p-8 rounded-2xl shadow-xl">
        <h1 className="text-2xl font-semibold mb-6 text-center">
          Complete Your Profile
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Full Name"
            className="w-full p-3 rounded-lg bg-neutral-800 border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-white"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />

          <input
            type="text"
            placeholder="Exam (JEE, UPSC, Custom...)"
            className="w-full p-3 rounded-lg bg-neutral-800 border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-white"
            value={primaryExam}
            onChange={(e) => setPrimaryExam(e.target.value)}
            required
          />

          <input
            type="number"
            placeholder="Daily Available Study Hours"
            className="w-full p-3 rounded-lg bg-neutral-800 border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-white"
            value={dailyHours}
            onChange={(e) => setDailyHours(e.target.value)}
            required
          />

          <button
            type="submit"
            className="w-full p-3 rounded-lg bg-white text-black font-medium hover:bg-gray-200 transition"
          >
            Save & Continue
          </button>
        </form>
      </div>
    </div>
  );
}
