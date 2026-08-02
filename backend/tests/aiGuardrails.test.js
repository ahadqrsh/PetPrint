const test = require("node:test");
const assert = require("node:assert/strict");
const { hasClinicalQuestion, parseJsonReply, AI_CONFIGURED } = require("../src/services/aiService");

// These tests cover the parts that must hold whether or not an API key is set:
// what the assistant refuses to accept, and how its reply is parsed.

test("the assistant is off unless a key is configured", () => {
  assert.equal(AI_CONFIGURED, false, "no ANTHROPIC_API_KEY in the test environment");
});

test("requests for a diagnosis are refused", () => {
  for (const input of [
    "What's wrong with this dog?",
    "what could be causing the vomiting?",
    "What do you think is going on here?",
    "Give me a differential for the lameness?",
    "Is this cancer?"
  ]) {
    assert.equal(hasClinicalQuestion(input), true, `should refuse: ${input}`);
  }
});

test("requests for treatment advice are refused", () => {
  for (const input of [
    "Should I prescribe antibiotics?",
    "should i give metacam for this",
    "What dose of amoxicillin for a 14kg dog",
    "how much should i give a cat this size",
    "What would you recommend here?",
    "Do I need to start fluids?"
  ]) {
    assert.equal(hasClinicalQuestion(input), true, `should refuse: ${input}`);
  }
});

test("ordinary clinical notes are accepted", () => {
  for (const input of [
    "Head shaking, right ear. Yeasty smell, canal inflamed. Otitis externa. Flushed in clinic, otic drops BID 7 days.",
    "Annual check. BCS 5/9, weight 14.2kg up 0.4. Dentition good. DHPP booster given, left shoulder.",
    "Lame on left fore after agility. No swelling, pain on carpal flexion. Soft tissue strain. Rest 10 days, meloxicam 0.1mg/kg SID.",
    "Owner reports reduced appetite 2 days. Temp 38.9. Abdomen soft, non-painful. Advised bland diet, recheck 48h."
  ]) {
    assert.equal(hasClinicalQuestion(input), false, `should accept: ${input}`);
  }
});

test("a note that merely mentions a dose is not a question about one", () => {
  assert.equal(
    hasClinicalQuestion("Gave meloxicam 0.1mg/kg SID for five days, owner shown how to dose."),
    false
  );
});

test("JSON is parsed even when the model wraps it in fences", () => {
  const withFences = '```json\n{"symptoms": "Head shaking", "diagnosis": "Otitis"}\n```';
  const parsed = parseJsonReply(withFences);
  assert.equal(parsed.symptoms, "Head shaking");
  assert.equal(parsed.diagnosis, "Otitis");
});

test("JSON is parsed despite a preamble", () => {
  const chatty = 'Here is the record:\n{"symptoms": "Lame on left fore", "notes": ""}';
  assert.equal(parseJsonReply(chatty).symptoms, "Lame on left fore");
});

test("an unparseable reply throws rather than returning junk", () => {
  assert.throws(() => parseJsonReply("I'm sorry, I can't help with that."));
  assert.throws(() => parseJsonReply(""));
});

test("clinical text containing braces doesn't break parsing", () => {
  const reply = '{"symptoms": "Owner said {sic} he ate a sock", "diagnosis": "FB ingestion"}';
  assert.equal(parseJsonReply(reply).diagnosis, "FB ingestion");
});
