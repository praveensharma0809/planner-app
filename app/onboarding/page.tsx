"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/components/Toast";
import { addSubject } from "@/app/actions/subjects/addSubject";
import { addOffDay } from "@/app/actions/offdays/addOffDay";
import { deleteOffDay } from "@/app/actions/offdays/deleteOffDay";
import { analyzePlanAction, type AnalyzePlanResponse } from "@/app/actions/plan/analyzePlan";
import { commitPlan } from "@/app/actions/plan/commitPlan";

interface SubjectDraft {
  name: string;
  total_items: number;
  avg_duration_minutes: number;
  deadline: string;
  priority: number;
}

interface OffDayDraft {
  id: string;
  date: string;
  reason: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { addToast } = useToast();

  // Wizard step: 1 = profile, 2 = subjects, 3 = off-days, 4 = preview, 5 = confirm
  const [step, setStep] = useState(1);
  const totalSteps = 5;

  // Step 1 — Profile
  const [fullName, setFullName] = useState("");
  const [primaryExam, setPrimaryExam] = useState("");
  const [dailyHours, setDailyHours] = useState("");
  const [examDate, setExamDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);

  // Step 2 — Subjects
  const [subjects, setSubjects] = useState<SubjectDraft[]>([]);
  const [subName, setSubName] = useState("");
  const [subItems, setSubItems] = useState(20);
  const [subDuration, setSubDuration] = useState(60);
  const [subDeadline, setSubDeadline] = useState("");
  const [subPriority, setSubPriority] = useState(3);
  const [subSaving, setSubSaving] = useState(false);

  // Step 3 — Off-days
  const [offDays, setOffDays] = useState<OffDayDraft[]>([]);
  const [offDate, setOffDate] = useState("");
  const [offReason, setOffReason] = useState("");
  const [offSaving, setOffSaving] = useState(false);

