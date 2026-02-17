export const parseCookieHeader = (cookieHeader: string | null): Record<string, string> => {
  if (!cookieHeader) return {};

  return cookieHeader.split(";").reduce<Record<string, string>>((acc, item) => {
    const [rawKey, ...rawValue] = item.trim().split("=");
    if (!rawKey) return acc;
    acc[rawKey] = decodeURIComponent(rawValue.join("="));
    return acc;
  }, {});
};

type CookieOptions = {
  path?: string;
  httpOnly?: boolean;
  sameSite?: "Lax" | "Strict" | "None";
  secure?: boolean;
  maxAge?: number;
  expires?: Date;
};

export const serializeCookie = (name: string, value: string, options: CookieOptions = {}): string => {
  const segments = [`${name}=${encodeURIComponent(value)}`];
  segments.push(`Path=${options.path ?? "/"}`);
  if (options.httpOnly !== false) segments.push("HttpOnly");
  segments.push(`SameSite=${options.sameSite ?? "Lax"}`);
  if (options.secure) segments.push("Secure");
  if (typeof options.maxAge === "number") segments.push(`Max-Age=${options.maxAge}`);
  if (options.expires) segments.push(`Expires=${options.expires.toUTCString()}`);
  return segments.join("; ");
};

export const clearCookie = (name: string, options: Omit<CookieOptions, "maxAge" | "expires"> = {}): string =>
  serializeCookie(name, "", {
    ...options,
    maxAge: 0,
    expires: new Date(0),
  });
