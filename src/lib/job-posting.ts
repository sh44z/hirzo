import { Job } from "@/models/Job";
import type { IJobPostingPayment } from "@/models/JobPostingPayment";

const JOB_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

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
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        featured: payment.plan === "premium",
        paymentId: payment._id,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
}

export async function renewJobForPayment(
  payment: Pick<
    IJobPostingPayment,
    "_id" | "employerId" | "plan" | "amount" | "renewalJobId"
  >,
) {
  if (!payment.renewalJobId) return null;

  const job = await Job.findOne({
    _id: payment.renewalJobId,
    employerId: payment.employerId,
  });
  if (!job) return null;

  if (String(job.lastRenewalPaymentId) !== String(payment._id)) {
    const expiresAt = new Date(
      Math.max(Date.now(), job.expiresAt.getTime()) + JOB_LIFETIME_MS,
    );
    const renewedJob = await Job.findOneAndUpdate(
      {
        _id: job._id,
        employerId: payment.employerId,
        lastRenewalPaymentId: { $ne: payment._id },
      },
      {
        $set: {
          expiresAt,
          lastRenewalPaymentId: payment._id,
          postingPlan: payment.plan,
          postingPrice: payment.amount,
          featured: payment.plan === "premium",
        },
      },
      { new: true },
    );
    if (renewedJob) return renewedJob;
  }

  return Job.findOne({
    _id: payment.renewalJobId,
    employerId: payment.employerId,
  });
}
