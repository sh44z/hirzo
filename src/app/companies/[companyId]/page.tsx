"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type CompanyProfile = {
  company: {
    id: string;
    name: string;
    logo?: string;
    description: string;
    culture: string;
    benefits: string[];
  };
  jobs: Array<{
    id: string;
    title: string;
    description: string;
    location: string;
    employmentType: string;
    workplaceType: string;
    salaryMin?: number;
    salaryMax?: number;
    currency: string;
  }>;
};

const employmentLabels: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  internship: "Internship",
  temporary: "Temporary",
};

export default function CompanyPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch(`/api/companies/${companyId}`);
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || "Could not load company profile.");
          }
          if (active) setProfile(data);
        } catch (loadError) {
          if (active) {
            setError(
              loadError instanceof Error
                ? loadError.message
                : "Could not load company profile.",
            );
          }
        }
      })();
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [companyId]);

  return (
    <main className="public-site company-page">
      <nav className="public-nav">
        <div className="nav-inner">
          <Link className="brand" href="/">
            <Image src="/hirzologo.jpg" alt="Hirzo" width={90} height={52} unoptimized className="brand-logo" />
          </Link>
          <Link className="nav-employer-link" href="/#opportunities">Browse all jobs</Link>
        </div>
      </nav>
      {error ? (
        <section className="company-not-found">
          <h1>Company profile unavailable</h1>
          <p>{error}</p>
          <Link className="button button-dark" href="/">Back to Hirzo</Link>
        </section>
      ) : !profile ? (
        <section className="company-profile-shell" aria-label="Loading company profile">
          <div className="skeleton company-skeleton" />
          <div className="skeleton company-skeleton" />
        </section>
      ) : (
        <div className="company-profile-shell">
          <section className="company-profile-hero">
            <div className="company-profile-brand">
              {profile.company.logo ? (
                <Image src={profile.company.logo} alt={`${profile.company.name} logo`} width={72} height={72} unoptimized />
              ) : (
                <span>{profile.company.name.slice(0, 1).toUpperCase()}</span>
              )}
            </div>
            <div>
              <div className="eyebrow">COMPANY PROFILE</div>
              <h1>{profile.company.name}</h1>
              <p>{profile.jobs.length} open {profile.jobs.length === 1 ? "role" : "roles"} on Hirzo</p>
            </div>
          </section>
          <div className="company-profile-grid">
            <div className="company-profile-details">
              <section className="company-profile-panel">
                <div className="eyebrow">ABOUT THE COMPANY</div>
                <h2>Get to know {profile.company.name}</h2>
                <p>{profile.company.description || "This company hasn’t added an introduction yet. Explore their open roles to learn more about the team and its work."}</p>
              </section>
              <section className="company-profile-panel">
                <div className="eyebrow">CULTURE & WORKING HERE</div>
                <h2>What it’s like to work here</h2>
                <p>{profile.company.culture || "More details about the team’s culture will be added by the employer."}</p>
                {profile.company.benefits.length > 0 && (
                  <ul className="company-benefits">
                    {profile.company.benefits.map((benefit) => <li key={benefit}>{benefit}</li>)}
                  </ul>
                )}
              </section>
            </div>
            <section className="company-openings">
              <div className="eyebrow">OPEN OPPORTUNITIES</div>
              <h2>Join the team</h2>
              {profile.jobs.length ? (
                <div className="company-opening-list">
                  {profile.jobs.map((job) => (
                    <Link
                      className="company-opening-card"
                      href={`/?job=${encodeURIComponent(job.id)}#opportunities`}
                      key={job.id}
                    >
                      <strong>{job.title}</strong>
                      <span>{job.location} · {employmentLabels[job.employmentType] || job.employmentType}</span>
                      <span className="company-opening-arrow">View role →</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="field-hint">There are no open roles at the moment.</p>
              )}
            </section>
          </div>
        </div>
      )}
    </main>
  );
}
