const { ApiError } = require("../middleware/errorHandler");

/**
 * AI documentation assistant.
 *
 * SCOPE, deliberately narrow: this turns a vet's own observations into tidy
 * prose. It does not diagnose, does not suggest treatment, does not propose
 * drugs or doses, and does not answer clinical questions. Every output is a
 * draft that a vet edits and approves before it becomes a record.
 *
 * The constraints are enforced in three places, because a system prompt alone
 * is not a safety mechanism:
 *   1. the system prompt below
 *   2. hasClinicalQuestion() — refuses inputs that are asking for advice
 *   3. the controller, which never writes AI output to a record directly
 */

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const MAX_INPUT_CHARS = 4000;

const AI_CONFIGURED = Boolean(process.env.ANTHROPIC_API_KEY);

const CLINICAL_SYSTEM = `You are a veterinary documentation assistant. A qualified vet has examined an animal and given you their own rough notes. Your only job is to rewrite those notes as clean clinical documentation.

Rules you must follow:
- Use ONLY information the vet has given you. Never add findings, never infer a diagnosis they did not state, never suggest treatments, drugs, doses, or tests.
- If the vet's notes do not mention something, leave that field empty. An empty field is correct; an invented one is dangerous.
- Do not soften or strengthen the vet's clinical certainty. If they wrote "possible otitis", keep it possible.
- Preserve every specific number, measurement, drug name, and dose exactly as written.
- Write in the third person, past tense, in the plain register of a clinical record.

Return ONLY a JSON object, no preamble and no markdown fences:
{"symptoms": "", "diagnosis": "", "treatment": "", "notes": ""}`;

const OWNER_SYSTEM = `You are a veterinary documentation assistant. A vet has approved a clinical record and wants a version an owner can understand.

Rules you must follow:
- Use ONLY what is in the record. Add no advice, no prognosis, no reassurance the vet did not give, and no aftercare instructions that are not already written down.
- Translate clinical terms into plain language, but keep drug names and doses exactly as written — the owner needs those to be accurate.
- Do not speculate about causes or outcomes.
- Warm and clear, but never breezy about a serious finding. Around 120 words.
- End with a line telling the owner to contact the clinic with any questions.

Return ONLY a JSON object, no preamble and no markdown fences:
{"summary": ""}`;

/**
 * Blocks input that is asking the model for clinical judgement rather than
 * asking it to write up an examination that already happened.
 */
function hasClinicalQuestion(text = "") {
  const t = text.toLowerCase();
  const patterns = [
    /\bwhat('s| is| could| might| do you think)\b.*\b(wrong|causing|going on|it be|the diagnosis)\b/,
    /\b(should i|shall i|do i need to|would you) (prescribe|give|administer|treat|recommend|start)\b/,
    /\b(diagnose|diagnosis for|differential)\b.*\?/,
    /\bwhat (dose|dosage|drug|medication|antibiotic)\b/,
    /\bhow much .*(should|do) (i|we) give\b/,
    /\bis (this|it) (cancer|serious|fatal|contagious)\b/,
    /\bwhat would you (do|recommend|suggest)\b/
  ];
  return patterns.some((p) => p.test(t));
}

function assertConfigured() {
  if (!AI_CONFIGURED) {
    throw new ApiError(
      503,
      "The AI assistant isn't set up on this server. Add ANTHROPIC_API_KEY to enable it."
    );
  }
}

/** Strips markdown fences the model may add despite instructions. */
function parseJsonReply(raw) {
  const cleaned = String(raw).replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no JSON object in reply");
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function callClaude({ system, userContent, maxTokens = 1000 }) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: userContent }]
    }),
    signal: AbortSignal.timeout(30000)
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`[ai] ${res.status} ${detail.slice(0, 300)}`);
    if (res.status === 401) throw new ApiError(503, "The AI assistant's API key was rejected.");
    if (res.status === 429) throw new ApiError(429, "The AI assistant is busy. Try again shortly.");
    throw new ApiError(502, "The AI assistant couldn't be reached. Write the record manually.");
  }

  const data = await res.json();
  const text = (data.content || [])
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  if (!text) throw new ApiError(502, "The AI assistant returned an empty reply.");
  return text;
}

/**
 * Drafts a clinical record from a vet's rough notes.
 * Returns fields only — the caller decides what, if anything, to save.
 */
async function draftClinicalRecord({ observations, pet }) {
  assertConfigured();

  const text = String(observations || "").trim();
  if (text.length < 15) {
    throw new ApiError(400, "Write a little more detail for the assistant to work from.");
  }
  if (text.length > MAX_INPUT_CHARS) {
    throw new ApiError(400, `Keep observations under ${MAX_INPUT_CHARS} characters.`);
  }
  if (hasClinicalQuestion(text)) {
    throw new ApiError(
      400,
      "This assistant writes up an examination you've already done — it can't answer clinical questions or advise on treatment. Rephrase as notes on what you found."
    );
  }

  // Signalment is context for register and pronouns only, never for inference.
  const context = [
    `Species: ${pet.species}`,
    pet.breed ? `Breed: ${pet.breed}` : null,
    pet.sex ? `Sex: ${pet.sex}` : null,
    (pet.allergies || []).length ? `Known allergies: ${pet.allergies.join(", ")}` : null
  ]
    .filter(Boolean)
    .join("\n");

  const raw = await callClaude({
    system: CLINICAL_SYSTEM,
    userContent: `Animal (context only — do not draw conclusions from it):\n${context}\n\nThe vet's notes from this examination:\n${text}`
  });

  let parsed;
  try {
    parsed = parseJsonReply(raw);
  } catch (err) {
    console.error(`[ai] unparseable clinical reply: ${err.message}`);
    throw new ApiError(502, "The AI assistant returned something unusable. Write the record manually.");
  }

  return {
    symptoms: String(parsed.symptoms || "").trim(),
    diagnosis: String(parsed.diagnosis || "").trim(),
    treatment: String(parsed.treatment || "").trim(),
    notes: String(parsed.notes || "").trim()
  };
}

/**
 * Drafts an owner-friendly summary of a record the vet has already written.
 * Takes the saved record, not free text, so it can only restate approved
 * clinical content.
 */
async function draftOwnerSummary({ record, pet }) {
  assertConfigured();

  const body = [
    record.symptoms && `Presenting signs: ${record.symptoms}`,
    record.diagnosis && `Assessment: ${record.diagnosis}`,
    record.treatment && `Treatment given: ${record.treatment}`,
    record.notes && `Notes: ${record.notes}`
  ]
    .filter(Boolean)
    .join("\n");

  if (!body) {
    throw new ApiError(400, "There's nothing recorded for this visit to summarise yet.");
  }

  const raw = await callClaude({
    system: OWNER_SYSTEM,
    userContent: `Patient: ${pet.name}, a ${pet.sex} ${pet.breed || pet.species}.\n\nThe approved clinical record:\n${body}`,
    maxTokens: 600
  });

  let parsed;
  try {
    parsed = parseJsonReply(raw);
  } catch {
    // A summary is prose; if the JSON wrapper failed, the text is still usable.
    return { summary: String(raw).trim().slice(0, 2000) };
  }

  return { summary: String(parsed.summary || "").trim() };
}

module.exports = {
  AI_CONFIGURED,
  MODEL,
  draftClinicalRecord,
  draftOwnerSummary,
  hasClinicalQuestion,
  parseJsonReply
};
