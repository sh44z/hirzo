import { Job } from "@/models/Job";
import type { IJobPostingPayment } from "@/models/JobPostingPayment";

export async function createJobForPayment(
  payment: Pick<
    IJobPostingPayment,
    "_id" | "employerId" | "plan" | "amount" | "jobData"
  >,
) {
  return Job.findOneAndUpdate(
    { paymentId: payment._id },
    {
      $setOnInsert: {
        employerId: payment.employerId,
        ...payment.jobData,
        postingPlan: payment.plan,
        postingPrice: payment.amount,
        featured: payment.plan === "premium",
        paymentId: payment._id,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
}
