"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type MatchResult = {
  id: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone?: string;
  cvDownloadUrl?: string;
  status: string;
  appliedAt: string;
  score: number;
  breakdown: {
    skills: number;
    experience: number;
    qualifications: number;
    other: number;
  };
};

type MatchResultsResponse = {
  job: { id: string; title: string };
  matchResults: MatchResult[];
};

const scoreCategories: Array<[keyof MatchResult["breakdown"], string]> = [
  ["skills", "Skills"],
  ["experience", "Experience"],
  ["qualifications", "Qualifications"],
  ["other", "Responsibilities & other"],
] as const;

export default function ApplicantsPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const [data, setData] = useState<MatchResultsResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);

  const loadResults = useCallback(async () => {
    setError("");
    const response = await fetch(
      `/api/employers/jobs/${jobId}/match-results`,
    );
    const responseData = await response.json();
    if (!response.ok) {
      throw new Error(responseData.error || "Could not load match results.");
    }
    setData(responseData);
  }, [jobId]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await loadResults();
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load match results.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [loadResults]);

  async function recalculate() {
    setRecalculating(true);
    setError("");
    try {
      const response = await fetch(
        `/api/employers/jobs/${jobId}/match-results`,
        { method: "POST" },
      );
      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData.error || "Could not recalculate scores.");
      }
      await loadResults();
    } catch (recalculateError) {
      setError(
        recalculateError instanceof Error
          ? recalculateError.message
          : "Could not recalculate scores.",
      );
    } finally {
      setRecalculating(false);
    }
  }

  return (
    <main className="auth-shell match-results-shell">
      <div className="match-results-page">
        <Link className="back-link" href="/workspace">
          ← Back to workspace
        </Link>
        <header className="match-results-heading">
          <div>
            <div className="eyebrow">PREMIUM APPLICANT RANKING</div>
            <h1>{data?.job.title || "Applicant matches"}</h1>
            <p>
              Applicants are ranked by job requirements. Use scores as a
              decision-support tool, not as a substitute for human review.
            </p>
          </div>
          <button
            className="button button-dark"
            disabled={recalculating || loading}
            onClick={() => void recalculate()}
          >
            {recalculating ? "Recalculating…" : "Recalculate scores"}
          </button>
        </header>

        {error && <p className="form-error">{error}</p>}
        {loading ? (
          <p className="field-hint">Loading applicants…</p>
        ) : data?.matchResults.length ? (
          <section className="match-results-list" aria-label="Ranked applicants">
            {data.matchResults.map((applicant, index) => (
              <article className="match-result-card" key={applicant.id}>
                <div className="match-result-main">
                  <span className="match-rank">#{index + 1}</span>
                  <div>
                    <h2>{applicant.candidateName}</h2>
                    <a href={`mailto:${applicant.candidateEmail}`}>
                      {applicant.candidateEmail}
                    </a>
                    <div className="match-result-meta">
                      <span className={`status-pill ${applicant.status}`}>
                        {applicant.status}
                      </span>
                      {applicant.cvDownloadUrl && (
                        <a href={applicant.cvDownloadUrl}>Download private CV</a>
                      )}
                    </div>
                  </div>
                </div>
                <div className="match-score-block">
                  <strong>{applicant.score}%</strong>
                  <span>match</span>
                  <div
                    className="match-score-track"
                    role="meter"
                    aria-label={`${applicant.score}% job match`}
                    aria-valuenow={applicant.score}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <i style={{ width: `${applicant.score}%` }} />
                  </div>
                </div>
                <dl className="match-breakdown">
                  {scoreCategories.map(([key, label]) => (
                    <div key={key}>
                      <dt>{label}</dt>
                      <dd>
                        {applicant.breakdown[key]}%
                      </dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
          </section>
        ) : (
          !error && (
            <section className="empty-state match-results-empty">
              <h2>No applicants yet</h2>
              <p>Match scores will appear here as candidates apply.</p>
            </section>
          )
        )}
      </div>
    </main>
  );
}
