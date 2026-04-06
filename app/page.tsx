"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const checkUser = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data.user;

        if (!user) {
          if (!cancelled) router.replace("/auth/login");
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) {
          if (!cancelled) {
            setError("We could not load your profile. Redirecting to login.");
            router.replace("/auth/login");
          }
          return;
        }

        if (!profile) {
          if (!cancelled) router.replace("/onboarding");
          return;
        }

        if (!cancelled) router.replace("/dashboard");
      } catch {
        if (!cancelled) {
          setError("Something went wrong while loading your workspace.");
        }
      }
    };

    checkUser();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center mesh-bg text-white">
      <div className="mesh-bg" />
      <div className="text-center space-y-3 relative z-10">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto shadow-lg shadow-indigo-500/25">
          <span className="text-white font-bold text-xl">S</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight gradient-text">StudyHard</h1>
        <p className="text-sm text-white/30">{error ?? "Loading..."}</p>
      </div>
    </div>
  );
}