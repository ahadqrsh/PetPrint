const PDFDocument = require("pdfkit");

/**
 * Printable medical history. Built with pdfkit's standard fonts so there are no
 * font files to ship, and laid out to be readable when handed to an owner or
 * faxed to a referral practice: identity at the top, allergies impossible to
 * miss, then visits newest first.
 */

const INK = "#12241f";
const SOFT = "#5c6f68";
const FAINT = "#8a9a94";
const RULE = "#c4d2cc";
const WARN = "#b0432a";
const WARN_BG = "#fbeae5";

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "Not recorded";

function ageFrom(dob) {
  if (!dob) return null;
  const birth = new Date(dob);
  const now = new Date();
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 0) return null;
  if (months < 12) return `${months} mo`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest ? `${years} yr ${rest} mo` : `${years} yr`;
}

function rule(doc, y = doc.y) {
  doc.moveTo(doc.page.margins.left, y)
    .lineTo(doc.page.width - doc.page.margins.right, y)
    .lineWidth(0.75)
    .strokeColor(RULE)
    .stroke();
}

function field(doc, label, value) {
  doc.font("Helvetica-Bold").fontSize(7.5).fillColor(FAINT)
    .text(label.toUpperCase(), { characterSpacing: 1 });
  doc.font("Helvetica").fontSize(10).fillColor(INK).text(value || "—");
  doc.moveDown(0.5);
}

/** Two-column detail block. Returns the y position below whichever column is taller. */
function detailColumns(doc, left, right) {
  const { left: ml, right: mr } = doc.page.margins;
  const usable = doc.page.width - ml - mr;
  const colWidth = usable / 2 - 10;
  const startY = doc.y;

  doc.save();
  let leftY = startY;
  for (const [label, value] of left) {
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(FAINT)
      .text(label.toUpperCase(), ml, leftY, { width: colWidth, characterSpacing: 1 });
    leftY = doc.y;
    doc.font("Helvetica").fontSize(10).fillColor(INK)
      .text(value || "—", ml, leftY, { width: colWidth });
    leftY = doc.y + 6;
  }

  let rightY = startY;
  const rx = ml + usable / 2 + 10;
  for (const [label, value] of right) {
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(FAINT)
      .text(label.toUpperCase(), rx, rightY, { width: colWidth, characterSpacing: 1 });
    rightY = doc.y;
    doc.font("Helvetica").fontSize(10).fillColor(INK)
      .text(value || "—", rx, rightY, { width: colWidth });
    rightY = doc.y + 6;
  }
  doc.restore();

  doc.x = ml;
  doc.y = Math.max(leftY, rightY);
  return doc.y;
}

function warningBox(doc, title, lines) {
  const { left: ml, right: mr } = doc.page.margins;
  const width = doc.page.width - ml - mr;
  const padding = 10;

  // Measure first so the panel can be drawn behind the text.
  const bodyHeight = doc.font("Helvetica-Bold").fontSize(10.5)
    .heightOfString(lines.join("  ·  "), { width: width - padding * 2 });
  const boxHeight = bodyHeight + 26;

  doc.save()
    .rect(ml, doc.y, width, boxHeight)
    .fillAndStroke(WARN_BG, WARN)
    .restore();

  const textY = doc.y + padding;
  doc.font("Helvetica-Bold").fontSize(7.5).fillColor(WARN)
    .text(title.toUpperCase(), ml + padding, textY, { width: width - padding * 2, characterSpacing: 1 });
  doc.font("Helvetica-Bold").fontSize(10.5).fillColor(WARN)
    .text(lines.join("  ·  "), ml + padding, doc.y + 2, { width: width - padding * 2 });

  doc.x = ml;
  doc.y = textY + boxHeight - padding + 6;
}

