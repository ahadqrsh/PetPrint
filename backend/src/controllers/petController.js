const mongoose = require("mongoose");
const Pet = require("../models/Pet");
const User = require("../models/User");
const MedicalRecord = require("../models/MedicalRecord");
const { ApiError } = require("../middleware/errorHandler");
const { scopedFilter, assertSameClinic, stripProtected } = require("../utils/scope");
const { generatePetCode, normalisePetCode } = require("../utils/generatePetCode");
const { qrDataUrlFor, scanUrlFor } = require("../services/qrService");

function shape(pet, owner) {
  return {
    id: pet._id,
    petCode: pet.petCode,
    name: pet.name,
    species: pet.species,
    breed: pet.breed,
    sex: pet.sex,
    dateOfBirth: pet.dateOfBirth,
    allergies: pet.allergies || [],
    chronicConditions: pet.chronicConditions || [],
    photoUrl: pet.photoUrl,
    createdAt: pet.createdAt,
    owner: owner ? { id: owner._id, name: owner.name, email: owner.email, phone: owner.phone } : null
  };
}

// Loads a pet the caller is allowed to see. Owners only match their own.
async function loadPet(req, id) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, "Pet not found.");
  const pet = await Pet.findOne({ _id: id, ...scopedFilter(req.user) });
  if (!pet) throw new ApiError(404, "Pet not found.");
  return pet;
}

// Vets and admins may only attach a pet to an owner registered at their clinic.
async function resolveOwnerId(req, requestedOwnerId) {
  if (req.user.role === "owner") return req.user._id;
  if (!requestedOwnerId) throw new ApiError(400, "Choose an owner for this pet.");
  if (!mongoose.isValidObjectId(requestedOwnerId)) {
    throw new ApiError(400, "That owner doesn't exist at this clinic.");
  }
  const owner = await User.findOne({
    _id: requestedOwnerId,
    role: "owner",
    clinicId: req.user.clinicId
  });
  if (!owner) throw new ApiError(400, "That owner doesn't exist at this clinic.");
  return owner._id;
}

// GET /api/pets
async function listPets(req, res, next) {
  try {
    const { species, q, hasAllergies } = req.query;
    const filter = scopedFilter(req.user);
    if (species === "cat" || species === "dog") filter.species = species;
    if (q) filter.name = { $regex: String(q).trim(), $options: "i" };
    // Lets the dashboard's allergy count link somewhere useful instead of
    // being a number you can't act on.
    if (hasAllergies === "true") filter["allergies.0"] = { $exists: true };

    const pets = await Pet.find(filter).sort({ name: 1 }).limit(200).lean();
    const owners = await User.find({
      _id: { $in: pets.map((p) => p.ownerId) }
    }, "name email phone").lean();
    const byId = new Map(owners.map((o) => [String(o._id), o]));

    res.json({ pets: pets.map((p) => shape(p, byId.get(String(p.ownerId)))) });
  } catch (err) {
    next(err);
  }
}

// GET /api/pets/:id
async function getPet(req, res, next) {
  try {
    const pet = await loadPet(req, req.params.id);
    const owner = await User.findById(pet.ownerId, "name email phone").lean();
    res.json({ pet: shape(pet, owner) });
  } catch (err) {
    next(err);
  }
}

// GET /api/pets/code/:petCode — the QR scan target
async function getPetByCode(req, res, next) {
  try {
    const petCode = normalisePetCode(req.params.petCode);
    const pet = await Pet.findOne({ petCode, ...scopedFilter(req.user) });
    if (!pet) {
      // Same 404 whether the code is unknown or belongs to another clinic.
      throw new ApiError(404, "No pet at this clinic matches that code.");
    }
    const owner = await User.findById(pet.ownerId, "name email phone").lean();
    res.json({ pet: shape(pet, owner) });
  } catch (err) {
    next(err);
  }
}

// POST /api/pets — [vet, admin] for any owner at the clinic; owners for themselves
async function createPet(req, res, next) {
  try {
    const body = stripProtected(req.body);
    const ownerId = await resolveOwnerId(req, body.ownerId);

    const pet = await Pet.create({
      petCode: await generatePetCode(),
      name: body.name,
      species: body.species,
      breed: body.breed || "",
      sex: body.sex,
      dateOfBirth: body.dateOfBirth || null,
      allergies: body.allergies || [],
      chronicConditions: body.chronicConditions || [],
      photoUrl: body.photoUrl || "",
      ownerId,
      clinicId: req.user.clinicId
    });

    const owner = await User.findById(ownerId, "name email phone").lean();
    res.status(201).json({ pet: shape(pet, owner) });
  } catch (err) {
    next(err);
  }
}

// PUT /api/pets/:id — [vet, admin]. petCode and clinicId are immutable.
async function updatePet(req, res, next) {
  try {
    const pet = await Pet.findById(req.params.id);
    assertSameClinic(req.user, pet, "Pet");

    const body = stripProtected(req.body);
    delete body.petCode;

    for (const field of [
      "name", "species", "breed", "sex", "dateOfBirth",
      "allergies", "chronicConditions", "photoUrl"
    ]) {
      if (body[field] !== undefined) pet[field] = body[field];
    }
    if (body.ownerId !== undefined) pet.ownerId = await resolveOwnerId(req, body.ownerId);

    await pet.save();
    const owner = await User.findById(pet.ownerId, "name email phone").lean();
    res.json({ pet: shape(pet, owner) });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/pets/:id — [admin]. Takes the history with it.
async function removePet(req, res, next) {
  try {
    const pet = await Pet.findById(req.params.id);
    assertSameClinic(req.user, pet, "Pet");

    await MedicalRecord.deleteMany({ petId: pet._id });
    await Pet.deleteOne({ _id: pet._id });

    res.json({ ok: true, id: pet._id });
  } catch (err) {
    next(err);
  }
}

// GET /api/pets/:id/qrcode
async function getPetQrCode(req, res, next) {
  try {
    const pet = await loadPet(req, req.params.id);
    res.json({
      petCode: pet.petCode,
      scanUrl: scanUrlFor(pet.petCode),
      dataUrl: await qrDataUrlFor(pet.petCode)
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listPets, getPet, getPetByCode, createPet, updatePet, removePet, getPetQrCode, loadPet
};
