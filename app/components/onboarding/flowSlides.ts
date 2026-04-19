export type GuidedFlowSlide = {
  image: string
  title: string
  description: string
}

export const SUBJECTS_FLOW_SLIDES: GuidedFlowSlide[] = [
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
]

export const PLANNER_FLOW_SLIDES: GuidedFlowSlide[] = [
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
]

export const SCHEDULE_CALENDAR_FLOW_SLIDES: GuidedFlowSlide[] = [
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
]
