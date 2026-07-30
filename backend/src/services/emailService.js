const nodemailer = require("nodemailer");

/**
 * Email is optional. With no credentials configured every send becomes a
 * console line instead, so development and CI never depend on an SMTP server
 * and a missing password can't break a signup.
 *
 * Gmail needs an App Password, not the account password.
 */
const CONFIGURED = Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);
const FROM = process.env.EMAIL_FROM || `PetPrint <${process.env.EMAIL_USER || "no-reply@petprint.local"}>`;

let transporter = null;
if (CONFIGURED) {
  transporter = nodemailer.createTransport(
    process.env.EMAIL_HOST
      ? {
          host: process.env.EMAIL_HOST,
          port: Number(process.env.EMAIL_PORT || 587),
          secure: Number(process.env.EMAIL_PORT) === 465,
          auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
        }
      : {
          service: "gmail",
          auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
        }
  );
}

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
    console.log(`[email:skipped] to=${to} subject="${subject}" (EMAIL_USER/EMAIL_PASS not set)`);
    return { sent: false, reason: "not configured" };
  }

  const info = await transporter.sendMail({ from: FROM, to, subject, text, html });
  console.log(`[email:sent] to=${to} subject="${subject}" id=${info.messageId}`);
  return { sent: true, messageId: info.messageId };
}

/**
 * Fire-and-forget. Notifications must never fail the request that triggered
 * them — a signup shouldn't 500 because SMTP is down.
 */
function queueMail(payload) {
  Promise.resolve()
    .then(() => sendMail(payload))
    .catch((err) => console.error(`[email:failed] to=${payload.to}: ${err.message}`));
}

// ---- Templates -------------------------------------------------------------

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

module.exports = {
  EMAIL_CONFIGURED: CONFIGURED,
  sendMail,
  queueMail,
  welcomeOwner,
  welcomeClinic,
  vetAccountCreated,
  applicationReceived,
  applicationDecided,
  newApplicationForStaff
};
