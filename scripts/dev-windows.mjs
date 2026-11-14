// Opens one browser window per role, each on its own address, so every one keeps its own login:
//   http://admin.localhost:3001, http://staff.localhost:3001, http://judge1.localhost:3001, ...
// A browser keeps cookies per host name, and *.localhost is always this computer, so signing in as
// a judge in one window never signs the admin out of another. Each address also reaches the API on
// the same name (admin.localhost:5500, see lib/api.ts), which in development accepts any *.localhost.
//
// Usage (with `yarn dev` and the API running):
//   yarn dev:windows                 admin, staff, judge1–3
//   yarn dev:windows --judges=5      admin, staff, judge1–5
//   yarn dev:windows --only=judge2   just that one
//   yarn dev:windows --list          only print the links
import { spawn } from "node:child_process";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }),
);
const port = Number(args.port ?? 3001);
const judges = Math.max(0, Math.min(10, Number(args.judges ?? 3)));

const windows = [
  { name: "admin", path: "/dashboard" },
  { name: "staff", path: "/dashboard" },
  ...Array.from({ length: judges }, (_, i) => ({ name: `judge${i + 1}`, path: "/dashboard" })),
].filter((w) => !args.only || String(args.only).split(",").includes(w.name));

const urlOf = (w) => `http://${w.name}.localhost:${port}${w.path}`;

console.log("\nOne login per window (sign in once in each, the browser remembers it):\n");
for (const w of windows) console.log(`  ${w.name.padEnd(8)} ${urlOf(w)}`);
console.log(
  "\nStage screen: as admin, open Questions → stage screen link, and open it in its own window" +
    " (it needs no login).\nRegistration: open the registration link from the admin window.\n",
);

if (args.list) process.exit(0);

// A new window each (Chrome / Edge); otherwise the default browser opens them as tabs.
function open(url) {
  if (process.platform === "win32") {
    const chrome = spawn("cmd", ["/c", "start", "", "chrome", "--new-window", url], { stdio: "ignore" });
    chrome.on("exit", (code) => {
      if (code !== 0) spawn("cmd", ["/c", "start", "", url], { stdio: "ignore", detached: true }).unref();
    });
  } else if (process.platform === "darwin") {
    spawn("open", ["-na", "Google Chrome", "--args", "--new-window", url], { stdio: "ignore" }).on("error", () =>
      spawn("open", [url], { stdio: "ignore" }),
    );
  } else {
    spawn("xdg-open", [url], { stdio: "ignore", detached: true }).unref();
  }
}

windows.forEach((w, i) => setTimeout(() => open(urlOf(w)), i * 400));
