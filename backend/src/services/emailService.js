/**
 * Sends via Resend's HTTP API instead of SMTP. Render's free tier blocks
 * outbound traffic on SMTP ports 25/465/587 as of Sept 2025, which is why
 * Nodemailer worked locally but timed out in production — this uses a plain
 * HTTPS POST instead, which isn't affected by that restriction.
 *
 * No new dependency: Node 18+ (already required by this project) has global
 * fetch built in.
 *
 * Email is still optional. With no RESEND_API_KEY configured, every send
 * becomes a console line instead, so development and CI never depend on it
 * and a missing key can't break a signup.
 *
 * Sandbox mode: until a domain is verified in Resend, FROM must be
 * onboarding@resend.dev and mail can only be delivered TO the address that
 * owns the Resend account — fine for development, not for real clinic use.
 * Verifying a domain (resend.com/domains) lifts both restrictions.
 */

const RESEND_API_URL = "https://api.resend.com/emails";

const CONFIGURED = Boolean(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM || "PetPrint <onboarding@resend.dev>";

const shell = (heading, bodyHtml) => `
<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#12241f;max-width:520px">
  <p style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#5c6f68;margin:0 0 4px">PetPrint</p>
  <h1 style="font-size:20px;margin:0 0 12px">${heading}</h1>
  ${bodyHtml}
  <p style="font-size:12px;color:#8a9a94;margin-top:24px;border-top:1px solid #dde5e1;padding-top:12px">
    You're receiving this because you have a PetPrint account at your clinic.
  </p>
</div>`;

async function sendMail({ to, subject, text, html }) {
  if (!to) return { sent: false, reason: "no recipient" };

  if (!CONFIGURED) {
    console.log(`[email:skipped] to=${to} subject="${subject}" (RESEND_API_KEY not set)`);
    return { sent: false, reason: "not configured" };
  }

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ from: FROM, to, subject, text, html }),
    signal: AbortSignal.timeout(10000)
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    // A 403 here almost always means the sandbox-domain restriction: sending
    // to anyone other than the Resend account's own address before a domain
    // is verified. Surfacing the raw response makes that obvious in the logs
    // rather than looking like a generic failure.
    throw new Error(`Resend ${res.status}: ${detail.slice(0, 300)}`);
  }

  const data = await res.json();
  console.log(`[email:sent] to=${to} subject="${subject}" id=${data.id}`);
  return { sent: true, messageId: data.id };
}

/**
 * Fire-and-forget. Notifications must never fail the request that triggered
 * them — a signup shouldn't 500 because email delivery had a problem.
 */
function queueMail(payload) {
  Promise.resolve()
    .then(() => sendMail(payload))
    .catch((err) => console.error(`[email:failed] to=${payload.to}: ${err.message}`));
}

// ---- Templates -------------------------------------------------------------
// Unchanged below this point — every template calls queueMail() the same way
// it always did, so none of them needed to change for the Resend swap.

function welcomeOwner({ user, clinic }) {
  const heading = `Welcome to PetPrint, ${user.name.split(" ")[0]}`;
  const line = `Your account at ${clinic.name} is ready. You can see your pets' full medical history, and browse animals looking for a home.`;
  queueMail({
    to: user.email,
    subject: `Your PetPrint account at ${clinic.name}`,
    text: `${heading}\n\n${line}`,
    html: shell(heading, `<p style="line-height:1.6;margin:0">${line}</p>`)
  });
}

function welcomeClinic({ user, clinic }) {
  const heading = `${clinic.name} is set up`;
  const line = `You're the administrator. Add your vets from the Team page, then start registering pets — each one gets a code and a QR tag you can print.`;
  queueMail({
    to: user.email,
    subject: `${clinic.name} on PetPrint`,
    text: `${heading}\n\n${line}`,
    html: shell(heading, `<p style="line-height:1.6;margin:0">${line}</p>`)
  });
}

