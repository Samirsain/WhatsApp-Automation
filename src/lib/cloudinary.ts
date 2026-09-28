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
 * Signs one browser-to-Cloudinary upload, so the secret never leaves the
 * server and files never pass through our request body limit.
 * CLOUDINARY_URL = cloudinary://<api_key>:<api_secret>@<cloud_name>
 */
export function signUpload(env: NodeJS.ProcessEnv = process.env): UploadTicket | null {
  const match = env.CLOUDINARY_URL?.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
  if (!match) return null;
  const [, apiKey, secret, cloud] = match;
  const folder = "direct-messages";
  const timestamp = String(Math.floor(Date.now() / 1000));
  // Cloudinary: sha1 of the sorted params joined with &, then the secret.
  const signature = createHash("sha1")
    .update(`folder=${folder}&timestamp=${timestamp}${secret}`)
    .digest("hex");
  return { url: `https://api.cloudinary.com/v1_1/${cloud}/auto/upload`, apiKey, timestamp, signature, folder };
}
