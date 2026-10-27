"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  getJobPostingPrice,
  JOB_POSTING_PLANS,
  type JobPostingPlan,
} from "@/lib/job-posting-plans";

type Employer = {
  id: string;
  email: string;
  companyName: string;
  contactName: string;
  jobPostingDiscountPercent: number;
};

type Job = {
  id: string;
  title: string;
  location: string;
  employmentType: string;
  status: string;
  postingPlan?: JobPostingPlan;
  postingPrice?: number;
  featured?: boolean;
  createdAt: string;
};

type Applicant = {
  id: string;
  candidateName: string;
  candidateEmail: string;
  status: string;
  cvDownloadUrl?: string;
  createdAt: string;
};

const typeLabels: Record<string, string> = {
  full_time: "Full time",
  part_time: "Part time",
  contract: "Contract",
  internship: "Internship",
  temporary: "Temporary",
};

const planIds = ["basic", "premium", "full_recruitment"] as const;

export default function WorkspacePage() {
  const [employer, setEmployer] = useState<Employer | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [qualificationQuestions, setQualificationQuestions] = useState<string[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<JobPostingPlan>("basic");
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [applicantJob, setApplicantJob] = useState<Job | null>(null);
  const [loadingApplicants, setLoadingApplicants] = useState(false);
  const [updatingApplicant, setUpdatingApplicant] = useState("");
  const [paymentNotice, setPaymentNotice] = useState("");
  const [pendingPayPalOrder, setPendingPayPalOrder] = useState("");
  const [capturingPayment, setCapturingPayment] = useState(false);
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
        setPaymentNotice(`Payment confirmed. “${data.job.title}” is now in your job posts.`);
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
    const form = new FormData(event.currentTarget);
    const payload: Record<string, string> = {
      email: String(form.get("email")),
      password: String(form.get("password")),
    };
    if (registering) {
      payload.companyName = String(form.get("companyName"));
      payload.contactName = String(form.get("contactName"));
    }
    const response = await fetch(`/api/auth/${registering ? "register" : "login"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Could not sign in");
      return;
    }
    setEmployer(data.employer);
    await loadWorkspace();
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
      currency: "GBP",
      status: String(form.get("status")),
      ...(form.get("salaryMin")
        ? { salaryMin: Number(form.get("salaryMin")) }
        : {}),
      ...(form.get("salaryMax")
        ? { salaryMax: Number(form.get("salaryMax")) }
        : {}),
      qualificationQuestions: form
        .getAll("qualificationQuestion")
        .map(String)
        .map((question) => question.trim())
        .filter(Boolean)
        .map((question) => ({ question, type: "text", required: true })),
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
        checkoutError instanceof Error
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

  async function openApplicants(job: Job) {
    setApplicantJob(job);
    setApplicants([]);
    setLoadingApplicants(true);
    setError("");
    try {
      const response = await fetch(
        `/api/employers/jobs/${job.id}/applications`,
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load applicants.");
      setApplicants(data.applications);
    } catch (applicantError) {
      setError(
        applicantError instanceof Error
          ? applicantError.message
          : "Could not load applicants.",
      );
    } finally {
      setLoadingApplicants(false);
    }
  }

  async function updateApplicantStatus(applicant: Applicant, status: string) {
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
      setApplicants((current) =>
        current.map((item) =>
          item.id === applicant.id ? { ...item, status } : item,
        ),
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
          <span className="brand-mark">h</span> hirzo
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
            <button className="button button-dark button-full" type="submit">
              {registering ? "Create account" : "Sign in to workspace"}
              <span>→</span>
            </button>
          </form>
          <p className="auth-switch">
            {registering ? "Already have an account?" : "New to Hirzo?"}{" "}
            <button
              onClick={() => {
                setRegistering(!registering);
                setError("");
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

  return (
    <main className="workspace-shell">
      <aside className="workspace-sidebar">
        <Link className="brand" href="/">
          <span className="brand-mark">h</span> hirzo
        </Link>
        <div className="sidebar-label">WORKSPACE</div>
        <a className="side-link active">
          <span>▦</span> Overview
        </a>
        <a className="side-link" href="#job-list">
          <span>▤</span> Job postings
        </a>
        <div className="sidebar-bottom">
          <div className="avatar">
            {employer.companyName.slice(0, 1).toUpperCase()}
          </div>
          <div className="user-label">
            <strong>{employer.companyName}</strong>
            <span>{employer.email}</span>
          </div>
          <button
            className="icon-button"
            aria-label="Sign out"
            onClick={logout}
          >
            ↗
          </button>
        </div>
      </aside>
      <section className="workspace-content">
        <header className="workspace-topbar">
          <div>
            <span className="breadcrumb">Workspace</span>
            <span className="breadcrumb-sep">/</span>
            <strong>Overview</strong>
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
              <span>Drafts</span>
              <strong>{(jobs.length - publishedCount).toString().padStart(2, "0")}</strong>
              <small>Ready when you are</small>
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
                  <article className="managed-job" key={job.id}>
                    <div className="company-monogram">
                      {employer.companyName.slice(0, 1).toUpperCase()}
                    </div>
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
                      </div>
                    </div>
                    <span className={`status-pill ${job.status}`}>
                      {job.status}
                    </span>
                    <button
                      className="button button-light small-button"
                      onClick={() => void openApplicants(job)}
                    >
                      Applicants
                    </button>
                    {job.postingPlan === "premium" && (
                      <Link
                        className="button button-light small-button"
                        href={`/employer/jobs/${job.id}/applicants`}
                      >
                        Applicant matches
                      </Link>
                    )}
                    <button
                      className="button button-light small-button"
                      onClick={() => void updateJobStatus(job)}
                    >
                      {job.status === "published" ? "Unpublish" : "Publish"}
                    </button>
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
                  Do not include age, sex, ethnicity, disability, or other protected traits.
                </p>
                <label>
                  Required skills <span className="optional-label">One per line or comma-separated</span>
                  <textarea name="skills" rows={3} placeholder={"e.g. Salesforce\nConsultative selling"} />
                </label>
                <label>
                  Minimum years of experience
                  <input type="number" name="yearsExperience" min="0" max="60" defaultValue="0" />
                </label>
                <label>
                  Qualifications <span className="optional-label">One per line or comma-separated</span>
                  <textarea name="qualifications" rows={3} placeholder="e.g. Relevant professional certification" />
                </label>
                <label>
                  Responsibilities <span className="optional-label">One per line or comma-separated</span>
                  <textarea name="responsibilities" rows={3} placeholder={"e.g. Manage the full sales cycle\nBuild a qualified pipeline"} />
                </label>
                <label>
                  Other job-related requirements <span className="optional-label">One per line or comma-separated</span>
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
                      value={question}
                      onChange={(event) =>
                        setQualificationQuestions((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? event.target.value : item,
                          ),
                        )
                      }
                      placeholder={
                        index === 0
                          ? "Do you have 5 years of sales experience?"
                          : "Give an example of when you overcame an objection."
                      }
                    />
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
                ))}
                <button
                  type="button"
                  className="button button-light add-question"
                  onClick={() =>
                    setQualificationQuestions((current) => [...current, ""])
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

      {applicantJob && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setApplicantJob(null);
          }}
        >
          <section className="job-modal applicant-modal">
            <div className="modal-heading">
              <div>
                <div className="eyebrow">APPLICANT PIPELINE</div>
                <h2>{applicantJob.title}</h2>
              </div>
              <button
                className="icon-button close-button"
                onClick={() => setApplicantJob(null)}
                aria-label="Close applicants"
              >
                ×
              </button>
            </div>
            {loadingApplicants ? (
              <p className="field-hint">Loading applicants…</p>
            ) : applicants.length === 0 ? (
              <p className="field-hint">No applicants yet for this role.</p>
            ) : (
              <div className="applicant-list">
                {applicants.map((applicant) => (
                  <article className="applicant-row" key={applicant.id}>
                    <div>
                      <strong>{applicant.candidateName}</strong>
                      <a href={`mailto:${applicant.candidateEmail}`}>
                        {applicant.candidateEmail}
                      </a>
                      <span className={`status-pill ${applicant.status}`}>
                        {applicant.status}
                      </span>
                      {applicant.cvDownloadUrl && (
                        <a href={applicant.cvDownloadUrl}>Download CV</a>
                      )}
                    </div>
                    <div className="applicant-actions">
                      {applicant.status === "applied" && (
                        <button
                          className="button button-light small-button"
                          disabled={updatingApplicant === applicant.id}
                          onClick={() =>
                            void updateApplicantStatus(applicant, "shortlisted")
                          }
                        >
                          Shortlist
                        </button>
                      )}
                      {applicant.status === "shortlisted" && (
                        <>
                          <button
                            className="button button-light small-button"
                            disabled={updatingApplicant === applicant.id}
                            onClick={() =>
                              void updateApplicantStatus(applicant, "applied")
                            }
                          >
                            Remove shortlist
                          </button>
                          <button
                            className="button button-dark small-button"
                            disabled={updatingApplicant === applicant.id}
                            onClick={() =>
                              void updateApplicantStatus(applicant, "hired")
                            }
                          >
                            Hire
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
            {error && <p className="form-error">{error}</p>}
          </section>
        </div>
      )}
    </main>
  );
}
