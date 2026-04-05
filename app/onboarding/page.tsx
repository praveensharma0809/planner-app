"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/components/Toast";
import { addSubject } from "@/app/actions/subjects/addSubject";

interface SubjectDraft {
  name: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { addToast } = useToast();

  // Wizard step: 1 = profile, 2 = subjects, 3 = done
  const [step, setStep] = useState(1);
  const totalSteps = 3;

  // Step 1 — Profile
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);

  // Step 2 — Subjects
  const [subjects, setSubjects] = useState<SubjectDraft[]>([]);
  const [subName, setSubName] = useState("");
  const [subSaving, setSubSaving] = useState(false);

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
        .select("id")
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

  // Step 1 — Save profile
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);

    try {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) return;

      const { error } = await supabase.from("profiles").insert({
        id: user.id,
        full_name: fullName,
      });

      if (error) {
        addToast(error.message, "error");
      } else {
        setStep(2);
      }
    } catch {
      addToast("Network error — please try again.", "error");
    } finally {
      setProfileSaving(false);
    }
  };

  // Step 2 — Add subject
  const handleAddSubject = async () => {
    if (!subName.trim()) return;
    setSubSaving(true);

    try {
      const result = await addSubject({
        name: subName.trim(),
      });

      if (result.status === "SUCCESS") {
        setSubjects((prev) => [
          ...prev,
          { name: subName.trim() },
        ]);
        setSubName("");
      } else if (result.status === "ERROR") {
        addToast(result.message, "error");
      } else {
        addToast("Session expired. Please log in again.", "error");
        router.push("/auth/login");
      }
    } catch {
      addToast("Network error — please try again.", "error");
    } finally {
      setSubSaving(false);
    }
  };

  // Step 3 — Go to planner
  const handleGoToPlanner = () => {
    router.push("/planner");
  };

  const handleGoToDashboard = () => {
    router.push("/dashboard");
  };

  if (loading) return null;

  // Shared input style
  const inputClass =
    "w-full p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] focus:outline-none focus:border-indigo-500/30 focus:ring-1 focus:ring-indigo-500/20 transition-all";

  return (
    <main className="min-h-screen flex items-center justify-center text-white relative">
      <div className="mesh-bg" />
      <div className="w-full max-w-lg glass-card !p-8 relative z-10">
        {/* Step indicator */}
        <div className="flex items-center gap-1.5 mb-6" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={totalSteps} aria-label={`Onboarding step ${step} of ${totalSteps}`}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                step > i ? "bg-indigo-500" : step === i + 1 ? "bg-indigo-500/60" : "bg-white/20"
              }`}
            />
          ))}
        </div>

        {/* ======================== STEP 1: Profile ======================== */}
        {step === 1 && (
          <>
            <h1 className="mb-2 text-center text-2xl font-semibold">
              Complete Your Profile
            </h1>
            <p className="mb-6 text-center text-sm text-white/50">
              Tell us your name to finish setup.
            </p>

            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div className="mx-auto max-w-md">
                <input
                  type="text"
                  placeholder="Full Name"
                  className={inputClass}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  aria-label="Full name"
                />
              </div>

              <button
                type="submit"
                disabled={profileSaving}
                className="w-full p-3 rounded-xl btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {profileSaving ? "Saving…" : "Next →"}
              </button>
            </form>
          </>
        )}

        {/* ======================== STEP 2: Subjects ======================== */}
        {step === 2 && (
          <>
            <h1 className="text-2xl font-semibold mb-2 text-center">
              Add Your Subjects
            </h1>
            <p className="text-sm text-white/50 text-center mb-6">
              Add the subjects you need to study. You can always add more later.
            </p>

            {/* Added subjects list */}
            {subjects.length > 0 && (
              <div className="mb-6 space-y-2">
                {subjects.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3"
                  >
                    <div className="text-sm font-medium">{s.name}</div>
                    <svg
                      className="w-4 h-4 text-emerald-400"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="3"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                ))}
              </div>
            )}

            {/* Subject form */}
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Subject name"
                value={subName}
                onChange={(e) => setSubName(e.target.value)}
                className={inputClass}
              />

              <p className="text-xs text-white/30">
                Topics and workload details can be configured later in the Planner wizard.
              </p>

              <button
                type="button"
                onClick={handleAddSubject}
                disabled={subSaving || !subName.trim()}
                className="w-full p-3 rounded-xl bg-neutral-700 text-white font-medium hover:bg-neutral-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {subSaving ? "Adding…" : "+ Add Subject"}
              </button>
            </div>

            {/* Navigation */}
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 p-3 rounded-xl btn-ghost"
              >
                ← Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 p-3 rounded-xl btn-primary"
              >
                {subjects.length === 0
                  ? "Skip for now →"
                  : `Next with ${subjects.length} subject${subjects.length > 1 ? "s" : ""} →`}
              </button>
            </div>
            <button
              type="button"
              onClick={handleGoToDashboard}
              className="mt-3 w-full rounded-xl btn-ghost p-3 text-sm"
            >
              Skip to Dashboard
            </button>
          </>
        )}

        {/* ======================== STEP 3: All Set ======================== */}
        {step === 3 && (
          <>
            <h1 className="text-2xl font-semibold mb-2 text-center">
              You&apos;re All Set!
            </h1>
            <p className="text-sm text-white/50 text-center mb-6">
              Your profile and subjects are saved. Head to the Planner to
              configure topics and generate your study schedule.
            </p>

            <div className="space-y-3 mb-6">
              <div className="bg-white/5 rounded-xl px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-white/70">Subjects</span>
                <span className="text-sm font-semibold">{subjects.length}</span>
              </div>
            </div>

            <div className="text-center py-4">
              <div className="w-16 h-16 mx-auto bg-emerald-500/20 rounded-full flex items-center justify-center mb-4">
                <svg
                  className="w-8 h-8 text-emerald-400"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 p-3 rounded-xl btn-ghost"
              >
                ← Back
              </button>
              <button
                onClick={handleGoToPlanner}
                className="flex-1 p-3 rounded-xl btn-primary"
              >
                Open Planner
              </button>
            </div>
            <button
              onClick={handleGoToDashboard}
              className="w-full mt-3 p-3 rounded-xl btn-ghost text-sm"
            >
              Skip to Dashboard
            </button>
          </>
        )}
      </div>
    </main>
  );
}
