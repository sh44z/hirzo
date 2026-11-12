import { z } from "zod";
import { containsProtectedCharacteristic } from "@/lib/protected-characteristics";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  companyName: z.string().min(2).max(120),
  companyLogo: z
    .string()
    .max(700_000)
    .regex(
      /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/,
      "Company logo must be a PNG, JPEG, or WebP image",
    )
    .optional(),
  contactName: z.string().min(2).max(120),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const contactInquirySchema = z.object({
  name: z.string().trim().min(2).max(120),
  companyName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(40).optional().default(""),
  service: z.enum(["full_recruitment", "hiring_training"]),
  message: z.string().trim().min(10).max(2000),
});

const qualificationQuestionSchema = z
  .object({
    id: z.string().min(1).optional(),
    question: z.string().min(3),
    expectedAnswer: z.string().trim().min(1).max(500),
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

const virtualInterviewQuestionSchema = z.object({
  id: z.string().min(1).optional(),
  question: z.string().trim().min(3).max(500),
  maxDurationSeconds: z.number().int().min(15).max(300).optional().default(120),
  required: z.boolean().optional().default(true),
});

const assignmentQuestionSchema = z
  .object({
    id: z.string().min(1).optional(),
    question: z.string().trim().min(3).max(500),
    type: z.enum([
      "long_text",
      "multiple_choice",
      "file_upload",
      "video_link",
    ]),
    options: z.array(z.string().trim().min(1).max(200)).max(10).optional(),
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

export const assignmentTemplateSchema = z.object({
  instructions: z.string().trim().max(3000).optional().default(""),
  timeLimitHours: z.number().int().min(1).max(720).optional(),
  questions: z.array(assignmentQuestionSchema).max(20),
});

const requirementListSchema = z
  .array(z.string().trim().min(1).max(200))
  .max(100, "Each job requirements list can contain at most 100 items");
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
  workplaceType: z.enum(["onsite", "hybrid", "remote"]).optional(),
  salaryMin: z.number().nonnegative().optional(),
  salaryMax: z.number().nonnegative().optional(),
  currency: z.string().length(3).optional().default("GBP"),
  status: z.enum(["draft", "published", "closed"]).optional().default("draft"),
  qualificationQuestions: z
    .array(qualificationQuestionSchema)
    .optional()
    .default([]),
  videoQuestions: z.array(videoQuestionSchema).optional().default([]),
  interviewQuestions: z
    .array(virtualInterviewQuestionSchema)
    .max(10, "A virtual interview can contain at most 10 questions")
    .optional()
    .default([]),
  defaultAssignment: assignmentTemplateSchema.optional(),
  requirements: jobRequirementsSchema.default({
    skills: [],
    yearsExperience: 0,
    qualifications: [],
    responsibilities: [],
    otherRequirements: [],
  }),
});

export const createPaidJobPostingSchema = createJobSchema.extend({
  plan: z.enum(["basic", "premium", "full_recruitment"]),
  creditExpected: z.boolean().optional().default(false),
});

export const paypalCaptureSchema = z.object({
  orderId: z.string().min(1).max(128),
});

export const companyProfileSchema = z.object({
  companyDescription: z.string().trim().max(2000).optional(),
  companyCulture: z.string().trim().max(2000).optional(),
  companyBenefits: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
});

export const updateJobSchema = createJobSchema.partial().extend({
  salaryMin: z.number().nonnegative().nullable().optional(),
  salaryMax: z.number().nonnegative().nullable().optional(),
  defaultAssignment: assignmentTemplateSchema.nullable().optional(),
});

export const updateApplicationStatusSchema = z.object({
  status: z.enum([
    "applied",
    "shortlisted",
    "interview",
    "offer_extended",
    "hired",
    "rejected",
  ]),
  notes: z.string().max(2000).optional(),
});

export const reviewAssignmentSchema = z.object({
  rating: z.number().int().min(1).max(5).nullable().optional(),
  decision: z.enum(["pass", "fail"]).nullable().optional(),
  feedback: z.string().trim().max(2000).optional(),
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
  confirmQualificationMismatch: z.boolean().optional().default(false),
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