function buildHistoryPdf({ pet, owner, records, clinic, generatedBy }) {
  const doc = new PDFDocument({
    size: "A4",
    margin: 50,
    // Required for the footer pass: pages must stay buffered so switchToPage
    // can revisit them after all the content has been laid out.
    bufferPages: true,
    info: {
      Title: `${pet.name} — medical history (${pet.petCode})`,
      Author: clinic?.name || "PetPrint",
      Subject: "Veterinary medical history"
    }
  });

  const { left: ml, right: mr } = doc.page.margins;
  const usable = doc.page.width - ml - mr;

  // ---- Header -------------------------------------------------------------
  doc.font("Helvetica-Bold").fontSize(13).fillColor(INK).text(clinic?.name || "PetPrint");
  const contact = [clinic?.address, clinic?.phone].filter(Boolean).join(" · ");
  if (contact) doc.font("Helvetica").fontSize(9).fillColor(SOFT).text(contact);

  doc.font("Helvetica").fontSize(8.5).fillColor(FAINT)
    .text(`Medical history · generated ${fmtDate(new Date())}`, ml, doc.y - (contact ? 22 : 13), {
      width: usable,
      align: "right"
    });

  doc.moveDown(1);
  rule(doc, doc.y);
  doc.moveDown(1.2);

  // ---- Identity -----------------------------------------------------------
  doc.font("Helvetica-Bold").fontSize(22).fillColor(INK).text(pet.name, { continued: false });
  doc.font("Helvetica-Bold").fontSize(9).fillColor(SOFT)
    .text(pet.petCode, ml, doc.y - 26, { width: usable, align: "right", characterSpacing: 0.5 });
  doc.moveDown(0.8);

  detailColumns(
    doc,
    [
      ["Species", pet.species === "cat" ? "Cat" : "Dog"],
      ["Breed", pet.breed],
      ["Sex", pet.sex === "male" ? "Male" : "Female"]
    ],
    [
      ["Date of birth", fmtDate(pet.dateOfBirth)],
      ["Age", ageFrom(pet.dateOfBirth) || "Unknown"],
      ["Owner", owner ? [owner.name, owner.phone].filter(Boolean).join(" · ") : "—"]
    ]
  );

  doc.moveDown(0.6);

  // ---- Clinical alerts ----------------------------------------------------
  if (pet.allergies?.length) {
    warningBox(doc, "Allergies — do not administer", pet.allergies);
  }
  if (pet.chronicConditions?.length) {
    field(doc, "Ongoing conditions", pet.chronicConditions.join("  ·  "));
  }

  doc.moveDown(0.4);
  rule(doc, doc.y);
  doc.moveDown(0.9);

  // ---- Visits -------------------------------------------------------------
  doc.font("Helvetica-Bold").fontSize(12).fillColor(INK)
    .text(`Visit history — ${records.length} ${records.length === 1 ? "visit" : "visits"}`);
  doc.moveDown(0.7);

  if (records.length === 0) {
    doc.font("Helvetica-Oblique").fontSize(10).fillColor(SOFT)
      .text("No visits have been recorded for this pet.");
  }

  records.forEach((record, i) => {
    // Keep a visit's heading with at least some of its body.
    if (doc.y > doc.page.height - doc.page.margins.bottom - 110) doc.addPage();

    if (i > 0) {
      rule(doc, doc.y);
      doc.moveDown(0.7);
    }

    doc.font("Helvetica-Bold").fontSize(11).fillColor(INK).text(fmtDate(record.visitDate));
    if (record.vet?.name) {
      doc.font("Helvetica").fontSize(9).fillColor(SOFT)
        .text(`Seen by ${record.vet.name}`, ml, doc.y - 14, { width: usable, align: "right" });
    }
    doc.moveDown(0.5);

    const entries = [
      ["Symptoms", record.symptoms],
      ["Diagnosis", record.diagnosis],
      ["Treatment", record.treatment],
      ["Notes", record.notes]
    ].filter(([, v]) => v);

    if (entries.length === 0) {
      doc.font("Helvetica-Oblique").fontSize(9.5).fillColor(FAINT)
        .text("No detail recorded for this visit.");
    }
    for (const [label, value] of entries) field(doc, label, value);

    doc.moveDown(0.3);
  });

  // ---- Footer on every page ----------------------------------------------
  // The footer sits below the bottom margin, which would normally make pdfkit
  // spill onto a new page (and then footer *that* page, forever). Zeroing the
  // margin for the duration of the write keeps the page count fixed.
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);
    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    const y = doc.page.height - 38;
    doc.font("Helvetica").fontSize(7.5).fillColor(FAINT)
      .text(
        `${pet.name} · ${pet.petCode}${generatedBy ? ` · issued by ${generatedBy}` : ""}`,
        ml, y, { width: usable / 2, lineBreak: false }
      )
      .text(`Page ${i + 1} of ${range.count}`, ml + usable / 2, y, {
        width: usable / 2,
        align: "right",
        lineBreak: false
      });

    doc.page.margins.bottom = savedBottom;
  }

  doc.end();
  return doc;
}

module.exports = { buildHistoryPdf };
