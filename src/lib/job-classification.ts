import type { JobDepartment, WorkplaceType } from "@/types";

export function inferJobDepartment(
  department: JobDepartment | undefined,
  title: string,
  description: string,
  skills: string[] = [],
): JobDepartment {
  if (department) return department;

  const text = [title, description, ...skills].join(" ").toLowerCase();
  if (/\b(engineer|engineering|developer|software|devops|data scientist)\b/.test(text)) return "engineering";
  if (/\b(market|marketing|seo|content|brand|social media)\b/.test(text)) return "marketing";
  if (/\b(design|designer|ux|ui)\b/.test(text)) return "design";
  if (/\b(product manager|product owner)\b/.test(text)) return "product";
  if (/\b(customer success|customer support|account manager)\b/.test(text)) return "customer_success";
  if (/\b(finance|accountant|accounting)\b/.test(text)) return "finance";
  if (/\b(human resources|recruiter|people partner)\b/.test(text)) return "hr";
  if (/\b(operations|logistics|administrator)\b/.test(text)) return "operations";
  if (/\b(sales|account executive|business development|sdr|bdr)\b/.test(text)) return "sales";
  return "other";
}

export function inferWorkplaceType(
  workplaceType: WorkplaceType | undefined,
  location: string,
): WorkplaceType {
  if (workplaceType) return workplaceType;
  if (/\b(remote|work from home|wfh)\b/i.test(location)) return "remote";
  if (/\bhybrid\b/i.test(location)) return "hybrid";
  return "onsite";
}
