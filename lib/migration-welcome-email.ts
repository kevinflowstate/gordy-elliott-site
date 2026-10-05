export const MIGRATION_EMAIL_LINKS = {
  appStore: "https://apps.apple.com/app/id6805066999",
  webApp: "https://app.onlinegordy.com/portal",
  feedback: "https://app.onlinegordy.com/support/report",
} as const;

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function assertEmailAccepted(result: {
  data: { id: string } | null;
  error: { message: string } | null;
}): string {
  if (result.error || !result.data?.id) {
    throw new Error(result.error?.message || "Email was not accepted by Resend");
  }
  return result.data.id;
}

export function buildMigrationWelcomeEmail(name: string, setupUrl: string) {
  const setup = new URL(setupUrl);
  if (setup.protocol !== "https:" || setup.origin !== "https://app.onlinegordy.com") {
    throw new Error("Migration setup link must use the production app domain");
  }
  const firstName = name.trim().split(/\s+/)[0] || "there";
  const subject = "Your new AT CAPACITY app is ready — let’s get you settled in";
  const text = `Hi ${firstName},

We’re moving your coaching over to the new AT CAPACITY app, and I’d love you to get started this week.

I’ve had this built around how we work together, bringing your training, progress and coaching support into one place.

This will be our last week on the old app. You can keep using it during the changeover, but please take some time this week to log into the new app, explore and give it a go. The aim is to have everyone fully switched over by this time next week.

Set up your account: ${setupUrl}

Set up your account first, then sign into the iPhone app or web app using the same email and password.

Download the iPhone app: ${MIGRATION_EMAIL_LINKS.appStore}
Open the web app: ${MIGRATION_EMAIL_LINKS.webApp}

We have an update coming to improve how grouped exercises and circuits appear in the iPhone app. In the meantime, please use the web app for workouts containing supersets or circuits so you see them grouped correctly.

As you use it, please let me know if anything doesn’t look right, something’s missing or you get stuck. Use the feedback form below so we can track each issue and get it sorted:

Report an issue: ${MIGRATION_EMAIL_LINKS.feedback}

A quick description of what happened—and a screenshot if possible—will really help.

Thanks for helping me put the finishing touches to this. I’m looking forward to getting everyone settled in.

Gordy`;
  const paragraph = (content: string) => `<p style="color:#555;font-size:15px;line-height:1.6;margin:0 0 20px;">${content}</p>`;
  const link = (href: string, label: string) => `<a href="${escapeHtml(href)}" style="color:#b72eaa;font-weight:600;">${label}</a>`;
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;">
    <h2 style="margin:0 0 16px;font-size:20px;color:#111;">Hi ${escapeHtml(firstName)},</h2>
    ${paragraph("We’re moving your coaching over to the new AT CAPACITY app, and I’d love you to get started this week.")}
    ${paragraph("I’ve had this built around how we work together, bringing your training, progress and coaching support into one place.")}
    ${paragraph("<strong>This will be our last week on the old app.</strong> You can keep using it during the changeover, but please take some time this week to log into the new app, explore and give it a go. The aim is to have everyone fully switched over by this time next week.")}
    <p style="margin:0 0 20px;"><a href="${escapeHtml(setupUrl)}" style="display:inline-block;background:#E040D0;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;">Set up your account →</a></p>
    ${paragraph("Set up your account first, then sign into the iPhone app or web app using the same email and password.")}
    ${paragraph(`${link(MIGRATION_EMAIL_LINKS.appStore, "Download the iPhone app →")}<br><br>${link(MIGRATION_EMAIL_LINKS.webApp, "Open the web app →")}`)}
    ${paragraph("We have an update coming to improve how grouped exercises and circuits appear in the iPhone app. In the meantime, please use the web app for workouts containing supersets or circuits so you see them grouped correctly.")}
    ${paragraph("As you use it, please let me know if anything doesn’t look right, something’s missing or you get stuck. <strong>Use the feedback form below</strong> so we can track each issue and get it sorted:")}
    ${paragraph(link(MIGRATION_EMAIL_LINKS.feedback, "Report an issue →"))}
    ${paragraph("A quick description of what happened—and a screenshot if possible—will really help.")}
    ${paragraph("Thanks for helping me put the finishing touches to this. I’m looking forward to getting everyone settled in.")}
    ${paragraph("Gordy")}
    <p style="color:#999;font-size:12px;margin:32px 0 0;">AT CAPACITY - Client Portal</p>
  </div>`;
  return { subject, html, text };
}
