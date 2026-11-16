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
  VALIDATION_FAILED: "Please check the highlighted fields.",
  GOOGLE_DISABLED: "Sign in with Google is not set up on this server. Use your email and password.",
  GOOGLE_INVALID: "Google sign-in did not go through. Try again.",
  GOOGLE_NO_ACCOUNT: "No account on the team uses this Google email. Ask the administrator for an invite link, or log in with your email and password.",
  CSRF_FAILED: "Request blocked for security reasons. Reload the page.",
  SERVER_UNAVAILABLE: "The server is not answering right now. Try again in a moment.",
  HTTP_ERROR: "The server refused the request. Reload the page and try again.",
};

export interface ApiError {
  code?: string;
  message: string;
  fields: Record<string, string>;
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
  if (code && overrides[code]) return { code, message: overrides[code], fields };
  // In the chosen language (the English text above is the fallback).
  return localizeError({ code, message: (code && MESSAGES[code]) || first?.message || "Something went wrong.", fields });
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
