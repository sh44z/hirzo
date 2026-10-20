"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

type Employer = { id: string; email: string; companyName: string; contactName: string };
type Job = { id: string; title: string; location: string; employmentType: string; status: string; createdAt: string };

const typeLabels: Record<string, string> = {
  full_time: "Full time", part_time: "Part time", contract: "Contract", internship: "Internship", temporary: "Temporary",
};

export default function WorkspacePage() {
  const [employer, setEmployer] = useState<Employer | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    const me = await fetch("/api/auth/me");
    if (me.ok) {
      const data = await me.json();
      setEmployer(data.employer);
      const response = await fetch("/api/employers/jobs");
      if (response.ok) setJobs((await response.json()).jobs);
    } else setEmployer(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadWorkspace(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadWorkspace]);

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const payload: Record<string, string> = {
      email: String(form.get("email")), password: String(form.get("password")),
    };
    if (registering) {
      payload.companyName = String(form.get("companyName"));
      payload.contactName = String(form.get("contactName"));
    }
    const response = await fetch(`/api/auth/${registering ? "register" : "login"}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) { setError(data.error || "Could not sign in"); return; }
    setEmployer(data.employer);
    await loadWorkspace();
  }

  async function createJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      title: String(form.get("title")), description: String(form.get("description")),
      location: String(form.get("location")), employmentType: String(form.get("employmentType")),
      currency: "GBP", status: String(form.get("status")),
      ...(form.get("salaryMin") ? { salaryMin: Number(form.get("salaryMin")) } : {}),
      ...(form.get("salaryMax") ? { salaryMax: Number(form.get("salaryMax")) } : {}),
    };
    const response = await fetch("/api/employers/jobs", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) { setError(data.error || "Could not create job"); return; }
    setJobs((current) => [data.job, ...current]);
    setShowCreate(false);
  }

  async function updateJobStatus(job: Job) {
    const nextStatus = job.status === "published" ? "draft" : "published";
    const response = await fetch(`/api/employers/jobs/${job.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: nextStatus }),
    });
    if (response.ok) setJobs((current) => current.map((item) => item.id === job.id ? { ...item, status: nextStatus } : item));
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setEmployer(null); setJobs([]);
  }

  if (loading) return <main className="auth-shell"><div className="loading-mark">H</div><p>Loading your workspace…</p></main>;

  if (!employer) return (
    <main className="auth-shell">
      <Link className="brand" href="/"><span className="brand-mark">h</span> hirzo</Link>
      <section className="auth-card">
        <div className="eyebrow">EMPLOYER WORKSPACE</div>
        <h1>{registering ? "Build your team." : "Welcome back."}</h1>
        <p className="muted">{registering ? "Create your employer account and publish your first role." : "Sign in to manage your jobs and applicants."}</p>
        <form onSubmit={handleAuth} className="form-stack">
          {registering && <>
            <label>Company name<input name="companyName" required minLength={2} placeholder="Northstar Studio" /></label>
            <label>Your name<input name="contactName" required minLength={2} placeholder="Alex Morgan" /></label>
          </>}
          <label>Work email<input type="email" name="email" required placeholder="you@company.com" /></label>
          <label>Password<input type="password" name="password" required minLength={8} placeholder="At least 8 characters" /></label>
          {error && <p className="form-error">{error}</p>}
          <button className="button button-dark button-full" type="submit">{registering ? "Create account" : "Sign in to workspace"}<span>→</span></button>
        </form>
        <p className="auth-switch">{registering ? "Already have an account?" : "New to Hirzo?"} <button onClick={() => { setRegistering(!registering); setError(""); }}>{registering ? "Sign in" : "Create an account"}</button></p>
      </section>
      <Link href="/" className="back-link">← Back to the job board</Link>
    </main>
  );

  const publishedCount = jobs.filter((job) => job.status === "published").length;
  return (
    <main className="workspace-shell">
      <aside className="workspace-sidebar">
        <Link className="brand" href="/"><span className="brand-mark">h</span> hirzo</Link>
        <div className="sidebar-label">WORKSPACE</div>
        <a className="side-link active"><span>▦</span> Overview</a>
        <a className="side-link" href="#job-list"><span>▤</span> Job postings</a>
        <div className="sidebar-bottom"><div className="avatar">{employer.companyName.slice(0, 1).toUpperCase()}</div><div className="user-label"><strong>{employer.companyName}</strong><span>{employer.email}</span></div><button className="icon-button" aria-label="Sign out" onClick={logout}>↗</button></div>
      </aside>
      <section className="workspace-content">
        <header className="workspace-topbar"><div><span className="breadcrumb">Workspace</span><span className="breadcrumb-sep">/</span><strong>Overview</strong></div><div className="topbar-actions"><Link href="/" className="text-link">View job board ↗</Link><button className="button button-dark" onClick={() => { setError(""); setShowCreate(true); }}>＋ Post a job</button></div></header>
        <div className="workspace-inner">
          <div className="page-intro"><div><div className="eyebrow">YOUR HIRING HQ</div><h1>Good morning, {employer.contactName.split(" ")[0]}.</h1><p>Make your next great hire happen.</p></div><div className="date-chip">✳ &nbsp; Your workspace</div></div>
          <div className="metric-grid"><div className="metric-card"><span>Total job posts</span><strong>{jobs.length.toString().padStart(2, "0")}</strong><small>Across your company</small></div><div className="metric-card metric-highlight"><span>Live on Hirzo</span><strong>{publishedCount.toString().padStart(2, "0")}</strong><small>Visible to candidates</small></div><div className="metric-card"><span>Drafts</span><strong>{(jobs.length - publishedCount).toString().padStart(2, "0")}</strong><small>Ready when you are</small></div></div>
          <section className="job-management" id="job-list"><div className="section-heading"><div><h2>Your job posts</h2><p>Manage roles and keep your hiring moving.</p></div><button className="button button-light" onClick={() => setShowCreate(true)}>＋ New job</button></div>
            {jobs.length === 0 ? <div className="empty-state"><div className="empty-icon">✳</div><h3>Your next great hire starts here.</h3><p>Post your first role and find the people who will help your company grow.</p><button className="button button-dark" onClick={() => setShowCreate(true)}>Create your first job <span>→</span></button></div> : <div className="managed-jobs">{jobs.map((job) => <article className="managed-job" key={job.id}><div className="company-monogram">{employer.companyName.slice(0, 1).toUpperCase()}</div><div className="managed-job-main"><h3>{job.title}</h3><div className="job-meta"><span>{job.location}</span><i>·</i><span>{typeLabels[job.employmentType] || job.employmentType}</span></div></div><span className={`status-pill ${job.status}`}>{job.status}</span><button className="button button-light small-button" onClick={() => updateJobStatus(job)}>{job.status === "published" ? "Unpublish" : "Publish"}</button></article>)}</div>}
          </section>
          <div className="workspace-note"><span>✳</span><p><strong>Good hiring starts with a clear role.</strong><br />Keep your job descriptions focused on the impact this person can make.</p><Link href="/" className="text-link">Browse the board ↗</Link></div>
        </div>
      </section>
      {showCreate && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowCreate(false); }}><section className="job-modal"><div className="modal-heading"><div><div className="eyebrow">NEW OPPORTUNITY</div><h2>Post a job</h2></div><button className="icon-button close-button" onClick={() => setShowCreate(false)} aria-label="Close">×</button></div><form onSubmit={createJob} className="form-stack modal-form"><label>Job title<input name="title" required minLength={3} maxLength={160} placeholder="e.g. Senior Product Designer" /></label><div className="form-row"><label>Location<input name="location" required minLength={2} placeholder="London / Remote" /></label><label>Employment type<select name="employmentType" defaultValue="full_time"><option value="full_time">Full time</option><option value="part_time">Part time</option><option value="contract">Contract</option><option value="internship">Internship</option><option value="temporary">Temporary</option></select></label></div><div className="form-row"><label>Salary from (£)<input type="number" name="salaryMin" min="0" placeholder="45000" /></label><label>Salary to (£)<input type="number" name="salaryMax" min="0" placeholder="65000" /></label></div><label>About the role<textarea name="description" required minLength={20} rows={5} placeholder="Tell candidates what they'll work on, the impact they'll make, and what you're looking for…" /></label><label>Visibility<select name="status" defaultValue="published"><option value="published">Publish now</option><option value="draft">Save as draft</option></select></label>{error && <p className="form-error">{error}</p>}<div className="modal-actions"><button type="button" className="button button-light" onClick={() => setShowCreate(false)}>Cancel</button><button type="submit" disabled={saving} className="button button-dark">{saving ? "Creating…" : "Create job"}<span>→</span></button></div></form></section></div>}
    </main>
  );
}