function vetAccountCreated({ vet, clinic, temporaryPassword }) {
  const heading = `You've been added to ${clinic.name}`;
  const creds = temporaryPassword
    ? `<p style="line-height:1.6">Sign in with <strong>${vet.email}</strong> and the temporary password your administrator gave you, then change it.</p>`
    : `<p style="line-height:1.6">Sign in with <strong>${vet.email}</strong>.</p>`;
  queueMail({
    to: vet.email,
    subject: `Your PetPrint account at ${clinic.name}`,
    text: `${heading}\n\nSign in with ${vet.email}.`,
    html: shell(heading, creds)
  });
}

function applicationReceived({ applicant, listing }) {
  const heading = `We've got your application for ${listing.name}`;
  const line = `The team is reviewing it and will be in touch. You can withdraw your application from PetPrint at any point before they decide.`;
  queueMail({
    to: applicant.email,
    subject: `Your application for ${listing.name}`,
    text: `${heading}\n\n${line}`,
    html: shell(heading, `<p style="line-height:1.6;margin:0">${line}</p>`)
  });
}

function applicationDecided({ applicant, listing, status }) {
  const approved = status === "approved";
  const heading = approved
    ? `Good news about ${listing.name}`
    : `About your application for ${listing.name}`;
  const line = approved
    ? `Your application has been approved. The clinic will contact you to arrange collection.`
    : `${listing.name} has gone to another home. Other animals may still be available, so do have another look.`;
  queueMail({
    to: applicant.email,
    subject: approved ? `${listing.name} is yours` : `Update on ${listing.name}`,
    text: `${heading}\n\n${line}`,
    html: shell(heading, `<p style="line-height:1.6;margin:0">${line}</p>`)
  });
}

function newApplicationForStaff({ recipients, applicant, listing }) {
  const heading = `New adoption application for ${listing.name}`;
  const line = `${applicant.name} has applied. Review it in the adoption queue.`;
  for (const to of recipients) {
    queueMail({
      to,
      subject: `New application for ${listing.name}`,
      text: `${heading}\n\n${line}`,
      html: shell(heading, `<p style="line-height:1.6;margin:0">${line}</p>`)
    });
  }
}

function sendPasswordResetEmail({ user, rawToken, appUrl }) {
  const link = `${appUrl}/reset-password/${rawToken}`;
  const heading = "Reset your password";
  const body = `
    <p>We received a request to reset the password for your PetPrint account.
    This link expires in 1 hour and can only be used once.</p>
    <p style="margin:20px 0">
      <a href="${link}" style="background:#1a6b58;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600">
        Reset password
      </a>
    </p>
    <p style="font-size:12px;color:#8a9a94">
      If you didn't request this, you can ignore this email — your password
      won't change unless you open the link above and choose a new one.
    </p>`;
  queueMail({
    to: user.email,
    subject: "Reset your PetPrint password",
    text: `Reset your password: ${link} (expires in 1 hour)`,
    html: shell(heading, body)
  });
}

function sendVerificationEmail({ user, rawToken, appUrl }) {
  const link = `${appUrl}/verify-email/${rawToken}`;
  const heading = "Confirm your email";
  const body = `
    <p>Click below to confirm ${user.email} is yours. This isn't required to
    use PetPrint, but it's what lets a password reset reach you if you ever
    need one.</p>
    <p style="margin:20px 0">
      <a href="${link}" style="background:#1a6b58;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600">
        Confirm email
      </a>
    </p>`;
  queueMail({
    to: user.email,
    subject: "Confirm your PetPrint email",
    text: `Confirm your email: ${link}`,
    html: shell(heading, body)
  });
}

module.exports = {
  EMAIL_CONFIGURED: CONFIGURED,
  sendMail,
  queueMail,
  welcomeOwner,
  welcomeClinic,
  vetAccountCreated,
  applicationReceived,
  applicationDecided,
  newApplicationForStaff,
  sendPasswordResetEmail,
  sendVerificationEmail
};