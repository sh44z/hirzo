"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import {
  HIRING_TRAINING_AMOUNT,
  JOB_POSTING_PLANS,
} from "@/lib/job-posting-plans";

type ContactService = "full_recruitment" | "hiring_training";

const phoneTrainingModules = [
  {
    number: "01",
    title: "Pre-call prep",
    description: "Research the prospect, set a clear goal, and prepare a confident opener.",
  },
  {
    number: "02",
    title: "Tone & delivery",
    description: "Build a natural, clear delivery and learn to listen actively.",
  },
  {
    number: "03",
    title: "The 5-Stage Cold Call Framework",
    description: "Follow a simple structure from introduction through to agreed next steps.",
  },
  {
    number: "04",
    title: "Objection Handling Matrix",
    description: "Respond to common objections with empathy and relevant follow-up questions.",
  },
  {
    number: "05",
    title: "Closing & Post-Call Execution",
    description: "Confirm the next step, record useful notes, and follow up consistently.",
  },
] as const;

export default function EmployersPage() {
  const [contactService, setContactService] =
    useState<ContactService>("full_recruitment");
  const [contactOpen, setContactOpen] = useState(false);
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactError, setContactError] = useState("");
  const [contactSent, setContactSent] = useState(false);

  function openContactForm(service: ContactService) {
    setContactService(service);
    setContactError("");
    setContactSent(false);
    setContactOpen(true);
  }

  async function submitContactInquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setContactSubmitting(true);
    setContactError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const response = await fetch("/api/contact-inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          companyName: form.get("companyName"),
          email: form.get("email"),
          phone: form.get("phone"),
          service: contactService,
          message: form.get("message"),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not send your inquiry.");
      }
      setContactSent(true);
      formElement.reset();
    } catch (error) {
      setContactError(
        error instanceof Error ? error.message : "Could not send your inquiry.",
      );
    } finally {
      setContactSubmitting(false);
    }
  }

  return (
    <main className="public-site">
      <nav className="public-nav">
        <div className="nav-inner">
          <Link className="brand" href="/" aria-label="Hirzo job board">
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
            <a href="#sales-training">Our training</a>
            <a href="#pricing">Pricing</a>
          </div>
          <div className="nav-actions">
            <Link href="/" className="nav-employer-link">
              Browse jobs
            </Link>
            <Link href="/workspace" className="button button-dark nav-cta">
              Employer workspace <span>↗</span>
            </Link>
          </div>
        </div>
      </nav>

      <section className="employer-services-hero">
        <div className="employer-services-hero-inner">
          <div className="employer-services-copy">
            <div className="hero-tag">
              <span className="hero-tag-dot" /> FRESH GRADUATES, READY TO GROW
            </div>
            <h1>
              We find a fresh graduate.
              <br />
              <span>You choose to hire.</span>
            </h1>
            <p>
              We find a fresh graduate for your entry-level sales role. If you
              decide to hire them, we can provide basic phone training to help
              them start with confidence.
            </p>
            <div className="employer-service-actions">
              <button
                className="button button-dark"
                onClick={() => openContactForm("hiring_training")}
              >
                Find and train a graduate <span>→</span>
              </button>
              <a href="#pricing" className="text-link">
                Explore packages
              </a>
            </div>
          </div>
          <aside className="employer-hiring-journey">
            <span className="eyebrow">HOW IT WORKS</span>
            <ol>
              <li><b>01</b><span>We find a fresh graduate for your role</span></li>
              <li><b>02</b><span>You decide who to hire</span></li>
              <li><b>03</b><span>We provide basic phone training after hire</span></li>
            </ol>
          </aside>
        </div>
      </section>

      <section className="sales-training-section" id="sales-training">
        <div className="sales-training-inner">
          <div className="section-kicker">
            <span>✳</span> PRACTICAL TRAINING AFTER YOU HIRE
          </div>
          <div className="sales-training-heading">
            <div>
              <h2>
                Basic phone training.
                <br />
                <em>Ready for their first calls.</em>
              </h2>
              <p>
                Once you hire the graduate, we can train them in the core phone
                skills they need to get started in an entry-level sales role.
              </p>
            </div>
          </div>
          <div className="training-module-grid">
            {phoneTrainingModules.map((module) => (
              <article className="training-module-card" key={module.number}>
                <span>{module.number}</span>
                <h3>{module.title}</h3>
                <p>{module.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="pricing-section" id="pricing">
        <div className="pricing-inner">
          <div className="section-kicker">
            <span>£</span> HIRING OPTIONS
          </div>
          <div className="pricing-heading">
            <h2>
              Choose the support
              <br />
              <em>that works for you.</em>
            </h2>
            <p>
              Post a sales role yourself, ask us to manage recruitment, or add
              basic phone training after you hire.
            </p>
          </div>
          <div className="pricing-card-grid">
            <article className="pricing-card">
              <span className="eyebrow">JOB POST</span>
              <h3>Basic</h3>
              <strong>£{JOB_POSTING_PLANS.basic.amount}</strong>
              <p>One-off price per job post.</p>
              <ul>
                <li>Post a role on Hirzo</li>
                <li>Qualification questions</li>
                <li>Shortlist and hire applicants</li>
              </ul>
              <Link href="/workspace" className="button button-light">
                Post a Basic job <span>→</span>
              </Link>
            </article>
            <article className="pricing-card">
              <span className="eyebrow">JOB POST</span>
              <h3>Premium</h3>
              <strong>£{JOB_POSTING_PLANS.premium.amount}</strong>
              <p>One-off price per job post.</p>
              <ul>
                <li>Everything in Basic</li>
                <li>CV screening and match scores</li>
                <li>Featured job listing</li>
              </ul>
              <Link href="/workspace" className="button button-light">
                Post a Premium job <span>→</span>
              </Link>
            </article>
            <article className="pricing-card pricing-service-card">
              <span className="eyebrow">RECRUITMENT SUPPORT</span>
              <h3>{JOB_POSTING_PLANS.full_recruitment.name}</h3>
              <strong>£{JOB_POSTING_PLANS.full_recruitment.amount}</strong>
              <p>End-to-end support to find and hire the right person.</p>
              <ul>
                <li>Candidate sourcing and screening</li>
                <li>Interview support</li>
                <li>Contract preparation</li>
              </ul>
              <button
                className="button button-dark"
                onClick={() => openContactForm("full_recruitment")}
              >
                Contact us <span>→</span>
              </button>
            </article>
            <article className="pricing-card pricing-service-card">
              <span className="eyebrow">HIRING + TRAINING</span>
              <h3>Hiring &amp; training solution</h3>
              <strong>£{HIRING_TRAINING_AMOUNT.toLocaleString("en-GB")}</strong>
              <p>
                We find a fresh graduate; after you hire them, we provide basic
                phone training.
              </p>
              <ul>
                <li>Fresh graduate search and recruitment</li>
                <li>Training after you hire</li>
                <li>Practical entry-level phone skills</li>
              </ul>
              <button
                className="button button-dark"
                onClick={() => openContactForm("hiring_training")}
              >
                Contact us <span>→</span>
              </button>
            </article>
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
          <span>Fresh graduate sales hiring, with training after you hire.</span>
          <div>
            <Link href="/">Browse jobs ↗</Link>
            <Link href="/workspace">Employer workspace</Link>
          </div>
          <small>© {new Date().getFullYear()} Hirzo. Made for what’s next.</small>
        </div>
      </footer>

      {contactOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !contactSubmitting) {
              setContactOpen(false);
            }
          }}
        >
          <section
            className="job-modal contact-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-inquiry-title"
          >
            <div className="modal-heading">
              <div>
                <div className="eyebrow">TELL US WHAT YOU NEED</div>
                <h2 id="contact-inquiry-title">
                  {contactService === "full_recruitment"
                    ? "Complete recruitment solution"
                    : "Hiring & training"}
                </h2>
              </div>
              <button
                className="icon-button close-button"
                aria-label="Close"
                disabled={contactSubmitting}
                onClick={() => setContactOpen(false)}
              >
                ×
              </button>
            </div>
            {contactSent ? (
              <div className="contact-success" role="status">
                <strong>Thanks for getting in touch.</strong>
                <p>
                  Your inquiry has been sent to the Hirzo back office. We&apos;ll
                  follow up with you.
                </p>
                <button
                  className="button button-dark"
                  onClick={() => setContactOpen(false)}
                >
                  Done
                </button>
              </div>
            ) : (
              <form
                className="form-stack modal-form"
                onSubmit={(event) => void submitContactInquiry(event)}
              >
                <p className="contact-modal-copy">
                  Share a few details and our team will be in touch about this{" "}
                  {contactService === "full_recruitment"
                    ? `£${JOB_POSTING_PLANS.full_recruitment.amount} recruitment service`
                    : `£${HIRING_TRAINING_AMOUNT.toLocaleString("en-GB")} hiring and training service`}
                  .
                </p>
                <div className="form-row">
                  <label>
                    Your name
                    <input name="name" required minLength={2} maxLength={120} />
                  </label>
                  <label>
                    Company
                    <input
                      name="companyName"
                      required
                      minLength={2}
                      maxLength={120}
                    />
                  </label>
                </div>
                <div className="form-row">
                  <label>
                    Work email
                    <input
                      type="email"
                      name="email"
                      required
                      maxLength={254}
                    />
                  </label>
                  <label>
                    Phone (optional)
                    <input type="tel" name="phone" maxLength={40} />
                  </label>
                </div>
                <label>
                  How can we help?
                  <textarea
                    name="message"
                    required
                    minLength={10}
                    maxLength={2000}
                    rows={4}
                    placeholder="Tell us about the sales role or training you need."
                  />
                </label>
                {contactError && (
                  <p className="form-error" role="alert">
                    {contactError}
                  </p>
                )}
                <button
                  className="button button-dark"
                  type="submit"
                  disabled={contactSubmitting}
                >
                  {contactSubmitting ? "Sending…" : "Send inquiry"} <span>→</span>
                </button>
              </form>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
