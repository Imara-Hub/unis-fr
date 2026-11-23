import { CombinedGraphQLErrors, ServerError, ServerParseError } from "@apollo/client";
import { localizeError } from "@/lib/i18n/core";

// English messages for the API's stable error codes. The other languages: lib/i18n (errors).
const MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: "Please log in.",
  FORBIDDEN: "You do not have access to this.",
  INVALID_CREDENTIALS: "Wrong email or password.",
  ACCOUNT_LOCKED: "Too many wrong attempts. Try again in 15 minutes.",
  RATE_LIMITED: "Too many attempts from this device. Please wait and try again.",
  SIGNUP_CLOSED: "Signup is closed. Please log in.",
  LINK_INVALID: "This link is not valid anymore. Ask the organisers for a new one.",
  REGISTRATION_CLOSED: "Registration is closed.",
  TERMS_NOT_SET: "Registration is not ready yet. Try again later.",
  TERMS_CHANGED: "The terms and conditions were just updated. Read them again and accept to continue.",
  REVIEW_LOCKED: "This participant was already called on stage, so the registration can no longer be rejected.",
  NOT_APPROVED: "This registration is not approved yet.",
  ALREADY_REGISTERED: "This person is already registered (same name and date of birth).",
  INVALID_PHOTO: "The photo must be a JPG or PNG image of at most 2 MB.",
  INVALID_ID_DOCUMENT: "The ID document must be a JPG or PNG photo of at most 2 MB.",
  NOT_FOUND: "Not found. It may have been deleted.",
  ENVELOPE_TAKEN: "This envelope was already drawn.",
  NOT_DRAWN: "This participant has not drawn an envelope yet.",
  SHEET_LOCKED: "This sheet was submitted and can no longer be changed.",
  ALREADY_RECITED: "This participant has already recited.",
  PANEL_COMPLETE: "All the judges already submitted for this participant: the score is final.",
  MARKS_DIFFER: "Your count differs from the other judges. Recount the marks shown. If you are sure, ask the admin.",
  NOT_FINALIST: "The final is on: only the finalists can be called.",
  FINAL_STARTED: "The final has started: the tasfia can no longer change.",
  FINAL_UNDERWAY: "A finalist already drew a final envelope: the final can no longer be undone.",
  ROUND_NOT_OVER: "The tasfia is not over: someone is on stage or still waits for the judges' sheets.",
  NO_FINALISTS: "Nobody passed the tasfia, so there is no final.",
  ROUND_CHANGED: "This sheet was marked in the tasfia, but the final is on stage now: it was not saved.",
  RESULTS_PUBLISHED: "The results are published: unpublish them first to change a score.",
  NOT_CHIEF_JUDGE: "Only the chief judge calls the participants.",
  SEASON_CLOSED: "This is a past year: it can only be looked at. Go back to the current year to make changes.",
  VALIDATION_FAILED: "Please check the highlighted fields.",
  GOOGLE_DISABLED: "Sign in with Google is not set up on this server. Use your email and password.",
  GOOGLE_INVALID: "Google sign-in did not go through. Try again.",
  GOOGLE_NO_ACCOUNT: "No account on the team uses this Google email. Ask the administrator for an invite link, or log in with your email and password.",
  GOOGLE_ACCOUNT_USED: "This Google account is already linked to another account on the team. Choose another Google account, or log in with that account.",
  CSRF_FAILED: "Request blocked for security reasons. Reload the page.",
  SERVER_UNAVAILABLE: "The server is not answering right now. Try again in a moment.",
  HTTP_ERROR: "The server refused the request. Reload the page and try again.",
};

export interface ApiError {
  code?: string;
  message: string;
  fields: Record<string, string>;
  // MARKS_DIFFER: where the judge's Fath, Tanbih or Kusita count is not the other judges'.
  differences?: MarkDifference[];
}

export interface MarkDifference {
  question: number; // 1 to 3
  mark: "fath" | "tanbih" | "kusita";
  // What the other judges counted when they all agree (e.g. 1: reminded once); null when they do not.
  count: number | null;
}

export interface GraphQLErrorLike {
  message: string;
  extensions?: Record<string, unknown>;
}

export const NETWORK_ERROR: ApiError = { message: "Cannot reach the server. Is the API running?", fields: {} };

// Turns the first GraphQL error into { code, message, fields } for the UI.
export function apiErrorFrom(first: GraphQLErrorLike | undefined, overrides: Record<string, string> = {}): ApiError {
  // The server answered with an error but no code: still a refusal, not a lost connection
  // (callers treat "no code" as offline and retry), so it gets a code of its own.
  const code = (first?.extensions?.code as string | undefined) ?? (first ? "UNKNOWN_ERROR" : undefined);
  const fields: Record<string, string> = {};
  const list = first?.extensions?.fields as { field: string; message: string }[] | undefined;
  for (const f of list ?? []) fields[f.field] = f.message;
  const differences = first?.extensions?.differences as MarkDifference[] | undefined;
  if (code && overrides[code]) return { code, message: overrides[code], fields };
  // In the chosen language (the English text above is the fallback).
  return localizeError({
    code,
    message: (code && MESSAGES[code]) || first?.message || "Something went wrong.",
    fields,
    ...(differences ? { differences } : {}),
  });
}

// Turns any Apollo error into { code, message, fields } for the UI.
// An answer that is not GraphQL (an HTML page from a proxy in front of the API) gets its own code:
// a server error or "busy" is SERVER_UNAVAILABLE (try again later), anything else HTTP_ERROR (a "no"
// to show). No code at all means the server could not be reached: no connection.
export function readApiError(error: unknown, overrides: Record<string, string> = {}): ApiError {
  if (CombinedGraphQLErrors.is(error)) return apiErrorFrom(error.errors[0], overrides);
  if (ServerError.is(error) || ServerParseError.is(error)) {
    const status = error.statusCode;
    const busy = status >= 500 || status === 408 || status === 429;
    return apiErrorFrom({ message: "", extensions: { code: busy ? "SERVER_UNAVAILABLE" : "HTTP_ERROR" } }, overrides);
  }
  return localizeError(NETWORK_ERROR);
}
