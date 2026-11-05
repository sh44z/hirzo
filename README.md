# Hirzo

End-to-end job board built with **Next.js** and **MongoDB**.

Hirzo includes a public job board with a dedicated featured-roles section, an employer hiring dashboard with jobs, applicants, and available match scores together, and a protected backoffice for managing employer and master accounts. Employers can set a reference answer for each qualification question; applicants are advised when their answers do not match before they choose whether to continue.

## Setup

1. Copy env template and fill values:

```bash
cp .env.example .env.local
```

Required:

- `MONGODB_URI` — MongoDB Atlas connection string (database name `hirzo`)
- `JWT_SECRET` — long random secret for employer sessions
- `ADMIN_INITIAL_PASSWORD` — unique initial password for `admin@hirzo.com` (at least 12 characters recommended). The initial master account is created when it first signs in; it is never provisioned with a hard-coded password.
- `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` — server-only PayPal REST app credentials
- `PAYPAL_MODE` — `live` for real payments; use `sandbox` only for testing
- `RESEND_API_KEY` and `RESEND_FROM_EMAIL` — optional Resend credentials for assignment and virtual interview invitations. If omitted or delivery fails, the employer can copy the secure link and send it manually.

Put real local values in `.env.local`; keep `.env.example` as a placeholder-only template. `.env.local` is ignored by Git and must not be committed. For Vercel, configure the same required values in the project's Environment Variables settings.

Employer job posts use PayPal checkout unless an employer has a free posting credit:

- **Basic (£79):** job posting, qualification questions, applicant shortlisting, and hiring
- **Premium (£110):** Basic plus CV screening, a featured job listing, and applicant match scoring with configurable role-specific weights
- **Full Recruitment (£699):** job posting, candidate interviews, and contract preparation

Platform admins can grant employer-specific Basic or Premium job posting credits from the backoffice. Each new job post uses one matching credit; once the balance is used, the employer pays the standard price through PayPal. Credits do not apply to Full Recruitment plans or renewals.

Published and draft job posts expire 30 days after posting and are automatically removed by MongoDB's TTL index. Employers can renew a post from their workspace with a new paid checkout, extending its expiry by 30 days. Backoffice admins can set a job to Basic or Premium after confirming an offline invoice; the action is recorded as an offline payment.

PayPal is configured for Live mode; add valid live credentials and confirm the merchant account is ready before accepting payments.

For a live deployment, add these variables to the hosting provider's production environment settings and redeploy. Confirm the MongoDB database user/password are valid, URL-encode special characters in the connection string, and allow the hosting provider to connect in MongoDB Atlas network access settings. `.env.example` contains placeholders and should not be used as a live connection string.

2. Install & run:

```bash
npm install
npm run dev
```

Visit `/` for the public job board, `/workspace` for employer registration/sign-in and job management, and `/backoffice` for platform administration. Employers can edit a job's title, description, location, employment type, salary, visibility, and optional default candidate assignment, or delete a post from the workspace. Employers can optionally upload a PNG, JPEG, or WebP company logo (up to 500 KB) during registration; it appears on their job listings. Premium posts appear as featured roles and can be found with the Featured filter. Set `ADMIN_INITIAL_PASSWORD` before the first admin login. Signed-in admins can create and deactivate additional master accounts.

Employers can create a job-level assignment template with long responses, multiple choice, file uploads, or video/audio links, then customize and send it while shortlisting a candidate. Invitations use a random token stored as a hash, expire after 14 days if unopened, and start an optional time limit on first open. Candidate text drafts are saved in that browser's local storage. Assignment files are limited to 8 MB each and 12 MB total.

Premium and Full Recruitment jobs can define up to 10 virtual interview questions, each with a 15-second to 5-minute response limit. Employers can invite candidates to the video interview only after reviewing their assignment and marking it as passed. Candidates record responses in their browser; uploads are sent as 3 MB chunks and assembled server-side into MongoDB GridFS. Video file metadata and every GridFS chunk have MongoDB TTL indexes for three-day retention. MongoDB's TTL monitor removes expired records asynchronously (normally within about a minute after expiry). Video playback is streamed from GridFS through an employer-authenticated route. Configure both optional Resend variables to email invitations automatically; otherwise, the workspace provides a secure link and email-draft option.

Each job requirements category (skills, qualifications, responsibilities, and other requirements) accepts up to 100 items, with each item limited to 200 characters.

The public job details view includes any optional role requirements and application questions provided by the employer, along with the job description and listing information.

## Employer API

All employer routes use an httpOnly cookie session (`hirzo_employer_session`).

### Auth

| Method | Path | Body |
|--------|------|------|
| `POST` | `/api/auth/register` | `{ email, password, companyName, contactName, companyLogo? }` (`companyLogo` is an optional PNG/JPEG/WebP data URL) |
| `POST` | `/api/auth/login` | `{ email, password }` |
| `POST` | `/api/auth/logout` | — |
| `GET` | `/api/auth/me` | — |

### Jobs

| Method | Path | Notes |
|--------|------|------|
| `GET` | `/api/employers/jobs` | List employer's jobs |
| `POST` | `/api/employers/jobs` | Disabled; create a paid post via PayPal checkout |
| `GET` | `/api/employers/jobs/:jobId` | Get one job |
| `PATCH` | `/api/employers/jobs/:jobId` | Update job / questions / status |
| `DELETE` | `/api/employers/jobs/:jobId` | Delete job |

