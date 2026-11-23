import { API_URL } from "./api";
import { apiErrorFrom, NETWORK_ERROR, type ApiError, type GraphQLErrorLike } from "./errors";
import { SET_AVATAR } from "./graphql/auth";
import { SET_BANNER } from "./graphql/seasons";
import { getSessionToken } from "./sessionToken";

// Profile picture upload: GraphQL multipart request, like the passport photo.
// The picture is shrunk and re-encoded first with preparePhoto (lib/register.ts).
export async function uploadAvatar(photo: Blob): Promise<{ avatarUrl: string | null } | ApiError> {
  const form = new FormData();
  form.append("operations", JSON.stringify({ query: SET_AVATAR, variables: { photo: null } }));
  form.append("map", JSON.stringify({ 0: ["variables.photo"] }));
  form.append("0", photo, "avatar.jpg");

  let body: { data?: { setAvatar: { avatarUrl: string | null } }; errors?: GraphQLErrorLike[] };
  try {
    const token = getSessionToken();
    const res = await fetch(API_URL, {
      method: "POST",
      body: form,
      credentials: "include",
      headers: {
        "x-csrf": "1",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    });
    body = await res.json();
  } catch {
    return NETWORK_ERROR;
  }
  if (body.errors?.length || !body.data) return apiErrorFrom(body.errors?.[0]);
  return body.data.setAvatar;
}

// The year's banner (admin): sent as it is (the API keeps it as a crisp PNG, at most 2 MB).
export async function uploadBanner(image: File): Promise<{ bannerUrl: string | null } | ApiError> {
  const form = new FormData();
  form.append("operations", JSON.stringify({ query: SET_BANNER, variables: { image: null } }));
  form.append("map", JSON.stringify({ 0: ["variables.image"] }));
  form.append("0", image, image.name || "banner.png");

  let body: { data?: { setBanner: { bannerUrl: string | null } }; errors?: GraphQLErrorLike[] };
  try {
    const token = getSessionToken();
    const res = await fetch(API_URL, {
      method: "POST",
      body: form,
      credentials: "include",
      headers: {
        "x-csrf": "1",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    });
    body = await res.json();
  } catch {
    return NETWORK_ERROR;
  }
  if (body.errors?.length || !body.data) return apiErrorFrom(body.errors?.[0]);
  return body.data.setBanner;
}
