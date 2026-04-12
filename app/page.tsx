"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
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
          .select("id, onboarding_completed")
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

        // Show onboarding tutorial if not completed yet
        if (!profile.onboarding_completed) {
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
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto overflow-hidden shadow-lg shadow-indigo-500/25">
          <Image src="/logo.png" alt="StayPlanned Logo" width={64} height={64} className="object-cover" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight gradient-text">StayPlanned</h1>
        <p className="text-sm text-white/30">{error ?? "Loading..."}</p>
      </div>
    </div>
  );
}
