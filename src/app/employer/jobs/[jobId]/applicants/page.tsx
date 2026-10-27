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
  hasScannedCv: boolean;
};

type MatchResultsResponse = {
  job: { id: string; title: string };
  matchResults: MatchResult[];
};

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
        throw new Error(responseData.error || "Could not refresh matches.");
      }
      await loadResults();
    } catch (recalculateError) {
      setError(
        recalculateError instanceof Error
          ? recalculateError.message
          : "Could not refresh matches.",
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
            <div className="eyebrow">APPLICANT MATCHES</div>
            <h1>{data?.job.title || "Applicant matches"}</h1>
            <p>
              CVs are checked for matching keywords and phrases from the job
              requirements and qualifications. Use this as a quick guide, not
              a substitute for reviewing each application.
            </p>
          </div>
          <button
            className="button button-dark"
            disabled={recalculating || loading}
            onClick={() => void recalculate()}
          >
            {recalculating ? "Refreshing…" : "Refresh matches"}
          </button>
        </header>

        {error && <p className="form-error">{error}</p>}
        {loading ? (
          <p className="field-hint">Loading applicants…</p>
        ) : data?.matchResults.length ? (
          <section className="match-results-list" aria-label="Applicant matches">
            {data.matchResults.map((applicant) => (
              <article className="match-result-card" key={applicant.id}>
                <div className="match-result-main">
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
                  <strong>
                    {!applicant.hasScannedCv
                      ? "CV not scanned"
                      : applicant.score < 60
                        ? "Not a good match"
                        : `${applicant.score}% Match`}
                  </strong>
                </div>
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
