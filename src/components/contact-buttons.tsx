import { buttonClass } from "@/components/ui";

/** WhatsApp and Call as real buttons, so a lead is one tap away on any screen. */
export function ContactButtons({ phone, className = "" }: { phone: string; className?: string }) {
  const digits = phone.replace(/\D/g, "");
  return (
    <div className={`gap-2 print:hidden ${className}`}>
      <a href={`https://wa.me/${digits}`} target="_blank" rel="noreferrer" className={buttonClass.secondary}>
        <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 21l1.7-5A8.5 8.5 0 1 1 8 19.3z" />
        </svg>
        WhatsApp
      </a>
      <a href={`tel:${phone}`} className={buttonClass.secondary}>
        <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />
        </svg>
        Call
      </a>
    </div>
  );
}