  // Step 4 — Blueprint preview
  const [analysis, setAnalysis] = useState<AnalyzePlanResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Step 5 — Confirm
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitDone, setCommitDone] = useState(false);

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

  // Step 1 — Save profile
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);

    try {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) return;

      const parsed = parseInt(dailyHours);
      const dailyMinutes = isNaN(parsed) || parsed <= 0 ? 60 : parsed * 60;

      const { error } = await supabase.from("profiles").insert({
        id: user.id,
        full_name: fullName,
        primary_exam: primaryExam,
        daily_available_minutes: dailyMinutes,
        exam_date: examDate || null,
      });

      if (error) {
        addToast(error.message, "error");
      } else {
        // Default subject deadline to exam date
        setSubDeadline(examDate);
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
        total_items: subItems,
        avg_duration_minutes: subDuration,
        deadline: subDeadline,
        priority: subPriority,
      });

      if (result.status === "SUCCESS") {
        setSubjects((prev) => [
          ...prev,
          {
            name: subName.trim(),
            total_items: subItems,
            avg_duration_minutes: subDuration,
            deadline: subDeadline,
            priority: subPriority,
          },
        ]);
        setSubName("");
        setSubItems(20);
        setSubDuration(60);
        setSubPriority(3);
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

  // Step 3 — Add off-day
  const handleAddOffDay = async () => {
    if (!offDate) return;
    setOffSaving(true);

    try {
      const result = await addOffDay({
        date: offDate,
        reason: offReason || undefined,
      });

      if (result.status === "SUCCESS") {
        setOffDays((prev) => [
          ...prev,
          { id: result.id, date: offDate, reason: offReason },
        ]);
        setOffDate("");
        setOffReason("");
      } else if (result.status === "ERROR") {
        addToast(result.message, "error");
      } else {
        addToast("Session expired. Please log in again.", "error");
        router.push("/auth/login");
      }
    } catch {
      addToast("Network error — please try again.", "error");
    } finally {
      setOffSaving(false);
    }
  };

  const handleRemoveOffDay = async (offDayId: string, index: number) => {
    try {
      await deleteOffDay(offDayId);
      setOffDays((prev) => prev.filter((_, i) => i !== index));
    } catch {
      addToast("Failed to remove off day.", "error");
    }
  };

  // Step 4 — Run analysis
  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      const res = await analyzePlanAction();
      setAnalysis(res);
    } catch {
      addToast("Failed to analyze — please try again.", "error");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Auto-analyze when entering step 4, clear stale analysis first
  useEffect(() => {
    if (step === 4) {
      setAnalysis(null);
      handleAnalyze();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Step 5 — Commit
  const handleCommit = async () => {
    if (!analysis || analysis.status !== "READY") return;
    setIsCommitting(true);
    try {
      const result = await commitPlan({ tasks: analysis.tasks });
      if (result.status === "SUCCESS") {
        setCommitDone(true);
      } else {
        addToast("Failed to commit plan.", "error");
      }
    } catch {
      addToast("Network error — could not commit plan.", "error");
    } finally {
      setIsCommitting(false);
    }
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
            <h1 className="text-2xl font-semibold mb-6 text-center">
              Complete Your Profile
            </h1>

            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <input
                type="text"
                placeholder="Full Name"
                className={inputClass}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                aria-label="Full name"
              />

              <input
                type="text"
                placeholder="e.g. CPA, product launch, thesis…"
                className={inputClass}
                value={primaryExam}
                onChange={(e) => setPrimaryExam(e.target.value)}
                required
                aria-label="Goal or exam name"
              />

              <input
                type="number"
                placeholder="Daily Available Hours (e.g. 3)"
                className={inputClass}
                value={dailyHours}
                onChange={(e) => setDailyHours(e.target.value)}
                min={1}
                max={16}
                required
                aria-label="Daily available hours"
              />

              <div className="space-y-1">
                <label className="text-sm text-white/60">
                  Goal deadline{" "}
                  <span className="text-white/40">
                    (used to schedule your plan)
                  </span>
                </label>
                <input
                  type="date"
                  className={inputClass}
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  required
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
                    <div>
                      <div className="text-sm font-medium">{s.name}</div>
                      <div className="text-xs text-white/40">
                        {s.total_items} items · {s.avg_duration_minutes} min/item · P{s.priority}
                      </div>
                    </div>
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

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-white/50">Total items</label>
                  <input
                    type="number"
                    value={subItems}
                    onChange={(e) => setSubItems(Number(e.target.value))}
                    min={1}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-white/50">
                    Avg duration (mins)
                  </label>
                  <input
                    type="number"
                    value={subDuration}
                    onChange={(e) => setSubDuration(Number(e.target.value))}
                    min={1}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-white/50">Deadline</label>
                  <input
                    type="date"
                    value={subDeadline}
                    onChange={(e) => setSubDeadline(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-white/50">Priority</label>
                  <select
                    value={subPriority}
                    onChange={(e) => setSubPriority(Number(e.target.value))}
                    className={inputClass}
                  >
                    <option value={1}>High</option>
                    <option value={2}>Medium-High</option>
                    <option value={3}>Medium</option>
                    <option value={4}>Low</option>
                    <option value={5}>Very Low</option>
                  </select>
                </div>
              </div>

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
          </>
        )}

        {/* ======================== STEP 3: Off-days ======================== */}
        {step === 3 && (
          <>
            <h1 className="text-2xl font-semibold mb-2 text-center">
              Set Off Days
            </h1>
            <p className="text-sm text-white/50 text-center mb-6">
              Mark dates when you can&apos;t study (holidays, events, rest days).
              The planner will skip these dates. This is optional.
            </p>

            {/* Added off-days list */}
            {offDays.length > 0 && (
              <div className="mb-6 space-y-2">
                {offDays.map((d, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3"
                  >
                    <div>
                      <div className="text-sm font-medium">{d.date}</div>
                      {d.reason && (
                        <div className="text-xs text-white/40">{d.reason}</div>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveOffDay(d.id, i)}
                      className="text-xs text-red-400 hover:text-red-300"
                      aria-label={`Remove off day ${d.date}`}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Off-day form */}
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-white/50">Date</label>
                <input
                  type="date"
                  value={offDate}
                  onChange={(e) => setOffDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className={inputClass}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-white/50">
                  Reason <span className="text-white/30">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Family event, Holiday…"
                  value={offReason}
                  onChange={(e) => setOffReason(e.target.value)}
                  className={inputClass}
                />
              </div>

              <button
                type="button"
                onClick={handleAddOffDay}
                disabled={offSaving || !offDate}
                className="w-full p-3 rounded-xl bg-neutral-700 text-white font-medium hover:bg-neutral-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {offSaving ? "Adding…" : "+ Add Off Day"}
              </button>
            </div>

            {/* Navigation */}
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 p-3 rounded-xl btn-ghost"
              >
                ← Back
              </button>
              <button
                onClick={() => setStep(4)}
                className="flex-1 p-3 rounded-xl btn-primary"
              >
                {offDays.length === 0 ? "Skip →" : "Next →"}
              </button>
            </div>
          </>
        )}

        {/* ======================== STEP 4: Blueprint Preview ======================== */}
        {step === 4 && (
          <>
            <h1 className="text-2xl font-semibold mb-2 text-center">
              Your Study Blueprint
            </h1>
            <p className="text-sm text-white/50 text-center mb-6">
              We&apos;ve analyzed your subjects and schedule. Here&apos;s a preview
              of your study plan.
            </p>

            {isAnalyzing && (
              <div className="text-center py-8">
                <div className="inline-block w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <p className="text-sm text-white/60 mt-3">Analyzing your plan…</p>
              </div>
            )}

            {analysis && !isAnalyzing && (
              <div className="space-y-4">
                {analysis.status === "READY" && (
                  <>
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                      <div className="text-sm font-semibold text-emerald-400 mb-1">Plan is feasible!</div>
                      <div className="text-xs text-white/60">
                        {analysis.taskCount} tasks across{" "}
                        {new Set(analysis.tasks.map((t) => t.scheduled_date)).size} days
                      </div>
                    </div>

                    {/* Compact schedule preview — show first 5 days */}
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {(() => {
                        const byDate = new Map<string, { count: number; minutes: number }>();
                        analysis.tasks.forEach((t) => {
                          const entry = byDate.get(t.scheduled_date) ?? { count: 0, minutes: 0 };
                          entry.count += 1;
                          entry.minutes += t.duration_minutes;
                          byDate.set(t.scheduled_date, entry);
                        });
                        return Array.from(byDate.entries())
                          .sort(([a], [b]) => (a > b ? 1 : -1))
                          .slice(0, 7)
                          .map(([date, { count, minutes }]) => (
                            <div
                              key={date}
                              className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-2"
                            >
                              <div className="text-sm">{date}</div>
                              <div className="text-xs text-white/50">
                                {count} tasks · {minutes} min
                              </div>
                            </div>
                          ));
                      })()}
                    </div>

                    {analysis.taskCount > 7 && (
                      <p className="text-xs text-white/40 text-center">
                        + more days — view full schedule on your dashboard after confirming
                      </p>
                    )}
                  </>
                )}

                {analysis.status === "OVERLOAD" && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 space-y-2">
                    <div className="text-sm font-semibold text-amber-400">
                      Schedule is overloaded
                    </div>
                    <div className="text-xs text-white/60">
                      You need ~{Math.ceil(analysis.burnRate)} min/day but only have{" "}
                      {analysis.currentCapacity} min/day available.
                    </div>
                    <p className="text-xs text-white/50 mt-2">
                      You can go back and adjust subjects, deadlines, or daily hours.
                      Or continue to the dashboard and use the Planner page to resolve overload.
                    </p>
                  </div>
                )}

                {analysis.status === "NO_SUBJECTS" && (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <p className="text-sm text-white/60">
                      No subjects found. Go back and add at least one subject to generate a blueprint.
                    </p>
                  </div>
                )}

                {(analysis.status === "UNAUTHORIZED" || analysis.status === "NO_PROFILE") && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                    <p className="text-sm text-red-400">
                      Something went wrong. Please try logging in again.
                    </p>
                  </div>
                )}

                {/* Re-analyze button */}
                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className="w-full p-2 rounded-xl bg-white/5 text-white/60 text-sm hover:bg-white/10 transition disabled:opacity-50"
                >
                  Re-analyze
                </button>
              </div>
            )}

            {/* Navigation */}
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setStep(3)}
                className="flex-1 p-3 rounded-xl btn-ghost"
              >
                ← Back
              </button>
              <button
                onClick={() => setStep(5)}
                className="flex-1 p-3 rounded-xl btn-primary"
              >
                Next →
              </button>
            </div>
          </>
        )}

        {/* ======================== STEP 5: Confirm & Generate ======================== */}
        {step === 5 && (
          <>
            <h1 className="text-2xl font-semibold mb-2 text-center">
              {commitDone ? "You're All Set!" : "Confirm & Generate"}
            </h1>

            {!commitDone && (
              <>
                <p className="text-sm text-white/50 text-center mb-6">
                  This will write your study schedule to your account. You can
                  always regenerate later from the Planner page.
                </p>

                {/* Summary */}
                <div className="space-y-3 mb-6">
                  <div className="bg-white/5 rounded-xl px-4 py-3 flex items-center justify-between">
                    <span className="text-sm text-white/70">Subjects</span>
                    <span className="text-sm font-semibold">{subjects.length}</span>
                  </div>
                  <div className="bg-white/5 rounded-xl px-4 py-3 flex items-center justify-between">
                    <span className="text-sm text-white/70">Off days</span>
                    <span className="text-sm font-semibold">{offDays.length}</span>
                  </div>
                  <div className="bg-white/5 rounded-xl px-4 py-3 flex items-center justify-between">
                    <span className="text-sm text-white/70">Daily hours</span>
                    <span className="text-sm font-semibold">{dailyHours}h</span>
                  </div>
                  {analysis?.status === "READY" && (
                    <div className="bg-white/5 rounded-xl px-4 py-3 flex items-center justify-between">
                      <span className="text-sm text-white/70">Tasks to schedule</span>
                      <span className="text-sm font-semibold">{analysis.taskCount}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(4)}
                    className="flex-1 p-3 rounded-xl btn-ghost"
                  >
                    ← Back
                  </button>

                  {analysis?.status === "READY" ? (
                    <button
                      onClick={handleCommit}
                      disabled={isCommitting}
                      className="flex-1 p-3 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isCommitting ? "Generating…" : "Generate Schedule"}
                    </button>
                  ) : (
                    <button
                      onClick={handleGoToDashboard}
                      className="flex-1 p-3 rounded-xl btn-primary"
                    >
                      Go to Dashboard →
                    </button>
                  )}
                </div>
              </>
            )}

            {commitDone && (
              <>
                <div className="text-center py-6">
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
                  <p className="text-sm text-white/60 mb-6">
                    Your study schedule has been generated. Head to the dashboard to start working through your tasks.
                  </p>
                </div>

                <button
                  onClick={handleGoToDashboard}
                  className="w-full p-3 rounded-xl btn-primary"
                >
                  Go to Dashboard →
                </button>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
