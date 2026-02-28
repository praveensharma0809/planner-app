"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
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

      if (!profile) {
        router.push("/onboarding");
      } else {
        router.push("/dashboard");
      }
    };

    checkUser();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center mesh-bg text-white">
      <div className="mesh-bg" />
      <div className="text-center space-y-3 relative z-10">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto shadow-lg shadow-indigo-500/25">
          <span className="text-white font-bold text-xl">S</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight gradient-text">StudyHard</h1>
        <p className="text-sm text-white/30">Loading&#x2026;</p>
      </div>
    </div>
  );
}