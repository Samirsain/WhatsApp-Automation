/**
 * The funnel templates (MARKETING, hi, IMAGE header, body {{1}} = name, quick
 * reply "BRAND"). Step 1 goes first; step 2 if no reply in 3 days; step 3 if
 * still none 2 days later (src/lib/brand/funnel.ts). Within a step one is
 * picked at random. Not editable in the UI: a change needs a newly approved template anyway.
 */
export type FunnelStep = 1 | 2 | 3;
export type BrandTemplate = { template: string; image: string };

export const BRAND_LANGUAGE = "hi";

// One header image per step: "Dealer नहीं, Brand बनिए" / "कृपया ध्यान दें" / "Last chance".
const IMG: Record<FunnelStep, string> = {
  1: "https://res.cloudinary.com/tnvyehsj/image/upload/v1790595262/funnel/funnel_1.jpg",
  2: "https://res.cloudinary.com/tnvyehsj/image/upload/v1790595264/funnel/funnel_2.jpg",
  3: "https://res.cloudinary.com/tnvyehsj/image/upload/v1790595265/funnel/funnel_3.jpg",
};

export const FUNNEL: Record<FunnelStep, readonly BrandTemplate[]> = {
  1: [
    { template: "funnel_1a", image: IMG[1] },
    { template: "funnel_1b", image: IMG[1] },
    { template: "funnel_1c", image: IMG[1] },
  ],
  2: [
    { template: "funnel_2a", image: IMG[2] },
    { template: "funnel_2b", image: IMG[2] },
    { template: "funnel_2c", image: IMG[2] },
  ],
  3: [{ template: "funnel_3", image: IMG[3] }],
};

export function pickTemplate(step: FunnelStep = 1, random: () => number = Math.random): BrandTemplate {
  const list = FUNNEL[step];
  return list[Math.min(list.length - 1, Math.floor(random() * list.length))];
}

/** Sent once after a BRAND tap. Free: it goes inside the 24h window the tap opened. */
export function thankYouText(name: string | null): string {
  const who = name?.trim() ? ` *${name.trim().toUpperCase()} जी*` : "";
  return `धन्यवाद${who} 🙏\nहमारी टीम जल्द ही आपसे संपर्क करेगी। ✅\n*3% Real Estate Club*`;
}
