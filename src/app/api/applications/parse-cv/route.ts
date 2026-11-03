import { NextRequest, NextResponse } from "next/server";
import { badRequest, serverError } from "@/lib/auth";
import { extractCandidateContact } from "@/lib/job-matching";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const file = form.get("cvFile");
    if (!(file instanceof File)) return badRequest("Choose a Word CV to parse.");
    if (file.size === 0 || file.size > 4 * 1024 * 1024) {
      return badRequest("CV must be a non-empty file no larger than 4 MB.");
    }

    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension !== "doc" && extension !== "docx") {
      return badRequest("CV must be a Word document (.doc or .docx).");
    }
    const data = Buffer.from(await file.arrayBuffer());
    const isValidWordFile =
      extension === "docx"
        ? data[0] === 0x50 && data[1] === 0x4b
        : data.subarray(0, 8).equals(
            Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
          );
    if (!isValidWordFile) return badRequest("The uploaded file is not a valid Word document.");

    try {
      return NextResponse.json({ contact: await extractCandidateContact(data) });
    } catch (error) {
      console.warn("CV contact extraction failed:", error);
      return badRequest("Could not read the uploaded CV. Please check the document and try again.");
    }
  } catch (error) {
    console.error("Parse CV error:", error);
    return serverError();
  }
}
