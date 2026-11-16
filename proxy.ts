import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, checkAccess, enterWithInvitation, grantAccess } from "@/lib/access";

// Runs before every page (not assets, see `config`). See lib/access.ts for the idea.
//
// Public, for participants and anyone they share with: the registration form, the results, the
// stage screen. Everything else is the team's and needs the access cookie; without it the visitor
// is sent to the public results page, as if the rest did not exist.
const PUBLIC = [/^\/results(\/|$)/, /^\/register\//, /^\/stage-screen\//, /^\/enter\//];
// An invite link comes from the admin: opening it unlocks this browser, so the new judge or staff
// member can log in afterwards.
const INVITE = /^\/invite\/([^/?#]+)/;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC.some((re) => re.test(pathname))) return NextResponse.next();

  const cookie = request.cookies.get(ACCESS_COOKIE)?.value;
  const invite = INVITE.exec(pathname);
  if (invite) {
    const response = NextResponse.next();
    if ((await checkAccess(cookie)) !== "no") return response;
    const token = await enterWithInvitation(decodeURIComponent(invite[1]));
    // A dead link still opens the page: it explains itself there ("not valid anymore").
    return token ? grantAccess(request, response, token) : response;
  }

  const allowed = (await checkAccess(cookie)) !== "no";
  // The bare address: the login page for the team (it moves on to /dashboard when already logged
  // in, or to /signup on a fresh install), the results for everyone else.
  if (pathname === "/") return NextResponse.redirect(new URL(allowed ? "/login" : "/results", request.url));
  if (allowed) return NextResponse.next();

  return NextResponse.redirect(new URL("/results", request.url));
}

export const config = {
  // Pages only: not Next's own files, nor anything with a file extension (icons, fonts, sw.js,
  // manifest.webmanifest, robots.txt…), which the public pages and the installed app need.
  matcher: ["/((?!_next/|.*\\.[a-zA-Z0-9]+$).*)"],
};
