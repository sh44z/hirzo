"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Admin = { adminId: string; email: string; name: string };
type EmployerStatus = "active" | "paused" | "pending_verification" | "suspended" | "banned";
type JobStatus = "draft" | "published" | "closed";
type ModerationStatus = "pending" | "approved" | "flagged" | "removed";
type EmployerJob = {
  id: string;
  title: string;
  status: JobStatus;
  moderationStatus: ModerationStatus;
  postingPlan: "basic" | "premium" | "full_recruitment";
  postingPrice: number;
  expiresAt: string;
  createdAt: string;
};
type Employer = {
  id: string;
  email: string;
  companyName: string;
  contactName: string;
  status: EmployerStatus;
  active: boolean;
  companyDescription: string;
  companyCulture: string;
  companyBenefits: string[];
  jobPostingCredits: { basic: number; premium: number };
  jobsCount: number;
  applicationsCount: number;
  jobs: EmployerJob[];
  createdAt: string;
};
type Account = { id: string; email: string; name: string; active: boolean; createdAt: string };
type Candidate = {
  email: string;
  name: string;
  applicationsCount: number;
  lastApplicationAt: string;
  status: "active" | "flagged" | "banned";
};
type ModerationJob = {
  id: string;
  title: string;
  description: string;
  status: JobStatus;
  moderationStatus: ModerationStatus;
  location: string;
  createdAt: string;
  applicationsCount: number;
  employer: { id: string; name: string; email: string } | null;
};
type AuditLog = {
  id: string;
  adminName: string;
  action: string;
  targetType: string;
  targetLabel: string;
  targetId?: string;
  detail: string;
  createdAt: string;
};
type NotificationTemplate = { key: string; subject: string; body: string };
type PlatformSettings = {
  defaultJobExpirationDays: number;
  maintenanceMode: boolean;
  notificationTemplates: NotificationTemplate[];
};
type Tab = "employers" | "moderation" | "candidates" | "settings" | "audit" | "accounts";

const employerStatuses: Array<{ value: EmployerStatus; label: string }> = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "pending_verification", label: "Pending verification" },
  { value: "suspended", label: "Suspended" },
  { value: "banned", label: "Banned" },
];

const tabs: Array<{ value: Tab; label: string; icon: string }> = [
  { value: "employers", label: "Employers", icon: "⌂" },
  { value: "moderation", label: "Job moderation", icon: "▤" },
  { value: "candidates", label: "Talent", icon: "♙" },
  { value: "settings", label: "System settings", icon: "⚙" },
  { value: "audit", label: "Audit log", icon: "◷" },
  { value: "accounts", label: "Master accounts", icon: "♧" },
];

async function readResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "The request could not be completed.");
  return data as T;
}

