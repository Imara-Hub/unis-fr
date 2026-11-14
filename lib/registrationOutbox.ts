import type { ApiError } from "./errors";
import { registerParticipant, type RegistrationInput, type TermsAcceptance } from "./register";

// Registrations that could not be sent (no connection), kept on the phone with both photos
// (IndexedDB: localStorage cannot hold images) and sent by themselves when the connection returns:
// while the page is open, or the next time the registration link is opened.

export interface QueuedRegistration {
  id?: number;
  token: string;
  fullName: string;
  input: RegistrationInput;
  terms: TermsAcceptance;
  photo: Blob;
  idDocument: Blob;
  savedAt: number;
  // The server answered but refused it (terms changed, link closed…): no automatic retry; the
  // person gets it back in the form to fix and send.
  refused: { code?: string; message: string } | null;
}

const DB = "musabaqa";
const STORE = "registrations";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = work(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

// Saves a registration on the phone. False when the phone cannot store it (private mode, full).
export async function queueRegistration(item: Omit<QueuedRegistration, "id" | "savedAt" | "refused">) {
  try {
    await run("readwrite", (s) => s.add({ ...item, savedAt: Date.now(), refused: null }));
    return true;
  } catch {
    return false;
  }
}

export async function queuedRegistrations(token: string): Promise<QueuedRegistration[]> {
  try {
    const all = await run("readonly", (s) => s.getAll() as IDBRequest<QueuedRegistration[]>);
    return all.filter((r) => r.token === token).sort((a, b) => a.savedAt - b.savedAt);
  } catch {
    return [];
  }
}

export async function removeQueued(id: number) {
  try {
    await run("readwrite", (s) => s.delete(id));
  } catch {
    // nothing to do
  }
}

async function markRefused(item: QueuedRegistration, refused: NonNullable<QueuedRegistration["refused"]>) {
  try {
    await run("readwrite", (s) => s.put({ ...item, refused }));
  } catch {
    // nothing to do
  }
}

export type SendOutcome = "sent" | "waiting" | "refused";

// Answers that mean "not now" rather than "no": the registration stays queued and is tried again.
const TRY_LATER = new Set(["RATE_LIMITED", "INTERNAL_SERVER_ERROR"]);
// A queued registration still to be sent automatically (also one refused with "try later" by an
// earlier version of this page).
export const isWaiting = (item: QueuedRegistration) => !item.refused || TRY_LATER.has(item.refused.code ?? "");

// Tries to send one saved registration.
// ALREADY_REGISTERED is shown as refused, not counted as sent: it may be an earlier try whose answer
// was lost, but it may also be a different person with the same name and date of birth, and that
// registration must not vanish silently. The message tells the registrar to check.
export async function sendQueued(item: QueuedRegistration): Promise<{ outcome: SendOutcome; error?: ApiError }> {
  const result = await registerParticipant(item.token, item.input, item.terms, item.photo, item.idDocument);
  if ("fullName" in result) {
    await removeQueued(item.id!);
    return { outcome: "sent" };
  }
  if (!result.code || TRY_LATER.has(result.code)) return { outcome: "waiting" }; // no connection, or busy: later
  await markRefused(item, { code: result.code, message: result.message });
  return { outcome: "refused", error: result };
}

// The terms changed while it waited: the person read the new ones and accepted, send it again.
export async function resendWithTerms(item: QueuedRegistration, terms: TermsAcceptance) {
  const again = { ...item, terms, refused: null };
  try {
    await run("readwrite", (s) => s.put(again));
  } catch {
    // still sent below; only the copy on the phone could not be updated
  }
  return sendQueued(again);
}
