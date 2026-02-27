"use server"

// Temporary dev-only route; remove once UI flow is ready.
import { analyzePlanAction } from "@/app/actions/plan/analyzePlan"
import { commitPlan } from "@/app/actions/plan/commitPlan"
import { NextResponse } from "next/server"

export async function GET() {
  // Avoid exposing this in production environments.
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 })
  }

  const analysis = await analyzePlanAction()

  if (analysis.status !== "READY") {
    const statusCode = analysis.status === "UNAUTHORIZED" ? 401 : 200
    return NextResponse.json(analysis, { status: statusCode })
  }

  const commitResult = await commitPlan({ tasks: analysis.tasks })
  const statusCode = commitResult.status === "UNAUTHORIZED" ? 401 : 200

  return NextResponse.json(
    {
      analysis,
      commit: commitResult
    },
    { status: statusCode }
  )
}