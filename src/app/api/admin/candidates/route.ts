import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { badRequest, requireAdminSession, serverError } from "@/lib/auth";
import { Application } from "@/models/Application";
import { CandidatePolicy } from "@/models/CandidatePolicy";
import { MatchResult } from "@/models/MatchResult";
import { recordAdminAction } from "@/lib/admin-audit";

const updateSchema = z.union([
  z.object({ status: z.enum(["active", "flagged", "banned"]) }),
  z.object({ erase: z.literal(true) }),
]);

export async function GET() {
  try {
    const { error } = await requireAdminSession();
    if (error) return error;
    await connectDB();
    const [candidates, policies] = await Promise.all([
      Application.aggregate([
        {
          $group: {
            _id: "$candidateEmail",
            name: { $last: "$candidateName" },
            applicationsCount: { $sum: 1 },
            lastApplicationAt: { $max: "$createdAt" },
          },
        },
        { $sort: { lastApplicationAt: -1 } },
      ]),
      CandidatePolicy.find().select("email status").lean(),
    ]);
    const statusByEmail = new Map(policies.map((policy) => [policy.email, policy.status]));
    const applicationEmails = new Set(candidates.map((candidate) => candidate._id));
    const candidatesWithPolicies = [
      ...candidates.map((candidate) => ({
        email: candidate._id,
        name: candidate.name,
        applicationsCount: candidate.applicationsCount,
        lastApplicationAt: candidate.lastApplicationAt,
        status: statusByEmail.get(candidate._id) || "active",
      })),
      ...policies.filter((policy) => !applicationEmails.has(policy.email)).map((policy) => ({
        email: policy.email,
        name: policy.email,
        applicationsCount: 0,
        lastApplicationAt: policy.updatedAt,
        status: policy.status,
      })),
    ];
    return NextResponse.json({
      candidates: candidatesWithPolicies,
    });
  } catch (error) {
    console.error("Admin candidates error:", error);
    return serverError();
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { session, error } = await requireAdminSession();
    if (error || !session) return error!;
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) return badRequest("Invalid candidate action");
    const email = request.nextUrl.searchParams.get("email")?.trim().toLowerCase();
    if (!email || !z.string().email().safeParse(email).success) return badRequest("A valid candidate email is required");

    await connectDB();
    if ("erase" in parsed.data) {
      const applications = await Application.find({ candidateEmail: email }).select("_id").lean();
      await MatchResult.deleteMany({ applicationId: { $in: applications.map((application) => application._id) } });
      await Application.deleteMany({ candidateEmail: email });
      await CandidatePolicy.deleteOne({ email });
      await recordAdminAction(session, "Erased candidate application data", "candidate", "Candidate data erased");
      return NextResponse.json({ success: true });
    }

    await CandidatePolicy.findOneAndUpdate(
      { email },
      { status: parsed.data.status },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    await recordAdminAction(session, `Set candidate status to ${parsed.data.status}`, "candidate", email, email);
    return NextResponse.json({ candidate: { email, status: parsed.data.status } });
  } catch (error) {
    console.error("Admin candidate update error:", error);
    return serverError();
  }
}
