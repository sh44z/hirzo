"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

type Admin = { adminId: string; email: string; name: string };
type Employer = { id: string; email: string; companyName: string; contactName: string; active: boolean; jobsCount: number; createdAt: string };
type Account = { id: string; email: string; name: string; active: boolean; createdAt: string };

export default function BackofficePage() {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [tab, setTab] = useState<"employers" | "accounts">("employers");
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState("");
  const [notice, setNotice] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [creating, setCreating] = useState(false);

  const loadData = useCallback(async () => {
    const meResponse = await fetch("/api/admin/auth/me");
    if (!meResponse.ok) { setLoading(false); return; }
    setAdmin((await meResponse.json()).admin);
    const [employersResponse, accountsResponse] = await Promise.all([
      fetch("/api/admin/employers"), fetch("/api/admin/accounts"),
    ]);
    if (employersResponse.ok) setEmployers((await employersResponse.json()).employers);
    if (accountsResponse.ok) setAccounts((await accountsResponse.json()).accounts);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadData(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoginError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
    });
    const data = await response.json();
    if (!response.ok) { setLoginError(data.error || "Unable to sign in"); return; }
    setAdmin(data.admin); setLoading(true); await loadData();
  }

  async function toggleEmployer(employer: Employer) {
    setNotice("");
    const response = await fetch(`/api/admin/employers/${employer.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !employer.active }),
    });
    const data = await response.json();
    if (!response.ok) { setNotice(data.error || "Could not update employer"); return; }
    setEmployers((current) => current.map((item) => item.id === employer.id ? { ...item, active: !employer.active } : item));
    setNotice(`${employer.companyName} account ${employer.active ? "paused" : "restored"}.`);
  }

  async function toggleAccount(account: Account) {
    setNotice("");
    const response = await fetch(`/api/admin/accounts/${account.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !account.active }),
    });
    const data = await response.json();
    if (!response.ok) { setNotice(data.error || "Could not update account"); return; }
    setAccounts((current) => current.map((item) => item.id === account.id ? { ...item, active: !account.active } : item));
    setNotice(`${account.email} account ${account.active ? "deactivated" : "restored"}.`);
  }

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setCreating(true); setNotice("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/accounts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.get("email"), name: form.get("name"), password: form.get("password") }),
    });
    const data = await response.json(); setCreating(false);
    if (!response.ok) { setNotice(data.error || "Could not create account"); return; }
    setAccounts((current) => [...current, { ...data.account, createdAt: new Date().toISOString() }]);
    setShowAdd(false); setNotice("Master account added successfully.");
  }

  async function logout() {
    await fetch("/api/admin/auth/logout", { method: "POST" }); setAdmin(null); setEmployers([]); setAccounts([]);
  }

  if (loading) return <main className="auth-shell"><div className="loading-mark">H</div><p>Opening backoffice…</p></main>;
  if (!admin) return (
    <main className="auth-shell admin-auth-shell">
      <Link className="brand" href="/"><span className="brand-mark">h</span> hirzo</Link>
      <section className="auth-card"><div className="eyebrow">HIRZO ADMINISTRATION</div><h1>Backoffice sign in.</h1><p className="muted">Manage employer accounts and platform administrators.</p>
        <form onSubmit={login} className="form-stack"><label>Admin email<input type="email" name="email" required defaultValue="admin@hirzo.com" /></label><label>Password<input type="password" name="password" required autoComplete="current-password" placeholder="Your admin password" /></label>{loginError && <p className="form-error">{loginError}</p>}<button type="submit" className="button button-dark button-full">Sign in to backoffice <span>→</span></button></form>
        <p className="auth-footnote">Initial access is provisioned with the server-side <strong>ADMIN_INITIAL_PASSWORD</strong> setting. Contact your platform owner if the initial account has not been configured.</p>
      </section><Link href="/" className="back-link">← Back to Hirzo</Link>
    </main>
  );

  return (
    <main className="workspace-shell admin-shell">
      <aside className="workspace-sidebar"><Link className="brand" href="/"><span className="brand-mark">h</span> hirzo</Link><div className="sidebar-label">PLATFORM</div><button className={`side-link ${tab === "employers" ? "active" : ""}`} onClick={() => setTab("employers")}><span>⌂</span> Employers</button><button className={`side-link ${tab === "accounts" ? "active" : ""}`} onClick={() => setTab("accounts")}><span>♙</span> Master accounts</button><div className="sidebar-bottom"><div className="avatar admin-avatar">{admin.name.slice(0, 1)}</div><div className="user-label"><strong>{admin.name}</strong><span>Platform admin</span></div><button className="icon-button" aria-label="Sign out" onClick={logout}>↗</button></div></aside>
      <section className="workspace-content"><header className="workspace-topbar"><div><span className="breadcrumb">Backoffice</span><span className="breadcrumb-sep">/</span><strong>{tab === "employers" ? "Employers" : "Master accounts"}</strong></div><div className="topbar-actions"><Link href="/" className="text-link">View job board ↗</Link><span className="admin-indicator"><i /> Admin access</span></div></header>
        <div className="workspace-inner admin-inner"><div className="page-intro"><div><div className="eyebrow">PLATFORM CONTROL</div><h1>{tab === "employers" ? "Employer accounts" : "Master accounts"}</h1><p>{tab === "employers" ? "Review, manage and support every employer on Hirzo." : "Control who has access to the Hirzo backoffice."}</p></div>{tab === "accounts" && <button className="button button-dark" onClick={() => { setNotice(""); setShowAdd(true); }}>＋ Add master account</button>}</div>
          {notice && <div className="notice-banner"><span>✓</span>{notice}<button onClick={() => setNotice("")} aria-label="Dismiss">×</button></div>}
          <div className="metric-grid admin-metrics"><div className="metric-card"><span>{tab === "employers" ? "Registered employers" : "Master accounts"}</span><strong>{(tab === "employers" ? employers.length : accounts.length).toString().padStart(2, "0")}</strong><small>All time</small></div><div className="metric-card metric-highlight"><span>Active accounts</span><strong>{(tab === "employers" ? employers.filter((item) => item.active).length : accounts.filter((item) => item.active).length).toString().padStart(2, "0")}</strong><small>Currently enabled</small></div>{tab === "employers" && <div className="metric-card"><span>Job posts created</span><strong>{employers.reduce((sum, employer) => sum + employer.jobsCount, 0).toString().padStart(2, "0")}</strong><small>Across all employers</small></div>}</div>
          <section className="job-management admin-table-section"><div className="section-heading"><div><h2>{tab === "employers" ? "All employers" : "People with platform access"}</h2><p>{tab === "employers" ? "Pausing an account immediately blocks workspace access." : "Only add trusted operators. Passwords are stored securely."}</p></div><span className="table-count">{tab === "employers" ? employers.length : accounts.length} total</span></div>
            {tab === "employers" ? <div className="admin-table"><div className="table-header employer-columns"><span>COMPANY</span><span>CONTACT</span><span>JOBS</span><span>STATUS</span><span>ACTION</span></div>{employers.length === 0 ? <div className="table-empty">Employer accounts will appear here when they register.</div> : employers.map((item) => <div className="table-row employer-columns" key={item.id}><div className="company-cell"><div className="company-monogram">{item.companyName.slice(0, 1).toUpperCase()}</div><div><strong>{item.companyName}</strong><small>{item.email}</small></div></div><span className="table-secondary">{item.contactName}</span><span className="jobs-number">{item.jobsCount}</span><span><i className={`active-dot ${item.active ? "on" : "off"}`} />{item.active ? "Active" : "Paused"}</span><button className={`table-action ${item.active ? "pause-action" : "restore-action"}`} onClick={() => toggleEmployer(item)}>{item.active ? "Pause" : "Restore"}</button></div>)}</div> : <div className="admin-table"><div className="table-header account-columns"><span>ADMINISTRATOR</span><span>STATUS</span><span>ADDED</span><span>ACTION</span></div>{accounts.length === 0 ? <div className="table-empty">No additional master accounts yet.</div> : accounts.map((item) => <div className="table-row account-columns" key={item.id}><div className="company-cell"><div className="company-monogram admin-monogram">{item.name.slice(0, 1).toUpperCase()}</div><div><strong>{item.name}</strong><small>{item.email}</small></div></div><span><i className={`active-dot ${item.active ? "on" : "off"}`} />{item.active ? "Active" : "Disabled"}</span><span className="table-secondary">{new Date(item.createdAt).toLocaleDateString()}</span><button className={`table-action ${item.active ? "pause-action" : "restore-action"}`} onClick={() => toggleAccount(item)}>{item.active ? "Deactivate" : "Restore"}</button></div>)}</div>}
          </section>
          <div className="workspace-note"><span>♧</span><p><strong>Account controls are immediate.</strong><br />Disabled users lose access to their workspace on their next request.</p></div>
        </div>
      </section>
      {showAdd && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowAdd(false); }}><section className="job-modal"><div className="modal-heading"><div><div className="eyebrow">PLATFORM ACCESS</div><h2>Add a master account</h2></div><button className="icon-button close-button" onClick={() => setShowAdd(false)} aria-label="Close">×</button></div><p className="muted modal-description">This person will have full access to employer controls and other master accounts.</p><form onSubmit={createAccount} className="form-stack modal-form"><label>Full name<input name="name" required minLength={2} placeholder="Jordan Lee" /></label><label>Email address<input type="email" name="email" required placeholder="jordan@hirzo.com" /></label><label>Temporary password<input type="password" name="password" required minLength={12} placeholder="At least 12 characters" /><small className="field-hint">Share this securely and have them rotate it after sign in.</small></label>{notice && <p className="form-error">{notice}</p>}<div className="modal-actions"><button type="button" className="button button-light" onClick={() => setShowAdd(false)}>Cancel</button><button type="submit" disabled={creating} className="button button-dark">{creating ? "Adding…" : "Add account"}<span>→</span></button></div></form></section></div>}
    </main>
  );
}
