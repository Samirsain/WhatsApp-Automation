/**
 * The three approved property-brand templates (MARKETING, hi, IMAGE header,
 * body {{1}} = name, quick reply "BRAND"). Same values the n8n workflow used.
 * Not editable in the UI: a change here needs a newly approved template anyway.
 */
export type BrandTemplate = { template: string; image: string };

export const BRAND_LANGUAGE = "hi";

export const BRAND_TEMPLATES: readonly BrandTemplate[] = [
  { template: "property_brand_1", image: "https://res.cloudinary.com/dn7bbf8cp/image/upload/v1790311483/d5d81305-e7a9-423b-8d61-115b617be8c2_o2ugry.jpg" },
  { template: "property_brand_2", image: "https://res.cloudinary.com/dn7bbf8cp/image/upload/v1790311490/222fac9b-84bb-41a4-80b3-e70409ec655d_uovoqs.jpg" },
  { template: "property_brand_3", image: "https://res.cloudinary.com/dn7bbf8cp/image/upload/v1790311500/b6399380-9d9e-48f3-8ce9-161fd0c0b2d1_t4sqlt.jpg" },
];

export function pickTemplate(random: () => number = Math.random): BrandTemplate {
  const i = Math.min(BRAND_TEMPLATES.length - 1, Math.floor(random() * BRAND_TEMPLATES.length));
  return BRAND_TEMPLATES[i];
}

/** Sent once after a BRAND tap. Free: it goes inside the 24h window the tap opened. */
export function thankYouText(name: string | null): string {
  const who = name?.trim() ? ` *${name.trim()} जी*` : "";
  return `धन्यवाद${who} 🙏\nहमारी टीम जल्द ही आपसे संपर्क करेगी। ✅\n*3% Real Estate Club*`;
}
