const Pet = require("../models/Pet");
const User = require("../models/User");
const Clinic = require("../models/Clinic");
const MedicalRecord = require("../models/MedicalRecord");
const { clinicFilter } = require("../utils/scope");
const { buildHistoryPdf } = require("../services/pdfService");
const { buildRecordsCsv } = require("../services/csvService");
const { loadPet } = require("./petController");

// GET /api/pets/:id/record.pdf — printable history.
// loadPet applies the caller's scope, so an owner can only export their own pet.
async function petHistoryPdf(req, res, next) {
  try {
    const pet = await loadPet(req, req.params.id);

    const [owner, clinic, records] = await Promise.all([
      User.findById(pet.ownerId, "name email phone").lean(),
      Clinic.findById(pet.clinicId).lean(),
      MedicalRecord.find({ petId: pet._id, clinicId: req.user.clinicId })
        .sort({ visitDate: -1, createdAt: -1 })
        .lean()
    ]);

    const vets = await User.find({ _id: { $in: records.map((r) => r.vetId) } }, "name").lean();
    const vetById = new Map(vets.map((v) => [String(v._id), v]));

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${pet.petCode}-history.pdf"`
    );

    const doc = buildHistoryPdf({
      pet,
      owner,
      clinic,
      generatedBy: req.user.name,
      records: records.map((r) => ({ ...r, vet: vetById.get(String(r.vetId)) }))
    });
    doc.pipe(res);
  } catch (err) {
    next(err);
  }
}

// GET /api/clinic/export.csv — [admin] every pet and visit in this clinic
async function clinicCsv(req, res, next) {
  try {
    const scope = clinicFilter(req.user);

    const [pets, records] = await Promise.all([
      Pet.find(scope).sort({ name: 1 }).lean(),
      MedicalRecord.find(scope).lean()
    ]);

    const [owners, vets] = await Promise.all([
      User.find({ _id: { $in: pets.map((p) => p.ownerId) } }, "name email phone").lean(),
      User.find({ _id: { $in: records.map((r) => r.vetId) } }, "name").lean()
    ]);

    const { csv } = buildRecordsCsv({ pets, records, owners, vets });
    const stamp = new Date().toISOString().slice(0, 10);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="petprint-records-${stamp}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
}

module.exports = { petHistoryPdf, clinicCsv };
