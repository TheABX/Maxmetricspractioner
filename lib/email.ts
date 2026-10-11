/**
 * Transactional email via Resend. If RESEND_API_KEY is not set the message is
 * not sent; the caller still records a notification row so nothing is lost.
 */

export type EmailResult =
  | { sent: true; provider: "resend"; id: string | null }
  | { sent: false; provider: "none"; error: string };

export function appUrl(path = "") {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path}`;
}

export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "MAXMetrics <no-reply@maxmetrics.local>";
  if (!key) return { sent: false, provider: "none", error: "RESEND_API_KEY not configured" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [options.to], subject: options.subject, html: options.html, text: options.text }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { sent: false, provider: "none", error: `Resend ${res.status}: ${body.slice(0, 200)}` };
    }
    const json = (await res.json()) as { id?: string };
    return { sent: true, provider: "resend", id: json.id ?? null };
  } catch (e) {
    return { sent: false, provider: "none", error: e instanceof Error ? e.message : "send failed" };
  }
}

function wrap(title: string, body: string) {
  return `<!doctype html><html><body style="font-family:Georgia,serif;background:#f4efe6;padding:32px;color:#17202a">
  <div style="max-width:560px;margin:0 auto;background:#fffcf7;border:1px solid #e2d8c8;border-radius:12px;padding:28px">
    <p style="font-family:sans-serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#5c6770;margin:0">MAXMetrics</p>
    <h1 style="font-size:24px;margin:8px 0 16px">${title}</h1>
    ${body}
  </div></body></html>`;
}

export function inviteEmail(firstName: string, joinUrl: string) {
  return {
    subject: "Your MAXMetrics client portal",
    html: wrap(
      `Hi ${firstName}, your portal is ready`,
      `<p>Create your login with this email address to complete your intake questionnaire — including how you eat — and, once approved, see your report, training program, and nutrition targets.</p>
       <p><a href="${joinUrl}" style="display:inline-block;background:#1f4d3a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-family:sans-serif">Set up my login</a></p>
       <p style="color:#5c6770;font-size:13px">${joinUrl}</p>`,
    ),
    text: `Hi ${firstName}, set up your MAXMetrics login here: ${joinUrl}`,
  };
}

export function programSentEmail(firstName: string, programTitle: string, portalUrl: string, message?: string | null) {
  return {
    subject: `Your training program is ready — ${programTitle}`,
    html: wrap(
      `Hi ${firstName}, your program is ready`,
      `${message ? `<p>${message}</p>` : ""}
       <p>Your assessment report and <strong>${programTitle}</strong> are now in your portal. Log each session as you go — reps, weight, how it felt — so the next block can be adjusted from real data.</p>
       <p><a href="${portalUrl}" style="display:inline-block;background:#1f4d3a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-family:sans-serif">Open my program</a></p>`,
    ),
    text: `Hi ${firstName}, your program "${programTitle}" is ready: ${portalUrl}`,
  };
}

export function questionnaireRequestEmail(firstName: string, portalUrl: string) {
  return {
    subject: "Please update your MAXMetrics questionnaire",
    html: wrap(
      `Hi ${firstName}, a quick update`,
      `<p>Your practitioner has asked you to complete an updated intake questionnaire. It only takes a few minutes and helps keep your program current.</p>
       <p><a href="${portalUrl}" style="display:inline-block;background:#1f4d3a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-family:sans-serif">Open questionnaire</a></p>`,
    ),
    text: `Hi ${firstName}, please update your intake questionnaire: ${portalUrl}`,
  };
}

export function reportSentEmail(firstName: string, portalUrl: string) {
  return {
    subject: "Your MAXMetrics assessment report",
    html: wrap(
      `Hi ${firstName}, your report is ready`,
      `<p>Your physical capacity report is available in your portal.</p>
       <p><a href="${portalUrl}" style="display:inline-block;background:#1f4d3a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-family:sans-serif">View my report</a></p>`,
    ),
    text: `Hi ${firstName}, your report is ready: ${portalUrl}`,
  };
}

export function coachingEmail(firstName: string, body: string, portalUrl: string) {
  const htmlBody = body
    .split("\n")
    .map((p) => `<p>${p}</p>`)
    .join("");
  return {
    subject: "A note from your MAXMetrics coach",
    html: wrap(
      `Hi ${firstName}`,
      `${htmlBody}
       <p><a href="${portalUrl}" style="display:inline-block;background:#1f4d3a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-family:sans-serif">Open messages</a></p>`,
    ),
    text: `${body}\n\n${portalUrl}`,
  };
}
