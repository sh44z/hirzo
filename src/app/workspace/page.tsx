"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  getJobPostingPrice,
  JOB_POSTING_PLANS,
  type JobPostingPlan,
} from "@/lib/job-posting-plans";
import type { ApplicationStatus } from "@/types";

type Employer = {
  id: string;
  email: string;
  companyName: string;
  companyLogo?: string;
  companyDescription?: string;
  companyCulture?: string;
  companyBenefits?: string[];
  contactName: string;
  jobPostingDiscountPercent: number;
};

type Job = {
  id: string;
  title: string;
  description: string;
  location: string;
  employmentType: string;
  workplaceType?: string;
  department?: string;
  salaryMin?: number;
  salaryMax?: number;
  currency: string;
  status: string;
  postingPlan?: JobPostingPlan;
  postingPrice?: number;
  featured?: boolean;
  createdAt: string;
  expiresAt: string;
  applicants: Applicant[];
};

type Applicant = {
  id: string;
  candidateName: string;
  candidateEmail: string;
  status: ApplicationStatus;
  cvDownloadUrl?: string;
  createdAt: string;
  score?: number;
  hasScannedCv: boolean;
};

type ApplicantFilter = "all" | "shortlisted" | "interview";
type ApplicantSort = "date" | "score" | "name";
type ContactDraft = {
  applicant: Applicant;
  jobTitle: string;
  mode: "message" | "interview";
};

const applicationStages: Array<{ value: ApplicationStatus; label: string }> = [
  { value: "applied", label: "Applied" },
  { value: "shortlisted", label: "Shortlisted" },
  { value: "interview", label: "Interviewing" },
  { value: "offer_extended", label: "Offer extended" },
  { value: "hired", label: "Hired" },
  { value: "rejected", label: "Rejected" },
];

const applicationStatusLabels = Object.fromEntries(
  applicationStages.map(({ value, label }) => [value, label]),
) as Record<ApplicationStatus, string>;

function getVisibleApplicants(
  applicants: Applicant[],
  filter: ApplicantFilter,
  sort: ApplicantSort,
) {
  const visible = applicants.filter((applicant) => {
    if (filter === "shortlisted") return applicant.status === "shortlisted";
    if (filter === "interview") return applicant.status === "interview";
    return true;
  });

  return visible.sort((a, b) => {
    if (sort === "name") return a.candidateName.localeCompare(b.candidateName);
    if (sort === "score") {
      if (a.score === undefined) return b.score === undefined ? 0 : 1;
      if (b.score === undefined) return -1;
      return b.score - a.score;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

function matchScoreTone(score: number) {
  if (score >= 80) return "strong";
  if (score >= 50) return "moderate";
  return "low";
}

const typeLabels: Record<string, string> = {
  full_time: "Full time",
  part_time: "Part time",
  contract: "Contract",
  internship: "Internship",
  temporary: "Temporary",
};

const planIds = ["basic", "premium", "full_recruitment"] as const;
const MAX_COMPANY_LOGO_SIZE = 500 * 1024;
const COMPANY_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Could not read the company logo."));
    };
    reader.onerror = () => reject(new Error("Could not read the company logo."));
    reader.readAsDataURL(file);
  });
}

