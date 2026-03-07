"use server"

// plan_events table has been replaced by plan_snapshots.
// This stub is kept for backward compatibility.
export async function logPlanEvent(
  _eventType: string,
  _taskCount: number,
  _summary?: string
): Promise<void> {
  void _eventType
  void _taskCount
  void _summary
  // No-op: plan history is now recorded via plan_snapshots in commit_plan_atomic
}