function statusLabel(status: string) {
  return status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function BackofficePage() {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [jobs, setJobs] = useState<ModerationJob[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [settings, setSettings] = useState<PlatformSettings>({
    defaultJobExpirationDays: 30,
    maintenanceMode: false,
    notificationTemplates: [],
  });
  const [tab, setTab] = useState<Tab>("employers");
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState("");
  const [notice, setNotice] = useState("");
  const [noticeError, setNoticeError] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedEmployer, setSelectedEmployer] = useState<Employer | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [creating, setCreating] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingJobId, setSavingJobId] = useState("");
  const [creditPlan, setCreditPlan] = useState<"basic" | "premium">("basic");
  const [creditQuantity, setCreditQuantity] = useState("1");
  const [grantingCredits, setGrantingCredits] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState("");

  const loadData = useCallback(async () => {
    try {
      const meResponse = await fetch("/api/admin/auth/me");
      if (!meResponse.ok) {
        setAdmin(null);
        setLoading(false);
        return;
      }
      const meData = await meResponse.json();
      setAdmin(meData.admin);
      const [employerData, accountData, candidateData, jobData, auditData, settingsData] = await Promise.all([
        fetch("/api/admin/employers").then(readResponse<{ employers: Employer[] }>),
        fetch("/api/admin/accounts").then(readResponse<{ accounts: Account[] }>),
        fetch("/api/admin/candidates").then(readResponse<{ candidates: Candidate[] }>),
        fetch("/api/admin/jobs").then(readResponse<{ jobs: ModerationJob[] }>),
        fetch("/api/admin/audit").then(readResponse<{ logs: AuditLog[] }>),
        fetch("/api/admin/settings").then(readResponse<{ settings: PlatformSettings }>),
      ]);
      setEmployers(employerData.employers);
      setAccounts(accountData.accounts);
      setCandidates(candidateData.candidates);
      setJobs(jobData.jobs);
      setLogs(auditData.logs);
      setSettings(settingsData.settings);
      setSelectedEmployer((current) =>
        current ? employerData.employers.find((item) => item.id === current.id) || null : null,
      );
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Could not load backoffice data.", true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  function showNotice(message: string, isError = false) {
    setNotice(message);
    setNoticeError(isError);
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      const data = await readResponse<{ admin: Admin }>(response);
      setAdmin(data.admin);
      setLoading(true);
      await loadData();
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Unable to sign in.");
    }
  }

  async function updateEmployerStatus(employer: Employer, status: EmployerStatus) {
    try {
      const response = await fetch(`/api/admin/employers/${employer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await readResponse(response);
      await loadData();
      showNotice(`${employer.companyName} is now ${statusLabel(status).toLowerCase()}.`);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Could not update employer status.", true);
    }
  }

  async function runEmployerAction(employer: Employer, action: "impersonate" | "reset_password" | "delete") {
    if (action === "delete" && !window.confirm(`Permanently delete ${employer.companyName} and its jobs, applications, and payment records?`)) return;
    try {
      if (action === "delete") {
        await readResponse(await fetch(`/api/admin/employers/${employer.id}`, { method: "DELETE" }));
        setSelectedEmployer(null);
        await loadData();
        showNotice(`${employer.companyName} and its associated records were deleted.`);
        return;
      }
      const response = await fetch(`/api/admin/employers/${employer.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await readResponse<{ redirectTo?: string; temporaryPassword?: string }>(response);
      if (action === "impersonate" && data.redirectTo) {
        window.location.assign(data.redirectTo);
        return;
      }
      setTemporaryPassword(data.temporaryPassword || "");
      showNotice("A temporary password was generated. Copy it now; it will not be shown again.");
      await loadData();
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Could not complete the employer action.", true);
    }
  }

  async function setJobModeration(job: ModerationJob, moderationStatus: ModerationStatus) {
    if (moderationStatus === "removed" && !window.confirm(`Remove “${job.title}” from the job board?`)) return;
    setSavingJobId(job.id);
    try {
      const response = await fetch(`/api/admin/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moderationStatus }),
      });
      await readResponse(response);
      await loadData();
      showNotice(`“${job.title}” marked ${statusLabel(moderationStatus).toLowerCase()}.`);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Could not update job moderation.", true);
    } finally {
      setSavingJobId("");
    }
  }

  async function updateCandidate(candidate: Candidate, action: "flagged" | "active" | "banned" | "erase") {
    if (action === "erase" && !window.confirm(`Permanently erase ${candidate.name}'s application data and CVs? This cannot be undone.`)) return;
    try {
      const response = await fetch(`/api/admin/candidates?email=${encodeURIComponent(candidate.email)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "erase" ? { erase: true } : { status: action }),
      });
      await readResponse(response);
      await loadData();
      showNotice(action === "erase" ? "Candidate application data was erased." : `${candidate.name} marked ${statusLabel(action).toLowerCase()}.`);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Could not update candidate.", true);
    }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingSettings(true);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await readResponse<{ settings: PlatformSettings }>(response);
      setSettings(data.settings);
      await loadData();
      showNotice("Platform settings saved.");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Could not save settings.", true);
    } finally {
      setSavingSettings(false);
    }
  }

  async function grantPostingCredits(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedEmployer) return;
    const quantity = Number(creditQuantity);
    setGrantingCredits(true);
    try {
      await readResponse(await fetch(`/api/admin/employers/${selectedEmployer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobPostingCreditGrant: { plan: creditPlan, quantity },
        }),
      }));
      await loadData();
      showNotice(`${quantity} free ${creditPlan} job posting credit${quantity === 1 ? "" : "s"} granted to ${selectedEmployer.companyName}.`);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Could not grant free job posting credits.", true);
    } finally {
      setGrantingCredits(false);
    }
  }

  async function updateJobPlan(job: EmployerJob, postingPlan: "basic" | "premium") {
    setSavingJobId(job.id);
    try {
      await readResponse(await fetch(`/api/admin/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postingPlan }),
      }));
      await loadData();
      showNotice(`“${job.title}” plan updated after offline invoice payment.`);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Could not update job plan.", true);
    } finally {
      setSavingJobId("");
    }
  }

  async function toggleAdminAccount(account: Account) {
    try {
      await readResponse(await fetch(`/api/admin/accounts/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !account.active }),
      }));
      await loadData();
      showNotice(`${account.email} account ${account.active ? "deactivated" : "restored"}.`);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Could not update master account.", true);
    }
  }

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    const form = new FormData(event.currentTarget);
    try {
      await readResponse(await fetch("/api/admin/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), name: form.get("name"), password: form.get("password") }),
      }));
      setShowAdd(false);
      await loadData();
      showNotice("Master account added successfully.");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Could not create master account.", true);
    } finally {
      setCreating(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    setAdmin(null);
    setEmployers([]);
    setAccounts([]);
  }

  const visibleEmployers = useMemo(() => employers.filter((employer) => {
    const matchesSearch = `${employer.companyName} ${employer.email} ${employer.contactName}`.toLowerCase().includes(search.trim().toLowerCase());
    return matchesSearch && (statusFilter === "all" || employer.status === statusFilter);
  }), [employers, search, statusFilter]);
  const pendingJobs = jobs.filter((job) => job.moderationStatus === "pending" || job.moderationStatus === "flagged");
  const pageTitle = tabs.find((item) => item.value === tab)?.label || "Backoffice";

  if (loading) return <main className="auth-shell"><div className="loading-mark">H</div><p>Opening backoffice…</p></main>;
  if (!admin) return (
    <main className="auth-shell admin-auth-shell">
      <Link className="brand" href="/"><Image src="/hirzologo.jpg" alt="Hirzo" width={90} height={52} unoptimized className="brand-logo" /></Link>
      <section className="auth-card">
        <div className="eyebrow">HIRZO ADMINISTRATION</div>
        <h1>Backoffice sign in.</h1>
        <p className="muted">Manage employers, job moderation, candidate applications, and platform access.</p>
        <form onSubmit={login} className="form-stack">
          <label>Admin email<input type="email" name="email" required defaultValue="admin@hirzo.com" /></label>
          <label>Password<input type="password" name="password" required autoComplete="current-password" placeholder="Your admin password" /></label>
          {loginError && <p className="form-error">{loginError}</p>}
          <button type="submit" className="button button-dark button-full">Sign in to backoffice <span>→</span></button>
        </form>
        <p className="auth-footnote">Initial access is provisioned with the server-side <strong>ADMIN_INITIAL_PASSWORD</strong> setting.</p>
      </section>
      <Link href="/" className="back-link">← Back to Hirzo</Link>
    </main>
  );

  return (
    <main className="workspace-shell admin-shell">
      <aside className="workspace-sidebar admin-sidebar">
        <Link className="brand" href="/"><Image src="/hirzologo.jpg" alt="Hirzo" width={90} height={52} unoptimized className="brand-logo" /></Link>
        <div className="sidebar-label">PLATFORM</div>
        <nav className="admin-navigation" aria-label="Backoffice">
          {tabs.map((item) => (
            <button key={item.value} className={`side-link ${tab === item.value ? "active" : ""}`} onClick={() => setTab(item.value)}>
              <span>{item.icon}</span>{item.label}
              {item.value === "moderation" && pendingJobs.length > 0 && <b className="nav-count">{pendingJobs.length}</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="avatar admin-avatar">{admin.name.slice(0, 1)}</div>
          <div className="user-label"><strong>{admin.name}</strong><span>Platform admin</span></div>
          <button className="icon-button" aria-label="Sign out" onClick={logout}>↗</button>
        </div>
      </aside>

      <section className="workspace-content">
        <header className="workspace-topbar">
          <div><span className="breadcrumb">Backoffice</span><span className="breadcrumb-sep">/</span><strong>{pageTitle}</strong></div>
          <div className="topbar-actions"><Link href="/" className="text-link">View job board ↗</Link><span className="admin-indicator"><i /> Admin access</span></div>
        </header>
        <div className="workspace-inner admin-inner">
          <div className="page-intro">
            <div><div className="eyebrow">PLATFORM CONTROL</div><h1>{tab === "employers" ? "Employer accounts" : pageTitle}</h1>
              <p>{tab === "employers" ? "Search, review, and manage every employer on Hirzo." : tab === "moderation" ? "Review job posts before they reach job seekers." : tab === "candidates" ? "Review applicants, flag profiles, and manage data requests." : tab === "settings" ? "Configure platform-wide defaults and maintenance." : tab === "audit" ? "A time-stamped record of administrative actions." : "Control who has access to the Hirzo backoffice."}</p>
            </div>
            {tab === "accounts" && <button className="button button-dark" onClick={() => setShowAdd(true)}>＋ Add master account</button>}
          </div>
          {notice && <div className={`notice-banner ${noticeError ? "notice-error" : ""}`} role={noticeError ? "alert" : "status"}><span>{noticeError ? "!" : "✓"}</span>{notice}<button onClick={() => setNotice("")} aria-label="Dismiss">×</button></div>}
          {temporaryPassword && <div className="temporary-password"><div><strong>Temporary password</strong><span>Copy and share this securely. It cannot be retrieved after closing this panel.</span></div><code>{temporaryPassword}</code><button className="table-action" onClick={() => { void navigator.clipboard.writeText(temporaryPassword); showNotice("Temporary password copied."); }}>Copy</button><button className="icon-button" aria-label="Dismiss temporary password" onClick={() => setTemporaryPassword("")}>×</button></div>}

          {tab === "employers" && <>
            <div className="metric-grid admin-metrics">
              <div className="metric-card"><span>Registered employers</span><strong>{employers.length.toString().padStart(2, "0")}</strong><small>All time</small></div>
              <div className="metric-card metric-highlight"><span>Active accounts</span><strong>{employers.filter((item) => item.status === "active").length.toString().padStart(2, "0")}</strong><small>Currently enabled</small></div>
              <div className="metric-card"><span>Job posts created</span><strong>{employers.reduce((sum, employer) => sum + employer.jobsCount, 0).toString().padStart(2, "0")}</strong><small>Across all employers</small></div>
            </div>
            <section className="job-management admin-table-section">
              <div className="section-heading"><div><h2>All employers</h2><p>Paused, suspended, and banned accounts cannot use their employer workspace.</p></div><span className="table-count">{visibleEmployers.length} of {employers.length}</span></div>
              <div className="admin-filters">
                <label className="admin-search"><span aria-hidden="true">⌕</span><input aria-label="Search employers" placeholder="Search company, contact, or email" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
                <label className="status-filter">Account status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option>{employerStatuses.map((status) => <option value={status.value} key={status.value}>{status.label}</option>)}</select></label>
              </div>
              <div className="admin-table employer-admin-table">
                <div className="table-header employer-columns"><span>COMPANY</span><span>CONTACT</span><span>JOBS</span><span>FREE POST CREDITS</span><span>STATUS</span><span>ACTIONS</span></div>
                {visibleEmployers.length === 0 ? <div className="table-empty">{employers.length ? "No employers match your search." : "Employer accounts will appear here when they register."}</div> : visibleEmployers.map((item) => (
                  <div className="table-row employer-columns" key={item.id}>
                    <button className="company-cell company-open-button" onClick={() => setSelectedEmployer(item)} aria-label={`View ${item.companyName} profile`}>
                      <div className="company-monogram">{item.companyName.slice(0, 1).toUpperCase()}</div><div><strong>{item.companyName}</strong><small>{item.email}</small></div>
                    </button>
                    <span className="table-secondary">{item.contactName}</span>
                    <div className="offer-cell"><span className="jobs-number">{item.jobsCount}</span><button className="table-action" onClick={() => setSelectedEmployer(item)}>View jobs</button></div>
                    <span>Basic {item.jobPostingCredits.basic} · Premium {item.jobPostingCredits.premium}</span>
                    <span><i className={`active-dot ${item.status === "active" ? "on" : "off"}`} />{statusLabel(item.status)}</span>
                    <details className="action-menu"><summary aria-label={`Actions for ${item.companyName}`}>•••</summary><div>
                      <button onClick={() => setSelectedEmployer(item)}>View profile</button>
                      <button onClick={() => void runEmployerAction(item, "impersonate")}>Impersonate user</button>
                      <button onClick={() => void runEmployerAction(item, "reset_password")}>Reset password</button>
                      <button className="menu-danger" onClick={() => void updateEmployerStatus(item, item.status === "paused" ? "active" : "paused")}>{item.status === "paused" ? "Restore account" : "Pause account"}</button>
                      <button className="menu-danger" onClick={() => void runEmployerAction(item, "delete")}>Delete account</button>
                    </div></details>
                  </div>
                ))}
              </div>
            </section>
          </>}

          {tab === "moderation" && <section className="job-management admin-table-section">
            <div className="section-heading"><div><h2>Moderation queue</h2><p>Pending and flagged posts are hidden from the public job board.</p></div><span className="table-count">{pendingJobs.length} need review</span></div>
            <div className="moderation-list">{pendingJobs.length === 0 ? <div className="table-empty">No jobs need moderation.</div> : pendingJobs.map((job) => (
              <article className="moderation-card" key={job.id}>
                <div className="moderation-main"><div className="eyebrow">{statusLabel(job.moderationStatus)} · {job.location}</div><h3>{job.title}</h3><p>{job.employer?.name || "Employer removed"} · {job.employer?.email || "—"} · {job.applicationsCount} applications</p><details><summary>Review job description</summary><p className="moderation-description">{job.description}</p></details></div>
                <div className="moderation-actions">
                  <button disabled={savingJobId === job.id} className="button button-dark" onClick={() => void setJobModeration(job, "approved")}>Approve</button>
                  <button disabled={savingJobId === job.id} className="button button-light" onClick={() => void setJobModeration(job, "flagged")}>Flag</button>
                  <button disabled={savingJobId === job.id} className="table-action pause-action" onClick={() => void setJobModeration(job, "removed")}>Remove</button>
                </div>
              </article>
            ))}</div>
            <div className="section-heading all-jobs-heading"><div><h2>Recently reviewed</h2><p>Published, removed, or closed job posts.</p></div></div>
            <div className="admin-table">
              <div className="table-header moderation-columns"><span>JOB</span><span>EMPLOYER</span><span>APPLICATIONS</span><span>STATUS</span><span>POSTED</span></div>
              {jobs.filter((job) => !pendingJobs.some((pending) => pending.id === job.id)).slice(0, 30).map((job) => <div className="table-row moderation-columns" key={job.id}><strong>{job.title}</strong><span>{job.employer?.name || "—"}</span><span>{job.applicationsCount}</span><span>{statusLabel(job.moderationStatus)}</span><span>{formatDate(job.createdAt)}</span></div>)}
            </div>
          </section>}

          {tab === "candidates" && <section className="job-management admin-table-section">
            <div className="section-heading"><div><h2>Talent directory</h2><p>Applicant records from submitted job applications; candidate accounts are not required.</p></div><span className="table-count">{candidates.length} applicants</span></div>
            <label className="admin-search candidate-search"><span aria-hidden="true">⌕</span><input aria-label="Search candidates" placeholder="Search by name or email" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
            <div className="admin-table">
              <div className="table-header candidate-columns"><span>CANDIDATE</span><span>APPLICATIONS</span><span>LAST ACTIVE</span><span>STATUS</span><span>ACTIONS</span></div>
              {candidates.filter((candidate) => `${candidate.name} ${candidate.email}`.toLowerCase().includes(search.trim().toLowerCase())).map((candidate) => <div className="table-row candidate-columns" key={candidate.email}>
                <div className="company-cell"><div className="company-monogram">{candidate.name.slice(0, 1).toUpperCase()}</div><div><strong>{candidate.name}</strong><small>{candidate.email}</small></div></div>
                <span>{candidate.applicationsCount}</span><span className="table-secondary">{formatDate(candidate.lastApplicationAt)}</span><span>{statusLabel(candidate.status)}</span>
                <details className="action-menu"><summary aria-label={`Actions for ${candidate.name}`}>•••</summary><div>
                  <button onClick={() => void updateCandidate(candidate, candidate.status === "flagged" ? "active" : "flagged")}>{candidate.status === "flagged" ? "Clear flag" : "Flag profile"}</button>
                  <button className="menu-danger" onClick={() => void updateCandidate(candidate, candidate.status === "banned" ? "active" : "banned")}>{candidate.status === "banned" ? "Unban candidate" : "Ban candidate"}</button>
                  <button className="menu-danger" onClick={() => void updateCandidate(candidate, "erase")}>Erase application data</button>
                </div></details>
              </div>)}
            </div>
          </section>}

          {tab === "settings" && <section className="job-management settings-panel">
            <div className="section-heading"><div><h2>Global configurations</h2><p>Changes apply platform-wide and are recorded in the audit log.</p></div></div>
            <form className="settings-form" onSubmit={saveSettings}>
              <label>Default job expiration (days)<input type="number" min="1" max="365" value={settings.defaultJobExpirationDays} onChange={(event) => setSettings({ ...settings, defaultJobExpirationDays: Number(event.target.value) })} /><small>Used for new job posts and renewals.</small></label>
              <label className="maintenance-toggle"><span><strong>Maintenance mode</strong><small>Pause public job browsing, applications, and new employer registration.</small></span><input type="checkbox" checked={settings.maintenanceMode} onChange={(event) => setSettings({ ...settings, maintenanceMode: event.target.checked })} /></label>
              <div className="template-editor"><div className="section-heading"><div><h2>Email notification templates</h2><p>Saved for platform configuration. Email delivery is not currently configured.</p></div><button type="button" className="button button-light" onClick={() => setSettings({ ...settings, notificationTemplates: [...settings.notificationTemplates, { key: "", subject: "", body: "" }] })}>＋ Add template</button></div>
                {settings.notificationTemplates.map((template, index) => <div className="template-card" key={`${template.key}-${index}`}><label>Template key<input required maxLength={80} value={template.key} onChange={(event) => setSettings({ ...settings, notificationTemplates: settings.notificationTemplates.map((item, itemIndex) => itemIndex === index ? { ...item, key: event.target.value } : item) })} /></label><label>Subject<input required maxLength={200} value={template.subject} onChange={(event) => setSettings({ ...settings, notificationTemplates: settings.notificationTemplates.map((item, itemIndex) => itemIndex === index ? { ...item, subject: event.target.value } : item) })} /></label><label>Message<textarea required maxLength={5000} rows={4} value={template.body} onChange={(event) => setSettings({ ...settings, notificationTemplates: settings.notificationTemplates.map((item, itemIndex) => itemIndex === index ? { ...item, body: event.target.value } : item) })} /></label><button type="button" className="table-action pause-action" onClick={() => setSettings({ ...settings, notificationTemplates: settings.notificationTemplates.filter((_, itemIndex) => itemIndex !== index) })}>Remove template</button></div>)}
              </div>
              <button type="submit" className="button button-dark" disabled={savingSettings}>{savingSettings ? "Saving…" : "Save settings"}<span>→</span></button>
            </form>
          </section>}

          {tab === "audit" && <section className="job-management admin-table-section">
            <div className="section-heading"><div><h2>Administrative activity</h2><p>Most recent 200 actions, with actor and timestamp.</p></div><span className="table-count">{logs.length} entries</span></div>
            <div className="admin-table"><div className="table-header audit-columns"><span>ADMINISTRATOR</span><span>ACTION</span><span>RECORD</span><span>DETAIL</span><span>WHEN</span></div>
              {logs.length === 0 ? <div className="table-empty">Administrative actions will appear here.</div> : logs.map((log) => <div className="table-row audit-columns" key={log.id}><strong>{log.adminName}</strong><span>{log.action}</span><span>{log.targetLabel}</span><span className="table-secondary">{log.detail || statusLabel(log.targetType)}</span><time dateTime={log.createdAt}>{new Date(log.createdAt).toLocaleString("en-GB")}</time></div>)}
            </div>
          </section>}

          {tab === "accounts" && <section className="job-management admin-table-section">
            <div className="section-heading"><div><h2>People with platform access</h2><p>Only add trusted operators. Passwords are stored securely.</p></div><span className="table-count">{accounts.length} total</span></div>
            <div className="admin-table"><div className="table-header account-columns"><span>ADMINISTRATOR</span><span>STATUS</span><span>ADDED</span><span>ACTION</span></div>
              {accounts.length === 0 ? <div className="table-empty">No master accounts found.</div> : accounts.map((item) => <div className="table-row account-columns" key={item.id}><div className="company-cell"><div className="company-monogram admin-monogram">{item.name.slice(0, 1).toUpperCase()}</div><div><strong>{item.name}</strong><small>{item.email}</small></div></div><span><i className={`active-dot ${item.active ? "on" : "off"}`} />{item.active ? "Active" : "Disabled"}</span><span className="table-secondary">{formatDate(item.createdAt)}</span><button className={`table-action ${item.active ? "pause-action" : "restore-action"}`} onClick={() => void toggleAdminAccount(item)}>{item.active ? "Deactivate" : "Restore"}</button></div>)}
            </div>
          </section>}
        </div>
      </section>

      {selectedEmployer && <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedEmployer(null); }}>
        <aside className="employer-drawer" role="dialog" aria-modal="true" aria-labelledby="employer-drawer-title">
          <header className="drawer-header"><div><div className="eyebrow">EMPLOYER PROFILE</div><h2 id="employer-drawer-title">{selectedEmployer.companyName}</h2></div><button className="icon-button" onClick={() => setSelectedEmployer(null)} aria-label="Close employer profile">×</button></header>
          <div className="drawer-body">
            <div className="drawer-contact"><strong>{selectedEmployer.contactName}</strong><a href={`mailto:${selectedEmployer.email}`}>{selectedEmployer.email}</a><span>Joined {formatDate(selectedEmployer.createdAt)}</span></div>
            <div className="drawer-stats"><div><strong>{selectedEmployer.jobsCount}</strong><span>Jobs</span></div><div><strong>{selectedEmployer.applicationsCount}</strong><span>Applications</span></div><div><strong>{selectedEmployer.jobPostingCredits.basic + selectedEmployer.jobPostingCredits.premium}</strong><span>Free post credits</span></div></div>
            <label className="drawer-status">Account status<select value={selectedEmployer.status} onChange={(event) => void updateEmployerStatus(selectedEmployer, event.target.value as EmployerStatus)}>{employerStatuses.map((status) => <option value={status.value} key={status.value}>{status.label}</option>)}</select></label>
            <section className="drawer-section"><h3>Company profile</h3><p>{selectedEmployer.companyDescription || "No company description provided."}</p>{selectedEmployer.companyCulture && <p>{selectedEmployer.companyCulture}</p>}{selectedEmployer.companyBenefits.length > 0 && <p><strong>Benefits:</strong> {selectedEmployer.companyBenefits.join(", ")}</p>}</section>
            <section className="drawer-section"><h3>Active jobs</h3>{selectedEmployer.jobs.length === 0 ? <p>No job posts yet.</p> : selectedEmployer.jobs.map((job) => <div className="drawer-job" key={job.id}><div><strong>{job.title}</strong><span>{statusLabel(job.status)} · expires {formatDate(job.expiresAt)}</span></div><select aria-label={`Posting plan for ${job.title}`} value={job.postingPlan === "full_recruitment" ? "premium" : job.postingPlan} disabled={savingJobId === job.id} onChange={(event) => void updateJobPlan(job, event.target.value as "basic" | "premium")}><option value="basic">Basic</option><option value="premium">Premium</option></select></div>)}</section>
            <section className="drawer-section"><h3>Grant free job posts</h3><p>Available now: Basic {selectedEmployer.jobPostingCredits.basic} · Premium {selectedEmployer.jobPostingCredits.premium}</p><form className="drawer-credit-form" onSubmit={(event) => void grantPostingCredits(event)}><label>Posting plan<select value={creditPlan} onChange={(event) => setCreditPlan(event.target.value as "basic" | "premium")}><option value="basic">Basic</option><option value="premium">Premium</option></select></label><label>Number of free posts<input aria-label="Number of free posts" type="number" min="1" max="1000" required value={creditQuantity} onChange={(event) => setCreditQuantity(event.target.value)} /></label><button className="button button-dark" type="submit" disabled={grantingCredits}>{grantingCredits ? "Granting…" : "Grant credits"}</button></form></section>
            <section className="drawer-section"><h3>Recent account activity</h3>{logs.filter((log) => log.targetId === selectedEmployer.id).slice(0, 8).map((log) => <p className="drawer-log" key={log.id}><strong>{log.action}</strong><span>{log.adminName} · {new Date(log.createdAt).toLocaleString("en-GB")}</span></p>)}{logs.filter((log) => log.targetId === selectedEmployer.id).length === 0 && <p>No recorded actions yet.</p>}</section>
          </div>
          <footer className="drawer-footer"><button className="button button-light" onClick={() => void runEmployerAction(selectedEmployer, "impersonate")}>Impersonate</button><button className="button button-light" onClick={() => void runEmployerAction(selectedEmployer, "reset_password")}>Reset password</button><button className="button button-danger" onClick={() => void runEmployerAction(selectedEmployer, "delete")}>Delete employer</button></footer>
        </aside>
      </div>}

      {showAdd && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowAdd(false); }}><section className="job-modal"><div className="modal-heading"><div><div className="eyebrow">PLATFORM ACCESS</div><h2>Add a master account</h2></div><button className="icon-button close-button" onClick={() => setShowAdd(false)} aria-label="Close">×</button></div><p className="muted modal-description">This person will have full access to employer controls and other master accounts.</p><form onSubmit={createAccount} className="form-stack modal-form"><label>Full name<input name="name" required minLength={2} placeholder="Jordan Lee" /></label><label>Email address<input type="email" name="email" required placeholder="jordan@hirzo.com" /></label><label>Temporary password<input type="password" name="password" required minLength={12} placeholder="At least 12 characters" /></label>{noticeError && <p className="form-error">{notice}</p>}<div className="modal-actions"><button type="button" className="button button-light" onClick={() => setShowAdd(false)}>Cancel</button><button type="submit" disabled={creating} className="button button-dark">{creating ? "Adding…" : "Add account"}<span>→</span></button></div></form></section></div>}
    </main>
  );
}
