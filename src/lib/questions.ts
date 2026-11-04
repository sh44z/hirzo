import { nanoid } from "nanoid";
import type {
  AssignmentQuestion,
  AssignmentTemplate,
  QualificationQuestion,
  VideoQuestion,
} from "@/types";

type IncomingQualification = {
  id?: string;
  question: string;
  expectedAnswer: string;
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
    expectedAnswer: q.expectedAnswer,
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

type IncomingAssignment = {
  instructions?: string;
  timeLimitHours?: number;
  questions: Array<
    Omit<AssignmentQuestion, "id"> & { id?: string }
  >;
};

export function normalizeAssignmentTemplate(
  template?: IncomingAssignment,
): AssignmentTemplate | undefined {
  if (!template || template.questions.length === 0) return undefined;
  return {
    instructions: template.instructions?.trim() || "",
    timeLimitHours: template.timeLimitHours,
    questions: template.questions.map((question) => ({
      ...question,
      id: question.id || nanoid(),
      options:
        question.type === "multiple_choice" ? question.options || [] : undefined,
      required: question.required ?? true,
    })),
  };
}
