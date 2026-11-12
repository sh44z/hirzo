export const JOB_POSTING_PLANS = {
  basic: {
    name: "Basic job posting",
    amount: 79,
    features: [
      "Job posting on Hirzo",
      "Qualification questions",
      "Shortlist and hire applicants",
    ],
  },
  premium: {
    name: "Premium job posting",
    amount: 110,
    features: [
      "Everything in Basic",
      "CV screening by Hirzo",
      "Featured job listing",
      "Simple CV requirement-match scores",
      "First-stage interview and feedback",
      "Virtual interview requests (coming soon)",
    ],
  },
  full_recruitment: {
    name: "Complete recruitment solution",
    amount: 999,
    features: [
      "Job posting and candidate interviews",
      "Contract preparation",
      "End-to-end recruitment support",
    ],
  },
} as const;

export const HIRING_TRAINING_AMOUNT = 1800;

export type JobPostingPlan = keyof typeof JOB_POSTING_PLANS;
export type CreditableJobPostingPlan = "basic" | "premium";
export type JobPostingCredits = Record<CreditableJobPostingPlan, number>;

export function isJobPostingPlan(value: unknown): value is JobPostingPlan {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(JOB_POSTING_PLANS, value)
  );
}

export function getJobPostingPrice(plan: JobPostingPlan): number {
  return JOB_POSTING_PLANS[plan].amount;
}
