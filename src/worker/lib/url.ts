const MAX_URL_LENGTH = 2048;

function isPrivateOrReservedIp(host: string): boolean {
  const h = host.toLowerCase();
  const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a > 255) return true; // not a valid IPv4 address
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // 127.0.0.0/8 loopback
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local
    if (a >= 224) return true; // multicast/reserved
    return false;
  }
  if (h.includes(":")) {
    const bare = h.replace(/^\[/, "").replace(/\]$/, "");
    if (bare === "::1" || bare === "::") return true;
    if (bare.startsWith("fc") || bare.startsWith("fd")) return true; // fc00::/7 unique-local
    if (/^fe[89ab]/.test(bare)) return true; // fe80::/10 link-local
    const mapped = bare.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
    if (mapped) return isPrivateOrReservedIp(mapped[1]);
    return false;
  }
  return false;
}

/**
 * True when the value parses as an `https://` URL pointing at a public host —
 * no localhost, no private/reserved IP literals, no embedded credentials.
 * Operator-controlled values (env) may be trusted before this check; this is
 * the gate for anything a user can write to the settings store.
 */
export function isPublicHttpsUrl(value: string): boolean {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) return false;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  if (!host) return false;
  if (host === "localhost" || host.endsWith(".localhost")) return false;
  if (isPrivateOrReservedIp(host)) return false;
  return true;
}
