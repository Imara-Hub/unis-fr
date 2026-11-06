import { CombinedGraphQLErrors } from "@apollo/client";
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
  ALREADY_REGISTERED: "This phone number is already registered.",
  INVALID_PHOTO: "The photo must be a JPG or PNG image of at most 2 MB.",
  INVALID_ID_DOCUMENT: "The ID document must be a JPG or PNG photo of at most 2 MB.",
  NOT_FOUND: "Not found. It may have been deleted.",
  ENVELOPE_TAKEN: "This envelope was already drawn.",
  NOT_DRAWN: "This participant has not drawn an envelope yet.",
  SHEET_LOCKED: "This sheet was submitted and can no longer be changed.",
  VALIDATION_FAILED: "Please check the highlighted fields.",
  CSRF_FAILED: "Request blocked for security reasons. Reload the page.",
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
  const code = first?.extensions?.code as string | undefined;
  const fields: Record<string, string> = {};
  const list = first?.extensions?.fields as { field: string; message: string }[] | undefined;
  for (const f of list ?? []) fields[f.field] = f.message;
  if (code && overrides[code]) return { code, message: overrides[code], fields };
  // In the chosen language (the English text above is the fallback).
  return localizeError({ code, message: (code && MESSAGES[code]) || first?.message || "Something went wrong.", fields });
}

// Turns any Apollo error into { code, message, fields } for the UI.
export function readApiError(error: unknown, overrides: Record<string, string> = {}): ApiError {
  if (CombinedGraphQLErrors.is(error)) return apiErrorFrom(error.errors[0], overrides);
  return localizeError(NETWORK_ERROR);
}
