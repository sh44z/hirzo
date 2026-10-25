export type EmploymentType =
  | "full_time"
  | "part_time"
  | "contract"
  | "internship"
  | "temporary";

export type JobStatus = "draft" | "published" | "closed";

export type QualificationQuestionType = "text" | "yes_no" | "multiple_choice";

export type ApplicationStatus =
  | "applied"
  | "shortlisted"
  | "interview"
  | "hired"
  | "rejected";

export interface QualificationQuestion {
  id: string;
  question: string;
  type: QualificationQuestionType;
  options?: string[];
  required: boolean;
}

export interface VideoQuestion {
  id: string;
  question: string;
  maxDurationSeconds: number;
  required: boolean;
}

export interface QualificationAnswer {
  questionId: string;
  answer: string;
}

export interface VideoAnswer {
  questionId: string;
  videoUrl: string;
}

export interface JobRequirements {
  skills: string[];
  yearsExperience: number;
  qualifications: string[];
  responsibilities: string[];
  otherRequirements: string[];
}

export interface MatchWeights {
  skills: number;
  experience: number;
  qualifications: number;
  other: number;
}

export interface CandidateProfile {
  skills: string[];
  yearsExperience: number | null;
  qualifications: string[];
  responsibilities: string[];
  otherRequirements: string[];
}

export interface MatchBreakdown {
  skills: number;
  experience: number;
  qualifications: number;
  other: number;
}
