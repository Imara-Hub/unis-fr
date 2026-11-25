import { API_URL } from "./api";
import { apiErrorFrom, NETWORK_ERROR, type ApiError, type GraphQLErrorLike } from "./errors";
import {
  REGISTER_PARTICIPANT,
  type Gender,
  type GuardianRelation,
  type RegisteredBy,
  type RegistrarInstitutionType,
} from "./graphql/participants";

// The parent / guardian, or the person responsible at the school / masjid / markaz.
export interface RegistrarContactInput {
  name: string;
  phone: string;
  relation: GuardianRelation | null; // GUARDIAN
  institutionType: RegistrarInstitutionType | null; // INSTITUTION
  institutionName: string | null; // INSTITUTION
}

export interface RegistrationInput {
  firstName: string;
  middleName?: string; // no longer asked: only registrations queued before the full-name field have one
  lastName: string;
  // The participant's own phone: required when they register themselves, optional otherwise ("" = none).
  phone: string;
  registeredBy: RegisteredBy;
  contact: RegistrarContactInput | null; // null when they register themselves
  dateOfBirth: string;
  gender: Gender;
  province: string;
  commune: string;
  institution: string; // madrassa / halaqah / markaz
  institutionLocation: string; // where it is
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
// JPEG at quality 0.8: ~80–120 KB for the photo, ~150–250 KB for an ID document (larger maxSide,
// so its text stays readable), always under the server's 2 MB limit. Small on purpose: on a 2G
// (EDGE) phone, sending goes at a few KB per second.
export async function preparePhoto(file: File, { passport = false, maxSide = MAX_SIDE } = {}): Promise<Blob> {
  // Phone photos carry their rotation in EXIF: apply it, or portraits come out sideways.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => createImageBitmap(file));
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
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
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
        input: { ...input, middleName: input.middleName?.trim() || null, phone: input.phone.trim() || null, ...terms },
        photo: null,
        idDocument: null,
      },
    }),
  );
  form.append("map", JSON.stringify({ 0: ["variables.photo"], 1: ["variables.idDocument"] }));
  form.append("0", photo, "photo.jpg");
  form.append("1", idDocument, "id-document.jpg");

  // A weak connection can stall without ever failing: give up after a while and treat it as no
  // connection, so the registration waits on the phone and goes again (instead of a spinner for
  // ever, and a queue that never moves on). The wait grows with what is sent: on 2G two photos take
  // a minute or two, and a fixed limit would cut every try short, the queued ones too.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), registerTimeoutMs(photo.size + idDocument.size));
  try {
    let res: Response;
    try {
      res = await fetch(API_URL, {
        method: "POST",
        body: form,
        credentials: "include",
        headers: { "x-csrf": "1" },
        signal: controller.signal,
      });
    } catch {
      return NETWORK_ERROR; // no connection, or no answer in time
    }
    let body: { data?: { registerParticipant: { fullName: string } }; errors?: GraphQLErrorLike[] };
    try {
      body = await res.json();
    } catch {
      // Cut off while the answer was arriving: as if there were no connection. If it did go in, the
      // next try is told ALREADY_REGISTERED and the person is asked to check.
      if (controller.signal.aborted) return NETWORK_ERROR;
      // The server answered, but not with JSON: a proxy in front of the API (nginx, Render…).
      // Too large is a final "no" (smaller photos are needed); a server error is "try again later".
      if (res.status === 413) return apiErrorFrom({ message: "", extensions: { code: "INVALID_PHOTO" } });
      if (res.status >= 500) return apiErrorFrom({ message: "", extensions: { code: "INTERNAL_SERVER_ERROR" } });
      return apiErrorFrom({ message: `The server refused the registration (HTTP ${res.status}).`, extensions: { code: "HTTP_ERROR" } });
    }
    if (body.errors?.length || !body.data) return apiErrorFrom(body.errors?.[0]);
    return body.data.registerParticipant;
  } finally {
    clearTimeout(timer);
  }
}

// How long one registration may take to send: a minute, plus the photos at 2 KB per second (a
// poor EDGE line), at most 4½ minutes (the API stops waiting for a request after 5).
export function registerTimeoutMs(bytes: number) {
  return Math.min(60_000 + Math.ceil(bytes / 2_000) * 1_000, 270_000);
}
