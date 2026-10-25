import { z } from "zod";
import { containsProtectedCharacteristic } from "@/lib/protected-characteristics";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  companyName: z.string().min(2).max(120),
  contactName: z.string().min(2).max(120),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const qualificationQuestionSchema = z
  .object({
    id: z.string().min(1).optional(),
    question: z.string().min(3),
    type: z.enum(["text", "yes_no", "multiple_choice"]),
    options: z.array(z.string().min(1)).optional(),
    required: z.boolean().optional().default(true),
  })
  .superRefine((value, ctx) => {
    if (
      value.type === "multiple_choice" &&
      (!value.options || value.options.length < 2)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Multiple choice questions need at least 2 options",
        path: ["options"],
      });
    }
  });

const videoQuestionSchema = z.object({
  id: z.string().min(1).optional(),
  question: z.string().min(3),
  maxDurationSeconds: z.number().int().min(15).max(600).optional().default(120),
  required: z.boolean().optional().default(true),
});

const requirementListSchema = z.array(z.string().trim().min(1).max(200)).max(30);
const jobRequirementsSchema = z
  .object({
    skills: requirementListSchema.default([]),
    yearsExperience: z.number().min(0).max(60).default(0),
    qualifications: requirementListSchema.default([]),
    responsibilities: requirementListSchema.default([]),
    otherRequirements: requirementListSchema.default([]),
  })
  .superRefine((requirements, ctx) => {
    for (const field of [
      "skills",
      "qualifications",
      "responsibilities",
      "otherRequirements",
    ] as const) {
      requirements[field].forEach((requirement, index) => {
        if (containsProtectedCharacteristic(requirement)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              "Job matching requirements must not use protected characteristics",
            path: [field, index],
          });
        }
      });
    }
  });
const matchWeightsSchema = z
  .object({
    skills: z.number().int().min(0).max(100).default(40),
    experience: z.number().int().min(0).max(100).default(30),
    qualifications: z.number().int().min(0).max(100).default(15),
    other: z.number().int().min(0).max(100).default(15),
  })
  .refine(
    (weights) =>
      weights.skills +
        weights.experience +
        weights.qualifications +
        weights.other ===
      100,
    "Match weights must add up to 100",
  );

export const createJobSchema = z.object({
  title: z.string().min(3).max(160),
  description: z.string().min(20),
  location: z.string().min(2).max(160),
  employmentType: z.enum([
    "full_time",
    "part_time",
    "contract",
    "internship",
    "temporary",
  ]),
  salaryMin: z.number().nonnegative().optional(),
  salaryMax: z.number().nonnegative().optional(),
  currency: z.string().length(3).optional().default("GBP"),
  status: z.enum(["draft", "published", "closed"]).optional().default("draft"),
  qualificationQuestions: z
    .array(qualificationQuestionSchema)
    .optional()
    .default([]),
  videoQuestions: z.array(videoQuestionSchema).optional().default([]),
  requirements: jobRequirementsSchema.default({
    skills: [],
    yearsExperience: 0,
    qualifications: [],
    responsibilities: [],
    otherRequirements: [],
  }),
  matchWeights: matchWeightsSchema.default({
    skills: 40,
    experience: 30,
    qualifications: 15,
    other: 15,
  }),
});

export const createPaidJobPostingSchema = createJobSchema.extend({
  plan: z.enum(["basic", "premium", "full_recruitment"]),
});

export const paypalCaptureSchema = z.object({
  orderId: z.string().min(1).max(128),
});

export const updateJobSchema = createJobSchema.partial();

export const updateApplicationStatusSchema = z.object({
  status: z.enum(["applied", "shortlisted", "interview", "hired", "rejected"]),
  notes: z.string().max(2000).optional(),
});

export const createApplicationSchema = z.object({
  jobId: z.string().min(1),
  candidateName: z.string().min(2).max(120),
  candidateEmail: z.string().email(),
  candidatePhone: z.string().max(40).optional(),
  cvUrl: z.string().url().optional(),
  cvFileName: z.string().max(255).optional(),
  qualificationAnswers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        answer: z.string().min(1),
      }),
    )
    .optional()
    .default([]),
  videoAnswers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        videoUrl: z.string().url(),
      }),
    )
    .optional()
    .default([]),
});
