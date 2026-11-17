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
    icon: "↗",
    title: "Cold Call Frameworks & Openers",
    description:
      "Pattern-interrupt hooks, permission-based openers, and tonality mastery to earn the first 30 seconds.",
  },
  {
    icon: "⌕",
    title: "Discovery & Pain Questioning",
    description:
      "Uncovering real business pain, BANT/MEDDIC qualification criteria, and active listening triggers.",
  },
  {
    icon: "!",
    title: "Objection Handling Playbooks",
    description:
      'Live rebuttals for "send me an email," "not interested," "no budget," and gatekeeper navigation.',
  },
  {
    icon: "♩",
    title: "Live Roleplay & Call Reviews",
    description:
      "1-on-1 call tear-downs, custom talk tracks tailored to your ICP, and closing for the booked meeting.",
  },
] as const;

export type PublicTab = "jobs" | "pricing" | "training";

export default function PublicTabs({
  activeTab,
}: {
  activeTab: PublicTab;
}) {
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
    <div className="public-tabs-content">
      {activeTab === "training" && <section className="sales-training-section" id="sales-training">
        <div className="sales-training-inner">
          <div className="training-offer">
            <div className="training-offer-kicker">
              <span>♧</span> ADD-ON OR STANDALONE REVENUE ENABLEMENT
            </div>
            <h2>Comprehensive SDR Phone Training</h2>
            <p className="training-offer-copy">
              Hiring great reps is only half the battle. Equip your new hires or
              existing SDR team with a repeatable, high-converting cold calling
              system built to book qualified meetings consistently.
            </p>
            <div className="training-module-grid">
              {phoneTrainingModules.map((module) => (
                <article className="training-module-card" key={module.title}>
                  <h3><span aria-hidden="true">{module.icon}</span>{module.title}</h3>
                  <p>{module.description}</p>
                </article>
              ))}
            </div>
            <div className="training-offer-footer">
              <div>
                <strong>£{HIRING_TRAINING_AMOUNT.toLocaleString("en-GB")}</strong>
                <span> / hiring &amp; training package</span>
                <p>Bundle with any Hiring Plan and save 15% on team cohorts.</p>
              </div>
              <button
                className="button button-dark"
                onClick={() => openContactForm("hiring_training")}
              >
                Contact us <span>→</span>
              </button>
            </div>
          </div>
          <div className="sales-101-grid">
            <article className="sales-101-card">
              <span className="eyebrow">SALES 101</span>
              <h3>Show what makes you a great starter</h3>
              <p>Highlight resilience, communication, teamwork, sport, volunteering, and moments when you took initiative—not just job titles.</p>
            </article>
            <article className="sales-101-card">
              <span className="eyebrow">INTERVIEW TIP</span>
              <h3>Make your follow-up count</h3>
              <p>Thank the interviewer, connect one strength to the role, and ask about the team’s coaching and first-month goals.</p>
            </article>
          </div>
          <EarningsCalculator />
        </div>
      </section>}

      {activeTab === "pricing" && <section className="pricing-section" id="pricing">
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
              <span className="eyebrow">SELF-SERVE HIRING</span>
              <h3>Basic</h3>
              <strong>£{JOB_POSTING_PLANS.basic.amount}</strong>
              <p>One-off price per job post.</p>
              <div className="pricing-feature-heading">CORE FEATURES INCLUDED</div>
              <ul>
                <li><strong>Standard Job Listing Placement</strong> across the Hirzo talent network</li>
                <li><strong>Basic Applicant Tracking</strong> &amp; visual pipeline view</li>
                <li>Qualification questions</li>
                <li>Shortlist and hire applicants</li>
              </ul>
              <Link href="/workspace" className="button button-light">
                Post a Basic job <span>→</span>
              </Link>
            </article>
            <article className="pricing-card">
              <span className="eyebrow">ENHANCED SCREENING &amp; CLOSING</span>
              <h3>Premium</h3>
              <strong>£{JOB_POSTING_PLANS.premium.amount}</strong>
              <p>One-off price per job post.</p>
              <div className="pricing-feature-heading">EVERYTHING IN BASIC, PLUS:</div>
              <ul>
                <li><strong>Featured Job Listing</strong><span>Priority top-of-feed placement and a highlighted badge for increased candidate visibility.</span></li>
                <li><strong>Assignments &amp; Competency Tests</strong><span>Custom skills assessments and role-specific take-home challenges built into your pipeline.</span></li>
                <li><strong>Async Virtual Video Interviews</strong><span>Send custom prompts and review candidate video answers on your schedule.</span></li>
                <li><strong>Offer Letter &amp; Contract Drafting Help</strong><span>Customizable templates and hands-on drafting support.</span></li>
              </ul>
              <Link href="/workspace" className="button button-light">
                Post a Premium job <span>→</span>
              </Link>
            </article>
            <article className="pricing-card pricing-service-card">
              <span className="eyebrow">DONE-FOR-YOU RECRUITING</span>
              <h3>Recruitment Support</h3>
              <strong>£{JOB_POSTING_PLANS.full_recruitment.amount}</strong>
              <p>For busy founders and hiring managers who want pre-vetted, interview-ready candidates delivered directly to their calendar.</p>
              <div className="pricing-feature-heading">EVERYTHING IN PREMIUM, PLUS:</div>
              <ul>
                <li><strong>We Find, Interview &amp; Qualify Candidates</strong><span>Active headhunting, structured first-round interviews, and skills verification.</span></li>
                <li><strong>Onsite Interview Preparation</strong><span>Dedicated coaching and role briefing so finalists arrive prepared for the final round.</span></li>
                <li><strong>Full Recruitment Consultant Service</strong><span>Pipeline strategy, salary benchmarking, feedback loops, and offer closing.</span></li>
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
      </section>}

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
          <div className="footer-about" id="about-us">
            <strong>About Hirzo</strong>
            <span>We help new talent find a first sales role and help growing teams meet their next great hire.</span>
          </div>
          <form
            className="footer-contact-form"
            onSubmit={(event) => void submitContactInquiry(event)}
          >
            <strong>Contact us</strong>
            {contactSent ? (
              <p role="status">Thanks for reaching out. We’ll be in touch.</p>
            ) : (
              <>
                <div className="footer-contact-fields">
                  <input aria-label="Your name" name="name" placeholder="Your name" required minLength={2} maxLength={120} />
                  <input aria-label="Company" name="companyName" placeholder="Company" required minLength={2} maxLength={120} />
                  <input aria-label="Work email" type="email" name="email" placeholder="Work email" required maxLength={254} />
                  <input aria-label="Phone (optional)" type="tel" name="phone" placeholder="Phone (optional)" maxLength={40} />
                </div>
                <textarea aria-label="How can we help?" name="message" placeholder="How can we help?" required minLength={10} maxLength={2000} rows={3} />
                {contactError && <p className="form-error" role="alert">{contactError}</p>}
                <button className="button button-dark" type="submit" disabled={contactSubmitting}>
                  {contactSubmitting ? "Sending…" : "Send message"} <span>→</span>
                </button>
              </>
            )}
          </form>
          <div className="footer-links">
            <a href="#about-us">About us</a>
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
    </div>
  );
}

function EarningsCalculator() {
  const [base, setBase] = useState(28000);
  const [commission, setCommission] = useState(15000);

  return (
    <section className="earnings-calculator" aria-labelledby="earnings-heading">
      <div>
        <span className="eyebrow">PLAN YOUR FIRST YEAR</span>
        <h3 id="earnings-heading">What could you earn?</h3>
        <p>Adjust the example base salary and commission to explore potential first-year earnings.</p>
      </div>
      <div className="earnings-controls">
        <label>
          Base salary <strong>£{base.toLocaleString("en-GB")}</strong>
          <input type="range" min="20000" max="60000" step="1000" value={base} onChange={(event) => setBase(Number(event.target.value))} />
        </label>
        <label>
          Commission <strong>£{commission.toLocaleString("en-GB")}</strong>
          <input type="range" min="0" max="50000" step="1000" value={commission} onChange={(event) => setCommission(Number(event.target.value))} />
        </label>
        <output>Potential total <strong>£{(base + commission).toLocaleString("en-GB")}</strong></output>
      </div>
    </section>
  );
}