Paid job posting uses `POST /api/payments/paypal/create-order` with the job details and `plan` (`basic`, `premium`, or `full_recruitment`). The employer is redirected to PayPal; after approval, `/api/payments/paypal/capture` verifies the GBP amount before publishing the job.

Renew an existing post using `POST /api/payments/paypal/renew-order` with `{ "jobId": "...", "plan": "basic" }`; capture is verified using the same PayPal endpoint. Backoffice admins can update a job's plan with `PATCH /api/admin/jobs/:jobId` after an offline invoice is confirmed.

Create/update job body example:

```json
{
  "title": "Frontend Engineer",
  "description": "Build candidate and employer experiences...",
  "location": "Remote (UK)",
  "employmentType": "full_time",
  "salaryMin": 50000,
  "salaryMax": 70000,
  "currency": "GBP",
  "status": "published",
  "requirements": {
    "skills": ["Salesforce", "Consultative selling"],
    "yearsExperience": 3,
    "qualifications": ["Relevant professional certification"],
    "responsibilities": ["Manage the full sales cycle"],
    "otherRequirements": ["Comfortable presenting to clients"]
  },
  "matchWeights": {
    "skills": 40,
    "experience": 30,
    "qualifications": 15,
    "other": 15
  },
  "qualificationQuestions": [
    {
      "question": "How many years of React experience?",
      "type": "text",
      "required": true
    },
    {
      "question": "Are you eligible to work in the UK?",
      "type": "yes_no",
      "required": true
    },
    {
      "question": "Preferred work style",
      "type": "multiple_choice",
      "options": ["Remote", "Hybrid", "Office"],
      "required": true
    }
  ],
  "videoQuestions": [
    {
      "question": "Introduce yourself and why you want this role",
      "maxDurationSeconds": 90,
      "required": true
    }
  ],
  "interviewQuestions": [
    {
      "question": "Tell us about a complex problem you solved.",
      "maxDurationSeconds": 120,
      "required": true
    }
  ]
}
```

### Applications (employer)

| Method | Path | Notes |
|--------|------|------|
| `GET` | `/api/employers/jobs/:jobId/applications?status=` | List / filter applicants |
| `GET` | `/api/employers/jobs/:jobId/match-results` | Premium-only applicant matches, sorted by score |
| `POST` | `/api/employers/jobs/:jobId/match-results` | Recalculate and save premium applicant scores |
| `GET` | `/api/employers/applications/:applicationId` | Review CV + answers |
| `PATCH` | `/api/employers/applications/:applicationId` | Update pipeline status |
| `POST` | `/api/employers/applications/:applicationId/assignment` | Shortlist and issue an assignment link |
| `POST` | `/api/employers/applications/:applicationId/virtual-interview` | Invite an applicant after a reviewed, passing assignment |
| `GET` | `/api/employers/applications/:applicationId/interview-videos/:questionId` | Stream a submitted video response while it is retained |
| `GET` / `PATCH` | `/api/employers/assignments/:assignmentId` | Read submitted answers or save an internal scorecard |
| `GET` | `/api/employers/assignments/:assignmentId/files/:questionId` | Download a submitted assignment file |

Status values: `applied` → `shortlisted` → `interview` → `hired` (or `rejected`). The employer sends a virtual interview invitation from a reviewed assignment scorecard with a passing decision; moving an applicant directly to `interview` is not allowed.

```json
{ "status": "shortlisted", "notes": "Strong CV, good video answers" }
```

### Public (for candidates later)

| Method | Path | Notes |
|--------|------|------|
| `GET` | `/api/jobs/public` | Published jobs |
| `GET` | `/api/employers/:employerId/logo` | Public company logo image |
| `POST` | `/api/applications` | Apply without an account |
| `GET` / `POST` | `/api/assignments/:token` | Open and submit an assignment without an account |
| `GET` / `POST` | `/api/virtual-interviews/:token` | Load questions and submit a video interview |
| `POST` / `PUT` | `/api/virtual-interviews/:token/videos/:questionId` | Upload a video in 3 MB chunks and finalize it into GridFS |

## Pipeline

```
Employer registers/logs in
  → chooses a paid package and completes PayPal checkout
  → publishes the paid job + structured requirements
  → premium jobs are featured and score applicants against role requirements
  → candidate applies with an optional .doc or .docx CV (text extracted server-side)
  → employer reviews CV & answers
  → shortlist and optionally send an assignment
  → candidate submits using a secure, account-free link
  → employer reviews responses and scores the submission
  → assignment pass unlocks a secure virtual video interview invitation
  → candidate records employer-defined answers and submits
  → employer streams the video answers from MongoDB
  → live interview / hire / reject
```

## Next

- Assignment video/audio links remain supported; virtual interview responses use direct browser recording and GridFS storage.

Match scores are decision-support signals, not hiring decisions. Skills, experience,
qualifications, and other role requirements can be weighted per job; weights must total
100%. Protected characteristics are rejected as job matching requirements. Uploaded
CV files are retained privately and can only be downloaded through an authenticated
employer route; CV text and parsed profile data are never included in applicant API
responses.
