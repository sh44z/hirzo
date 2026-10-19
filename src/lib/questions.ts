import { nanoid } from "nanoid";
import type { QualificationQuestion, VideoQuestion } from "@/types";

type IncomingQualification = {
  id?: string;
  question: string;
  type: QualificationQuestion["type"];
  options?: string[];
  required?: boolean;
};

type IncomingVideo = {
  id?: string;
  question: string;
  maxDurationSeconds?: number;
  required?: boolean;
};

export function normalizeQualificationQuestions(
  questions: IncomingQualification[] = [],
): QualificationQuestion[] {
  return questions.map((q) => ({
    id: q.id || nanoid(),
    question: q.question,
    type: q.type,
    options: q.type === "multiple_choice" ? q.options || [] : undefined,
    required: q.required ?? true,
  }));
}

export function normalizeVideoQuestions(
  questions: IncomingVideo[] = [],
): VideoQuestion[] {
  return questions.map((q) => ({
    id: q.id || nanoid(),
    question: q.question,
    maxDurationSeconds: q.maxDurationSeconds ?? 120,
    required: q.required ?? true,
  }));
}
