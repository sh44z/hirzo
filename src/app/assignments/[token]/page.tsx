"use client";

import Image from "next/image";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type {
  AssignmentQuestion,
} from "@/types";

type CandidateAssignment = {
  status: string;
  instructions: string;
  questions: AssignmentQuestion[];
  answers: Array<{ questionId: string; answer: string }>;
  startedAt?: string;
  deadline?: string;
  expiresAt: string;
  candidateName: string;
  companyName: string;
  companyLogo?: string;
  jobTitle: string;
};

const draftKey = (token: string) => `hirzo-assignment-draft:${token}`;

export default function CandidateAssignmentPage() {
  const { token } = useParams<{ token: string }>();
  const [assignment, setAssignment] = useState<CandidateAssignment | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [now, setNow] = useState(0);

  const loadAssignment = useCallback(async () => {
    try {
      const response = await fetch(`/api/assignments/${token}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load assignment.");
      const loaded = data.assignment as CandidateAssignment;
      setAssignment(loaded);
      if (loaded.status === "submitted" || loaded.status === "reviewed") {
        setSubmitted(true);
        try {
          window.localStorage.removeItem(draftKey(token));
        } catch (storageError) {
          console.warn("Could not clear the submitted assignment draft:", storageError);
        }
      } else {
        try {
          const draft = window.localStorage.getItem(draftKey(token));
          if (draft) {
            setAnswers(JSON.parse(draft) as Record<string, string>);
          }
        } catch (draftError) {
          console.warn("Could not restore the assignment draft:", draftError);
          setError("This browser could not restore a saved draft.");
        }
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Could not load assignment.",
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadAssignment(), 0);
    return () => window.clearTimeout(timer);
  }, [loadAssignment]);

  useEffect(() => {
    if (!assignment || submitted || assignment.status === "expired") return;
    try {
      window.localStorage.setItem(draftKey(token), JSON.stringify(answers));
    } catch (storageError) {
      console.warn("Could not save the assignment draft:", storageError);
      window.setTimeout(
        () => setError("Draft saving is unavailable in this browser."),
        0,
      );
    }
  }, [answers, assignment, submitted, token]);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => setNow(Date.now()), 0);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, []);

  async function submitAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!assignment) return;
    setSubmitting(true);
    setError("");
    const formData = new FormData();
    formData.set(
      "answers",
      JSON.stringify(
        assignment.questions
          .filter((question) => question.type !== "file_upload")
          .map((question) => ({
            questionId: question.id,
            answer: answers[question.id] || "",
          })),
      ),
    );
    for (const [questionId, file] of Object.entries(files)) {
      formData.set(`file:${questionId}`, file);
    }
    try {
      const response = await fetch(`/api/assignments/${token}`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not submit assignment.");
      try {
        window.localStorage.removeItem(draftKey(token));
      } catch (storageError) {
        console.warn("Could not clear the submitted assignment draft:", storageError);
      }
      setSubmitted(true);
      setAssignment({ ...assignment, status: data.status });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not submit assignment.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const expired =
    assignment?.status === "expired" ||
    (assignment?.expiresAt && new Date(assignment.expiresAt).getTime() <= now);
  const secondsRemaining = assignment?.expiresAt
    ? Math.max(0, Math.floor((new Date(assignment.expiresAt).getTime() - now) / 1000))
    : null;
  const remainingLabel =
    secondsRemaining === null
      ? ""
      : `${Math.floor(secondsRemaining / 3600)}h ${Math.floor((secondsRemaining % 3600) / 60)}m`;

  return (
    <main className="candidate-assignment-page">
      <div className="candidate-assignment-card">
        <header className="candidate-assignment-header">
          {assignment?.companyLogo ? (
            <Image
              src={assignment.companyLogo}
              alt={`${assignment.companyName} logo`}
              width={56}
              height={56}
              unoptimized
            />
          ) : (
            <span className="candidate-assignment-monogram">
              {assignment?.companyName.slice(0, 1) || "H"}
            </span>
          )}
          <div>
            <span className="eyebrow">{assignment?.companyName || "HIRZO"}</span>
            <h1>{assignment?.jobTitle || "Candidate assignment"}</h1>
          </div>
        </header>

        {loading ? (
          <p className="field-hint">Loading your assignment…</p>
        ) : error && !assignment ? (
          <section className="assignment-message">
            <h2>This link is unavailable</h2>
            <p>{error}</p>
          </section>
        ) : assignment && submitted ? (
          <section className="assignment-message">
            <span className="assignment-complete-icon">✓</span>
            <h2>Assignment submitted</h2>
            <p>
              Thanks, {assignment.candidateName}. Your responses have been
              received by {assignment.companyName}.
            </p>
          </section>
        ) : assignment && expired ? (
          <section className="assignment-message">
            <h2>This assignment has expired</h2>
            <p>Contact the employer if you need a new invitation.</p>
          </section>
        ) : assignment ? (
          <>
            <div className="candidate-assignment-intro">
              <p>
                Hello {assignment.candidateName}, complete the assessment for
                this role below. Your progress is automatically saved in this
                browser.
              </p>
              {assignment.instructions && (
                <div className="assignment-instructions">
                  <strong>Instructions</strong>
                  <p>{assignment.instructions}</p>
                </div>
              )}
              {assignment.deadline && (
                <div className="assignment-countdown" aria-live="polite">
                  Time remaining <strong>{remainingLabel}</strong>
                </div>
              )}
            </div>
            <form className="form-stack candidate-assignment-form" onSubmit={submitAssignment}>
              {assignment.questions.map((question) => (
                <label key={question.id}>
                  {question.question}
                  {question.required && <span className="required-mark"> *</span>}
                  {question.type === "long_text" ? (
                    <textarea
                      rows={6}
                      required={question.required}
                      maxLength={10000}
                      value={answers[question.id] || ""}
                      onChange={(event) =>
                        setAnswers((current) => ({
                          ...current,
                          [question.id]: event.target.value,
                        }))
                      }
                    />
                  ) : question.type === "multiple_choice" ? (
                    <select
                      required={question.required}
                      value={answers[question.id] || ""}
                      onChange={(event) =>
                        setAnswers((current) => ({
                          ...current,
                          [question.id]: event.target.value,
                        }))
                      }
                    >
                      <option value="">Select an answer</option>
                      {(question.options || []).map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : question.type === "file_upload" ? (
                    <>
                      <input
                        type="file"
                        required={question.required}
                        accept=".pdf,.zip,.docx,.pptx,.png,.jpg,.jpeg"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) {
                            setFiles((current) => ({
                              ...current,
                              [question.id]: file,
                            }));
                          }
                        }}
                      />
                      <span className="field-hint">
                        PDF, ZIP, DOCX, PPTX, PNG, or JPEG · up to 8 MB.
                        Selected files are not included in browser draft saving.
                      </span>
                    </>
                  ) : (
                    <input
                      type="url"
                      required={question.required}
                      value={answers[question.id] || ""}
                      onChange={(event) =>
                        setAnswers((current) => ({
                          ...current,
                          [question.id]: event.target.value,
                        }))
                      }
                      placeholder="https://"
                    />
                  )}
                </label>
              ))}
              {error && <p className="form-error">{error}</p>}
              <div className="candidate-assignment-submit">
                <span>Your draft stays in this browser until you submit.</span>
                <button className="button button-dark" disabled={submitting}>
                  {submitting ? "Submitting…" : "Submit assignment"}
                </button>
              </div>
            </form>
          </>
        ) : (
          <section className="assignment-message">
            <h2>Assignment unavailable</h2>
            <p>Please contact the employer for help.</p>
          </section>
        )}
      </div>
    </main>
  );
}
