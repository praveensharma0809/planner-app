"use client";

import React, { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { completeOnboarding } from "@/app/actions/onboarding/completeOnboarding";
import "./onboarding.css";


/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   Step data â€” 6 steps as agreed
   â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

interface CalloutChip {
  emoji: string;
  text: string;
}

interface TutorialStep {
  id: number;
  tag: string;
  title: string;
  description: string;
  bullets?: string[];
  callouts?: CalloutChip[];
  image: string | null;
  imageAlt: string;
}

const STEPS: TutorialStep[] = [
  {
    id: 1,
    tag: "Welcome",
    title: "Welcome to\nStayPlanned",
    description:
      "StayPlanned is your AI-powered study planner. It automatically creates a personalized study schedule based on your subjects, chapters, and available time.",
    bullets: [
      "Organize all your subjects, chapters, and tasks in one place",
      "Let the AI engine build an optimized daily study plan",
      "Track streaks, deadlines, and daily progress effortlessly",
    ],
    image: null,
    imageAlt: "StayPlanned app",
  },
  {
    id: 2,
    tag: "Foundation",
    title: "Start with\nSubjects",
    description:
      "Everything starts here. Add your Subjects, break them into Chapters, and add Tasks inside each chapter. This three-level structure is the foundation of your entire study plan.",
    bullets: [
      "Subject â†’ The broad area (e.g. Maths, Physics)",
      "Chapter â†’ A specific topic inside a subject (e.g. Calculus)",
      "Task â†’ An individual study session (e.g. Lecture-1, 150 min)",
    ],
    callouts: [
      { emoji: "ðŸ“š", text: 'Subject = "Maths"' },
      { emoji: "ðŸ“–", text: 'Chapter = "Calculus"' },
      { emoji: "âœ…", text: 'Task = "Lecture-1 (150 min)"' },
    ],
    image: "/onboarding/subjects.png",
    imageAlt: "Subjects page â€” three-pane structure",
  },
  {
    id: 3,
    tag: "AI Engine",
    title: "Generate Your\nStudy Plan",
    description:
      "Once your subjects are set up, open the Planner. It works in three phases to build your optimal schedule automatically.",
    bullets: [
      "Phase 1 (Intake) â€” Review your subjects and chapters. Set chapter dependencies like 'Basics before Trees'.",
      "Phase 2 (Preview) â€” The AI generates a full schedule. Pin sessions, adjust, or re-optimize.",
      "Phase 3 (Confirm) â€” Commit the plan. Sessions become real tasks on your calendar.",
    ],
    callouts: [
      { emoji: "âš™ï¸", text: "Phase 1: Configure" },
      { emoji: "ðŸ‘ï¸", text: "Phase 2: AI Schedule" },
      { emoji: "âœ…", text: "Phase 3: Commit" },
    ],
    image: "/onboarding/planner.png",
    imageAlt: "Planner page â€” Phase 1 Intake view",
  },
  {
    id: 4,
    tag: "Daily Hub",
    title: "Your Daily\nDashboard",
    description:
      "The Dashboard is your daily command center. Every morning it shows you exactly what needs attention.",
    bullets: [
      "Today's Progress â€” see your completion percentage and time remaining",
      "Today's Tasks â€” check off tasks as you study. Quick-add new ones anytime.",
      "Alerts â€” overdue work, deadline risks, streak warnings",
      "Subjects â€” a health snapshot showing each subject's status",
    ],
    callouts: [
      { emoji: "ðŸŽ¯", text: "Quick-add tasks anytime" },
      { emoji: "ðŸ”¥", text: "Streak tracker" },
      { emoji: "âš ï¸", text: "Smart alerts" },
    ],
    image: "/onboarding/dashboard.png",
    imageAlt: "Dashboard â€” daily command center",
  },
  {
    id: 5,
    tag: "Calendar",
    title: "Schedule &\nCalendar",
    description:
      "See your entire study plan at a glance. The Schedule page shows your weekly view, and the Calendar gives you a broader monthly perspective.",
    bullets: [
      "Weekly view â€” see all sessions day by day, edit or delete inline",
      "Filter by subject â€” focus on what matters with one-tap chips",
      "Add Events â€” add ad-hoc study sessions or personal events",
      "Monthly view â€” identify overloaded days and plan ahead",
    ],
    callouts: [
      { emoji: "ðŸ“…", text: "Weekly schedule" },
      { emoji: "ðŸ—“ï¸", text: "Monthly calendar" },
      { emoji: "âž•", text: "Add events manually" },
    ],
    image: "/onboarding/schedule.png",
    imageAlt: "Schedule â€” weekly calendar view",
  },
  {
    id: 6,
    tag: "Let's Go",
    title: "You're\nAll Set!",
    description:
      "You know everything. Here's your action plan to get started right now:",
    bullets: [
      "Go to Subjects and add your subjects, chapters, and tasks",
      "Open the Planner and generate your AI study schedule",
      "Come back to the Dashboard every day to track progress",
    ],
    image: null,
    imageAlt: "Ready to start",
  },
];

const TOTAL_STEPS = STEPS.length;

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   Component
   â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export default function TutorialWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [isAnimating, setIsAnimating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const step = STEPS[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === TOTAL_STEPS - 1;

  /* â”€â”€ Transition helpers â”€â”€ */
  const transitionTo = useCallback(
    (nextIndex: number, dir: "forward" | "backward") => {
      if (isAnimating) return;
      setIsAnimating(true);
      setDirection(dir);

      // Small delay for exit animation
      setTimeout(() => {
        setCurrentStep(nextIndex);
        setIsAnimating(false);
      }, 250);
    },
    [isAnimating]
  );

  const handleNext = useCallback(() => {
    if (currentStep < TOTAL_STEPS - 1) {
      transitionTo(currentStep + 1, "forward");
    }
  }, [currentStep, transitionTo]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      transitionTo(currentStep - 1, "backward");
    }
  }, [currentStep, transitionTo]);

  const handleDotClick = useCallback(
    (index: number) => {
      if (index === currentStep) return;
      const dir = index > currentStep ? "forward" : "backward";
      transitionTo(index, dir);
    },
    [currentStep, transitionTo]
  );

  /* â”€â”€ Completion handlers â”€â”€ */
  const markComplete = useCallback(async () => {
    setIsSaving(true);
    try {
      await completeOnboarding();
    } catch {
      // Non-critical â€” don't block navigation
    } finally {
      setIsSaving(false);
    }
  }, []);

  const handleSkip = useCallback(async () => {
    await markComplete();
    router.push("/dashboard");
  }, [markComplete, router]);

  const handleFinish = useCallback(async () => {
    await markComplete();
    router.push("/dashboard/subjects");
  }, [markComplete, router]);

  /* â”€â”€ Keyboard nav â”€â”€ */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "Enter") {
        if (isLast) return; // Don't auto-advance on last step
        handleNext();
      }
      if (e.key === "ArrowLeft") handleBack();
      if (e.key === "Escape") void handleSkip();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleNext, handleBack, handleSkip, isLast]);

  /* â”€â”€ Animation class helper â”€â”€ */
  const contentAnimClass = isAnimating
    ? direction === "forward"
      ? "onb-exit-left"
      : "onb-exit-right"
    : direction === "forward"
      ? "onb-enter-right"
      : "onb-enter-left";

  const imageAnimClass = isAnimating
    ? "onb-img-exit"
    : "onb-img-enter";

  return (
    <div className="onb-root">
      {/* â”€â”€ Left Pane â”€â”€ */}
      <div className="onb-left">
        {/* Progress dots */}
        <div className="onb-progress">
          <span className="onb-step-label">
            Step {currentStep + 1} of {TOTAL_STEPS}
          </span>
          <div className="onb-dots">
            {STEPS.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => handleDotClick(idx)}
                className={`onb-dot ${
                  idx === currentStep
                    ? "onb-dot-active"
                    : idx < currentStep
                      ? "onb-dot-done"
                      : ""
                }`}
                aria-label={`Go to step ${idx + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className={`onb-content ${contentAnimClass}`} key={step.id}>
          <span className="onb-tag">{step.tag}</span>

          <h1 className="onb-title">{step.title}</h1>

          <p className="onb-description">{step.description}</p>

          {/* Bullet list */}
          {step.bullets && step.bullets.length > 0 && (
            <ul className="onb-bullets">
              {step.bullets.map((bullet, i) => (
                <li key={i} className="onb-bullet">
                  <span className="onb-bullet-icon">
                    {isLast ? `${i + 1}` : "â†’"}
                  </span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Callout chips */}
          {step.callouts && step.callouts.length > 0 && (
            <div className="onb-callouts">
              {step.callouts.map((chip, i) => (
                <span key={i} className="onb-chip">
                  <span className="onb-chip-emoji">{chip.emoji}</span>
                  {chip.text}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Navigation controls */}
        <div className="onb-nav">
          <button
            onClick={handleSkip}
            className="onb-skip-btn"
            disabled={isSaving}
          >
            {isSaving ? "Savingâ€¦" : "Skip tutorial"}
          </button>

          <div className="onb-nav-btns">
            <button
              onClick={handleBack}
              disabled={isFirst}
              className={`onb-back-btn ${isFirst ? "onb-btn-hidden" : ""}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>

            {isLast ? (
              <button
                onClick={handleFinish}
                className="onb-finish-btn"
                disabled={isSaving}
              >
                {isSaving ? "Savingâ€¦" : "Go to Subjects"}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            ) : (
              <button onClick={handleNext} className="onb-next-btn">
                Next
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* â”€â”€ Right Pane â”€â”€ */}
      <div className="onb-right">
        {/* Ambient glow */}
        <div className="onb-glow onb-glow-1" />
        <div className="onb-glow onb-glow-2" />

        <div className={`onb-visual ${imageAnimClass}`} key={`img-${step.id}`}>
          {step.image ? (
            <div className="onb-screenshot-frame">
              <div className="onb-screenshot-topbar">
                <span className="onb-dot-red" />
                <span className="onb-dot-yellow" />
                <span className="onb-dot-green" />
              </div>
              <Image
                src={step.image}
                alt={step.imageAlt}
                width={900}
                height={560}
                className="onb-screenshot-img"
                priority={currentStep <= 1}
              />
            </div>
          ) : isLast ? (
            /* Celebration visual for last step */
            <div className="onb-celebration">
              <div className="onb-celebration-ring onb-ring-1" />
              <div className="onb-celebration-ring onb-ring-2" />
              <div className="onb-celebration-ring onb-ring-3" />
              <div className="onb-celebration-check">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
                  <circle cx="12" cy="12" r="10" strokeWidth="1.5" />
                </svg>
              </div>
              <p className="onb-celebration-text">Ready to StayPlanned ðŸŽ¯</p>
            </div>
          ) : (
            /* Welcome visual for first step */
            <div className="onb-welcome-visual">
              <div className="onb-welcome-logo">
                <div className="flex-shrink-0 w-14 h-14 rounded-2xl overflow-hidden grid place-items-center bg-transparent shadow-[0_8px_30px_var(--sh-primary-glow)]">
                  <Image src="/logo.png" alt="StayPlanned Logo" width={56} height={56} className="w-full h-full object-cover" />
                </div>
                <span className="onb-welcome-logo-text">StayPlanned</span>
              </div>
              <p className="onb-welcome-tagline">
                Your AI-powered study planner
              </p>
              <div className="onb-welcome-features">
                <div className="onb-welcome-feature">
                  <div className="onb-welcome-feature-icon">ðŸ“š</div>
                  <span>Subjects & Tasks</span>
                </div>
                <div className="onb-welcome-feature">
                  <div className="onb-welcome-feature-icon">ðŸ¤–</div>
                  <span>AI Scheduling</span>
                </div>
                <div className="onb-welcome-feature">
                  <div className="onb-welcome-feature-icon">ðŸ“Š</div>
                  <span>Progress Tracking</span>
                </div>
                <div className="onb-welcome-feature">
                  <div className="onb-welcome-feature-icon">ðŸ”¥</div>
                  <span>Daily Streaks</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
