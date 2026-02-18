"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        router.push("/auth/login");
      } else {
        setLoading(false);
      }
    };

    checkUser();
  }, [router]);

  if (loading) return null;

    return (
      <div className="min-h-screen bg-black text-white flex">
        {/* Sidebar */}
        <aside className="w-64 bg-neutral-900 p-6">
          <h2 className="text-lg font-semibold mb-6">Planner</h2>

          <nav className="space-y-3">
            <a href="/dashboard" className="block hover:text-gray-300">
              Dashboard
            </a>
            <a href="/dashboard/subjects" className="block hover:text-gray-300">
              Subjects
            </a>
            <a href="/planner" className="block hover:text-gray-300">
              Planner
            </a>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    );
}
