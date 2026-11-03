import type { WorkplaceType } from "@/types";

export function inferWorkplaceType(
  workplaceType: WorkplaceType | undefined,
  location: string,
): WorkplaceType {
  if (workplaceType) return workplaceType;
  if (/\b(remote|work from home|wfh)\b/i.test(location)) return "remote";
  if (/\bhybrid\b/i.test(location)) return "hybrid";
  return "onsite";
}
