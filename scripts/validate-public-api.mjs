const configured = process.env.NEXT_PUBLIC_API_BASE_URL;
if (!configured) throw new Error("Set the NEXT_PUBLIC_API_BASE_URL repository variable before publishing.");
const url = new URL(configured);
const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
if (url.protocol !== "https:" || ["localhost", "::1", "::", "0.0.0.0"].includes(host) || host.startsWith("::ffff:") || host.startsWith("127.") || host.endsWith(".localhost")) {
  throw new Error("The public API must use HTTPS and cannot point to a visitor's local computer.");
}
if (url.username || url.password || url.search || url.hash || url.pathname.replace(/\/$/, "") !== "/api/v1") {
  throw new Error("Use a credential-free HTTPS URL ending in /api/v1.");
}
console.log(`Production API validated: ${url.origin}/api/v1`);
