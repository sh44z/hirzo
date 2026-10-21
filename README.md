# Hirzo

End-to-end job board built with **Next.js** and **MongoDB**.

Hirzo includes a public job board, an employer workspace for job management, and a protected backoffice for managing employer and master accounts. The existing API also supports application review and the applicant pipeline.

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

Put real local values in `.env.local`; keep `.env.example` as a placeholder-only template. `.env.local` is ignored by Git and must not be committed. For Vercel, configure the same required values in the project's Environment Variables settings.

Employer job posts require checkout through PayPal:

- **Basic (£79):** job posting, qualification questions, applicant shortlisting, and hiring
- **Premium (£110):** Basic plus CV screening, a first-stage interview with feedback, and virtual interview requests (coming soon)
- **Full Recruitment (£699):** job posting, candidate interviews, and contract preparation

PayPal is configured for Live mode; add valid live credentials and confirm the merchant account is ready before accepting payments.

For a live deployment, add these variables to the hosting provider's production environment settings and redeploy. Confirm the MongoDB database user/password are valid, URL-encode special characters in the connection string, and allow the hosting provider to connect in MongoDB Atlas network access settings. `.env.example` contains placeholders and should not be used as a live connection string.

2. Install & run:

```bash
npm install
npm run dev
```

Visit `/` for the public job board, `/workspace` for employer registration/sign-in and job management, and `/backoffice` for platform administration. Set `ADMIN_INITIAL_PASSWORD` before the first admin login. Signed-in admins can create and deactivate additional master accounts.

## Employer API

All employer routes use an httpOnly cookie session (`hirzo_employer_session`).

### Auth

| Method | Path | Body |
|--------|------|------|
| `POST` | `/api/auth/register` | `{ email, password, companyName, contactName }` |
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
  ]
}
```

### Applications (employer)

| Method | Path | Notes |
|--------|------|------|
| `GET` | `/api/employers/jobs/:jobId/applications?status=` | List / filter applicants |
| `GET` | `/api/employers/applications/:applicationId` | Review CV + answers |
| `PATCH` | `/api/employers/applications/:applicationId` | Update pipeline status |

Status values: `applied` → `shortlisted` → `interview` → `hired` (or `rejected`).

Setting status to `interview` generates an invite token for later candidate email login.

```json
{ "status": "shortlisted", "notes": "Strong CV, good video answers" }
```

### Public (for candidates later)

| Method | Path | Notes |
|--------|------|------|
| `GET` | `/api/jobs/public` | Published jobs |
| `POST` | `/api/applications` | Apply without an account |

## Pipeline

```
Employer registers/logs in
  → chooses a paid package and completes PayPal checkout
  → publishes the paid job + qualification questions
  → candidate applies (public)
  → employer reviews CV & answers
  → shortlist / interview / hire / reject
```

## Next

- Candidate application and video upload UI
- Candidate email invite login for interviews