export default function WorkspacePage() {
  const [employer, setEmployer] = useState<Employer | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [companyLogoPreview, setCompanyLogoPreview] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [savingCompanyProfile, setSavingCompanyProfile] = useState(false);
  const [companyProfileNotice, setCompanyProfileNotice] = useState("");
  const [editError, setEditError] = useState("");
  const [deletingJobId, setDeletingJobId] = useState("");
  const [qualificationQuestions, setQualificationQuestions] = useState<Array<{ question: string; expectedAnswer: string; required: boolean }>>([]);
  const [selectedPlan, setSelectedPlan] = useState<JobPostingPlan>("basic");
  const [updatingApplicant, setUpdatingApplicant] = useState("");
  const [applicantFilters, setApplicantFilters] = useState<
    Record<string, ApplicantFilter>
  >({});
  const [applicantSorts, setApplicantSorts] = useState<
    Record<string, ApplicantSort>
  >({});
  const [contactDraft, setContactDraft] = useState<ContactDraft | null>(null);
  const [copiedJobId, setCopiedJobId] = useState("");
  const [paymentNotice, setPaymentNotice] = useState("");
  const [pendingPayPalOrder, setPendingPayPalOrder] = useState("");
  const [capturingPayment, setCapturingPayment] = useState(false);
  const [renewingJobId, setRenewingJobId] = useState("");
  const capturedOrder = useRef("");

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    try {
      const me = await fetch("/api/auth/me");
      if (!me.ok) {
        setEmployer(null);
        if (me.status !== 401) setError("Could not load your employer account.");
        return;
      }
      const accountData = await me.json();
      setEmployer(accountData.employer);

      const response = await fetch("/api/employers/jobs");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load your jobs.");
      setJobs(data.jobs);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load your workspace.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadWorkspace(), 0);
    return () => window.clearTimeout(timer);
  }, [loadWorkspace]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("paypal") === "success") {
        setPendingPayPalOrder(params.get("token") || "");
      } else if (params.get("paypal") === "cancelled") {
        setPaymentNotice("Checkout was cancelled. Your job has not been posted.");
        window.history.replaceState({}, "", window.location.pathname);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (
      !employer ||
      !pendingPayPalOrder ||
      capturedOrder.current === pendingPayPalOrder
    ) {
      return;
    }
    capturedOrder.current = pendingPayPalOrder;
    const timer = window.setTimeout(() => setCapturingPayment(true), 0);

    void (async () => {
      try {
        const response = await fetch("/api/payments/paypal/capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: pendingPayPalOrder }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Could not confirm your payment.");
        }
        setPaymentNotice(
          data.job.renewed
            ? `“${data.job.title}” renewed through ${new Date(data.job.expiresAt).toLocaleDateString()}.`
            : `Payment confirmed. “${data.job.title}” is now in your job posts.`,
        );
        window.history.replaceState({}, "", window.location.pathname);
        await loadWorkspace();
      } catch (captureError) {
        capturedOrder.current = "";
        setError(
          captureError instanceof Error
            ? captureError.message
            : "Could not confirm your payment.",
        );
      } finally {
        window.clearTimeout(timer);
        setCapturingPayment(false);
        setPendingPayPalOrder("");
      }
    })();
  }, [employer, pendingPayPalOrder, loadWorkspace]);

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setAuthSubmitting(true);
    try {
      const form = new FormData(event.currentTarget);
      const payload: Record<string, string> = {
        email: String(form.get("email")),
        password: String(form.get("password")),
      };
      if (registering) {
        payload.companyName = String(form.get("companyName"));
        payload.contactName = String(form.get("contactName"));
        const logoFile = form.get("companyLogo");
        if (logoFile instanceof File && logoFile.size > 0) {
          if (!COMPANY_LOGO_TYPES.includes(logoFile.type)) {
            throw new Error("Choose a PNG, JPEG, or WebP company logo.");
          }
          if (logoFile.size > MAX_COMPANY_LOGO_SIZE) {
            throw new Error("Company logos must be 500 KB or smaller.");
          }
          payload.companyLogo = await readFileAsDataUrl(logoFile);
        }
      }
      const response = await fetch(`/api/auth/${registering ? "register" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not sign in.");
      setEmployer(data.employer);
      await loadWorkspace();
    } catch (authError) {
      setError(
        authError instanceof TypeError
          ? "Could not connect to Hirzo. Check your connection and try again."
          : authError instanceof Error
            ? authError.message
            : "Could not sign in. Please try again.",
      );
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function createJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      title: String(form.get("title")),
      description: String(form.get("description")),
      location: String(form.get("location")),
      employmentType: String(form.get("employmentType")),
      workplaceType: String(form.get("workplaceType")),
      department: String(form.get("department")),
      currency: "GBP",
      status: String(form.get("status")),
      ...(form.get("salaryMin")
        ? { salaryMin: Number(form.get("salaryMin")) }
        : {}),
      ...(form.get("salaryMax")
        ? { salaryMax: Number(form.get("salaryMax")) }
        : {}),
      qualificationQuestions: qualificationQuestions
        .map(({ question, expectedAnswer, required }) => ({
          question: question.trim(),
          expectedAnswer: expectedAnswer.trim(),
          type: "text",
          required,
        }))
        .filter((question) => question.question && question.expectedAnswer),
      requirements: {
        skills: String(form.get("skills") || "")
          .split(/\n|,/)
          .map((item) => item.trim())
          .filter(Boolean),
        yearsExperience: Number(form.get("yearsExperience") || 0),
        qualifications: String(form.get("qualifications") || "")
          .split(/\n|,/)
          .map((item) => item.trim())
          .filter(Boolean),
        responsibilities: String(form.get("responsibilities") || "")
          .split(/\n|,/)
          .map((item) => item.trim())
          .filter(Boolean),
        otherRequirements: String(form.get("otherRequirements") || "")
          .split(/\n|,/)
          .map((item) => item.trim())
          .filter(Boolean),
      },
      plan: selectedPlan,
    };
    try {
      const response = await fetch("/api/payments/paypal/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not start checkout.");
      if (data.approvalUrl) {
        window.location.assign(data.approvalUrl);
        return;
      }
      if (!data.job) throw new Error("Checkout response was incomplete.");
      setShowCreate(false);
      setPaymentNotice(`Free job posting confirmed. “${data.job.title}” is now in your job posts.`);
      await loadWorkspace();
      setSaving(false);
    } catch (checkoutError) {
      setError(
        checkoutError instanceof TypeError
          ? "Could not connect to Hirzo or PayPal. Check your connection and try again."
          : checkoutError instanceof Error
            ? checkoutError.message
          : "Could not start PayPal checkout.",
      );
      setSaving(false);
    }
  }

  function openCreateJob() {
    setError("");
    setQualificationQuestions([]);
    setSelectedPlan("basic");
    setShowCreate(true);
  }

  async function renewJob(job: Job) {
    setRenewingJobId(job.id);
    setError("");
    try {
      const response = await fetch("/api/payments/paypal/renew-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: job.id,
          plan: job.postingPlan || "basic",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not renew this job.");
      if (data.approvalUrl) {
        window.location.assign(data.approvalUrl);
        return;
      }
      setPaymentNotice(
        `“${data.job.title}” renewed through ${new Date(data.job.expiresAt).toLocaleDateString()}.`,
      );
      await loadWorkspace();
    } catch (renewError) {
      setError(
        renewError instanceof Error ? renewError.message : "Could not renew this job.",
      );
    } finally {
      setRenewingJobId("");
    }
  }

  async function updateJobStatus(job: Job) {
    const nextStatus = job.status === "published" ? "draft" : "published";
    const response = await fetch(`/api/employers/jobs/${job.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (response.ok) {
      setJobs((current) =>
        current.map((item) =>
          item.id === job.id ? { ...item, status: nextStatus } : item,
        ),
      );
    } else {
      const data = await response.json();
      setError(data.error || "Could not update the job.");
    }
  }

  async function saveJobEdits(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingJob) return;
    setSavingEdit(true);
    setEditError("");
    const form = new FormData(event.currentTarget);
    const salaryMin = String(form.get("salaryMin") || "");
    const salaryMax = String(form.get("salaryMax") || "");
    const payload = {
      title: String(form.get("title")),
      description: String(form.get("description")),
      location: String(form.get("location")),
      employmentType: String(form.get("employmentType")),
      workplaceType: String(form.get("workplaceType")),
      department: String(form.get("department")),
      salaryMin: salaryMin ? Number(salaryMin) : null,
      salaryMax: salaryMax ? Number(salaryMax) : null,
      status: String(form.get("status")),
    };
    try {
      const response = await fetch(`/api/employers/jobs/${editingJob.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save job changes.");
      setJobs((current) =>
        current.map((job) =>
          job.id === editingJob.id ? { ...job, ...data.job } : job,
        ),
      );
      setPaymentNotice(`“${data.job.title}” has been updated.`);
      setEditingJob(null);
    } catch (editError) {
      setEditError(
        editError instanceof TypeError
          ? "Could not connect to Hirzo. Check your connection and try again."
          : editError instanceof Error
            ? editError.message
            : "Could not save job changes.",
      );
    } finally {
      setSavingEdit(false);
    }
  }

  async function saveCompanyProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingCompanyProfile(true);
    setCompanyProfileNotice("");
    const form = new FormData(event.currentTarget);
    const payload = {
      companyDescription: String(form.get("companyDescription") || ""),
      companyCulture: String(form.get("companyCulture") || ""),
      companyBenefits: String(form.get("companyBenefits") || "")
        .split(/\n|,/)
        .map((benefit) => benefit.trim())
        .filter(Boolean),
    };
    try {
      const response = await fetch("/api/employers/company-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not save your company profile.");
      }
      setEmployer((current) =>
        current ? { ...current, ...data.profile } : current,
      );
      setCompanyProfileNotice("Your public company profile has been updated.");
    } catch (profileError) {
      setError(
        profileError instanceof Error
          ? profileError.message
          : "Could not save your company profile.",
      );
    } finally {
      setSavingCompanyProfile(false);
    }
  }

  async function deleteJob(job: Job) {
    if (!window.confirm(`Delete “${job.title}”? This cannot be undone.`)) return;
    setDeletingJobId(job.id);
    setError("");
    try {
      const response = await fetch(`/api/employers/jobs/${job.id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not delete the job.");
      setJobs((current) => current.filter((item) => item.id !== job.id));
      setPaymentNotice(`“${job.title}” has been deleted.`);
    } catch (deleteError) {
      setError(
        deleteError instanceof TypeError
          ? "Could not connect to Hirzo. Check your connection and try again."
          : deleteError instanceof Error
            ? deleteError.message
            : "Could not delete the job.",
      );
    } finally {
      setDeletingJobId("");
    }
  }

  async function updateApplicantStatus(
    applicant: Applicant,
    status: ApplicationStatus,
  ) {
    setUpdatingApplicant(applicant.id);
    try {
      const response = await fetch(
        `/api/employers/applications/${applicant.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update applicant.");
      setJobs((current) =>
        current.map((job) => ({
          ...job,
          applicants: job.applicants.map((item) =>
            item.id === applicant.id ? { ...item, status } : item,
          ),
        })),
      );
    } catch (applicantError) {
      setError(
        applicantError instanceof Error
          ? applicantError.message
          : "Could not update applicant.",
      );
    } finally {
      setUpdatingApplicant("");
    }
  }

  async function copyJobLink(job: Job) {
    try {
      const link = new URL("/", window.location.origin);
      link.searchParams.set("job", job.id);
      link.hash = "opportunities";
      await navigator.clipboard.writeText(link.toString());
      setCopiedJobId(job.id);
      window.setTimeout(
        () => setCopiedJobId((current) => (current === job.id ? "" : current)),
        2200,
      );
    } catch (copyError) {
      setError(
        copyError instanceof Error
          ? `Could not copy the job link: ${copyError.message}`
          : "Could not copy the job link.",
      );
    }
  }

  function submitContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!contactDraft) return;

    const form = new FormData(event.currentTarget);
    const subject = String(form.get("subject") || "").trim();
    const message = String(form.get("message") || "").trim();
    const scheduledAt = String(form.get("scheduledAt") || "");
    const location = String(form.get("interviewLocation") || "").trim();
    const body =
      contactDraft.mode === "interview"
        ? `Hi ${contactDraft.applicant.candidateName},\n\nWe'd like to invite you to interview for ${contactDraft.jobTitle}.\n\nProposed time: ${new Date(scheduledAt).toLocaleString("en-GB")}\n${location ? `Location or meeting link: ${location}\n` : ""}\n${message}\n\nBest regards`
        : `Hi ${contactDraft.applicant.candidateName},\n\n${message}\n\nBest regards`;
    const mailto = `mailto:${contactDraft.applicant.candidateEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
    setContactDraft(null);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setEmployer(null);
    setJobs([]);
  }

  if (loading) {
    return (
      <main className="auth-shell">
        <div className="loading-mark">H</div>
        <p>Loading your workspace…</p>
      </main>
    );
  }

  if (!employer) {
    return (
      <main className="auth-shell">
        <Link className="brand" href="/">
          <Image src="/hirzologo.jpg" alt="Hirzo" width={90} height={52} unoptimized className="brand-logo" />
        </Link>
        <section className="auth-card">
          <div className="eyebrow">EMPLOYER WORKSPACE</div>
          <h1>{registering ? "Build your team." : "Welcome back."}</h1>
          <p className="muted">
            {registering
              ? "Create your employer account and choose a recruitment package."
              : "Sign in to manage your jobs and applicants."}
          </p>
          <form onSubmit={handleAuth} className="form-stack">
            {registering && (
              <>
                <label>
                  Company name
                  <input
                    name="companyName"
                    required
                    minLength={2}
                    placeholder="Northstar Studio"
                  />
                </label>
                <label>
                  Company logo <span className="optional-label">Optional · PNG, JPEG, or WebP · 500 KB max</span>
                  <input
                    type="file"
                    name="companyLogo"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0];
                      setCompanyLogoPreview("");
                      if (!file) return;
                      if (!COMPANY_LOGO_TYPES.includes(file.type)) {
                        setError("Choose a PNG, JPEG, or WebP company logo.");
                        event.currentTarget.value = "";
                        return;
                      }
                      if (file.size > MAX_COMPANY_LOGO_SIZE) {
                        setError("Company logos must be 500 KB or smaller.");
                        event.currentTarget.value = "";
                        return;
                      }
                      setError("");
                      void readFileAsDataUrl(file)
                        .then(setCompanyLogoPreview)
                        .catch((logoError: unknown) =>
                          setError(
                            logoError instanceof Error
                              ? logoError.message
                              : "Could not read the company logo.",
                          ),
                        );
                    }}
                  />
                </label>
                {companyLogoPreview && (
                  <div className="logo-upload-preview">
                    <Image
                      src={companyLogoPreview}
                      alt="Company logo preview"
                      width={64}
                      height={64}
                      unoptimized
                    />
                    <span>Logo preview</span>
                  </div>
                )}
                <label>
                  Your name
                  <input
                    name="contactName"
                    required
                    minLength={2}
                    placeholder="Alex Morgan"
                  />
                </label>
              </>
            )}
            <label>
              Work email
              <input
                type="email"
                name="email"
                required
                placeholder="you@company.com"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                name="password"
                required
                minLength={8}
                placeholder="At least 8 characters"
              />
            </label>
            {error && <p className="form-error">{error}</p>}
            <button className="button button-dark button-full" type="submit" disabled={authSubmitting}>
              {authSubmitting
                ? "Please wait…"
                : registering
                  ? "Create account"
                  : "Sign in to workspace"}
              <span>→</span>
            </button>
          </form>
          <p className="auth-switch">
            {registering ? "Already have an account?" : "New to Hirzo?"}{" "}
            <button
              onClick={() => {
                setRegistering(!registering);
                setError("");
                setCompanyLogoPreview("");
              }}
            >
              {registering ? "Sign in" : "Create an account"}
            </button>
          </p>
        </section>
        <section className="auth-pricing">
          <h2>Hiring packages</h2>
          <p>One-off pricing per job post</p>
          <div>
            {planIds.map((planId) => (
              <span key={planId}>
                {JOB_POSTING_PLANS[planId].name} · £
                {JOB_POSTING_PLANS[planId].amount}
              </span>
            ))}
          </div>
        </section>
        <Link href="/" className="back-link">
          ← Back to the job board
        </Link>
      </main>
    );
  }

  const publishedCount = jobs.filter((job) => job.status === "published").length;
  const visibleApplicantsByJobId = new Map(
    jobs.map((job) => [
      job.id,
      getVisibleApplicants(
        job.applicants,
        applicantFilters[job.id] || "all",
        applicantSorts[job.id] || "date",
      ),
    ]),
  );

  return (
    <main className="workspace-shell">
      <aside className="workspace-sidebar">
        <Link className="brand" href="/">
          <Image src="/hirzologo.jpg" alt="Hirzo" width={90} height={52} unoptimized className="brand-logo" />
        </Link>
        <div className="sidebar-label">DASHBOARD</div>
        <a className="side-link active">
          <span>▦</span> Hiring dashboard
        </a>
        <div className="sidebar-bottom">
          <details className="workspace-switcher">
            <summary className="workspace-switcher-trigger">
              <span className="avatar">
                {employer.companyLogo ? (
                  <Image
                    src={employer.companyLogo}
                    alt=""
                    width={36}
                    height={36}
                    unoptimized
                  />
                ) : (
                  employer.companyName.slice(0, 1).toUpperCase()
                )}
              </span>
              <span className="user-label">
                <strong>{employer.companyName}</strong>
                <span>Company workspace</span>
              </span>
              <span className="workspace-switcher-chevron" aria-hidden="true">
                ⌃
              </span>
            </summary>
            <div className="workspace-switcher-menu">
              <div className="workspace-switcher-label">ACTIVE WORKSPACE</div>
              <div className="workspace-switcher-current">
                <span className="workspace-switcher-monogram">
                  {employer.companyName.slice(0, 1).toUpperCase()}
                </span>
                <span>
                  <strong>{employer.companyName}</strong>
                  <small>{employer.email}</small>
                </span>
                <span className="workspace-switcher-check" aria-label="Selected">
                  ✓
                </span>
              </div>
              <button
                className="workspace-switcher-signout"
                onClick={logout}
              >
                Sign out
              </button>
            </div>
          </details>
        </div>
      </aside>
      <section className="workspace-content">
        <header className="workspace-topbar">
          <div>
            <span className="breadcrumb">Workspace</span>
            <span className="breadcrumb-sep">/</span>
            <strong>Hiring dashboard</strong>
          </div>
          <div className="topbar-actions">
            <Link href="/" className="text-link">
              View job board ↗
            </Link>
            <button className="button button-dark" onClick={openCreateJob}>
              ＋ Post a job
            </button>
          </div>
        </header>
        <div className="workspace-inner">
          {paymentNotice && (
            <div className="notice-banner">
              {paymentNotice}
              <button
                aria-label="Dismiss notice"
                onClick={() => setPaymentNotice("")}
              >
                ×
              </button>
            </div>
          )}
          {capturingPayment && (
            <div className="notice-banner">Confirming your PayPal payment…</div>
          )}
          {error && <p className="form-error workspace-error">{error}</p>}
          <div className="page-intro">
            <div>
              <div className="eyebrow">YOUR HIRING HQ</div>
              <h1>Good morning, {employer.contactName.split(" ")[0]}.</h1>
              <p>Make your next great hire happen.</p>
            </div>
            <div className="date-chip">✳ &nbsp; Your workspace</div>
          </div>
          <div className="metric-grid">
            <div className="metric-card">
              <span>Total job posts</span>
              <strong>{jobs.length.toString().padStart(2, "0")}</strong>
              <small>Across your company</small>
            </div>
            <div className="metric-card metric-highlight">
              <span>Live on Hirzo</span>
              <strong>{publishedCount.toString().padStart(2, "0")}</strong>
              <small>Visible to candidates</small>
            </div>
            <div className="metric-card">
              <span>Applicants</span>
              <strong>
                {jobs
                  .reduce((count, job) => count + job.applicants.length, 0)
                  .toString()
                  .padStart(2, "0")}
              </strong>
              <small>Across all your roles</small>
            </div>
          </div>
          <section className="job-management" id="job-list">
            <div className="section-heading">
              <div>
                <h2>Your job posts</h2>
                <p>Manage roles and keep your hiring moving.</p>
              </div>
              <button className="button button-light" onClick={openCreateJob}>
                ＋ New job
              </button>
            </div>
            {jobs.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">✳</div>
                <h3>Your next great hire starts here.</h3>
                <p>
                  Choose a package, post your first role, and find people who
                  will help your company grow.
                </p>
                <button
                  className="button button-dark"
                  onClick={openCreateJob}
                >
                  Create your first job <span>→</span>
                </button>
              </div>
            ) : (
              <div className="managed-jobs">
                {jobs.map((job) => (
                  <article className="dashboard-job" key={job.id}>
                    <div className="dashboard-job-heading">
                      {employer.companyLogo ? (
                        <Image
                          className="job-company-logo"
                          src={employer.companyLogo}
                          alt={`${employer.companyName} logo`}
                          width={39}
                          height={39}
                          unoptimized
                        />
                      ) : (
                        <div className="company-monogram">
                          {employer.companyName.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="managed-job-main">
                        <h3>{job.title}</h3>
                        <div className="job-meta">
                          <span>{job.location}</span>
                          <i>·</i>
                          <span>
                            {typeLabels[job.employmentType] || job.employmentType}
                          </span>
                          {job.postingPlan && (
                            <>
                              <i>·</i>
                              <span>
                                {JOB_POSTING_PLANS[job.postingPlan].name} (£
                                {job.postingPrice})
                              </span>
                            </>
                          )}
                          {job.featured && <span className="featured-job-label">Featured</span>}
                          <i>·</i>
                          <span>Expires {new Date(job.expiresAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <span className={`status-pill ${job.status}`}>
                        {job.status}
                      </span>
                    </div>
                    <div className="dashboard-job-actions">
                      <button
                        className="button button-light small-button"
                        onClick={() => void updateJobStatus(job)}
                      >
                        {job.status === "published" ? "Unpublish" : "Publish"}
                      </button>
                      <button
                        className="button button-light small-button"
                        onClick={() => {
                          setEditError("");
                          setEditingJob(job);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="button button-light small-button"
                        disabled={deletingJobId === job.id}
                        onClick={() => void deleteJob(job)}
                      >
                        {deletingJobId === job.id ? "Deleting…" : "Delete"}
                      </button>
                      <button
                        className="button button-light small-button"
                        disabled={renewingJobId === job.id}
                        onClick={() => void renewJob(job)}
                      >
                        {renewingJobId === job.id
                          ? "Opening checkout…"
                          : `Renew · £${getJobPostingPrice(job.postingPlan || "basic", employer.jobPostingDiscountPercent)}`}
                      </button>
                    </div>
                    <section className="job-applicants">
                      <div className="job-applicants-heading">
                        <h4>Applicants <span>{job.applicants.length}</span></h4>
                        {job.postingPlan === "premium" && (
                          <small>CV match scores</small>
                        )}
                      </div>
                      {job.applicants.length === 0 ? (
                        <div className="applicant-empty-state">
                          <span className="empty-icon">✳</span>
                          <div>
                            <strong>No applicants yet</strong>
                            <p>Share this job link to attract top talent.</p>
                          </div>
                          {job.status === "published" ? (
                            <button
                              className="button button-light small-button"
                              onClick={() => void copyJobLink(job)}
                            >
                              {copiedJobId === job.id
                                ? "Link copied"
                                : "Copy job link"}
                            </button>
                          ) : (
                            <span className="field-hint">
                              Publish this role to share it.
                            </span>
                          )}
                        </div>
                      ) : (
                        <>
                          <div className="applicant-toolbar">
                            <label>
                              Filter
                              <select
                                aria-label={`Filter applicants for ${job.title}`}
                                value={applicantFilters[job.id] || "all"}
                                onChange={(event) =>
                                  setApplicantFilters((current) => ({
                                    ...current,
                                    [job.id]: event.target.value as ApplicantFilter,
                                  }))
                                }
                              >
                                <option value="all">All applicants</option>
                                <option value="shortlisted">Shortlisted</option>
                                <option value="interview">Interviewed</option>
                              </select>
                            </label>
                            <label>
                              Sort by
                              <select
                                aria-label={`Sort applicants for ${job.title}`}
                                value={applicantSorts[job.id] || "date"}
                                onChange={(event) =>
                                  setApplicantSorts((current) => ({
                                    ...current,
                                    [job.id]: event.target.value as ApplicantSort,
                                  }))
                                }
                              >
                                <option value="date">Date applied</option>
                                <option value="score">Match score</option>
                                <option value="name">Name</option>
                              </select>
                            </label>
                          </div>
                          {visibleApplicantsByJobId.get(job.id)?.length === 0 ? (
                            <p className="applicant-filter-empty">
                              No applicants match this filter.
                            </p>
                          ) : (
                            <div className="applicant-list">
                              {visibleApplicantsByJobId
                                .get(job.id)
                                ?.map((applicant) => (
                            <article className="applicant-row" key={applicant.id}>
                              <div>
                                <strong>{applicant.candidateName}</strong>
                                <span className={`status-pill applicant-status ${applicant.status}`}>
                                  {applicationStatusLabels[applicant.status]}
                                </span>
                                <span className="applicant-applied-date">
                                  Applied {new Date(applicant.createdAt).toLocaleDateString("en-GB")}
                                </span>
                                {applicant.cvDownloadUrl && (
                                  <a href={applicant.cvDownloadUrl}>Download CV</a>
                                )}
                              </div>
                              <div className="applicant-match-score">
                                {job.postingPlan === "premium" ? (
                                  applicant.score === undefined ? (
                                    <span>CV not scanned</span>
                                  ) : (
                                    <span
                                      className={`match-score-badge ${matchScoreTone(applicant.score)}`}
                                    >
                                      {applicant.score}% match
                                    </span>
                                  )
                                ) : (
                                  <span>Premium match scores</span>
                                )}
                              </div>
                              <div className="applicant-actions">
                                <label className="stage-select-label">
                                  <span className="sr-only">Pipeline stage</span>
                                  <select
                                    aria-label={`Move ${applicant.candidateName} to a pipeline stage`}
                                    value={applicant.status}
                                    disabled={updatingApplicant === applicant.id}
                                    onChange={(event) =>
                                      void updateApplicantStatus(
                                        applicant,
                                        event.target.value as ApplicationStatus,
                                      )
                                    }
                                  >
                                    {applicationStages.map((stage) => (
                                      <option
                                        key={stage.value}
                                        value={stage.value}
                                        disabled={
                                          stage.value === "interview" &&
                                          job.postingPlan === "basic"
                                        }
                                      >
                                        {stage.label}
                                        {stage.value === "interview" &&
                                        job.postingPlan === "basic"
                                          ? " (Premium)"
                                          : ""}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <button
                                  className="button button-light small-button"
                                  disabled={updatingApplicant === applicant.id}
                                  onClick={() =>
                                    setContactDraft({
                                      applicant,
                                      jobTitle: job.title,
                                      mode: "message",
                                    })
                                  }
                                >
                                  Email
                                </button>
                                <button
                                  className="button button-light small-button"
                                  onClick={() =>
                                    setContactDraft({
                                      applicant,
                                      jobTitle: job.title,
                                      mode: "interview",
                                    })
                                  }
                                >
                                  Schedule
                                </button>
                              </div>
                            </article>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </section>
                  </article>
                ))}
              </div>
            )}
          </section>
          <div className="workspace-note">
            <span>✳</span>
            <p>
              <strong>Good hiring starts with a clear role.</strong>
              <br />
              Keep your job descriptions focused on the impact this person can
              make.
            </p>
            <Link href="/" className="text-link">
              Browse the board ↗
            </Link>
          </div>
          <details className="company-profile-editor">
            <summary>
              <span>
                <strong>Company profile</strong>
                <small>Add an introduction, culture, and benefits to your public profile.</small>
              </span>
              <span aria-hidden="true">⌄</span>
            </summary>
            <form
              className="form-stack company-profile-form"
              onSubmit={saveCompanyProfile}
            >
              <label>
                Company introduction{" "}
                <span className="optional-label">Shown on your company page</span>
                <textarea
                  name="companyDescription"
                  rows={4}
                  maxLength={2000}
                  defaultValue={employer.companyDescription || ""}
                  placeholder="Tell candidates about your company, mission, and the work you do."
                />
              </label>
              <label>
                Culture and working here
                <textarea
                  name="companyCulture"
                  rows={4}
                  maxLength={2000}
                  defaultValue={employer.companyCulture || ""}
                  placeholder="Describe the team, working style, and what candidates can expect."
                />
              </label>
              <label>
                Benefits{" "}
                <span className="optional-label">One per line or comma-separated · Up to 20</span>
                <textarea
                  name="companyBenefits"
                  rows={3}
                  defaultValue={(employer.companyBenefits || []).join("\n")}
                  placeholder={"Flexible working\nLearning and development budget"}
                />
              </label>
              {companyProfileNotice && (
                <p className="profile-save-notice">{companyProfileNotice}</p>
              )}
              <button
                className="button button-dark"
                type="submit"
                disabled={savingCompanyProfile}
              >
                {savingCompanyProfile ? "Saving…" : "Save company profile"}
              </button>
            </form>
          </details>
        </div>
      </section>

      {showCreate && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowCreate(false);
          }}
        >
          <section className="job-modal">
            <div className="modal-heading">
              <div>
                <div className="eyebrow">NEW OPPORTUNITY</div>
                <h2>Post a job</h2>
              </div>
              <button
                className="icon-button close-button"
                onClick={() => setShowCreate(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <form onSubmit={createJob} className="form-stack modal-form">
              <fieldset className="plan-picker">
                <legend>Choose your recruitment package</legend>
                <div className="plan-picker-grid">
                  {planIds.map((planId) => {
                    const plan = JOB_POSTING_PLANS[planId];
                    const price = getJobPostingPrice(
                      planId,
                      employer.jobPostingDiscountPercent,
                    );
                    return (
                      <button
                        key={planId}
                        type="button"
                        className={`plan-option ${selectedPlan === planId ? "selected" : ""}`}
                        onClick={() => setSelectedPlan(planId)}
                        aria-pressed={selectedPlan === planId}
                      >
                        <strong>{plan.name}</strong>
                        <b>{price === 0 ? "FREE" : <>£{price}{price !== plan.amount && <del>£{plan.amount}</del>}</>}</b>
                        <ul>
                          {plan.features.map((feature) => (
                            <li key={feature}>{feature}</li>
                          ))}
                        </ul>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              <label>
                Job title
                <input
                  name="title"
                  required
                  minLength={3}
                  maxLength={160}
                  placeholder="e.g. Senior Product Designer"
                />
              </label>
              <div className="form-row">
                <label>
                  Location
                  <input
                    name="location"
                    required
                    minLength={2}
                    placeholder="London / Remote"
                  />
                </label>
                <label>
                  Employment type
                  <select name="employmentType" defaultValue="full_time">
                    <option value="full_time">Full time</option>
                    <option value="part_time">Part time</option>
                    <option value="contract">Contract</option>
                    <option value="internship">Internship</option>
                    <option value="temporary">Temporary</option>
                  </select>
                </label>
              </div>
              <div className="form-row">
                <label>
                  Department
                  <select name="department" defaultValue="sales">
                    <option value="engineering">Engineering</option>
                    <option value="sales">Sales</option>
                    <option value="marketing">Marketing</option>
                    <option value="design">Design</option>
                    <option value="product">Product</option>
                    <option value="operations">Operations</option>
                    <option value="customer_success">Customer success</option>
                    <option value="finance">Finance</option>
                    <option value="hr">People &amp; HR</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label>
                  Workplace
                  <select name="workplaceType" defaultValue="onsite">
                    <option value="onsite">On-site</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="remote">Remote</option>
                  </select>
                </label>
              </div>
              <div className="form-row">
                <label>
                  Salary from (£)
                  <input type="number" name="salaryMin" min="0" placeholder="45000" />
                </label>
                <label>
                  Salary to (£)
                  <input type="number" name="salaryMax" min="0" placeholder="65000" />
                </label>
              </div>
              <label>
                About the role
                <textarea
                  name="description"
                  required
                  minLength={20}
                  rows={5}
                  placeholder="Tell candidates what they'll work on, the impact they'll make, and what you're looking for…"
                />
              </label>
              <fieldset className="qualification-editor">
                <legend>Job requirements</legend>
                <p className="field-hint">
                  Add role-related skills, qualifications, and responsibilities.
                  Add up to 100 items in each list. Do not include age, sex,
                  ethnicity, disability, or other protected traits.
                </p>
                <label>
                  Required skills <span className="optional-label">One per line or comma-separated · Up to 100</span>
                  <textarea name="skills" rows={3} placeholder={"e.g. Salesforce\nConsultative selling"} />
                </label>
                <label>
                  Minimum years of experience
                  <input type="number" name="yearsExperience" min="0" max="60" defaultValue="0" />
                </label>
                <label>
                  Qualifications <span className="optional-label">One per line or comma-separated · Up to 100</span>
                  <textarea name="qualifications" rows={3} placeholder="e.g. Relevant professional certification" />
                </label>
                <label>
                  Responsibilities <span className="optional-label">One per line or comma-separated · Up to 100</span>
                  <textarea name="responsibilities" rows={3} placeholder={"e.g. Manage the full sales cycle\nBuild a qualified pipeline"} />
                </label>
                <label>
                  Other job-related requirements <span className="optional-label">One per line or comma-separated · Up to 100</span>
                  <textarea name="otherRequirements" rows={3} placeholder="e.g. Comfortable presenting to clients" />
                </label>
              </fieldset>
              <fieldset className="qualification-editor">
                <legend>
                  Qualification questions <span className="optional-label">Optional</span>
                </legend>
                <p className="field-hint">
                  Ask candidates about relevant experience or how they handle
                  situations.
                </p>
                {qualificationQuestions.map((question, index) => (
                  <div className="qualification-editor-row" key={index}>
                    <label
                      className="sr-only"
                      htmlFor={`qualification-question-${index}`}
                    >
                      Question {index + 1}
                    </label>
                    <textarea
                      id={`qualification-question-${index}`}
                      name="qualificationQuestion"
                      required
                      minLength={3}
                      rows={2}
                      value={question.question}
                      onChange={(event) =>
                        setQualificationQuestions((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, question: event.target.value }
                              : item,
                          ),
                        )
                      }
                      placeholder={
                        index === 0
                          ? "Do you have 5 years of sales experience?"
                          : "Give an example of when you overcame an objection."
                      }
                    />
                    <label className="qualification-expected-answer">
                      Employer&apos;s expected answer
                      <input
                        required
                        maxLength={500}
                        value={question.expectedAnswer}
                        onChange={(event) =>
                          setQualificationQuestions((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, expectedAnswer: event.target.value }
                                : item,
                            ),
                          )
                        }
                        placeholder="e.g. Yes"
                      />
                    </label>
                    <div className="qualification-question-actions">
                      <label className="question-required-toggle">
                        <input
                          type="checkbox"
                          checked={question.required}
                          onChange={(event) =>
                            setQualificationQuestions((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, required: event.target.checked }
                                  : item,
                              ),
                            )
                          }
                        />
                        Required
                      </label>
                      <button
                        type="button"
                        className="button button-light remove-question"
                        aria-label={`Remove question ${index + 1}`}
                        onClick={() =>
                          setQualificationQuestions((current) =>
                            current.filter((_, itemIndex) => itemIndex !== index),
                          )
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="button button-light add-question"
                  onClick={() =>
                    setQualificationQuestions((current) => [
                      ...current,
                      { question: "", expectedAnswer: "", required: true },
                    ])
                  }
                >
                  ＋ Add a question
                </button>
              </fieldset>
              <label>
                Visibility after payment
                <select name="status" defaultValue="published">
                  <option value="published">Publish now</option>
                  <option value="draft">Save as draft</option>
                </select>
              </label>
              {error && <p className="form-error">{error}</p>}
              <div className="modal-actions">
                <button
                  type="button"
                  className="button button-light"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="button button-dark"
                >
                  {saving
                    ? "Opening PayPal…"
                    : getJobPostingPrice(selectedPlan, employer.jobPostingDiscountPercent) === 0
                      ? "Post for free"
                      : `Pay £${getJobPostingPrice(selectedPlan, employer.jobPostingDiscountPercent)} with PayPal`}
                  <span>→</span>
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {editingJob && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !savingEdit) {
              setEditingJob(null);
            }
          }}
        >
          <section className="job-modal">
            <div className="modal-heading">
              <div>
                <div className="eyebrow">EDIT JOB</div>
                <h2>Update your role</h2>
              </div>
              <button
                className="icon-button close-button"
                onClick={() => setEditingJob(null)}
                aria-label="Close"
                disabled={savingEdit}
              >
                ×
              </button>
            </div>
            <form onSubmit={saveJobEdits} className="form-stack modal-form">
              <label>
                Job title
                <input
                  name="title"
                  required
                  minLength={3}
                  maxLength={160}
                  defaultValue={editingJob.title}
                />
              </label>
              <div className="form-row">
                <label>
                  Location
                  <input
                    name="location"
                    required
                    minLength={2}
                    maxLength={160}
                    defaultValue={editingJob.location}
                  />
                </label>
                <label>
                  Employment type
                  <select
                    name="employmentType"
                    defaultValue={editingJob.employmentType}
                  >
                    {Object.entries(typeLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="form-row">
                <label>
                  Department
                  <select
                    name="department"
                    defaultValue={editingJob.department || "other"}
                  >
                    <option value="engineering">Engineering</option>
                    <option value="sales">Sales</option>
                    <option value="marketing">Marketing</option>
                    <option value="design">Design</option>
                    <option value="product">Product</option>
                    <option value="operations">Operations</option>
                    <option value="customer_success">Customer success</option>
                    <option value="finance">Finance</option>
                    <option value="hr">People &amp; HR</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label>
                  Workplace
                  <select
                    name="workplaceType"
                    defaultValue={editingJob.workplaceType || "onsite"}
                  >
                    <option value="onsite">On-site</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="remote">Remote</option>
                  </select>
                </label>
              </div>
              <div className="form-row">
                <label>
                  Salary from (£)
                  <input
                    type="number"
                    name="salaryMin"
                    min="0"
                    defaultValue={editingJob.salaryMin ?? ""}
                  />
                </label>
                <label>
                  Salary to (£)
                  <input
                    type="number"
                    name="salaryMax"
                    min="0"
                    defaultValue={editingJob.salaryMax ?? ""}
                  />
                </label>
              </div>
              <label>
                About the role
                <textarea
                  name="description"
                  required
                  minLength={20}
                  rows={6}
                  defaultValue={editingJob.description}
                />
              </label>
              <label>
                Visibility
                <select name="status" defaultValue={editingJob.status}>
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                  <option value="closed">Closed</option>
                </select>
              </label>
              {editError && <p className="form-error">{editError}</p>}
              <div className="modal-actions">
                <button
                  type="button"
                  className="button button-light"
                  onClick={() => setEditingJob(null)}
                  disabled={savingEdit}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button button-dark"
                  disabled={savingEdit}
                >
                  {savingEdit ? "Saving…" : "Save changes"} <span>→</span>
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {contactDraft && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setContactDraft(null);
          }}
        >
          <section
            className="job-modal contact-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-modal-title"
          >
            <div className="modal-heading">
              <div>
                <div className="eyebrow">
                  {contactDraft.mode === "interview"
                    ? "INTERVIEW INVITATION"
                    : "CANDIDATE MESSAGE"}
                </div>
                <h2 id="contact-modal-title">
                  {contactDraft.mode === "interview"
                    ? "Schedule an interview"
                    : `Email ${contactDraft.applicant.candidateName}`}
                </h2>
              </div>
              <button
                className="icon-button close-button"
                aria-label="Close"
                onClick={() => setContactDraft(null)}
              >
                ×
              </button>
            </div>
            <p className="muted contact-modal-copy">
              A draft will open in your email app addressed to{" "}
              <strong>{contactDraft.applicant.candidateEmail}</strong>. You can
              review and send it there.
            </p>
            <form className="form-stack modal-form" onSubmit={submitContact}>
              <label>
                Subject
                <input
                  name="subject"
                  required
                  defaultValue={
                    contactDraft.mode === "interview"
                      ? `Interview invitation: ${contactDraft.jobTitle}`
                      : `Regarding your application for ${contactDraft.jobTitle}`
                  }
                />
              </label>
              {contactDraft.mode === "interview" && (
                <>
                  <label>
                    Proposed date and time
                    <input name="scheduledAt" type="datetime-local" required />
                  </label>
                  <label>
                    Location or meeting link
                    <input
                      name="interviewLocation"
                      placeholder="Office address or video-call link"
                    />
                  </label>
                </>
              )}
              <label>
                {contactDraft.mode === "interview"
                  ? "Additional details"
                  : "Message"}
                <textarea
                  name="message"
                  rows={5}
                  required={contactDraft.mode === "message"}
                  placeholder={
                    contactDraft.mode === "interview"
                      ? "Share any preparation details or interview agenda."
                      : "Write your message to the candidate."
                  }
                />
              </label>
              <div className="modal-actions">
                <button
                  type="button"
                  className="button button-light"
                  onClick={() => setContactDraft(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="button button-dark">
                  Continue in email <span>→</span>
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

    </main>
  );
}
