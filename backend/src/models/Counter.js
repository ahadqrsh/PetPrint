const mongoose = require("mongoose");

// Atomic sequence source for human-friendly codes. One document per key
// (e.g. "petCode:2026"), incremented with findOneAndUpdate so two concurrent
// registrations can never be handed the same number.
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});

counterSchema.statics.next = async function (key) {
  const doc = await this.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return doc.seq;
};

module.exports = mongoose.model("Counter", counterSchema);
