export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
export type BloodGroup = (typeof BLOOD_GROUPS)[number];

export const COMPONENTS = ["whole_blood", "red_cells", "platelets", "plasma"] as const;
export type BloodComponent = (typeof COMPONENTS)[number];

export const COMPONENT_LABELS: Record<BloodComponent, string> = {
  whole_blood: "Whole blood",
  red_cells: "Red cells",
  platelets: "Platelets",
  plasma: "Plasma",
};

export const URGENCIES = ["critical", "urgent", "standard"] as const;
export type Urgency = (typeof URGENCIES)[number];

export const URGENCY_LABELS: Record<Urgency, string> = {
  critical: "Critical (within hours)",
  urgent: "Urgent (within a day)",
  standard: "Planned (within days)",
};

export function isBloodGroup(v: string): v is BloodGroup {
  return (BLOOD_GROUPS as readonly string[]).includes(v);
}

export function isComponent(v: string): v is BloodComponent {
  return (COMPONENTS as readonly string[]).includes(v);
}

type Abo = "A" | "B" | "AB" | "O";

function parse(group: BloodGroup): { abo: Abo; rhPositive: boolean } {
  return { abo: group.replace(/[+-]/, "") as Abo, rhPositive: group.endsWith("+") };
}

const RED_CELL_ABO: Record<Abo, Abo[]> = {
  A: ["A", "O"],
  B: ["B", "O"],
  AB: ["A", "B", "AB", "O"],
  O: ["O"],
};

const PLASMA_ABO: Record<Abo, Abo[]> = {
  A: ["A", "AB"],
  B: ["B", "AB"],
  AB: ["AB"],
  O: ["O", "A", "B", "AB"],
};

/**
 * Preliminary screening rules only. They narrow the search; they are not a clinical
 * compatibility determination. Final decisions rest with qualified healthcare professionals.
 */
export function supplyGroupsFor(recipient: BloodGroup, component: BloodComponent): BloodGroup[] {
  const r = parse(recipient);
  if (component === "platelets") return [...BLOOD_GROUPS];
  if (component === "plasma") {
    const allowed = PLASMA_ABO[r.abo];
    return BLOOD_GROUPS.filter((g) => allowed.includes(parse(g).abo));
  }
  const allowed = RED_CELL_ABO[r.abo];
  return BLOOD_GROUPS.filter((g) => {
    const p = parse(g);
    if (!allowed.includes(p.abo)) return false;
    return r.rhPositive ? true : !p.rhPositive;
  });
}

export function isPreliminarilyCompatible(
  recipient: BloodGroup,
  supply: BloodGroup,
  component: BloodComponent,
): boolean {
  return supplyGroupsFor(recipient, component).includes(supply);
}
