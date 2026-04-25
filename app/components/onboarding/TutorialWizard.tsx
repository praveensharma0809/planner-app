"use client";

import React, { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import { preload } from "react-dom";
import { useRouter } from "next/navigation";
import { completeOnboarding } from "@/app/actions/onboarding/completeOnboarding";
import "./onboarding.css";


/* ─────────────────────────────────────────────────────────
   Step data — 6 steps as agreed
   ───────────────────────────────────────────────────────── */

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

interface GuidedFlowSlide {
  image: string;
  title: string;
  description: string;
}

const SUBJECTS_FLOW_SLIDES: GuidedFlowSlide[] = [
  {
    image: "/onboarding/Subjects/1-new.png",
    title: "Start from the empty Subjects workspace",
    description: "You begin with clean Subject, Chapter, and Task columns ready for setup.",
  },
  {
    image: "/onboarding/Subjects/2-new.png",
    title: "Create your first Subject",
    description: "Use Add Subject to define the main study area before adding topics.",
  },
  {
    image: "/onboarding/Subjects/3-new.png",
    title: "Add Chapters inside the Subject",
    description: "Break the Subject into concrete chapters so planning can be more precise.",
  },
  {
    image: "/onboarding/Subjects/4-new.png",
    title: "Open a Chapter to populate tasks",
    description: "Selecting a chapter activates the task panel for detailed session planning.",
  },
  {
    image: "/onboarding/Subjects/5-new.png",
    title: "Use Add Task for single study items",
    description: "Create focused one-off tasks with clear names for daily execution.",
  },
  {
    image: "/onboarding/Subjects/6-new.png",
    title: "Use Bulk Series for faster entry",
    description: "Generate many lecture or revision tasks in one action when needed.",
  },
  {
    image: "/onboarding/Subjects/7-new.png",
    title: "Review tasks in the chapter panel",
    description: "Check order, naming, and structure before moving to scheduling.",
  },
  {
    image: "/onboarding/Subjects/8-new.png",
    title: "Refine with quick edits",
    description: "Adjust subjects, chapters, or tasks inline to keep the hierarchy clean.",
  },
  {
    image: "/onboarding/Subjects/9-new.png",
    title: "Manage and reorganize as needed",
    description: "Use built-in controls to keep the dataset accurate as scope evolves.",
  },
  {
    image: "/onboarding/Subjects/10-new.png",
    title: "Validate the full three-level structure",
    description: "Ensure Subject -> Chapter -> Task relationships look complete and consistent.",
  },
  {
    image: "/onboarding/Subjects/11-new.png",
    title: "Finalize the setup for planning",
    description: "Once this view is ready, you can move to Planner and generate your schedule.",
  },
];

const PLANNER_FLOW_SLIDES: GuidedFlowSlide[] = [
  {
    image: "/onboarding/Planner/1.png",
    title: "Open Planner from your prepared subjects",
    description: "Start in the Planner workspace after creating Subject, Chapter, and Task data.",
  },
  {
    image: "/onboarding/Planner/2.png",
    title: "Review chapter readiness in Intake",
    description: "Confirm chapters and task scope are complete before scheduling generation.",
  },
  {
    image: "/onboarding/Planner/3.png",
    title: "Set dependency order where needed",
    description: "Define prerequisite relationships so the plan respects learning sequence.",
  },
  {
    image: "/onboarding/Planner/4.png",
    title: "Tune planning options before preview",
    description: "Adjust timing and constraints to match your preferred study rhythm.",
  },
  {
    image: "/onboarding/Planner/5.png",
    title: "Generate the AI plan preview",
    description: "Let the engine build your draft schedule from intake and constraint inputs.",
  },
  {
    image: "/onboarding/Planner/6.png",
    title: "Inspect weekly distribution and load",
    description: "Check pacing and day-by-day spread to catch overloads early.",
  },
  {
    image: "/onboarding/Planner/7.png",
    title: "Pin key sessions that must stay fixed",
    description: "Lock important sessions before making broader optimization adjustments.",
  },
  {
    image: "/onboarding/Planner/8.png",
    title: "Re-optimize after your manual edits",
    description: "Regenerate to rebalance open slots while preserving your pinned choices.",
  },
  {
    image: "/onboarding/Planner/9.png",
    title: "Commit the final plan to your schedule",
    description: "Confirm and publish so sessions appear in Dashboard and Calendar workflows.",
  },
];

const DASHBOARD_FLOW_SLIDES: GuidedFlowSlide[] = [
  {
    image: "/onboarding/Dashboard/1.png",
    title: "Open your daily Dashboard overview",
    description: "Start from the command center that summarizes progress, workload, and today’s priorities.",
  },
  {
    image: "/onboarding/Dashboard/2.png",
    title: "Review tasks and active alerts",
    description: "Check pending items, urgency signals, and progress markers before choosing what to tackle first.",
  },
  {
    image: "/onboarding/Dashboard/3.png",
    title: "Manage execution for the day",
    description: "Use quick actions to complete work, stay on streak, and keep your daily plan moving.",
  },
];

const SCHEDULE_CALENDAR_FLOW_SLIDES: GuidedFlowSlide[] = [
  {
    image: "/onboarding/Schedule_Calendar/a1.png",
    title: "Open the weekly Schedule board",
    description: "Start in Scheduler mode to inspect your week by day and session load.",
  },
  {
    image: "/onboarding/Schedule_Calendar/a2.png",
    title: "Scan daily session distribution",
    description: "Review where sessions are clustered so you can balance heavy and light days.",
  },
  {
    image: "/onboarding/Schedule_Calendar/a3.png",
    title: "Filter and focus by subject",
    description: "Use subject filters to isolate one track and verify pacing across the week.",
  },
  {
    image: "/onboarding/Schedule_Calendar/a4.png",
    title: "Adjust sessions in scheduler view",
    description: "Refine entries inline to keep your weekly execution plan realistic.",
  },
  {
    image: "/onboarding/Schedule_Calendar/a5.png",
    title: "Confirm weekly plan readiness",
    description: "Finish scheduler checks before switching to the broader calendar perspective.",
  },
  {
    image: "/onboarding/Schedule_Calendar/b1.png",
    title: "Switch into Calendar mode",
    description: "Move from weekly planning into monthly visibility for long-range balance.",
  },
  {
    image: "/onboarding/Schedule_Calendar/b2.png",
    title: "Identify overloaded calendar windows",
    description: "Spot dense periods early so you can redistribute effort before deadlines.",
  },
  {
    image: "/onboarding/Schedule_Calendar/b3.png",
    title: "Review event context across the month",
    description: "Use the calendar timeline to align study sessions with other commitments.",
  },
  {
    image: "/onboarding/Schedule_Calendar/b4.png",
    title: "Finalize schedule and calendar alignment",
    description: "Confirm both views are coherent so daily execution and monthly planning stay in sync.",
  },
];

const GUIDED_FLOW_INTERVAL_MS = 1700;

const STEPS: TutorialStep[] = [
  {
    id: 1,
    tag: "Welcome",
    title: "Your AI Study\nOperating System",
    description:
      "Turn scattered syllabus, deadlines, and backlog into a precision daily plan you can actually finish.",
    bullets: [
      "Structure subjects, chapters, and tasks in minutes",
      "Generate an AI schedule that balances deadlines, effort, and available hours",
      "Execute with daily clarity using progress signals, alerts, and calendar control",
    ],
    callouts: [
      { emoji: "⚡", text: "Plan in minutes, not hours" },
      { emoji: "🧠", text: "AI optimization with full control" },
      { emoji: "🎯", text: "Daily clarity, measurable progress" },
    ],
    image: "/onboarding/step-1%20frame.png",
    imageAlt: "PrepVeda system flow overview",
  },
  {
    id: 2,
    tag: "Foundation",
    title: "Start with\nSubjects",
    description:
      "Everything starts here. Add your Subjects, break them into Chapters, and add Tasks inside each chapter. This three-level structure is the foundation of your entire study plan.",
    bullets: [
      "Subject → The broad area (e.g. Maths, Physics)",
      "Chapter → A specific topic inside a subject (e.g. Calculus)",
      "Task → An individual study session (e.g. Lecture-1, 150 min)",
    ],
    callouts: [
      { emoji: "📚", text: 'Subject = "Maths"' },
      { emoji: "📖", text: 'Chapter = "Calculus"' },
      { emoji: "✅", text: 'Task = "Lecture-1 (150 min)"' },
    ],
    image: null,
    imageAlt: "Subjects flow walkthrough",
  },
  {
    id: 3,
    tag: "AI Engine",
    title: "Generate Your\nStudy Plan",
    description:
      "Once your subjects are set up, open the Planner. It works in three phases to build your optimal schedule automatically.",
    bullets: [
      "Phase 1 (Intake) — Review your subjects and chapters. Set chapter dependencies like 'Basics before Trees'.",
      "Phase 2 (Preview) — The AI generates a full schedule. Pin sessions, adjust, or re-optimize.",
      "Phase 3 (Confirm) — Commit the plan. Sessions become real tasks on your calendar.",
    ],
    callouts: [
      { emoji: "⚙️", text: "Phase 1: Configure" },
      { emoji: "👁️", text: "Phase 2: AI Schedule" },
      { emoji: "✅", text: "Phase 3: Commit" },
    ],
    image: null,
    imageAlt: "Planner flow walkthrough",
  },
  {
    id: 4,
    tag: "Daily Hub",
    title: "Your Daily\nDashboard",
    description:
      "The Dashboard is your daily command center. Every morning it shows you exactly what needs attention.",
    bullets: [
      "Today's Progress — see your completion percentage and time remaining",
      "Today's Tasks — check off tasks as you study. Quick-add new ones anytime.",
      "Alerts — overdue work, deadline risks, streak warnings",
      "Subjects — a health snapshot showing each subject's status",
    ],
    callouts: [
      { emoji: "🎯", text: "Quick-add tasks anytime" },
      { emoji: "🔥", text: "Streak tracker" },
      { emoji: "⚠️", text: "Smart alerts" },
    ],
    image: null,
    imageAlt: "Dashboard flow walkthrough",
  },
  {
    id: 5,
    tag: "Calendar",
    title: "Schedule &\nCalendar",
    description:
      "See your entire study plan at a glance. The Schedule page shows your weekly view, and the Calendar gives you a broader monthly perspective.",
    bullets: [
      "Weekly view — see all sessions day by day, edit or delete inline",
      "Filter by subject — focus on what matters with one-tap chips",
      "Add Events — add ad-hoc study sessions or personal events",
      "Monthly view — identify overloaded days and plan ahead",
    ],
    callouts: [
      { emoji: "📅", text: "Weekly schedule" },
      { emoji: "🗓️", text: "Monthly calendar" },
      { emoji: "➕", text: "Add events manually" },
    ],
    image: null,
    imageAlt: "Schedule and calendar flow walkthrough",
  },
  {
    id: 6,
    tag: "Execution Ready",
    title: "Your System Is\nReady To Run",
    description:
      "Setup is complete. Launch your first execution cycle now and convert planning into daily completed work.",
    bullets: [
      "First move: open Subjects and lock your final task structure",
      "Then open Planner, generate, and commit your first optimized schedule",
      "Run the daily loop in Dashboard and Schedule to stay on track and adapt fast",
    ],
    callouts: [
      { emoji: "1", text: "Start in Subjects" },
      { emoji: "2", text: "Commit in Planner" },
      { emoji: "3", text: "Execute daily" },
    ],
    image: "/onboarding/Step-6_frame.png",
    imageAlt: "Final onboarding execution readiness overview",
  },
];

const TOTAL_STEPS = STEPS.length;

/* ─────────────────────────────────────────────────────────
   Component
   ───────────────────────────────────────────────────────── */

export default function TutorialWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [isAnimating, setIsAnimating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [subjectsFlowFrame, setSubjectsFlowFrame] = useState(0);
  const [plannerFlowFrame, setPlannerFlowFrame] = useState(0);
  const [dashboardFlowFrame, setDashboardFlowFrame] = useState(0);
  const [scheduleCalendarFlowFrame, setScheduleCalendarFlowFrame] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const step = STEPS[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === TOTAL_STEPS - 1;
  const isSubjectsFlowStep = step.id === 2;
  const isPlannerFlowStep = step.id === 3;
  const isDashboardFlowStep = step.id === 4;
  const isScheduleCalendarFlowStep = step.id === 5;
  const isGuidedFlowStep =
    isSubjectsFlowStep || isPlannerFlowStep || isDashboardFlowStep || isScheduleCalendarFlowStep;
  const subjectsFlowTotal = SUBJECTS_FLOW_SLIDES.length;
  const plannerFlowTotal = PLANNER_FLOW_SLIDES.length;
  const dashboardFlowTotal = DASHBOARD_FLOW_SLIDES.length;
  const scheduleCalendarFlowTotal = SCHEDULE_CALENDAR_FLOW_SLIDES.length;

  /* ── Transition helpers ── */
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

  const handleSubjectsFlowNext = useCallback(() => {
    setSubjectsFlowFrame((prev) => (prev + 1) % subjectsFlowTotal);
  }, [subjectsFlowTotal]);

  const handleSubjectsFlowPrevious = useCallback(() => {
    setSubjectsFlowFrame((prev) => (prev - 1 + subjectsFlowTotal) % subjectsFlowTotal);
  }, [subjectsFlowTotal]);

  const handlePlannerFlowNext = useCallback(() => {
    setPlannerFlowFrame((prev) => (prev + 1) % plannerFlowTotal);
  }, [plannerFlowTotal]);

  const handlePlannerFlowPrevious = useCallback(() => {
    setPlannerFlowFrame((prev) => (prev - 1 + plannerFlowTotal) % plannerFlowTotal);
  }, [plannerFlowTotal]);

  const handleDashboardFlowNext = useCallback(() => {
    setDashboardFlowFrame((prev) => (prev + 1) % dashboardFlowTotal);
  }, [dashboardFlowTotal]);

  const handleDashboardFlowPrevious = useCallback(() => {
    setDashboardFlowFrame((prev) => (prev - 1 + dashboardFlowTotal) % dashboardFlowTotal);
  }, [dashboardFlowTotal]);

  const handleScheduleCalendarFlowNext = useCallback(() => {
    setScheduleCalendarFlowFrame((prev) => (prev + 1) % scheduleCalendarFlowTotal);
  }, [scheduleCalendarFlowTotal]);

  const handleScheduleCalendarFlowPrevious = useCallback(() => {
    setScheduleCalendarFlowFrame((prev) => (prev - 1 + scheduleCalendarFlowTotal) % scheduleCalendarFlowTotal);
  }, [scheduleCalendarFlowTotal]);

  /* ── Completion handlers ── */
  const markComplete = useCallback(async () => {
    setIsSaving(true);
    try {
      await completeOnboarding();
    } catch {
      // Non-critical — don't block navigation
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

  /* ── Keyboard nav ── */
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

  // Preload every guided-flow image once on mount so slide swaps don't blank the frame.
  useEffect(() => {
    const allFlowImages = [
      ...SUBJECTS_FLOW_SLIDES,
      ...PLANNER_FLOW_SLIDES,
      ...DASHBOARD_FLOW_SLIDES,
      ...SCHEDULE_CALENDAR_FLOW_SLIDES,
    ].map((s) => s.image);
    for (const src of allFlowImages) {
      preload(src, { as: "image" });
    }
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const applyPreference = () => setPrefersReducedMotion(mediaQuery.matches);

    applyPreference();
    mediaQuery.addEventListener("change", applyPreference);

    return () => mediaQuery.removeEventListener("change", applyPreference);
  }, []);

  useEffect(() => {
    if (!isSubjectsFlowStep) {
      setSubjectsFlowFrame(0);
      return;
    }
  }, [isSubjectsFlowStep]);

  useEffect(() => {
    if (!isPlannerFlowStep) {
      setPlannerFlowFrame(0);
      return;
    }
  }, [isPlannerFlowStep]);

  useEffect(() => {
    if (!isDashboardFlowStep) {
      setDashboardFlowFrame(0);
      return;
    }
  }, [isDashboardFlowStep]);

  useEffect(() => {
    if (!isScheduleCalendarFlowStep) {
      setScheduleCalendarFlowFrame(0);
      return;
    }
  }, [isScheduleCalendarFlowStep]);

  useEffect(() => {
    if (!isGuidedFlowStep || isAnimating || prefersReducedMotion) return;

    const intervalId = window.setInterval(() => {
      if (isSubjectsFlowStep) {
        setSubjectsFlowFrame((prev) => (prev + 1) % subjectsFlowTotal);
      }

      if (isPlannerFlowStep) {
        setPlannerFlowFrame((prev) => (prev + 1) % plannerFlowTotal);
      }

      if (isDashboardFlowStep) {
        setDashboardFlowFrame((prev) => (prev + 1) % dashboardFlowTotal);
      }

      if (isScheduleCalendarFlowStep) {
        setScheduleCalendarFlowFrame((prev) => (prev + 1) % scheduleCalendarFlowTotal);
      }
    }, GUIDED_FLOW_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [
    dashboardFlowTotal,
    isAnimating,
    isDashboardFlowStep,
    isGuidedFlowStep,
    isPlannerFlowStep,
    isScheduleCalendarFlowStep,
    isSubjectsFlowStep,
    plannerFlowTotal,
    prefersReducedMotion,
    scheduleCalendarFlowTotal,
    subjectsFlowTotal,
  ]);

  const renderGuidedFlow = useCallback(
    (
      label: string,
      slides: GuidedFlowSlide[],
      activeFrame: number,
      onPrevious: () => void,
      onNext: () => void,
      onJump: (index: number) => void
    ) => (
      <div className="onb-sequence-layout" aria-label={`${label} walkthrough`}>
        <div className="onb-sequence-copy">
          <p className="onb-sequence-kicker">{label}</p>
          <h3 className="onb-sequence-title">{slides[activeFrame].title}</h3>
          <p className="onb-sequence-description">{slides[activeFrame].description}</p>
        </div>

        <div className="onb-screenshot-frame onb-screenshot-frame-flow">
          <div className="onb-screenshot-topbar">
            <span className="onb-dot-red" />
            <span className="onb-dot-yellow" />
            <span className="onb-dot-green" />
          </div>
          <Image
            key={slides[activeFrame].image}
            src={slides[activeFrame].image}
            alt={`${label} step ${activeFrame + 1} of ${slides.length}`}
            width={1919}
            height={1079}
            className="onb-sequence-img"
            priority
          />
        </div>

        <div className="onb-sequence-controls" aria-label={`${label} controls`}>
          <button
            type="button"
            className="onb-sequence-nav-btn"
            onClick={onPrevious}
            aria-label={`Previous ${label.toLowerCase()} slide`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
            </svg>
            Prev
          </button>

          <div className="onb-sequence-progress">
            <span className="onb-sequence-meta">
              Flow {activeFrame + 1}/{slides.length}
            </span>
            <div className="onb-sequence-bars">
              {slides.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onJump(idx)}
                  className={`onb-sequence-bar ${
                    idx === activeFrame
                      ? "onb-sequence-bar-active"
                      : idx < activeFrame
                        ? "onb-sequence-bar-done"
                        : ""
                  }`}
                  aria-label={`Show ${label} frame ${idx + 1}`}
                />
              ))}
            </div>
          </div>

          <button
            type="button"
            className="onb-sequence-nav-btn"
            onClick={onNext}
            aria-label={`Next ${label.toLowerCase()} slide`}
          >
            Next
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>
    ),
    []
  );

  /* ── Animation class helper ── */
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
      {/* ── Left Pane ── */}
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
                    {isLast ? `${i + 1}` : "→"}
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
            {isSaving ? "Saving…" : "Skip tutorial"}
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
                {isSaving ? "Saving…" : "Go to Subjects"}
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

      {/* ── Right Pane ── */}
      <div className={`onb-right ${isGuidedFlowStep ? "onb-right-flow" : ""}`}>
        {/* Ambient glow */}
        <div className="onb-glow onb-glow-1" />
        <div className="onb-glow onb-glow-2" />

        <div className={`onb-visual ${imageAnimClass} ${isGuidedFlowStep ? "onb-visual-flow" : ""}`} key={`img-${step.id}`}>
          {isSubjectsFlowStep ? (
            renderGuidedFlow(
              "Subjects Flow",
              SUBJECTS_FLOW_SLIDES,
              subjectsFlowFrame,
              handleSubjectsFlowPrevious,
              handleSubjectsFlowNext,
              setSubjectsFlowFrame
            )
          ) : isPlannerFlowStep ? (
            renderGuidedFlow(
              "Planner Flow",
              PLANNER_FLOW_SLIDES,
              plannerFlowFrame,
              handlePlannerFlowPrevious,
              handlePlannerFlowNext,
              setPlannerFlowFrame
            )
          ) : isDashboardFlowStep ? (
            renderGuidedFlow(
              "Dashboard Flow",
              DASHBOARD_FLOW_SLIDES,
              dashboardFlowFrame,
              handleDashboardFlowPrevious,
              handleDashboardFlowNext,
              setDashboardFlowFrame
            )
          ) : isScheduleCalendarFlowStep ? (
            renderGuidedFlow(
              "Schedule & Calendar Flow",
              SCHEDULE_CALENDAR_FLOW_SLIDES,
              scheduleCalendarFlowFrame,
              handleScheduleCalendarFlowPrevious,
              handleScheduleCalendarFlowNext,
              setScheduleCalendarFlowFrame
            )
          ) : step.image ? (
            <div className={`onb-screenshot-frame ${step.id === 1 || step.id === 6 ? "onb-screenshot-frame-hero" : ""}`}>
              <div className="onb-screenshot-topbar">
                <span className="onb-dot-red" />
                <span className="onb-dot-yellow" />
                <span className="onb-dot-green" />
              </div>
              <Image
                src={step.image}
                alt={step.imageAlt}
                width={1600}
                height={1000}
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
              <p className="onb-celebration-text">Ready to PrepVeda 🎯</p>
            </div>
          ) : (
            /* Welcome visual for first step */
            <div className="onb-welcome-visual">
              <div className="onb-welcome-logo">
                <div className="flex-shrink-0 w-14 h-14 rounded-2xl overflow-hidden grid place-items-center bg-transparent shadow-[0_8px_30px_var(--sh-primary-glow)]">
                  <Image src="/logo.jpg" alt="PrepVeda Logo" width={56} height={56} className="w-full h-full object-cover" />
                </div>
                <span className="onb-welcome-logo-text">PrepVeda</span>
              </div>
              <p className="onb-welcome-tagline">
                Your AI-powered study planner
              </p>
              <div className="onb-welcome-features">
                <div className="onb-welcome-feature">
                  <div className="onb-welcome-feature-icon">📚</div>
                  <span>Subjects & Tasks</span>
                </div>
                <div className="onb-welcome-feature">
                  <div className="onb-welcome-feature-icon">🤖</div>
                  <span>AI Scheduling</span>
                </div>
                <div className="onb-welcome-feature">
                  <div className="onb-welcome-feature-icon">📊</div>
                  <span>Progress Tracking</span>
                </div>
                <div className="onb-welcome-feature">
                  <div className="onb-welcome-feature-icon">🔥</div>
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

