import mongoose from "mongoose";
import type { GridFSBucket, ObjectId } from "mongodb";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { InterviewVideoChunk } from "@/models/InterviewVideoChunk";

export const INTERVIEW_VIDEO_RETENTION_MS = 3 * 24 * 60 * 60 * 1000;

let indexesPromise: Promise<void> | null = null;

function getDatabase() {
  const database = mongoose.connection.db;
  if (!database) throw new Error("MongoDB is not connected");
  return database;
}

export async function ensureInterviewVideoIndexes() {
  if (!indexesPromise) {
    const database = getDatabase();
    indexesPromise = Promise.all([
      database
        .collection("virtualInterviewVideos.files")
        .createIndex({ "metadata.expiresAt": 1 }, { expireAfterSeconds: 0 }),
      database
        .collection("virtualInterviewVideos.chunks")
        .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      InterviewVideoChunk.collection.createIndex(
        { applicationId: 1, questionId: 1, uploadId: 1, chunkIndex: 1 },
        { unique: true },
      ),
      InterviewVideoChunk.collection.createIndex(
        { expiresAt: 1 },
        { expireAfterSeconds: 0 },
      ),
    ])
      .then(() => undefined)
      .catch((error: unknown) => {
        indexesPromise = null;
        throw error;
      });
  }
  await indexesPromise;
}

export function getInterviewVideoBucket(): GridFSBucket {
  return new mongoose.mongo.GridFSBucket(getDatabase(), {
    bucketName: "virtualInterviewVideos",
  });
}

function toVideoChunkBuffer(data: unknown): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof Uint8Array) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  }
  if (data && typeof data === "object" && "buffer" in data) {
    const binary = data as { buffer: unknown; position?: unknown };
    if (
      binary.buffer instanceof Uint8Array &&
      (binary.position === undefined ||
        (typeof binary.position === "number" &&
          Number.isInteger(binary.position) &&
          binary.position >= 0 &&
          binary.position <= binary.buffer.byteLength))
    ) {
      const length =
        typeof binary.position === "number"
          ? binary.position
          : binary.buffer.byteLength;
      return Buffer.from(
        binary.buffer.buffer,
        binary.buffer.byteOffset,
        length,
      );
    }
  }
  throw new Error("Video upload chunk data is invalid");
}

export async function saveInterviewVideoChunks({
  applicationId,
  questionId,
  uploadId,
  totalChunks,
  mimeType,
}: {
  applicationId: string;
  questionId: string;
  uploadId: string;
  totalChunks: number;
  mimeType: string;
}) {
  await ensureInterviewVideoIndexes();
  const filter = { applicationId, questionId, uploadId };
  const chunkCount = await InterviewVideoChunk.countDocuments(filter);
  if (chunkCount !== totalChunks) {
    throw new Error("Video upload is incomplete");
  }
  const firstChunk = await InterviewVideoChunk.findOne({
    ...filter,
    chunkIndex: 0,
    totalChunks,
    mimeType,
  }).select("data");
  if (!firstChunk) throw new Error("Video upload is incomplete");
  const firstChunkData = toVideoChunkBuffer(firstChunk.data);
  const signatureMatches =
    mimeType === "video/webm"
      ? firstChunkData.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
      : firstChunkData.subarray(4, 8).toString() === "ftyp";
  if (!signatureMatches) throw new Error("Video format could not be validated");

  const bucket = getInterviewVideoBucket();
  const expiresAt = new Date(Date.now() + INTERVIEW_VIDEO_RETENTION_MS);
  const extension = mimeType === "video/mp4" ? "mp4" : "webm";
  const upload = bucket.openUploadStream(
    `${applicationId}-${questionId}.${extension}`,
    {
      metadata: { applicationId, questionId, mimeType, expiresAt },
    },
  );
  const fileId = upload.id as ObjectId;
  const cursor = InterviewVideoChunk.find(filter)
    .sort({ chunkIndex: 1 })
    .select("chunkIndex totalChunks mimeType data")
    .lean()
    .cursor();
  try {
    await pipeline(
      Readable.from(
        (async function* () {
          let expectedIndex = 0;
          for await (const chunk of cursor) {
            if (
              chunk.chunkIndex !== expectedIndex ||
              chunk.totalChunks !== totalChunks ||
              chunk.mimeType !== mimeType
            ) {
              throw new Error("Video upload chunks are inconsistent");
            }
            expectedIndex += 1;
            yield toVideoChunkBuffer(chunk.data);
          }
          if (expectedIndex !== totalChunks) {
            throw new Error("Video upload is incomplete");
          }
        })(),
      ),
      upload,
    );
    await getDatabase()
      .collection("virtualInterviewVideos.chunks")
      .updateMany({ files_id: fileId }, { $set: { expiresAt } });
  } catch (error) {
    try {
      await bucket.delete(fileId);
    } catch (cleanupError) {
      console.error("Could not clean up an incomplete interview video:", cleanupError);
    }
    throw error;
  } finally {
    await cursor.close();
  }
  return { fileId: fileId.toString(), expiresAt };
}

export async function deleteInterviewVideo(fileId: string) {
  if (!mongoose.Types.ObjectId.isValid(fileId)) return;
  await ensureInterviewVideoIndexes();
  const objectId = new mongoose.Types.ObjectId(fileId);
  const existing = await getDatabase()
    .collection("virtualInterviewVideos.files")
    .findOne({ _id: objectId });
  if (!existing) return;
  await getInterviewVideoBucket().delete(
    objectId,
  );
}

export async function getInterviewVideoFile(fileId: string) {
  if (!mongoose.Types.ObjectId.isValid(fileId)) return null;
  await ensureInterviewVideoIndexes();
  return getDatabase()
    .collection("virtualInterviewVideos.files")
    .findOne({
      _id: new mongoose.Types.ObjectId(fileId),
      "metadata.expiresAt": { $gt: new Date() },
    });
}
