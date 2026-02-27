"use server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { analyzePlan, type AnalyzePlanStatus } from "@/lib/planner/analyzePlan"
import type { SchedulerMode } from "@/lib/planner/scheduler"
import type { Subject } from "@/lib/types/db"

type ExtendDeadlineAdjustment = {
	kind: "extendDeadline"
	subjectId: string
	newDeadline: string
}

type ReduceItemsAdjustment = {
	kind: "reduceItems"
	subjectId: string
	newTotalItems: number
}

type IncreaseDailyMinutesAdjustment = {
	kind: "increaseDailyMinutes"
	deltaMinutes: number
}

export type AdjustmentInput =
	| ExtendDeadlineAdjustment
	| ReduceItemsAdjustment
	| IncreaseDailyMinutesAdjustment

export type ResolveOverloadResponse =
	| { status: "UNAUTHORIZED" }
	| { status: "NO_PROFILE" }
	| { status: "NO_SUBJECTS" }
	| AnalyzePlanStatus

function applyAdjustment(
	subjects: Subject[],
	profileDailyMinutes: number,
	adjustment?: AdjustmentInput
): { subjects: Subject[]; dailyMinutes: number } {
	if (!adjustment) {
		return { subjects, dailyMinutes: profileDailyMinutes }
	}

	if (adjustment.kind === "increaseDailyMinutes") {
		const newDaily = Math.max(0, profileDailyMinutes + adjustment.deltaMinutes)
		return { subjects, dailyMinutes: newDaily }
	}

	if (adjustment.kind === "extendDeadline") {
		const updated = subjects.map(s =>
			s.id === adjustment.subjectId
				? { ...s, deadline: adjustment.newDeadline }
				: s
		)
		return { subjects: updated, dailyMinutes: profileDailyMinutes }
	}

	if (adjustment.kind === "reduceItems") {
		const updated = subjects.map(s =>
			s.id === adjustment.subjectId
				? { ...s, total_items: Math.max(0, adjustment.newTotalItems) }
				: s
		)
		return { subjects: updated, dailyMinutes: profileDailyMinutes }
	}

	return { subjects, dailyMinutes: profileDailyMinutes }
}

export async function resolveOverload(
	adjustment?: AdjustmentInput,
	mode: SchedulerMode = "strict"
): Promise<ResolveOverloadResponse> {
	const supabase = await createServerSupabaseClient()
	const {
		data: { user }
	} = await supabase.auth.getUser()

	if (!user) {
		return { status: "UNAUTHORIZED" }
	}

	const today = new Date()

	const { data: profile } = await supabase
		.from("profiles")
		.select("daily_available_minutes, exam_date")
		.eq("id", user.id)
		.single()

	if (!profile) {
		return { status: "NO_PROFILE" }
	}

	const { data: subjects } = await supabase
		.from("subjects")
		.select(
			"id, user_id, name, total_items, completed_items, avg_duration_minutes, deadline, priority, mandatory, created_at"
		)
		.eq("user_id", user.id)

	if (!subjects || subjects.length === 0) {
		return { status: "NO_SUBJECTS" }
	}

	const { subjects: adjustedSubjects, dailyMinutes } = applyAdjustment(
		subjects,
		profile.daily_available_minutes,
		adjustment
	)

	const analysis: AnalyzePlanStatus = analyzePlan(
		adjustedSubjects,
		dailyMinutes,
		today,
		mode,
		profile.exam_date ?? undefined
	)

	return analysis
}
