"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/components/Toast";
import Link from "next/link";
import Image from "next/image";
import { Plus_Jakarta_Sans } from "next/font/google";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

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
        const msg = error.message.toLowerCase();
        if (msg.includes("already registered") || msg.includes("already exists")) {
          addToast("An account with this email already exists.", "error");
        } else if (msg.includes("password")) {
          addToast("Password must be at least 6 characters.", "error");
        } else {
          addToast("Could not create account. Please try again.", "error");
        }
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
    <main className={`${plusJakarta.className} min-h-screen grid lg:grid-cols-[1fr_1.1fr] bg-white text-[#0B0C1A] antialiased overflow-hidden`}>
      {/* Left Pane - Form */}
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16 xl:px-24 relative z-10">
        <Link href="/landingpage" className="absolute top-8 left-6 sm:left-12 lg:left-16 xl:left-24 flex items-center gap-2.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2 transition-transform hover:-translate-x-1">
          <Image src="/logo.jpg" alt="PrepVeda" width={32} height={32} className="rounded-full object-cover shadow-sm border border-black/5" />
          <span className="text-base font-extrabold tracking-tight text-[#0B0C1A]">PrepVeda</span>
        </Link>
        
        <div className="w-full max-w-[420px] mx-auto space-y-10 mt-12 lg:mt-0">
          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#0B0C1A]">Create an account</h1>
            <p className="text-[#454772] font-medium text-base">Start planning your exams for free.</p>
          </div>

          <form className="space-y-6" onSubmit={handleSignup}>
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-bold text-[#0B0C1A]">Email</label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                className="w-full px-4 py-3.5 rounded-2xl bg-white border border-black/[0.1] focus:outline-none focus:border-[#F43F5E] focus:ring-4 focus:ring-[#F43F5E]/10 text-[15px] font-medium text-[#0B0C1A] placeholder:text-[#9294B4] transition-all shadow-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-bold text-[#0B0C1A]">Password</label>
              <input
                id="password"
                type="password"
                placeholder="Min 6 characters"
                className="w-full px-4 py-3.5 rounded-2xl bg-white border border-black/[0.1] focus:outline-none focus:border-[#F43F5E] focus:ring-4 focus:ring-[#F43F5E]/10 text-[15px] font-medium text-[#0B0C1A] placeholder:text-[#9294B4] transition-all shadow-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-2xl bg-[#F43F5E] hover:bg-[#E11D48] active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100 text-white font-bold text-[15px] shadow-[0_8px_24px_rgba(244,63,94,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F43F5E] focus-visible:ring-offset-2 transition-all"
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <p className="text-center text-[#454772] font-medium text-sm">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-[#F43F5E] font-extrabold hover:text-[#E11D48] focus-visible:outline-none focus-visible:underline transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Right Pane - Image & Brand */}
      <div className="hidden lg:block relative bg-[#F5F3FF] p-6 xl:p-8">
        <div className="absolute inset-0 bg-gradient-to-br from-[#4F46E5]/5 to-[#F43F5E]/5" />
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle, rgba(79, 70, 229, 0.1) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        
        <div className="relative h-full w-full rounded-[2.5rem] overflow-hidden shadow-2xl shadow-[#4F46E5]/10 border border-white/50 bg-[#EEF0FF] flex items-center justify-center">
          <Image 
            src="/app_screenshots/auth_cover.png" 
            alt="PrepVeda Abstract" 
            fill 
            className="object-cover" 
            priority 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/0 to-black/0" />
          
          <div className="absolute bottom-12 left-12 right-12 z-20">

            <h2 className="text-4xl xl:text-5xl font-extrabold tracking-tight text-white mb-4 leading-tight">
              Stop guessing. <br/> Start scheduling.
            </h2>
            <p className="text-white/80 font-medium text-lg max-w-md">
              PrepVeda is the only planner that flags impossible deadlines before you even begin studying.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
