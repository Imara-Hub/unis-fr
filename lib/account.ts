import { API_URL } from "./api";
import { apiErrorFrom, NETWORK_ERROR, type ApiError, type GraphQLErrorLike } from "./errors";
import { SET_AVATAR } from "./graphql/auth";

// Profile picture upload: GraphQL multipart request, like the passport photo.
// The picture is shrunk and re-encoded first with preparePhoto (lib/register.ts).
export async function uploadAvatar(photo: Blob): Promise<{ avatarUrl: string | null } | ApiError> {
  const form = new FormData();
  form.append("operations", JSON.stringify({ query: SET_AVATAR, variables: { photo: null } }));
  form.append("map", JSON.stringify({ 0: ["variables.photo"] }));
  form.append("0", photo, "avatar.jpg");

  let body: { data?: { setAvatar: { avatarUrl: string | null } }; errors?: GraphQLErrorLike[] };
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
  return body.data.setAvatar;
}
