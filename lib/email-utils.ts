import { Resend } from "resend"
import { APRIME_EMETTEUR } from "@/lib/emetteur"

/**
 * Helpers partagés par toutes les routes /api/notify-* :
 * - validation d'email
 * - escape HTML pour les templates
 * - configuration Resend (clé API + adresse expéditeur société)
 */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function escapeHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Adresse expéditeur de tous les envois (rapports, devis, factures, relances) :
 * toujours l'adresse société de `APRIME_EMETTEUR`, dont le domaine est vérifié
 * sur Resend. Aucune variable d'env ne peut la détourner : RESEND_TEST_EMAIL ne
 * redirige que le DESTINATAIRE (cf. getResendRecipient), jamais l'expéditeur.
 */
export function getResendFromEmail(): string {
  return APRIME_EMETTEUR.email
}

/** Destinataire effectif : si RESEND_TEST_EMAIL est défini il prime sur le client. */
export function getResendRecipient(clientEmail: string): string {
  return process.env.RESEND_TEST_EMAIL || clientEmail
}

export type ResendCtx = {
  resend: Resend
  fromEmail: string
  recipient: string
}

/**
 * Initialise Resend ou renvoie une erreur structurée.
 * Pattern d'usage :
 *   const ctx = initResend(clientEmail)
 *   if ('error' in ctx) return NextResponse.json(ctx, { status: ctx.status })
 */
export function initResend(clientEmail: string): ResendCtx | { error: string; status: number } {
  if (!clientEmail || typeof clientEmail !== 'string' || !EMAIL_RE.test(clientEmail)) {
    return { error: 'Email client invalide', status: 400 }
  }
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    return { error: 'RESEND_API_KEY manquante', status: 500 }
  }
  return {
    resend: new Resend(resendKey),
    fromEmail: getResendFromEmail(),
    recipient: getResendRecipient(clientEmail),
  }
}
