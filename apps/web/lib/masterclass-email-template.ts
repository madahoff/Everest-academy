/**
 * Gabarit de l'e-mail de confirmation d'inscription à une Masterclass.
 *
 * Fichier volontairement AUTONOME — aucune dépendance en dehors du calendrier — et
 * recopié à l'identique dans les deux applications, comme le sont déjà le schéma
 * Prisma et la tarification. C'est ce qui garantit que la confirmation renvoyée
 * depuis la console est mot pour mot celle qu'envoie la vitrine.
 */

import { formatSessionDate } from "@/lib/masterclass-month";

const APP_URL = (process.env.APP_PUBLIC_URL || process.env.NEXTAUTH_URL || "https://academy.pro-everest.com").replace(
    /\/+$/,
    "",
);

/** Aucune décimale : l'ariary n'en a pas, et le tarif en euros est un entier. */
function money(amount: number, currency: string): string {
    const value = Math.round(amount).toLocaleString("fr-FR");
    return currency === "EUR" ? `${value} €` : `${value} Ar`;
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

export interface ConfirmationData {
    recipientName: string;
    title: string;
    instructor: string;
    scheduledAt: Date;
    duration: string | null;
    location: string | null;
    /** Montant réglé. `0` pour une session offerte : la ligne devient « offerte ». */
    amount: number;
    currency: string;
    paid: boolean;
}

export function renderConfirmationEmail(data: ConfirmationData): { subject: string; html: string } {
    const rows: [string, string][] = [
        ["Masterclass", data.title],
        ["Date et heure", formatSessionDate(data.scheduledAt)],
        ...(data.duration ? ([["Durée", data.duration]] as [string, string][]) : []),
        ["Formateur", data.instructor],
        ["Lieu / accès", data.location || "Les modalités de connexion vous seront communiquées avant la séance"],
        [
            "Paiement",
            data.amount > 0
                ? `${money(data.amount, data.currency)} — ${data.paid ? "réglé" : "en attente"}`
                : "Session offerte",
        ],
    ];

    const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f9fafb;padding:24px 0;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;margin:0 auto;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
        <tr>
          <td align="center" style="background-color:#050505;padding:36px 20px;">
            <p style="margin:0;color:#2563EB;font-size:11px;font-weight:bold;letter-spacing:0.3em;text-transform:uppercase;">Everest Academy</p>
            <p style="margin:10px 0 0;color:#ffffff;font-size:22px;font-weight:bold;">Inscription confirmée</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px 8px;color:#1f2937;font-size:15px;line-height:1.6;">
            <p style="margin:0 0 16px;">Bonjour ${escapeHtml(data.recipientName)},</p>
            <p style="margin:0 0 24px;">
              Votre inscription à la Masterclass <strong>${escapeHtml(data.title)}</strong> est confirmée.
              Votre place est réservée${data.amount > 0 && data.paid ? " et votre paiement a bien été encaissé" : ""}.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e5e7eb;border-collapse:collapse;">
              ${rows
                  .map(
                      ([label, value], index) => `<tr style="background-color:${index % 2 === 0 ? "#f9fafb" : "#ffffff"};">
                <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.1em;color:#6b7280;width:38%;">${escapeHtml(label)}</td>
                <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;">${escapeHtml(value)}</td>
              </tr>`,
                  )
                  .join("")}
            </table>
            <p style="margin:24px 0 0;font-size:14px;color:#374151;">
              Présentez-vous une dizaine de minutes avant le début de la séance. En cas d'empêchement,
              répondez simplement à cet e-mail — nous reporterons votre place sur une prochaine session.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0 8px;">
              <tr><td align="center">
                <a href="${APP_URL}/masterclass" style="background-color:#2563EB;color:#ffffff;padding:14px 32px;text-decoration:none;font-weight:bold;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;display:inline-block;">
                  Voir la Masterclass
                </a>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="background-color:#f3f4f6;padding:24px;font-size:12px;color:#6b7280;line-height:1.5;border-top:1px solid #e5e7eb;">
            &copy; ${new Date().getFullYear()} Everest Academy. Tous droits réservés.<br/>
            <a href="${APP_URL}" style="color:#2563EB;text-decoration:none;">academy.pro-everest.com</a>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    return { subject: `Inscription confirmée — ${data.title}`, html };
}
