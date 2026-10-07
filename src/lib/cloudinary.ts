import "server-only";
import { createHash } from "node:crypto";

export type UploadTicket = {
  url: string;
  apiKey: string;
  timestamp: string;
  signature: string;
  folder: string;
};

/**
 * Reads CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET,
 * or CLOUDINARY_URL = cloudinary://<api_key>:<api_secret>@<cloud_name>.
 */
function credentials(env: NodeJS.ProcessEnv) {
  const match = env.CLOUDINARY_URL?.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
  const cloud = env.CLOUDINARY_CLOUD_NAME?.trim() || match?.[3];
  const apiKey = env.CLOUDINARY_API_KEY?.trim() || match?.[1];
  const secret = env.CLOUDINARY_API_SECRET?.trim() || match?.[2];
  if (!cloud || !apiKey || !secret || secret === "PASTE_API_SECRET_HERE") return null;
  return { cloud, apiKey, secret };
}

/** Cloudinary: sha1 of the sorted params joined with &, then the secret. */
export function sign(params: Record<string, string>, secret: string): string {
  const query = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHash("sha1").update(query + secret).digest("hex");
}

/**
 * Signs one browser-to-Cloudinary upload, so the secret never leaves the
 * server and files never pass through our request body limit.
 */
export function signUpload(env: NodeJS.ProcessEnv = process.env): UploadTicket | null {
  const c = credentials(env);
  if (!c) return null;
  const folder = "direct-messages";
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = sign({ folder, timestamp }, c.secret);
  return { url: `https://api.cloudinary.com/v1_1/${c.cloud}/auto/upload`, apiKey: c.apiKey, timestamp, signature, folder };
}

/**
 * Server-side upload of a file we already hold. Same `publicId` overwrites,
 * so a repeated copy of one file stays one asset. Returns the https URL.
 * `raw` for documents: Cloudinary blocks PDF delivery as an image by default.
 */
export async function uploadFile(
  file: Blob,
  publicId: string,
  resourceType: "auto" | "raw",
  env: NodeJS.ProcessEnv = process.env,
): Promise<string | null> {
  const c = credentials(env);
  if (!c) return null;
  const params = { folder: "inbound", overwrite: "true", public_id: publicId, timestamp: String(Math.floor(Date.now() / 1000)) };
  const form = new FormData();
  for (const [k, v] of Object.entries(params)) form.append(k, v);
  form.append("api_key", c.apiKey);
  form.append("signature", sign(params, c.secret));
  form.append("file", file);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${c.cloud}/${resourceType}/upload`, { method: "POST", body: form });
  if (!res.ok) {
    console.error("[cloudinary] upload failed", res.status, (await res.text()).slice(0, 200));
    return null;
  }
  return ((await res.json()) as { secure_url?: string }).secure_url ?? null;
}
