import type { KobConsentSheet } from '@/types/kob';

/** Whether the player has answered the Consent Sheet at all. A read-only sheet hides it if not. */
export function hasAnyConsentContent(consent: KobConsentSheet): boolean {
  return (
    consent.crush ||
    consent.date ||
    consent.partner ||
    consent.onScreenIntimacy ||
    consent.offScreenIntimacy ||
    Boolean(consent.relationshipNotes.trim()) ||
    Boolean(consent.characterNotes.trim())
  );
}
