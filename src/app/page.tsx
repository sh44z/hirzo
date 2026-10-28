"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type Job = {
  id: string; title: string; description: string; location: string; employmentType: string;
  companyName: string; salaryMin?: number; salaryMax?: number; currency: string; createdAt: string; featured?: boolean;
  qualificationQuestions?: Array<{ id: string; question: string; required: boolean; type: string; options?: Array<string> }>;
  videoQuestions?: Array<{ id: string; question: string; required: boolean; maxDurationSeconds: number }>;
};

const filters = ["All roles", "Full time", "Part time", "Contract", "Internship"];
const typeLabels: Record<string, string> = { full_time: "Full time", part_time: "Part time", contract: "Contract", internship: "Internship", temporary: "Temporary" };
const colors = ["mint", "lilac", "peach", "blue", "yellow"];

function salaryLabel(job: Job) {
  if (!job.salaryMin && !job.salaryMax) return "Salary not listed";
  const currency = job.currency || "GBP";
  const format = (amount: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  if (job.salaryMin && job.salaryMax) return `${format(job.salaryMin)} – ${format(job.salaryMax)}`;
  return job.salaryMin ? `${format(job.salaryMin)}+` : `Up to ${format(job.salaryMax!)}`;
}

export default function Home() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("");
  const [filter, setFilter] = useState("All roles");
  const [selected, setSelected] = useState<Job | null>(null);
  const [applying, setApplying] = useState(false);
  const [applicationDone, setApplicationDone] = useState(false);
  const [applicationError, setApplicationError] = useState("");

  useEffect(() => {
    fetch("/api/jobs/public").then((response) => response.ok ? response.json() : { jobs: [] })
      .then((data) => setJobs(data.jobs || [])).catch(() => setJobs([])).finally(() => setLoading(false));
  }, []);

  const visibleJobs = useMemo(() => jobs.filter((job) => {
    const term = search.trim().toLowerCase();
    const matchesTerm = !term || [job.title, job.companyName, job.location, job.description].some((value) => value.toLowerCase().includes(term));
    const matchesLocation = !location.trim() || job.location.toLowerCase().includes(location.trim().toLowerCase());
    return matchesTerm && matchesLocation && (filter === "All roles" || typeLabels[job.employmentType] === filter);
  }), [jobs, search, location, filter]);

  async function submitApplication(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setApplicationError("");
    const form = new FormData(event.currentTarget);
    const qualificationAnswers = selected.qualificationQuestions?.map((question) => ({
      questionId: question.id,
      answer: String(form.get(`qualification-${question.id}`) || ""),
    })).filter((answer) => answer.answer);
    const videoAnswers = selected.videoQuestions?.map((question) => ({
      questionId: question.id,
      videoUrl: String(form.get(`video-${question.id}`) || ""),
    })).filter((answer) => answer.videoUrl);
    const formData = new FormData();
    formData.set("jobId", selected.id);
    formData.set("candidateName", String(form.get("candidateName") || ""));
    formData.set("candidateEmail", String(form.get("candidateEmail") || ""));
    const candidatePhone = String(form.get("candidatePhone") || "");
    const cvUrl = String(form.get("cvUrl") || "");
    if (candidatePhone) formData.set("candidatePhone", candidatePhone);
    if (cvUrl) formData.set("cvUrl", cvUrl);
    formData.set("qualificationAnswers", JSON.stringify(qualificationAnswers));
    formData.set("videoAnswers", JSON.stringify(videoAnswers));
    const cvFile = form.get("cvFile");
    if (cvFile instanceof File && cvFile.size > 0) formData.set("cvFile", cvFile);
    const response = await fetch("/api/applications", {
      method: "POST",
      body: formData,
    });
    const data = await response.json();
    if (!response.ok) { setApplicationError(data.error || "We could not submit your application."); return; }
    setApplicationDone(true);
  }

  return (
    <main className="public-site">
      <nav className="public-nav"><div className="nav-inner"><Link className="brand" href="/"><Image src="/hirzologo.jpg" alt="Hirzo" width={90} height={52} className="brand-logo" /></Link><div className="nav-center"><a href="#opportunities">Find sales jobs</a><a href="#why-hirzo">About us</a></div><div className="nav-actions"><Link href="/workspace" className="nav-employer-link">For employers</Link><Link href="/workspace" className="button button-dark nav-cta">Post a job <span>↗</span></Link></div></div></nav>
      <section className="hero-section"><div className="hero-grid-lines" /><div className="hero-content"><div className="hero-tag"><span className="hero-tag-dot" /> A better way to find your next sales role</div><h1>Sales jobs<br />start <span>here.</span></h1><p className="hero-copy">Discover sales jobs that fit your ambition, from your first sales role to your next big move.</p><div className="hero-search"><span className="search-icon">⌕</span><input aria-label="Search jobs" placeholder="Account executive, SDR, sales manager" value={search} onChange={(event) => setSearch(event.target.value)} /><span className="search-divider" /><span className="location-icon">⌖</span><input aria-label="Location" placeholder="Anywhere" value={location} onChange={(event) => setLocation(event.target.value)} /><button onClick={() => document.getElementById("opportunities")?.scrollIntoView({ behavior: "smooth" })}>Find sales jobs <span>→</span></button></div><div className="hero-footnote"><span>✳ &nbsp; Sales roles for every stage of your career</span><span className="hero-footnote-right">No noise. Just good work.</span></div></div><div className="hero-decoration" aria-hidden="true"><div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" /><div className="hero-sun">h</div><div className="hero-note note-top">A better kind<br />of Monday <span>↗</span></div><div className="hero-note note-bottom"><i /> Your next chapter</div><div className="hero-spark spark-one">✳</div><div className="hero-spark spark-two">✳</div></div><div className="hero-bottom-rule"><span>MADE FOR WHAT’S NEXT</span><span>SCROLL TO EXPLORE ↓</span></div></section>
      <section className="trust-strip"><div className="trust-inner"><span>FOR SALES PEOPLE READY TO GROW</span><div className="trust-stat"><strong>{jobs.length ? `${jobs.length}+` : "A fresh start"}</strong><small>open opportunities</small></div><div className="trust-divider" /><div className="trust-stat"><strong>Every stage</strong><small>from SDR to sales leader</small></div><div className="trust-divider" /><div className="trust-stat"><strong>People first</strong><small>teams worth joining</small></div><span className="trust-star">✳</span></div></section>
      <section className="opportunities-section" id="opportunities"><div className="opportunities-inner"><div className="section-kicker"><span>01</span> YOUR NEXT SALES MOVE</div><div className="opportunities-heading"><div><h2>Find your next<br /><em>sales role.</em></h2></div><p>From SDR and account executive to sales leadership, find a role that fits your goals.</p></div><div className="jobs-toolbar"><div className="filter-pills">{filters.map((item) => <button key={item} onClick={() => setFilter(item)} className={filter === item ? "filter-pill selected" : "filter-pill"}>{item}</button>)}</div><span className="results-count">{loading ? "Finding roles…" : `${visibleJobs.length} ${visibleJobs.length === 1 ? "role" : "roles"}`}</span></div>
        {loading ? <div className="jobs-loading"><span className="loading-mark">H</span><p>Finding your next opportunity…</p></div> : visibleJobs.length === 0 ? <div className="board-empty"><div className="board-empty-icon">✳</div><h3>{jobs.length ? "No roles found this time." : "A good opportunity is on its way."}</h3><p>{jobs.length ? "Try a different search or select another category." : "We’re getting things ready. Check back soon, or let us know you're hiring."}</p>{jobs.length ? <button className="button button-light" onClick={() => { setSearch(""); setFilter("All roles"); }}>Clear filters</button> : <Link className="button button-dark" href="/workspace">I’m hiring <span>→</span></Link>}</div> : <div className="job-grid">{visibleJobs.map((job, index) => <article className={`job-card ${job.featured ? "featured-job-card" : ""}`} key={job.id} onClick={() => setSelected(job)}><div className="job-card-top"><div className={`job-company-icon ${colors[index % colors.length]}`}>{job.companyName.slice(0, 1).toUpperCase()}</div><span className="posted-label">{new Date(job.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>{job.featured && <span className="feature-badge">Featured</span>}<button className="save-job" aria-label="View role" onClick={(event) => { event.stopPropagation(); setSelected(job); }}>↗</button></div><div className="job-card-company">{job.companyName}</div><h3>{job.title}</h3><p className="job-card-description">{job.description}</p><div className="job-tags"><span>{job.location}</span><span>{typeLabels[job.employmentType] || job.employmentType}</span></div><div className="job-card-bottom"><span>{salaryLabel(job)}</span><button onClick={(event) => { event.stopPropagation(); setSelected(job); }}>Explore role <span>→</span></button></div></article>)}</div>}
        <div className="board-footer"><span>GOOD THINGS TAKE A LITTLE LOOKING.</span><span>HIRZO JOB BOARD &nbsp;·&nbsp; {new Date().getFullYear()}</span></div>
      </div></section>
      <section className="manifesto-section" id="why-hirzo"><div className="manifesto-inner"><div className="section-kicker"><span>02</span> A BETTER WAY TO FIND SALES WORK</div><div className="manifesto-content"><div><div className="manifesto-mark">h<span>✳</span></div><h2>The right sales role<br />can change your<br /><em>whole trajectory.</em></h2></div><div className="manifesto-aside"><p>We believe finding your next sales role shouldn&apos;t feel like work. Hirzo brings ambitious salespeople and great teams together.</p><Link href="/workspace" className="text-link">Build your team with us <span>↗</span></Link><div className="manifesto-scribble">A better fit<br />changes everything <span>✳</span></div></div></div></div></section>
      <footer className="public-footer"><div className="footer-inner"><Link className="brand" href="/"><Image src="/hirzologo.jpg" alt="Hirzo" width={90} height={52} className="brand-logo" /></Link><span>The next sales role starts here.</span><div><Link href="/workspace">Employer workspace ↗</Link><Link href="/backoffice">Backoffice</Link></div><small>© {new Date().getFullYear()} Hirzo. Made for what’s next.</small></div></footer>
      {selected && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) { setSelected(null); setApplying(false); setApplicationDone(false); } }}><section className="job-modal role-modal"><div className="modal-heading"><div className={`job-company-icon ${colors[Math.max(0, jobs.findIndex((job) => job.id === selected.id)) % colors.length]}`}>{selected.companyName.slice(0, 1).toUpperCase()}</div><button className="icon-button close-button" onClick={() => { setSelected(null); setApplying(false); setApplicationDone(false); }} aria-label="Close">×</button></div>{applicationDone ? <div className="application-success"><div className="board-empty-icon">✳</div><div className="eyebrow">APPLICATION RECEIVED</div><h2>You’re one step closer.</h2><p>Your application for {selected.title} has been sent. Good luck — we’re rooting for you.</p><button className="button button-dark" onClick={() => { setSelected(null); setApplying(false); setApplicationDone(false); }}>Back to opportunities <span>→</span></button></div> : applying ? <><div className="eyebrow">APPLYING TO {selected.companyName.toUpperCase()}</div><h2>{selected.title}</h2><form className="form-stack application-form" onSubmit={submitApplication} onInvalidCapture={(event) => { const target = event.target; if (target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) { const question = selected.qualificationQuestions?.find((item) => target.name === `qualification-${item.id}`); if (question) target.setCustomValidity(`${question.question} is required.`); } }} onChangeCapture={(event) => { const target = event.target; if (target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) target.setCustomValidity(""); }}><div className="form-row"><label>Your name<input name="candidateName" required minLength={2} placeholder="Alex Morgan" /></label><label>Email address<input name="candidateEmail" type="email" required placeholder="alex@email.com" /></label></div><label>Phone number <span className="optional-label">Optional</span><input name="candidatePhone" type="tel" placeholder="+44 7700 900000" /></label><label>CV link <span className="optional-label">Optional · public link</span><input name="cvUrl" type="url" placeholder="https://…" /></label><label>Attach your Word CV <span className="optional-label">Optional · .doc or .docx, max 4 MB</span><input name="cvFile" type="file" accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" /></label>{selected.qualificationQuestions?.map((question) => <label key={question.id}>{question.question}{question.required && <span className="required-label">Required</span>}{question.type === "multiple_choice" ? <select name={`qualification-${question.id}`} required={question.required} defaultValue=""><option value="" disabled>Select an answer</option>{question.options?.map((option) => <option key={option} value={option}>{option}</option>)}</select> : question.type === "yes_no" ? <select name={`qualification-${question.id}`} required={question.required} defaultValue=""><option value="" disabled>Select an answer</option><option value="Yes">Yes</option><option value="No">No</option></select> : <textarea name={`qualification-${question.id}`} required={question.required} rows={3} placeholder="Your answer" />}</label>)}{selected.videoQuestions?.map((question) => <label key={question.id}>{question.question} <span className="optional-label">Video link · up to {Math.floor(question.maxDurationSeconds / 60)} min</span><input name={`video-${question.id}`} type="url" required={question.required} placeholder="https://…" /></label>)}{applicationError && <p className="form-error">{applicationError}</p>}<div className="modal-actions"><button type="button" className="button button-light" onClick={() => { setApplying(false); setApplicationError(""); }}>Back to role</button><button className="button button-dark" type="submit">Send application <span>→</span></button></div></form></> : <><div className="eyebrow">{selected.companyName.toUpperCase()}</div><h2>{selected.title}</h2><div className="job-tags role-tags"><span>{selected.location}</span><span>{typeLabels[selected.employmentType] || selected.employmentType}</span><span>{salaryLabel(selected)}</span></div><div className="role-description">{selected.description.split("\n").filter(Boolean).map((line, index) => <p key={index}>{line}</p>)}</div><div className="modal-actions"><button className="button button-light" onClick={() => setSelected(null)}>Close</button><button className="button button-dark" onClick={() => { setApplying(true); setApplicationError(""); }}>Apply for this role <span>→</span></button></div></>}</section></div>}
    </main>
  );
}
