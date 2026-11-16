# unis-fr

Frontend of the UNIS Musabaqa (Quran competition) platform, built with [Next.js](https://nextjs.org) and Chakra UI.

## Getting Started

Copy `.env.example` to `.env.local` and point `NEXT_PUBLIC_API_URL` at the GraphQL API, then run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) with your browser to see the result.

On Windows, `npm run dev:windows` starts the dev server with the right network settings for phones on the same Wi-Fi.

## Who can open the app

The team's pages (login, dashboard, judging…) are not public. Once an entry key exists, a browser only sees them after opening:

- an **invite link** sent by the admin (judges and staff), or
- the **entry link** `https://<domain>/enter/<key>` (the owners' own devices, and the very first signup).

Anyone else who types the domain lands on the public results page. Registration links, the results page and the stage-screen link stay public.

The key lives in the API: the first one is `ORG_ACCESS_KEY` in the API's `.env` (handed over with the app); the admin then makes their own in Settings → Access to the app, which replaces it and locks every browser out until they open a link again. With no key at all (development) there is no gate. `proxy.ts` asks the API about the cookie (answers cached 30 s), see `lib/access.ts`.

## Sign in with Google (optional)

Set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` here and the same value as `GOOGLE_CLIENT_ID` on the API, and a Google button appears under the login, signup and invite forms (`components/GoogleSignIn.tsx`). Google's ID token is checked by the API; a user is matched by their Google account, then by email (linked on first login). Accounts created with Google have no password until an admin gives a temporary one. Without the variable nothing changes.
