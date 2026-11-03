import "server-only";
import mammoth from "mammoth";
import WordExtractor from "word-extractor";
import { containsProtectedCharacteristic } from "@/lib/protected-characteristics";
import type { CandidateProfile, JobRequirements } from "@/types";

const sectionHeading =
  /^(?:skills|technical skills|core competencies|education|qualifications|certifications|licenses|professional experience|work experience|employment history|experience|responsibilities|projects|summary|profile|languages|other requirements)\s*:?\s*$/i;
function emptyProfile(): CandidateProfile {
  return {
    skills: [],
    yearsExperience: null,
    qualifications: [],
    responsibilities: [],
    otherRequirements: [],
  };
}

function addLine(lines: string[], line: string) {
  const cleaned = line
    .replace(/^[\s•▪◦*–—-]+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
  if (cleaned && lines.length < 100) lines.push(cleaned);
}

async function extractDocumentText(data: Buffer) {
  const isDocx = data[0] === 0x50 && data[1] === 0x4b;
  const value = isDocx
    ? (await mammoth.extractRawText({ buffer: data })).value
    : (await new WordExtractor().extract(data)).getBody();
  return value.slice(0, 100_000);
}

export async function extractCandidateContact(data: Buffer) {
  const text = await extractDocumentText(data);
  const email = text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0];
  const phone = text.match(/(?:\+\d{1,3}[\s().-]*)?(?:\(?\d{2,5}\)?[\s().-]*){2,5}\d{2,5}/)?.[0]
    ?.replace(/\s+/g, " ")
    .trim();
  const name = text
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/^[\s•▪◦*–—-]+/, "")
        .split(/[|•·–—]/)[0]
        .trim(),
    )
    .find(
      (line) =>
        /^[\p{L}][\p{L}'’.-]*(?:\s+[\p{L}][\p{L}'’.-]*){1,4}$/u.test(line) &&
        !line.includes("@") &&
        !sectionHeading.test(line) &&
        !/\b(resume|curriculum vitae|cv|phone|mobile|email|linkedin|github|engineer|developer|manager|professional|specialist|director|designer|analyst|consultant|executive|experience|summary|portfolio|objective|profile)\b/i.test(line),
    );

  return { candidateName: name || "", candidateEmail: email || "", candidatePhone: phone || "" };
}

export async function extractCandidateProfile(
  data: Buffer,
): Promise<CandidateProfile> {
  const text = await extractDocumentText(data);
  const profile = emptyProfile();
  let section: keyof CandidateProfile = "otherRequirements";

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (sectionHeading.test(trimmed)) {
      const heading = trimmed.replace(/:$/, "").toLowerCase();
      if (/skill|competenc/.test(heading)) section = "skills";
      else if (/education|qualif|certification|license/.test(heading))
        section = "qualifications";
      else if (/experience|employment|responsibilit|project/.test(heading))
        section = "responsibilities";
      else section = "otherRequirements";
      continue;
    }
    addLine(profile[section], trimmed);
  }

  const experience = text.match(
    /\b(\d{1,2}(?:\.\d+)?)\s*\+?\s*years?\s+(?:of\s+)?(?:relevant\s+)?experience\b/i,
  );
  if (experience) {
    const years = Number(experience[1]);
    if (Number.isFinite(years) && years <= 60) {
      profile.yearsExperience = years;
    }
  }

  return profile;
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9+#.]+/g, " ").trim();
}

export function calculateMatchScore(
  requirements: JobRequirements,
  profile: CandidateProfile,
): number {
  const criteria = [
    ...requirements.skills,
    ...requirements.qualifications,
    ...requirements.responsibilities,
    ...requirements.otherRequirements,
    ...(requirements.yearsExperience > 0
      ? [`${requirements.yearsExperience} years experience`]
      : []),
  ].filter((requirement) => !containsProtectedCharacteristic(requirement));
  if (criteria.length === 0) return 0;

  const evidence = normalize(
    [
      ...profile.skills,
      ...profile.qualifications,
      ...profile.responsibilities,
      ...profile.otherRequirements,
    ].join(" "),
  );
  const evidenceWords = new Set(evidence.split(/\s+/).filter(Boolean));
  const scores = criteria.map((criterion) => {
    const normalized = normalize(criterion);
    if (!normalized) return 0;
    if (` ${evidence} `.includes(` ${normalized} `)) return 100;

    const words = [...new Set(normalized.split(/\s+/).filter(Boolean))];
    if (words.length === 0) return 0;
    const matches = words.filter((word) => evidenceWords.has(word)).length;
    return Math.round((matches / words.length) * 100);
  });

  return Math.round(scores.reduce((total, score) => total + score, 0) / scores.length);
}
