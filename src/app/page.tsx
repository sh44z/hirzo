"use client";

import Link from "next/link";
import Image from "next/image";
import {
  ChangeEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Job = {
  id: string;
  companyId: string;
  title: string;
  description: string;
  location: string;
  employmentType: string;
  workplaceType: string;
  companyName: string;
  companyLogo?: string;
  salaryMin?: number;
  salaryMax?: number;
  currency: string;
  createdAt: string;
  featured?: boolean;
  requirements?: {
    skills?: string[];
    yearsExperience?: number;
    qualifications?: string[];
    responsibilities?: string[];
    otherRequirements?: string[];
  };
  qualificationQuestions?: Array<{
    id: string;
    question: string;
    required: boolean;
    type: string;
    options?: string[];
  }>;
};

const filters = [
  "All roles",
  "Full time",
  "Part time",
  "Contract",
  "Internship",
  "Temporary",
];
const typeLabels: Record<string, string> = {
  full_time: "Full time",
  part_time: "Part time",
  contract: "Contract",
  internship: "Internship",
  temporary: "Temporary",
};
const colors = ["mint", "lilac", "peach", "blue", "yellow"];
const MAX_SALARY_FILTER = 100_000;

function salaryLabel(job: Job) {
  if (!job.salaryMin && !job.salaryMax) return "Salary not listed";
  const currency = job.currency || "GBP";
  const format = (amount: number) =>
    new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  if (job.salaryMin && job.salaryMax) {
    return `${format(job.salaryMin)} – ${format(job.salaryMax)}`;
  }
  return job.salaryMin
    ? `${format(job.salaryMin)}+`
    : `Up to ${format(job.salaryMax!)}`;
}

function getRoleDetailsDescription(job: Job) {
  const details: string[] = [
    `Posted: ${new Date(job.createdAt).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })}`,
  ];
  if (job.featured) details.push("Featured role");

  const requirements = job.requirements;
  if (requirements?.yearsExperience) {
    details.push(`Minimum experience: ${requirements.yearsExperience} years`);
  }
  const requirementGroups = [
    ["Skills", requirements?.skills],
    ["Qualifications", requirements?.qualifications],
    ["Responsibilities", requirements?.responsibilities],
    ["Other requirements", requirements?.otherRequirements],
  ] as const;
  for (const [label, items] of requirementGroups) {
    if (items?.length) details.push(`${label}:`, ...items.map((item) => `- ${item}`));
  }
  if (job.qualificationQuestions?.length) {
    details.push(
      "Application questions:",
      ...job.qualificationQuestions.map((question) => `- ${question.question}`),
    );
  }
  return `${job.description}\n\nRole details\n${details.join("\n")}`;
}

export default function Home() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("");
  const [filter, setFilter] = useState("All roles");
  const [workplaceFilter, setWorkplaceFilter] = useState("any");
  const [salaryRange, setSalaryRange] = useState<[number, number]>([
    0,
    MAX_SALARY_FILTER,
  ]);
  const [selected, setSelectedState] = useState<Job | null>(null);
  const [applying, setApplying] = useState(false);
  const [applicationDone, setApplicationDone] = useState(false);
  const [applicationError, setApplicationError] = useState("");
  const [qualificationMismatches, setQualificationMismatches] = useState<
    string[]
  >([]);
  const [confirmQualificationMismatch, setConfirmQualificationMismatch] =
    useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cvParsing, setCvParsing] = useState(false);
  const [cvParseNotice, setCvParseNotice] = useState("");
  const candidateNameRef = useRef<HTMLInputElement>(null);
  const candidateEmailRef = useRef<HTMLInputElement>(null);
  const candidatePhoneRef = useRef<HTMLInputElement>(null);

  function setSelected(job: Job | null) {
    setSelectedState(
      job ? { ...job, description: getRoleDetailsDescription(job) } : null,
    );
    setQualificationMismatches([]);
    setConfirmQualificationMismatch(false);
    setApplicationError("");
  }

  useEffect(() => {
    fetch("/api/jobs/public")
      .then((response) =>
        response.ok ? response.json() : Promise.reject(new Error("Could not load jobs.")),
      )
      .then((data) => {
        const availableJobs: Job[] = data.jobs || [];
        setJobs(availableJobs);

        const sharedJobId = new URLSearchParams(window.location.search).get(
          "job",
        );
        const sharedJob = availableJobs.find((job) => job.id === sharedJobId);
        if (sharedJob) {
          setSelected(sharedJob);
          window.history.replaceState(
            {},
            "",
            `${window.location.pathname}${window.location.hash}`,
          );
        }
      })
      .catch(() => setJobs([]))
      .finally(() => setLoading(false));
  }, []);

  const featuredJobs = useMemo(() => {
    const term = search.trim().toLowerCase();
    const place = location.trim().toLowerCase();
    return jobs.filter(
      (job) =>
        job.featured &&
        (!term ||
          [
            job.title,
            job.companyName,
            job.location,
            job.description,
            ...(job.requirements?.skills || []),
            ...(job.requirements?.qualifications || []),
          ].some(
            (value) => value.toLowerCase().includes(term),
          )) &&
        (!place || job.location.toLowerCase().includes(place)),
    );
  }, [jobs, search, location]);

  const visibleJobs = useMemo(
    () =>
      jobs.filter((job) => {
        const term = search.trim().toLowerCase();
        const matchesTerm =
          !term ||
          [
            job.title,
            job.companyName,
            job.location,
            job.description,
            ...(job.requirements?.skills || []),
            ...(job.requirements?.qualifications || []),
          ].some(
            (value) => value.toLowerCase().includes(term),
          );
        const matchesLocation =
          !location.trim() ||
          job.location.toLowerCase().includes(location.trim().toLowerCase());
        const matchesFilter =
          filter === "All roles" ||
          typeLabels[job.employmentType] === filter;
        const matchesWorkplace =
          workplaceFilter === "any" || job.workplaceType === workplaceFilter;
        const [minimumSalary, maximumSalary] = salaryRange;
        const salarySpecified =
          job.salaryMin !== undefined || job.salaryMax !== undefined;
        const matchesSalary =
          (minimumSalary === 0 && maximumSalary === MAX_SALARY_FILTER) ||
          (salarySpecified &&
            (minimumSalary === 0 ||
              (job.salaryMax ?? job.salaryMin ?? 0) >= minimumSalary) &&
            (maximumSalary === MAX_SALARY_FILTER ||
              (job.salaryMin ?? job.salaryMax ?? Infinity) <= maximumSalary));
        return (
          matchesTerm &&
          matchesLocation &&
          matchesFilter &&
          matchesWorkplace &&
          matchesSalary
        );
      }),
    [jobs, search, location, filter, workplaceFilter, salaryRange],
  );

  const searchSuggestions = useMemo(
    () =>
      [...new Set(
        jobs.flatMap((job) => [
          job.title,
          ...(job.requirements?.skills || []),
        ]),
      )].slice(0, 100),
    [jobs],
  );

  async function parseCv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setCvParseNotice("");
    if (!file) return;
    setCvParsing(true);
    try {
      const formData = new FormData();
      formData.set("cvFile", file);
      const response = await fetch("/api/applications/parse-cv", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not read your CV.");
      const contact = data.contact as {
        candidateName: string;
        candidateEmail: string;
        candidatePhone: string;
      };
      if (candidateNameRef.current && !candidateNameRef.current.value.trim()) {
        candidateNameRef.current.value = contact.candidateName;
      }
      if (candidateEmailRef.current && !candidateEmailRef.current.value.trim()) {
        candidateEmailRef.current.value = contact.candidateEmail;
      }
      if (candidatePhoneRef.current && !candidatePhoneRef.current.value.trim()) {
        candidatePhoneRef.current.value = contact.candidatePhone;
      }
      setCvParseNotice(
        contact.candidateName || contact.candidateEmail || contact.candidatePhone
          ? "We found some contact details. Please check them before applying."
          : "CV added. We couldn’t find contact details, so please enter them below.",
      );
    } catch (parseError) {
      setCvParseNotice(
        parseError instanceof Error
          ? parseError.message
          : "Could not read your CV. Please enter your details below.",
      );
    } finally {
      setCvParsing(false);
    }
  }

  async function submitApplication(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setApplicationError("");
    setSubmitting(true);
    try {
      const form = new FormData(event.currentTarget);
      const qualificationAnswers = selected.qualificationQuestions
        ?.map((question) => ({
          questionId: question.id,
          answer: String(form.get(`qualification-${question.id}`) || ""),
        }))
        .filter((answer) => answer.answer);
      const formData = new FormData();
      formData.set("jobId", selected.id);
      formData.set("candidateName", String(form.get("candidateName") || ""));
      formData.set("candidateEmail", String(form.get("candidateEmail") || ""));
      const candidatePhone = String(form.get("candidatePhone") || "");
      const cvUrl = String(form.get("cvUrl") || "");
      if (candidatePhone) formData.set("candidatePhone", candidatePhone);
      if (cvUrl) formData.set("cvUrl", cvUrl);
      formData.set("qualificationAnswers", JSON.stringify(qualificationAnswers));
      formData.set("videoAnswers", "[]");
      formData.set(
        "confirmQualificationMismatch",
        String(form.get("confirmQualificationMismatch") === "on"),
      );
      const cvFile = form.get("cvFile");
      if (cvFile instanceof File && cvFile.size > 0) {
        formData.set("cvFile", cvFile);
      }

      const response = await fetch("/api/applications", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (
        response.status === 409 &&
        Array.isArray(data.qualificationMismatches)
      ) {
        setQualificationMismatches(data.qualificationMismatches);
        setConfirmQualificationMismatch(false);
        return;
      }
      if (!response.ok) {
        setApplicationError(data.error || "We could not submit your application.");
        return;
      }
      setApplicationDone(true);
    } catch {
      setApplicationError("We could not submit your application. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="public-site">
      <nav className="public-nav">
        <div className="nav-inner">
          <Link className="brand" href="/">
            <Image
              src="/hirzologo.jpg"
              alt="Hirzo"
              width={90}
              height={52}
              unoptimized
              className="brand-logo"
            />
          </Link>
          <div className="nav-center">
            <a href="#opportunities">Find jobs</a>
            <Link href="/employers">For employers</Link>
          </div>
          <div className="nav-actions">
            <Link href="/workspace" className="button button-dark nav-cta">
              Post a job <span>↗</span>
            </Link>
          </div>
        </div>
      </nav>

      <section className="hero-section">
        <div className="hero-grid-lines" />
        <div className="hero-content">
          <div className="hero-tag">
            <span className="hero-tag-dot" /> YOUR FIRST SALES ROLE STARTS HERE
          </div>
          <h1>
            Your first
            <br />
            sales role <span>starts here.</span>
          </h1>
          <p className="hero-copy">
            Find entry-level SDR and sales executive roles for fresh graduates
            and people starting their sales careers.
          </p>
          <div className="hero-audience-grid">
            <article className="hero-audience-card">
              <span className="eyebrow">FOR JOB SEEKERS</span>
              <p>Explore first sales roles, built for fresh graduates and new starters.</p>
              <a href="#opportunities">Browse jobs <span>→</span></a>
            </article>
            <article className="hero-audience-card employer-audience-card">
              <span className="eyebrow">FOR EMPLOYERS</span>
              <p>Looking for fresh graduate sales talent? Find out how Hirzo can help.</p>
              <Link href="/employers">Explore employer services <span>→</span></Link>
            </article>
          </div>
          <div className="hero-search">
            <span className="search-icon">⌕</span>
            <input
              aria-label="Search jobs"
              list="job-search-suggestions"
              placeholder="Search roles, companies, or skills"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <datalist id="job-search-suggestions">
              {searchSuggestions.map((suggestion) => (
                <option key={suggestion} value={suggestion} />
              ))}
            </datalist>
            <span className="search-divider" />
            <span className="location-icon">⌖</span>
            <input
              aria-label="Location"
              placeholder="Anywhere"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
            />
            <button
              onClick={() =>
                document
                  .getElementById("opportunities")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Find a role <span>→</span>
            </button>
          </div>
          <div className="hero-footnote">
            <span>✳ &nbsp; Opportunities for what’s next</span>
            <span className="hero-footnote-right">No noise. Just good work.</span>
          </div>
        </div>
        <div className="hero-decoration" aria-hidden="true">
          <div className="hero-orbit orbit-one" />
          <div className="hero-orbit orbit-two" />
          <div className="hero-sun">h</div>
          <div className="hero-note note-top">
            A better kind
            <br />
            of Monday <span>↗</span>
          </div>
          <div className="hero-note note-bottom">
            <i /> Your next chapter
          </div>
          <div className="hero-spark spark-one">✳</div>
          <div className="hero-spark spark-two">✳</div>
        </div>
        <div className="hero-bottom-rule">
          <span>MADE FOR WHAT’S NEXT</span>
          <span>SCROLL TO EXPLORE ↓</span>
        </div>
      </section>

      <section className="trust-strip">
        <div className="trust-inner">
          <span>FOR PEOPLE READY TO GROW</span>
          <div className="trust-stat">
            <strong>{jobs.length ? `${jobs.length}+` : "A fresh start"}</strong>
            <small>open opportunities</small>
          </div>
          <div className="trust-divider" />
          <div className="trust-stat">
            <strong>Fresh starts</strong>
            <small>entry-level sales roles for new graduates</small>
          </div>
          <div className="trust-divider" />
          <div className="trust-stat">
            <strong>People first</strong>
            <small>teams worth joining</small>
          </div>
          <span className="trust-star">✳</span>
        </div>
      </section>

      {!loading && featuredJobs.length > 0 && (
        <section className="featured-section" aria-labelledby="featured-heading">
          <div className="featured-inner">
            <div className="section-kicker">
              <span>✳</span> HAND-PICKED OPPORTUNITIES
            </div>
            <div className="featured-heading">
              <div>
                <h2 id="featured-heading">Featured roles</h2>
                <p>Standout opportunities, brought to the top.</p>
              </div>
              <a href="#opportunities" className="text-link">
                Browse all roles ↓
              </a>
            </div>
            <div className="featured-grid">
              {featuredJobs.slice(0, 3).map((job, index) => (
                <article
                  className="featured-card"
                  key={job.id}
                  onClick={() => setSelected(job)}
                >
                  <div className="featured-card-top">
                    {job.companyLogo ? (
                      <Image
                        className="job-company-logo"
                        src={job.companyLogo}
                        alt={`${job.companyName} logo`}
                        width={38}
                        height={38}
                        unoptimized
                      />
                    ) : (
                      <div className={`job-company-icon ${colors[index % colors.length]}`}>
                        {job.companyName.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <span className="feature-badge">Featured</span>
                  </div>
                  <Link
                    className="job-card-company company-name-link"
                    href={`/companies/${job.companyId}`}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {job.companyName}
                  </Link>
                  <h3>{job.title}</h3>
                  <div className="job-tags">
                    <span>{job.location}</span>
                    <span>{typeLabels[job.employmentType] || job.employmentType}</span>
                  </div>
                  <div className="job-card-bottom">
                    <span>{salaryLabel(job)}</span>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelected(job);
                      }}
                    >
                      Explore role <span>→</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="opportunities-section" id="opportunities">
        <div className="opportunities-inner">
          <div className="section-kicker">
            <span>01</span> YOUR NEXT SALES MOVE
          </div>
          <div className="opportunities-heading">
            <div>
              <h2>
                Find your first
                <br />
                <em>sales role.</em>
              </h2>
            </div>
            <p>
              Explore SDR and sales executive opportunities for fresh
              graduates and entry-level candidates.
            </p>
          </div>
          <div className="jobs-toolbar">
            <div className="filter-pills">
              {filters.map((item) => (
                <button
                  key={item}
                  onClick={() => setFilter(item)}
                  className={
                    filter === item ? "filter-pill selected" : "filter-pill"
                  }
                >
                  {item}
                </button>
              ))}
            </div>
            <span className="results-count">
              {loading
                ? "Finding roles…"
                : `${visibleJobs.length} ${visibleJobs.length === 1 ? "role" : "roles"}`}
            </span>
          </div>
          <div className="advanced-filter-bar">
            <label>
              Workplace
              <select
                aria-label="Filter by workplace"
                value={workplaceFilter}
                onChange={(event) => setWorkplaceFilter(event.target.value)}
              >
                <option value="any">Any workplace</option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="onsite">On-site</option>
              </select>
            </label>
            <fieldset className="salary-range-filter">
              <legend>Salary range</legend>
              <div className="salary-range-values">
                <span>{salaryRange[0] ? `£${Math.round(salaryRange[0] / 1000)}k` : "Any"}</span>
                <span>{salaryRange[1] === MAX_SALARY_FILTER ? "£100k+" : `£${Math.round(salaryRange[1] / 1000)}k`}</span>
              </div>
              <label>
                <span className="sr-only">Minimum salary</span>
                <input
                  type="range"
                  min="0"
                  max={MAX_SALARY_FILTER}
                  step="5000"
                  value={salaryRange[0]}
                  onChange={(event) =>
                    setSalaryRange((range) => [
                      Math.min(Number(event.target.value), range[1]),
                      range[1],
                    ])
                  }
                />
              </label>
              <label>
                <span className="sr-only">Maximum salary</span>
                <input
                  type="range"
                  min="0"
                  max={MAX_SALARY_FILTER}
                  step="5000"
                  value={salaryRange[1]}
                  onChange={(event) =>
                    setSalaryRange((range) => [
                      range[0],
                      Math.max(Number(event.target.value), range[0]),
                    ])
                  }
                />
              </label>
            </fieldset>
          </div>
          {loading ? (
            <div className="job-grid skeleton-grid" aria-label="Loading jobs">
              {Array.from({ length: 6 }, (_, index) => (
                <div className="job-skeleton-card" key={index} aria-hidden="true">
                  <div className="skeleton skeleton-logo" />
                  <div className="skeleton skeleton-company" />
                  <div className="skeleton skeleton-title" />
                  <div className="skeleton skeleton-copy" />
                  <div className="skeleton skeleton-copy short" />
                  <div className="skeleton skeleton-footer" />
                </div>
              ))}
            </div>
          ) : visibleJobs.length === 0 ? (
            <div className="board-empty">
              <div className="board-empty-icon">✳</div>
              <h3>{jobs.length ? "No roles found this time." : "A good opportunity is on its way."}</h3>
              <p>
                {jobs.length
                  ? "Try a different search or select another category."
                  : "We’re getting things ready. Check back soon, or let us know you're hiring."}
              </p>
              {jobs.length ? (
                <button
                  className="button button-light"
                  onClick={() => {
                    setSearch("");
                    setLocation("");
                    setFilter("All roles");
                    setWorkplaceFilter("any");
                    setSalaryRange([0, MAX_SALARY_FILTER]);
                  }}
                >
                  Clear filters
                </button>
              ) : (
                <Link className="button button-dark" href="/workspace">
                  I’m hiring <span>→</span>
                </Link>
              )}
            </div>
          ) : (
            <div className="job-grid">
              {visibleJobs.map((job, index) => (
                <article
                  className={`job-card ${job.featured ? "featured-job-card" : ""}`}
                  key={job.id}
                  onClick={() => setSelected(job)}
                >
                  <div className="job-card-top">
                    {job.companyLogo ? (
                      <Image
                        className="job-company-logo"
                        src={job.companyLogo}
                        alt={`${job.companyName} logo`}
                        width={38}
                        height={38}
                        unoptimized
                      />
                    ) : (
                      <div className={`job-company-icon ${colors[index % colors.length]}`}>
                        {job.companyName.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <span className="posted-label">
                      {new Date(job.createdAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                    {job.featured && <span className="feature-badge">Featured</span>}
                    <button
                      className="save-job"
                      aria-label="View role"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelected(job);
                      }}
                    >
                      ↗
                    </button>
                  </div>
                  <Link
                    className="job-card-company company-name-link"
                    href={`/companies/${job.companyId}`}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {job.companyName}
                  </Link>
                  <h3>{job.title}</h3>
                  <p className="job-card-description">{job.description}</p>
                  <div className="job-tags">
                    <span>{job.location}</span>
                    <span>{typeLabels[job.employmentType] || job.employmentType}</span>
                    <span>
                      {job.workplaceType === "remote"
                        ? "Remote"
                        : job.workplaceType === "hybrid"
                          ? "Hybrid"
                          : "On-site"}
                    </span>
                  </div>
                  <div className="job-card-bottom">
                    <span>{salaryLabel(job)}</span>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelected(job);
                      }}
                    >
                      Explore role <span>→</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
          <div className="board-footer">
            <span>GOOD THINGS TAKE A LITTLE LOOKING.</span>
            <span>HIRZO JOB BOARD &nbsp;·&nbsp; {new Date().getFullYear()}</span>
          </div>
        </div>
      </section>

      <footer className="public-footer">
        <div className="footer-inner">
          <Link className="brand" href="/">
            <Image
              src="/hirzologo.jpg"
              alt="Hirzo"
              width={90}
              height={52}
              unoptimized
              className="brand-logo"
            />
          </Link>
          <span>Your next great role starts here.</span>
          <div>
            <Link href="/employers">For employers ↗</Link>
            <Link href="/workspace">Employer workspace ↗</Link>
          </div>
          <small>© {new Date().getFullYear()} Hirzo. Made for what’s next.</small>
        </div>
      </footer>

      {selected && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelected(null);
              setApplying(false);
              setApplicationDone(false);
            }
          }}
        >
          <section className="job-modal role-modal">
            <div className="modal-heading">
              <div
                className={`job-company-icon ${colors[Math.max(0, jobs.findIndex((job) => job.id === selected.id)) % colors.length]}`}
              >
                {selected.companyName.slice(0, 1).toUpperCase()}
              </div>
              <button
                className="icon-button close-button"
                onClick={() => {
                  setSelected(null);
                  setApplying(false);
                  setApplicationDone(false);
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            {applicationDone ? (
              <div className="application-success">
                <div className="board-empty-icon">✳</div>
                <div className="eyebrow">APPLICATION RECEIVED</div>
                <h2>You’re one step closer.</h2>
                <p>
                  Your application for {selected.title} has been sent. Good luck
                  — we’re rooting for you.
                </p>
                <button
                  className="button button-dark"
                  onClick={() => {
                    setSelected(null);
                    setApplying(false);
                    setApplicationDone(false);
                  }}
                >
                  Back to opportunities <span>→</span>
                </button>
              </div>
            ) : applying ? (
              <>
                <div className="eyebrow">
                  APPLYING TO {selected.companyName.toUpperCase()}
                </div>
                <h2>{selected.title}</h2>
                <form
                  className="form-stack application-form"
                  onSubmit={submitApplication}
                  onInvalidCapture={(event) => {
                    const target = event.target;
                    if (
                      target instanceof HTMLSelectElement ||
                      target instanceof HTMLTextAreaElement
                    ) {
                      const question = selected.qualificationQuestions?.find(
                        (item) =>
                          target.name === `qualification-${item.id}`,
                      );
                      if (question) {
                        target.setCustomValidity(`${question.question} is required.`);
                      }
                    }
                  }}
                  onChangeCapture={(event) => {
                    const target = event.target;
                    if (
                      target instanceof HTMLSelectElement ||
                      target instanceof HTMLTextAreaElement
                    ) {
                      target.setCustomValidity("");
                    }
                    if (
                      target instanceof HTMLInputElement ||
                      target instanceof HTMLSelectElement ||
                      target instanceof HTMLTextAreaElement
                    ) {
                      if (target.name.startsWith("qualification-")) {
                        setQualificationMismatches([]);
                        setConfirmQualificationMismatch(false);
                      }
                    }
                  }}
                >
                  <div className="form-row">
                    <label>
                      Your name
                      <input
                        name="candidateName"
                        ref={candidateNameRef}
                        required
                        minLength={2}
                        placeholder="Alex Morgan"
                      />
                    </label>
                    <label>
                      Email address
                      <input
                        name="candidateEmail"
                        ref={candidateEmailRef}
                        type="email"
                        required
                        placeholder="alex@email.com"
                      />
                    </label>
                  </div>
                  <label>
                    Phone number <span className="optional-label">Optional</span>
                    <input
                      name="candidatePhone"
                      ref={candidatePhoneRef}
                      type="tel"
                      placeholder="+44 7700 900000"
                    />
                  </label>
                  <label>
                    CV link <span className="optional-label">Optional · public link</span>
                    <input name="cvUrl" type="url" placeholder="https://…" />
                  </label>
                  <label>
                    Upload your CV{" "}
                    <span className="optional-label">Word document · .doc or .docx · max 4 MB</span>
                    <input
                      name="cvFile"
                      type="file"
                      accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={(event) => void parseCv(event)}
                    />
                  </label>
                  {cvParsing && (
                    <p className="cv-parse-status" role="status">
                      Reading your CV and looking for contact details…
                    </p>
                  )}
                  {cvParseNotice && (
                    <p
                      className={cvParseNotice.startsWith("Could not") ? "form-error" : "cv-parse-status"}
                      role="status"
                    >
                      {cvParseNotice}
                    </p>
                  )}
                  {selected.qualificationQuestions?.map((question) => (
                    <label key={question.id}>
                      <span className="application-question-title">
                        {question.question}
                        {question.required && (
                          <span className="required-label">Required</span>
                        )}
                      </span>
                      {question.type === "multiple_choice" ? (
                        <select
                          name={`qualification-${question.id}`}
                          required={question.required}
                          defaultValue=""
                        >
                          <option value="" disabled>
                            Select an answer
                          </option>
                          {question.options?.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : question.type === "yes_no" ? (
                        <select
                          name={`qualification-${question.id}`}
                          required={question.required}
                          defaultValue=""
                        >
                          <option value="" disabled>
                            Select an answer
                          </option>
                          <option value="Yes">Yes</option>
                          <option value="No">No</option>
                        </select>
                      ) : (
                        <textarea
                          name={`qualification-${question.id}`}
                          required={question.required}
                          rows={3}
                          placeholder="Your answer"
                        />
                      )}
                    </label>
                  ))}
                  {qualificationMismatches.length > 0 && (
                    <div className="qualification-warning" role="alert">
                      <strong>
                        Your answers may not meet the employer&apos;s
                        requirements.
                      </strong>
                      <p>
                        Consider whether this role is right for you before
                        applying. Answers that do not match:
                      </p>
                      <ul>
                        {qualificationMismatches.map((question) => (
                          <li key={question}>{question}</li>
                        ))}
                      </ul>
                      <label className="qualification-confirm">
                        <input
                          type="checkbox"
                          name="confirmQualificationMismatch"
                          checked={confirmQualificationMismatch}
                          onChange={(event) =>
                            setConfirmQualificationMismatch(
                              event.target.checked,
                            )
                          }
                        />
                        I understand and still want to apply
                      </label>
                    </div>
                  )}
                  {applicationError && (
                    <p className="form-error">{applicationError}</p>
                  )}
                  <div className="modal-actions">
                    <button
                      type="button"
                      className="button button-light"
                      onClick={() => {
                        setApplying(false);
                        setApplicationError("");
                        setQualificationMismatches([]);
                        setConfirmQualificationMismatch(false);
                      }}
                    >
                      Back to role
                    </button>
                    <button
                      className="button button-dark"
                      type="submit"
                      disabled={
                        submitting ||
                        (qualificationMismatches.length > 0 &&
                          !confirmQualificationMismatch)
                      }
                    >
                      {submitting
                        ? "Submitting…"
                        : qualificationMismatches.length > 0
                          ? "Continue anyway"
                          : "Send application"}{" "}
                      <span>→</span>
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <Link
                  className="eyebrow role-company-link"
                  href={`/companies/${selected.companyId}`}
                  onClick={() => setSelected(null)}
                >
                  {selected.companyName.toUpperCase()} · VIEW COMPANY
                </Link>
                <h2>{selected.title}</h2>
                <div className="job-tags role-tags">
                  <span>{selected.location}</span>
                  <span>
                    {typeLabels[selected.employmentType] || selected.employmentType}
                  </span>
                  <span>{salaryLabel(selected)}</span>
                  <span>{selected.workplaceType === "remote" ? "Remote" : selected.workplaceType === "hybrid" ? "Hybrid" : "On-site"}</span>
                </div>
                <div className="role-description">
                  {selected.description
                    .split("\n")
                    .filter(Boolean)
                    .map((line, index) => (
                      <p key={index}>{line}</p>
                    ))}
                </div>
                <div className="modal-actions">
                  <button
                    className="button button-light"
                    onClick={() => setSelected(null)}
                  >
                    Close
                  </button>
                  <button
                    className="button button-dark"
                    onClick={() => {
                      setApplying(true);
                      setApplicationError("");
                    }}
                  >
                    Apply for this role <span>→</span>
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
