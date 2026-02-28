"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/components/Toast";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        addToast(error.message, "error");
        setLoading(false);
      } else {
        addToast("Account created - check your email to confirm.", "success");
        router.push("/auth/login");
      }
    } catch {
      addToast("Network error - please try again.", "error");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center text-white relative overflow-hidden" style={{ background: "var(--background)" }}>
      <div className="mesh-bg" />

      <div className="w-full max-w-md space-y-8 relative z-10 px-4">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-xl shadow-indigo-500/20">
            <span className="text-xl font-black text-white">S</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight gradient-text">StudyHard</h1>
          <p className="text-sm text-white/40">Create your account</p>
        </div>

        <div className="glass-card !p-8 space-y-6">
          <form className="space-y-4" onSubmit={handleSignup}>
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs text-white/40 font-medium">Email</label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                className="w-full p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] focus:outline-none focus:border-indigo-500/30 focus:ring-1 focus:ring-indigo-500/20 text-sm transition-all"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs text-white/40 font-medium">Password</label>
              <input
                id="password"
                type="password"
                placeholder="Min 6 characters"
                className="w-full p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] focus:outline-none focus:border-indigo-500/30 focus:ring-1 focus:ring-indigo-500/20 text-sm transition-all"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full !py-3 !text-sm"
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <p className="text-center text-sm text-white/30">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-indigo-400 hover:text-indigo-300 transition-colors font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}