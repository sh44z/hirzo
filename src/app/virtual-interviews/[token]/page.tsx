"use client";

import Image from "next/image";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import type { VirtualInterviewQuestion } from "@/types";

type CandidateInterview = {
  status: "invited" | "submitted";
  candidateName: string;
  companyName: string;
  companyLogo?: string;
  jobTitle: string;
  questions: VirtualInterviewQuestion[];
  expiresAt: string;
};

const MAX_VIDEO_BYTES = 30 * 1024 * 1024;
const VIDEO_CHUNK_BYTES = 3 * 1024 * 1024;

export default function CandidateVirtualInterviewPage() {
  const { token } = useParams<{ token: string }>();
  const [interview, setInterview] = useState<CandidateInterview | null>(null);
  const [recordings, setRecordings] = useState<Record<string, Blob>>({});
  const [recordingQuestionId, setRecordingQuestionId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(0);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const mediaStream = useRef<MediaStream | null>(null);
  const recordingTimer = useRef<number | null>(null);
  const previewUrls = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(recordings).map(([questionId, blob]) => [
          questionId,
          URL.createObjectURL(blob),
        ]),
      ),
    [recordings],
  );

  const loadInterview = useCallback(async () => {
    try {
      const response = await fetch(`/api/virtual-interviews/${token}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load interview.");
      setInterview(data.interview as CandidateInterview);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Could not load interview.",
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadInterview(), 0);
    return () => window.clearTimeout(timer);
  }, [loadInterview]);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => setNow(Date.now()), 0);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(
    () => () => {
      if (recordingTimer.current !== null) {
        window.clearTimeout(recordingTimer.current);
      }
      mediaStream.current?.getTracks().forEach((track) => track.stop());
      Object.values(previewUrls).forEach((url) => URL.revokeObjectURL(url));
    },
    [previewUrls],
  );

  async function startRecording(question: VirtualInterviewQuestion) {
    setError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        throw new Error("This browser does not support video recording.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { facingMode: "user" },
      });
      mediaStream.current = stream;
      const mimeType = ["video/webm;codecs=vp9,opus", "video/webm", "video/mp4"].find(
        (type) => MediaRecorder.isTypeSupported(type),
      );
      if (!mimeType) throw new Error("This browser cannot record a supported video format.");
      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorder.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onerror = () => setError("The video recording could not be completed.");
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: recorder.mimeType });
        if (!blob.size) {
          setError("The video recording was empty. Please try again.");
        } else if (blob.size > MAX_VIDEO_BYTES) {
          setError("This video is larger than 30 MB. Please record a shorter answer.");
        } else {
          setRecordings((current) => ({ ...current, [question.id]: blob }));
        }
        stream.getTracks().forEach((track) => track.stop());
        mediaStream.current = null;
        mediaRecorder.current = null;
        setRecordingQuestionId("");
      };
      recorder.start();
      setRecordingQuestionId(question.id);
      recordingTimer.current = window.setTimeout(
        () => recorder.stop(),
        question.maxDurationSeconds * 1000,
      );
    } catch (recordingError) {
      mediaStream.current?.getTracks().forEach((track) => track.stop());
      mediaStream.current = null;
      setRecordingQuestionId("");
      setError(
        recordingError instanceof Error
          ? recordingError.message
          : "Could not start video recording.",
      );
    }
  }

  function stopRecording() {
    if (recordingTimer.current !== null) {
      window.clearTimeout(recordingTimer.current);
      recordingTimer.current = null;
    }
    if (mediaRecorder.current?.state === "recording") mediaRecorder.current.stop();
  }

  async function submitInterview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!interview || recordingQuestionId) return;
    setError("");
    for (const question of interview.questions) {
      if (question.required && !recordings[question.id]) {
        setError(`Record a video response for: ${question.question}`);
        return;
      }
    }
    const totalBytes = Object.values(recordings).reduce(
      (total, blob) => total + blob.size,
      0,
    );
    if (!totalBytes) {
      setError("Record at least one video response before submitting.");
      return;
    }

    setSubmitting(true);
    try {
      for (const [questionId, blob] of Object.entries(recordings)) {
        const totalChunks = Math.ceil(blob.size / VIDEO_CHUNK_BYTES);
        if (totalChunks > 10) {
          throw new Error("A video is larger than 30 MB. Please record a shorter answer.");
        }
        const uploadId = crypto.randomUUID();
        const mimeType = blob.type.startsWith("video/mp4")
          ? "video/mp4"
          : "video/webm";
        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
          const formData = new FormData();
          formData.set(
            "video",
            blob.slice(
              chunkIndex * VIDEO_CHUNK_BYTES,
              Math.min((chunkIndex + 1) * VIDEO_CHUNK_BYTES, blob.size),
              mimeType,
            ),
          );
          formData.set("uploadId", uploadId);
          formData.set("mimeType", mimeType);
          formData.set("chunkIndex", String(chunkIndex));
          formData.set("totalChunks", String(totalChunks));
          const chunkResponse = await fetch(
            `/api/virtual-interviews/${token}/videos/${encodeURIComponent(questionId)}`,
            { method: "POST", body: formData },
          );
          const chunkData = await chunkResponse.json();
          if (!chunkResponse.ok) {
            throw new Error(chunkData.error || "Could not upload a video chunk.");
          }
        }
        const finalizeResponse = await fetch(
          `/api/virtual-interviews/${token}/videos/${encodeURIComponent(questionId)}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uploadId, totalChunks, mimeType }),
          },
        );
        const finalizeData = await finalizeResponse.json();
        if (!finalizeResponse.ok) {
          throw new Error(finalizeData.error || "Could not save a video response.");
        }
      }

      const response = await fetch(`/api/virtual-interviews/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not submit interview.");
      setInterview({ ...interview, status: "submitted" });
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Could not submit interview.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const expired =
    interview && now > 0 && new Date(interview.expiresAt).getTime() <= now;

  return (
    <main className="candidate-assignment-page">
      <div className="candidate-assignment-card">
        <header className="candidate-assignment-header">
          {interview?.companyLogo ? (
            <Image
              src={interview.companyLogo}
              alt={`${interview.companyName} logo`}
              width={56}
              height={56}
              unoptimized
            />
          ) : (
            <span className="candidate-assignment-monogram">
              {interview?.companyName.slice(0, 1) || "H"}
            </span>
          )}
          <div>
            <span className="eyebrow">{interview?.companyName || "HIRZO"}</span>
            <h1>{interview?.jobTitle || "Video interview"}</h1>
          </div>
        </header>

        {loading ? (
          <p className="field-hint">Loading your video interview…</p>
        ) : error && !interview ? (
          <section className="assignment-message">
            <h2>This link is unavailable</h2>
            <p>{error}</p>
          </section>
        ) : interview?.status === "submitted" ? (
          <section className="assignment-message">
            <span className="assignment-complete-icon">✓</span>
            <h2>Video interview submitted</h2>
            <p>
              Thanks, {interview.candidateName}. Your responses have been
              received by {interview.companyName}. The video files are
              automatically deleted after three days.
            </p>
          </section>
        ) : expired ? (
          <section className="assignment-message">
            <h2>This interview link has expired</h2>
            <p>Contact the employer if you need a new invitation.</p>
          </section>
        ) : interview ? (
          <>
            <div className="candidate-assignment-intro">
              <p>
                Hello {interview.candidateName}, record a video response for
                each question. You can review or re-record your answer before
                submitting.
              </p>
              <p className="interview-recording-note">
                Your browser will ask for camera and microphone access. Videos
                are securely stored in MongoDB and deleted after three days.
              </p>
            </div>
            <form
              className="form-stack candidate-assignment-form"
              onSubmit={submitInterview}
            >
              {interview.questions.map((question, index) => (
                <section className="interview-question" key={question.id}>
                  <h2>
                    <span>Question {index + 1}</span>
                    {question.required && <span className="required-mark">Required</span>}
                  </h2>
                  <p>{question.question}</p>
                  <span className="field-hint">
                    Maximum response: {Math.floor(question.maxDurationSeconds / 60)}:
                    {String(question.maxDurationSeconds % 60).padStart(2, "0")}
                  </span>
                  {recordings[question.id] && previewUrls[question.id] && (
                    <video
                      className="interview-video-preview"
                      src={previewUrls[question.id]}
                      controls
                      playsInline
                    />
                  )}
                  {recordingQuestionId === question.id ? (
                    <button
                      type="button"
                      className="button button-light"
                      onClick={stopRecording}
                    >
                      Stop recording
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="button button-light"
                      disabled={Boolean(recordingQuestionId)}
                      onClick={() => void startRecording(question)}
                    >
                      {recordings[question.id] ? "Record again" : "Record answer"}
                    </button>
                  )}
                  {recordings[question.id] && (
                    <span className="field-hint">
                      Video ready ({(recordings[question.id].size / (1024 * 1024)).toFixed(1)} MB)
                    </span>
                  )}
                </section>
              ))}
              {error && <p className="form-error">{error}</p>}
              <div className="candidate-assignment-submit">
                <span>Your responses are sent only when you submit.</span>
                <button
                  type="submit"
                  className="button button-dark"
                  disabled={submitting || Boolean(recordingQuestionId)}
                >
                  {submitting ? "Uploading videos…" : "Submit video interview"}
                </button>
              </div>
            </form>
          </>
        ) : null}
      </div>
    </main>
  );
}
