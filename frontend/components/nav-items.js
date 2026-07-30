// Nav is derived from role in one place. Items marked `soon` render disabled
// with the phase that will deliver them, so the shell shows the whole product
// without pretending unfinished pages exist.
export const NAV_SECTIONS = [
  {
    label: "Care",
    items: [
      { href: "/dashboard", label: "Overview", roles: ["admin", "vet", "owner"] },
      { href: "/pets", label: "Pets", roles: ["admin", "vet"] },
      { href: "/pets", label: "My pets", roles: ["owner"] }
    ]
  },
  {
    label: "Adoption",
    items: [
      { href: "/adoptions", label: "Listings", roles: ["admin", "vet"] },
      { href: "/adoptions", label: "Looking for a home", roles: ["owner"] },
      { href: "/adoptions/applications", label: "Review queue", roles: ["admin", "vet"] },
      { href: "/adoptions/applications", label: "My applications", roles: ["owner"] }
    ]
  },
  {
    label: "Clinic",
    items: [
      { href: "/admin/vets", label: "Team", roles: ["admin"] },
      { href: "/clinic", label: "Clinic details", roles: ["admin"] }
    ]
  }
];

export function sectionsForRole(role) {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.roles.includes(role))
  })).filter((section) => section.items.length > 0);
}
