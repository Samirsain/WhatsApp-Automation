/**
 * The ID the team quotes for a lead: "L-0042". The number comes from the
 * database (Customer.leadNumber), so it is unique and never reused, even after
 * a customer is deleted. Padded to four digits so IDs sort and read evenly;
 * past 9999 they simply grow.
 */
export function leadId(leadNumber: number): string {
  return `L-${String(leadNumber).padStart(4, "0")}`;
}
