"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        router.push("/auth/signup");
      } else {
        setUser(data.user);
      }
    };

    checkUser();
  }, [router]);

  if (!user) return null;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white">
        <h1 className="mb-6 text-xl">
          Welcome to your Dashboard, {user.email}
        </h1>

        <button
          onClick={async () => {
            await supabase.auth.signOut();
            router.push("/auth/login");
          }}
          className="px-6 py-2 bg-white text-black rounded-lg hover:bg-gray-200 transition"
        >
          Logout
        </button>
      </div>
    );
}
