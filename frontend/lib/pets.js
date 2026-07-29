// Shared display helpers so a pet reads the same way on every screen.

export function ageFrom(dateOfBirth) {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;

  const now = new Date();
  let months = (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
  if (now.getDate() < dob.getDate()) months -= 1;
  if (months < 0) return null;

  if (months < 12) return `${months} mo`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest ? `${years} yr ${rest} mo` : `${years} yr`;
}

export function formatDate(value, opts = {}) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...opts
  });
}

export function relativeDate(value) {
  if (!value) return "";
  const days = Math.round((Date.now() - new Date(value).getTime()) / 864e5);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 31) return `${days} days ago`;
  const months = Math.round(days / 30);
  if (months < 24) return `${months} mo ago`;
  return `${Math.round(months / 12)} yr ago`;
}

export function describePet(pet) {
  return [
    pet.breed || (pet.species === "cat" ? "Cat" : "Dog"),
    pet.sex === "male" ? "Male" : "Female",
    ageFrom(pet.dateOfBirth)
  ]
    .filter(Boolean)
    .join(" · ");
}

export const SPECIES_LABEL = { cat: "Cat", dog: "Dog" };
