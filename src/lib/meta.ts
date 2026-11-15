import type { Category, DutyRole, FieldNeed, RoomRole, Team } from "./types";

/**
 * Category colours follow a fixed categorical order (validated palette):
 * blue, orange, aqua, violet, yellow. Every block also carries a text label,
 * so colour is never the only carrier of identity.
 */
export const CATEGORY_META: Record<Category, { label: string; color: string; soft: string; text: string }> = {
  pupillen: { label: "Pupillen", color: "#2a78d6", soft: "#e3eefb", text: "#174a8a" },
  junioren: { label: "Junioren", color: "#eb6834", soft: "#fde9e0", text: "#8f3511" },
  senioren: { label: "Senioren", color: "#1baf7a", soft: "#dcf5ea", text: "#0d6646" },
  vrouwen: { label: "Meiden & vrouwen", color: "#6250d6", soft: "#e9e6fa", text: "#3a2c99" },
  recreatief: { label: "Recreatief", color: "#eda100", soft: "#fdf1d6", text: "#7a5300" },
};

export const CATEGORIES = Object.keys(CATEGORY_META) as Category[];

export const FIELD_NEED_META: Record<FieldNeed, { label: string; sections: number }> = {
  heel: { label: "Heel veld", sections: 4 },
  half: { label: "Half veld", sections: 2 },
  kwart: { label: "Kwart veld", sections: 1 },
};

export const SECTION_LABELS = ["A", "B", "C", "D"];

export const ROOM_ROLE_META: Record<RoomRole, { label: string; color: string; soft: string }> = {
  thuis: { label: "Thuis", color: "#1baf7a", soft: "#dcf5ea" },
  uit: { label: "Uit", color: "#eb6834", soft: "#fde9e0" },
  scheidsrechter: { label: "Scheidsrechter", color: "#52514e", soft: "#ecebe8" },
  training: { label: "Training", color: "#2a78d6", soft: "#e3eefb" },
  overig: { label: "Overig", color: "#6250d6", soft: "#e9e6fa" },
};

export const DUTY_META: Record<DutyRole, { label: string; emoji: string }> = {
  bardienst: { label: "Bardienst", emoji: "☕" },
  scheidsrechter: { label: "Scheidsrechter", emoji: "🟨" },
  wedstrijdsecretariaat: { label: "Wedstrijdsecretariaat", emoji: "📋" },
  kleedkamercontrole: { label: "Kleedkamercontrole", emoji: "🚿" },
  veldopbouw: { label: "Veld opbouwen", emoji: "🥅" },
};

/** Age number for youth teams ("JO11-2" → 11), 99 for seniors. Used to order the match day. */
export function teamAge(team: Team): number {
  const m = team.name.match(/[JM]O(\d+)/i);
  if (m) return Number(m[1]);
  return team.category === "recreatief" ? 100 : 99;
}

/** Sensible defaults based on KNVB age categories. */
export function defaultsForAge(age: number): { fieldNeed: FieldNeed; matchDuration: number } {
  if (age <= 9) return { fieldNeed: "kwart", matchDuration: 60 };
  if (age <= 12) return { fieldNeed: "half", matchDuration: 75 };
  if (age <= 15) return { fieldNeed: "heel", matchDuration: 85 };
  if (age <= 17) return { fieldNeed: "heel", matchDuration: 95 };
  return { fieldNeed: "heel", matchDuration: 105 };
}
