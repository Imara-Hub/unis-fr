import { API_URL } from "./api";
import { apiErrorFrom, NETWORK_ERROR, type ApiError, type GraphQLErrorLike } from "./errors";
import { REGISTER_PARTICIPANT, type Gender } from "./graphql/participants";

export interface RegistrationInput {
  firstName: string;
  middleName: string; // optional: "" when there is none
  lastName: string;
  phone: string;
  dateOfBirth: string;
  gender: Gender;
  province: string;
  commune: string;
  institution: string; // halaqa
}

// Burundi's five provinces, as on the competition flyer: suggestions only, any province can be typed.
export const PROVINCES = ["Bujumbura", "Buhumuza", "Burunga", "Butanyerere", "Gitega"] as const;
// The flyer: "umri usio zidi 29".
export const MAX_AGE = 29;

// Passport photo: 35 × 45 mm, portrait. Every photo is cropped to this shape.
export const PASSPORT_RATIO = 35 / 45;
const OUT_W = 700; // px → 700 × 900, sharp enough to print
// Smaller than this, the face cannot be recognised once printed.
const MIN_W = 300;
const MIN_H = Math.round(MIN_W / PASSPORT_RATIO);
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_SIDE = 1000; // px: other photos (profile pictures, ID documents) keep their shape

export class PhotoTooSmallError extends Error {}

// Phone cameras make 3–8 MB photos in any shape. For a passport photo, cut the largest
// 35:45 portrait out of the middle (a little towards the top, where the face usually is) and
// scale it to 700 × 900. Other photos are only shrunk to at most 1000 px. Then re-encode as
// JPEG: ~150 KB, always under the server's 2 MB limit. ID documents pass a larger maxSide so
// the text stays readable.
export async function preparePhoto(file: File, { passport = false, maxSide = MAX_SIDE } = {}): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;

  if (!passport) {
    const scale = Math.min(1, maxSide / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return toJpeg(canvas);
  }

  let cropW = width;
  let cropH = Math.round(width / PASSPORT_RATIO);
  if (cropH > height) {
    cropH = height;
    cropW = Math.round(height * PASSPORT_RATIO);
  }
  if (cropW < MIN_W || cropH < MIN_H) {
    bitmap.close();
    throw new PhotoTooSmallError("photo too small");
  }
  const x = Math.round((width - cropW) / 2);
  const y = Math.round((height - cropH) * 0.3);

  const canvas = document.createElement("canvas");
  canvas.width = Math.min(OUT_W, cropW);
  canvas.height = Math.round(canvas.width / PASSPORT_RATIO);
  canvas.getContext("2d")!.drawImage(bitmap, x, y, cropW, cropH, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return toJpeg(canvas);
}

async function toJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
  if (!blob || blob.size > MAX_BYTES) throw new Error("photo too large");
  return blob;
}

// The terms the person was shown, and whether they ticked "I accept".
export interface TermsAcceptance {
  acceptTerms: boolean;
  termsVersion: number;
}

// GraphQL multipart request: the two images travel as files next to the JSON.
export async function registerParticipant(
  token: string,
  input: RegistrationInput,
  terms: TermsAcceptance,
  photo: Blob,
  idDocument: Blob,
): Promise<{ fullName: string } | ApiError> {
  const form = new FormData();
  form.append(
    "operations",
    JSON.stringify({
      query: REGISTER_PARTICIPANT,
      variables: {
        token,
        input: { ...input, middleName: input.middleName.trim() || null, ...terms },
        photo: null,
        idDocument: null,
      },
    }),
  );
  form.append("map", JSON.stringify({ 0: ["variables.photo"], 1: ["variables.idDocument"] }));
  form.append("0", photo, "photo.jpg");
  form.append("1", idDocument, "id-document.jpg");

  let body: { data?: { registerParticipant: { fullName: string } }; errors?: GraphQLErrorLike[] };
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      body: form,
      credentials: "include",
      headers: { "x-csrf": "1" },
    });
    body = await res.json();
  } catch {
    return NETWORK_ERROR;
  }
  if (body.errors?.length || !body.data) return apiErrorFrom(body.errors?.[0]);
  return body.data.registerParticipant;
}
