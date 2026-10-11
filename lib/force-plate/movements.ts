export type MovementProfile = {
  testType: string;
  displayName: string;
  includeInClientReport: boolean;
  plainWhatWeTested: string;
};

const MOVEMENT_ALIASES: { match: RegExp; profile: MovementProfile }[] = [
  {
    match: /等长中腿拉|mid[-\s]?thigh|imtp/i,
    profile: {
      testType: "FORCE_PLATE_IMTP",
      displayName: "Isometric Mid-Thigh Pull",
      includeInClientReport: true,
      plainWhatWeTested:
        "This is a standing pull. You tried to produce as much lower-body force as you could, without a jump.",
    },
  },
  {
    match: /比目鱼肌|soleus/i,
    profile: {
      testType: "FORCE_PLATE_SOLEUS",
      displayName: "Soleus Test",
      includeInClientReport: true,
      plainWhatWeTested:
        "This looks at force from the lower leg. It is not a measure of every muscle in the thigh.",
    },
  },
  {
    match: /等长硬拉|isometric\s*deadlift/i,
    profile: {
      testType: "FORCE_PLATE_ISOMETRIC_DEADLIFT",
      displayName: "Isometric Deadlift",
      includeInClientReport: true,
      plainWhatWeTested:
        "This is a standing pull from a deadlift position. It shows how much force you can produce through your hips and lower body.",
    },
  },
  {
    match: /自由训练|free\s*train/i,
    profile: {
      testType: "FORCE_PLATE_FREE_TRAINING",
      displayName: "Free Training",
      includeInClientReport: false,
      plainWhatWeTested: "These rows are stored for the practitioner. They are not used on the client summary.",
    },
  },
];

export function resolveMovement(raw: string | null): MovementProfile {
  const value = (raw ?? "").trim();
  if (!value) {
    return {
      testType: "FORCE_PLATE_UNKNOWN",
      displayName: "Force plate test",
      includeInClientReport: true,
      plainWhatWeTested: "You produced force against the plates. We keep the numbers so we can compare later tests.",
    };
  }
  const hit = MOVEMENT_ALIASES.find((item) => item.match.test(value));
  if (hit) return hit.profile;
  const slug = value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
  return {
    testType: `FORCE_PLATE_${slug || "OTHER"}`,
    displayName: value,
    includeInClientReport: true,
    plainWhatWeTested:
      "You produced force against the plates. We keep the numbers so we can compare later tests.",
  };
}
