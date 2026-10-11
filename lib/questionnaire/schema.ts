/**
 * Intake questionnaire. Kept in code so the form, the practitioner view,
 * and the program-builder read the same field keys. The DB stores the
 * version number with each response so this can change safely.
 *
 * v2 adds: goal profile (hypertrophy vs health), appetite for training
 * (want vs can), lifting experience detail, movement confidence, access
 * detail, and preferences. deriveProfile() reduces answers to six dials.
 * v3 adds nutrition goal and eating preferences for the client Nutrition tab.
 */

import { NUTRITION_SECTIONS } from "@/lib/nutrition/questionnaire";

export const QUESTIONNAIRE_VERSION = 3;

export type Field =
  | { key: string; label: string; type: "text" | "textarea" | "number"; placeholder?: string; help?: string }
  | { key: string; label: string; type: "select"; options: { value: string; label: string }[]; help?: string }
  | { key: string; label: string; type: "multi"; options: { value: string; label: string }[]; help?: string };

export type Section = { key: string; title: string; intro?: string; fields: Field[] };

const PATTERN_OPTIONS = [
  { value: "yes", label: "Yes, comfortably" },
  { value: "with_pain", label: "Yes, but with pain or hesitation" },
  { value: "no", label: "No / never tried" },
];

const FAMILIARITY = [
  { value: "never", label: "Never done it" },
  { value: "tried", label: "Tried it, not confident" },
  { value: "competent", label: "Can do it with good form" },
  { value: "strong", label: "Confident and have trained it seriously" },
];

const AGREE = [
  { value: "1", label: "Not at all" },
  { value: "2", label: "A little" },
  { value: "3", label: "Somewhat" },
  { value: "4", label: "Mostly" },
  { value: "5", label: "Completely" },
];

export const QUESTIONNAIRE_SECTIONS: Section[] = [
  {
    key: "goals",
    title: "Goals",
    fields: [
      {
        key: "primary_goal",
        label: "What matters most to you over the next 12 weeks?",
        type: "select",
        options: [
          { value: "strength", label: "Get stronger" },
          { value: "hypertrophy", label: "Build muscle / change how I look" },
          { value: "longevity", label: "Stay capable and independent as I age" },
          { value: "fat_loss", label: "Lose body fat" },
          { value: "return_to_sport", label: "Return to a sport or activity" },
          { value: "pain_free", label: "Move with less pain" },
          { value: "general", label: "General health and wellbeing" },
        ],
      },
      {
        key: "secondary_goals",
        label: "Anything else you'd like from training? (tick any)",
        type: "multi",
        options: [
          { value: "strength", label: "Strength" },
          { value: "hypertrophy", label: "Muscle" },
          { value: "fat_loss", label: "Fat loss" },
          { value: "fitness", label: "Cardio fitness" },
          { value: "mobility", label: "Flexibility / mobility" },
          { value: "balance", label: "Balance and confidence on my feet" },
          { value: "energy", label: "Energy and mood" },
          { value: "sport", label: "Sport performance" },
        ],
      },
      { key: "goal_detail", label: "Anything specific? (an event, a hike, picking up grandchildren…)", type: "textarea" },
      {
        key: "ambition",
        label: "How hard do you want to push?",
        type: "select",
        options: [
          { value: "gentle", label: "Gentle — I want to feel better, not exhausted" },
          { value: "steady", label: "Steady — work hard but leave the gym feeling good" },
          { value: "driven", label: "Driven — I want to see real change and I'll work for it" },
          { value: "max", label: "All in — push me as hard as is sensible" },
        ],
      },
    ],
  },
  {
    key: "history",
    title: "Training history",
    intro: "This decides where we start you. Rough answers are fine.",
    fields: [
      {
        key: "training_status",
        label: "Which describes you best?",
        type: "select",
        options: [
          { value: "knows_loads", label: "I train now and I know roughly what weights I use" },
          { value: "trains_no_numbers", label: "I train (or used to) but I don’t know my numbers" },
          { value: "untrained", label: "I don’t currently do strength training" },
        ],
      },
      { key: "years_training", label: "Years of strength training in total (approx.)", type: "number" },
      {
        key: "consistency",
        label: "In the last 12 months, how consistently have you strength trained?",
        type: "select",
        options: [
          { value: "none", label: "Not at all" },
          { value: "sporadic", label: "On and off — a few weeks here and there" },
          { value: "regular", label: "Most weeks, 1–2 sessions" },
          { value: "committed", label: "Most weeks, 3+ sessions" },
        ],
      },
      {
        key: "coached_before",
        label: "Have you been coached on lifting technique before?",
        type: "select",
        options: [
          { value: "no", label: "No" },
          { value: "some", label: "A little (a few sessions or a class)" },
          { value: "yes", label: "Yes, regularly" },
        ],
      },
      { key: "fam_barbell_squat", label: "Barbell back or front squat", type: "select", options: FAMILIARITY },
      { key: "fam_deadlift", label: "Deadlift (barbell or trap bar)", type: "select", options: FAMILIARITY },
      { key: "fam_press", label: "Bench or overhead press", type: "select", options: FAMILIARITY },
      { key: "fam_dumbbell", label: "Dumbbell exercises (goblet squat, rows, lunges)", type: "select", options: FAMILIARITY },
      { key: "fam_machines", label: "Gym machines (leg press, cable row, lat pulldown)", type: "select", options: FAMILIARITY },
      { key: "current_squat", label: "Squat-type lift you currently do, and a working weight", type: "text", placeholder: "e.g. goblet squat 16 kg × 8" },
      { key: "current_hinge", label: "Deadlift / hinge you currently do, and a working weight", type: "text", placeholder: "e.g. trap bar 60 kg × 5" },
      { key: "current_push", label: "Press / push you currently do, and a working weight", type: "text", placeholder: "e.g. push-ups × 10, DB press 12 kg" },
      { key: "current_pull", label: "Row / pull you currently do, and a working weight", type: "text" },
      {
        key: "rpe_familiar",
        label: "Are you comfortable rating how hard a set felt on a 1–10 scale?",
        type: "select",
        options: [
          { value: "yes", label: "Yes, I've used RPE / RIR before" },
          { value: "sort_of", label: "I get the idea but haven't used it" },
          { value: "no", label: "No — I'd need it explained" },
        ],
      },
    ],
  },
  {
    key: "movement",
    title: "How you move day to day",
    intro: "Your assessment measures this objectively. These questions tell us how it feels to you.",
    fields: [
      { key: "can_squat", label: "Can you squat to a chair and stand up?", type: "select", options: PATTERN_OPTIONS },
      { key: "can_hinge", label: "Can you lift something from the floor with a flat back?", type: "select", options: PATTERN_OPTIONS },
      { key: "can_push", label: "Can you do a push-up (any version)?", type: "select", options: PATTERN_OPTIONS },
      { key: "can_pull", label: "Can you row or pull something heavy toward you?", type: "select", options: PATTERN_OPTIONS },
      { key: "can_carry", label: "Can you carry heavy shopping in each hand?", type: "select", options: PATTERN_OPTIONS },
      { key: "can_overhead", label: "Can you reach and press overhead without pain?", type: "select", options: PATTERN_OPTIONS },
      { key: "can_floor", label: "Can you get down to the floor and back up without using your hands?", type: "select", options: PATTERN_OPTIONS },
      { key: "can_balance", label: "Can you stand on one leg for 10 seconds?", type: "select", options: PATTERN_OPTIONS },
      { key: "can_stairs", label: "Can you climb two flights of stairs without stopping?", type: "select", options: PATTERN_OPTIONS },
      {
        key: "movement_confidence",
        label: "How confident do you feel in your body when you move?",
        type: "select",
        options: [
          { value: "low", label: "Cautious — I worry about hurting myself" },
          { value: "moderate", label: "Okay — fine with familiar movements" },
          { value: "high", label: "Confident — happy to try new things" },
        ],
      },
      { key: "avoids", label: "Movements or positions you avoid, and why", type: "textarea", placeholder: "e.g. kneeling (knee), overhead (shoulder), running (breathless)" },
    ],
  },
  {
    key: "schedule",
    title: "Time, access and equipment",
    fields: [
      {
        key: "days_per_week",
        label: "How many days per week can you realistically train?",
        type: "select",
        options: [1, 2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: `${n} day${n > 1 ? "s" : ""}` })),
      },
      {
        key: "days_wanted",
        label: "If time were no object, how many days would you want to train?",
        type: "select",
        options: [1, 2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: `${n} day${n > 1 ? "s" : ""}` })),
      },
      {
        key: "session_minutes",
        label: "How long per session?",
        type: "select",
        options: [
          { value: "30", label: "About 30 minutes" },
          { value: "45", label: "About 45 minutes" },
          { value: "60", label: "About 60 minutes" },
          { value: "75", label: "75 minutes" },
          { value: "90", label: "90 minutes or more — I enjoy long sessions" },
        ],
      },
      {
        key: "schedule_flex",
        label: "How predictable is your week?",
        type: "select",
        options: [
          { value: "fixed", label: "Very — same days every week" },
          { value: "mostly", label: "Mostly — one day might move" },
          { value: "chaotic", label: "Unpredictable — I need flexibility" },
        ],
      },
      {
        key: "setting",
        label: "Where will you train most of the time?",
        type: "select",
        options: [
          { value: "commercial_gym", label: "Commercial gym" },
          { value: "home_full", label: "Home — barbell / rack" },
          { value: "home_minimal", label: "Home — dumbbells / bands only" },
          { value: "bodyweight", label: "Bodyweight only" },
          { value: "clinic", label: "With the practitioner" },
        ],
      },
      {
        key: "gym_access",
        label: "Do you have gym access at all?",
        type: "select",
        options: [
          { value: "member", label: "Yes — I'm a member" },
          { value: "could", label: "Could join / occasional access" },
          { value: "no", label: "No gym access" },
        ],
      },
      {
        key: "equipment",
        label: "Equipment available",
        type: "multi",
        options: [
          { value: "barbell", label: "Barbell & plates" },
          { value: "rack", label: "Squat rack" },
          { value: "trap_bar", label: "Trap bar" },
          { value: "dumbbells", label: "Dumbbells" },
          { value: "adjustable_db", label: "Adjustable dumbbells (range of weights)" },
          { value: "kettlebells", label: "Kettlebells" },
          { value: "cables", label: "Cable machine" },
          { value: "machines", label: "Pin-loaded machines" },
          { value: "bands", label: "Bands" },
          { value: "bench", label: "Bench" },
          { value: "box", label: "Box / step" },
          { value: "pullup_bar", label: "Pull-up bar" },
          { value: "bike", label: "Bike / rower / treadmill" },
        ],
      },
      { key: "equipment_detail", label: "Dumbbell / kettlebell weights you have at home (if any)", type: "text", placeholder: "e.g. 8, 12, 16 kg" },
    ],
  },
  {
    key: "preferences",
    title: "Preferences",
    intro: "The best program is the one you'll actually do.",
    fields: [
      {
        key: "style_pref",
        label: "Which sounds most like you?",
        type: "select",
        options: [
          { value: "free_weights", label: "I like free weights and learning lifts" },
          { value: "machines", label: "I prefer machines — simple and safe" },
          { value: "mixed", label: "Happy with a mix" },
          { value: "bodyweight", label: "I'd rather use my own body than equipment" },
          { value: "no_pref", label: "No preference — whatever works" },
        ],
      },
      {
        key: "variety_pref",
        label: "Same routine or variety?",
        type: "select",
        options: [
          { value: "same", label: "Same exercises each week so I can see progress" },
          { value: "some", label: "Mostly the same with small changes" },
          { value: "varied", label: "I get bored — mix it up" },
        ],
      },
      {
        key: "cardio_pref",
        label: "How do you feel about cardio?",
        type: "select",
        options: [
          { value: "love", label: "Love it" },
          { value: "fine", label: "Fine in small doses" },
          { value: "dislike", label: "Dislike it — keep it minimal" },
          { value: "cant", label: "Can't do much (breathing, joints)" },
        ],
      },
      { key: "enjoys", label: "Exercises or activities you enjoy", type: "textarea" },
      { key: "dislikes", label: "Exercises you dislike or don't want programmed", type: "textarea" },
      {
        key: "past_barrier",
        label: "What has stopped you sticking with exercise before?",
        type: "multi",
        options: [
          { value: "time", label: "Time" },
          { value: "boredom", label: "Boredom" },
          { value: "pain", label: "Pain or injury" },
          { value: "confidence", label: "Not knowing what to do" },
          { value: "results", label: "Not seeing results" },
          { value: "motivation", label: "Motivation" },
          { value: "life", label: "Life got in the way" },
          { value: "none", label: "Nothing — I've never really tried" },
        ],
      },
    ],
  },
  {
    key: "health",
    title: "Injuries and health",
    intro: "Anything here overrides the test results when we plan your program.",
    fields: [
      { key: "injuries", label: "Current or past injuries, surgeries, joint replacements", type: "textarea", placeholder: "e.g. left knee replacement 2023, shoulder pain when reaching overhead" },
      { key: "pain_now", label: "Anything that hurts right now during daily life or exercise?", type: "textarea" },
      { key: "conditions", label: "Medical conditions we should know about (heart, blood pressure, diabetes, osteoporosis, etc.)", type: "textarea" },
      { key: "medications", label: "Medications that affect exercise (blood pressure, beta-blockers, blood thinners…)", type: "textarea" },
      { key: "cleared", label: "Has a doctor told you to avoid any exercise?", type: "select", options: [{ value: "no", label: "No" }, { value: "yes", label: "Yes (explain below)" }] },
      { key: "cleared_detail", label: "Details", type: "textarea" },
    ],
  },
  {
    key: "lifestyle",
    title: "Lifestyle and recovery",
    fields: [
      {
        key: "sleep_hours",
        label: "Typical sleep per night",
        type: "select",
        options: [
          { value: "<6", label: "Under 6 hours" },
          { value: "6-7", label: "6–7 hours" },
          { value: "7-8", label: "7–8 hours" },
          { value: ">8", label: "More than 8 hours" },
        ],
      },
      {
        key: "stress",
        label: "Current stress level",
        type: "select",
        options: [
          { value: "low", label: "Low" },
          { value: "moderate", label: "Moderate" },
          { value: "high", label: "High" },
        ],
      },
      {
        key: "activity_level",
        label: "Day-to-day activity",
        type: "select",
        options: [
          { value: "sedentary", label: "Mostly sitting" },
          { value: "light", label: "On my feet some of the day" },
          { value: "active", label: "Physically active job or lifestyle" },
        ],
      },
      { key: "other_activity", label: "Other sport or exercise you do each week", type: "textarea" },
      { key: "recovery_feel", label: "I recover well between hard days", type: "select", options: AGREE },
      { key: "anything_else", label: "Anything else we should know?", type: "textarea" },
    ],
  },
  ...NUTRITION_SECTIONS,
];

export type LoadBucket = "knows_loads" | "trains_no_numbers" | "untrained";

export function deriveLoadBucket(answers: Record<string, unknown>): LoadBucket | null {
  const v = String(answers.training_status ?? "");
  if (v === "knows_loads" || v === "trains_no_numbers" || v === "untrained") return v;
  return null;
}

// ---------------------------------------------------------------------------
// Profile: six dials derived from the answers. This is what the program
// builder (human or AI) reasons over, instead of 50 raw fields.
// ---------------------------------------------------------------------------

export type Profile = {
  goal: "strength" | "hypertrophy" | "health" | "fat_loss" | "pain_free" | "performance";
  goalLabel: string;
  intensity: "gentle" | "steady" | "driven" | "max";
  experience: "novice" | "beginner" | "intermediate" | "advanced";
  movement: "cautious" | "moderate" | "confident";
  access: "full_gym" | "home_barbell" | "home_minimal" | "bodyweight";
  timeBudget: { days: number; minutes: number; wantsMore: boolean; weeklyMinutes: number; tier: "minimal" | "standard" | "generous" };
  flags: string[];
};

function n(v: unknown, fallback = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}
function s(v: unknown) {
  return v == null ? "" : String(v);
}
function arr(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string" && v) return v.split(",");
  return [];
}

export function deriveProfile(a: Record<string, unknown>): Profile {
  // Goal
  const pg = s(a.primary_goal);
  const goal: Profile["goal"] =
    pg === "strength"
      ? "strength"
      : pg === "hypertrophy"
        ? "hypertrophy"
        : pg === "fat_loss"
          ? "fat_loss"
          : pg === "pain_free"
            ? "pain_free"
            : pg === "return_to_sport"
              ? "performance"
              : "health";
  const goalLabel = {
    strength: "Strength",
    hypertrophy: "Hypertrophy",
    fat_loss: "Fat loss",
    pain_free: "Pain-free movement",
    performance: "Performance / sport",
    health: "Health & longevity",
  }[goal];

  // Intensity appetite
  const amb = s(a.ambition);
  const intensity: Profile["intensity"] =
    amb === "gentle" || amb === "steady" || amb === "driven" || amb === "max" ? amb : "steady";

  // Experience: combine status, years, consistency, coaching, lift familiarity
  const fam = ["fam_barbell_squat", "fam_deadlift", "fam_press", "fam_dumbbell", "fam_machines"].map((k) => s(a[k]));
  const famScore = fam.reduce((acc, v) => acc + (v === "strong" ? 3 : v === "competent" ? 2 : v === "tried" ? 1 : 0), 0); // 0–15
  const years = n(a.years_training);
  const cons = s(a.consistency);
  const status = s(a.training_status);
  let expScore = 0;
  expScore += status === "knows_loads" ? 3 : status === "trains_no_numbers" ? 1.5 : 0;
  expScore += years >= 5 ? 3 : years >= 2 ? 2 : years >= 0.5 ? 1 : 0;
  expScore += cons === "committed" ? 2 : cons === "regular" ? 1.5 : cons === "sporadic" ? 0.5 : 0;
  expScore += s(a.coached_before) === "yes" ? 1.5 : s(a.coached_before) === "some" ? 0.5 : 0;
  expScore += famScore / 3; // 0–5
  const experience: Profile["experience"] =
    expScore >= 10 ? "advanced" : expScore >= 6 ? "intermediate" : expScore >= 2.5 ? "beginner" : "novice";

  // Movement confidence: self-rating + capability answers
  const caps = ["can_squat", "can_hinge", "can_push", "can_pull", "can_carry", "can_overhead", "can_floor", "can_balance", "can_stairs"].map((k) => s(a[k]));
  const capNo = caps.filter((v) => v === "no").length;
  const capPain = caps.filter((v) => v === "with_pain").length;
  const mc = s(a.movement_confidence);
  const movement: Profile["movement"] =
    mc === "low" || capNo >= 3 || capPain >= 4
      ? "cautious"
      : mc === "high" && capNo === 0 && capPain <= 1
        ? "confident"
        : "moderate";

  // Access
  const setting = s(a.setting);
  const eq = arr(a.equipment);
  const access: Profile["access"] =
    setting === "commercial_gym" || setting === "clinic" || s(a.gym_access) === "member"
      ? "full_gym"
      : setting === "home_full" || (eq.includes("barbell") && eq.includes("rack"))
        ? "home_barbell"
        : setting === "bodyweight" || eq.length === 0
          ? "bodyweight"
          : "home_minimal";

  // Time
  const days = Math.max(1, n(a.days_per_week, 3));
  const minutes = Math.max(20, n(a.session_minutes, 45));
  const wanted = n(a.days_wanted, days);
  const weeklyMinutes = days * minutes;
  const timeBudget: Profile["timeBudget"] = {
    days,
    minutes,
    wantsMore: wanted > days,
    weeklyMinutes,
    tier: weeklyMinutes < 100 ? "minimal" : weeklyMinutes <= 200 ? "standard" : "generous",
  };

  // Flags worth surfacing to whoever writes the program
  const flags: string[] = [];
  if (s(a.cleared) === "yes") flags.push("Medical restriction reported");
  if (s(a.pain_now).trim()) flags.push("Current pain reported");
  if (s(a.injuries).trim()) flags.push("Injury history");
  if (capPain > 0) flags.push(`${capPain} movement${capPain > 1 ? "s" : ""} with pain/hesitation`);
  if (s(a.cardio_pref) === "cant") flags.push("Limited cardio tolerance");
  if (s(a.rpe_familiar) === "no") flags.push("Needs RPE explained");
  if (s(a.schedule_flex) === "chaotic") flags.push("Unpredictable schedule — favour full-body days");
  if (intensity === "max" && experience === "novice") flags.push("High ambition, low experience — temper early progression");
  if (goal === "hypertrophy" && timeBudget.tier === "minimal") flags.push("Hypertrophy goal on minimal time — set expectations");
  if (s(a.dislikes).trim()) flags.push("Has exercise dislikes");
  const barriers = arr(a.past_barrier);
  if (barriers.includes("boredom")) flags.push("Boredom is a barrier — build in variety");
  if (barriers.includes("pain")) flags.push("Pain ended past attempts");
  if (s(a.sleep_hours) === "<6" || s(a.stress) === "high") flags.push("Recovery limited (sleep/stress)");

  return { goal, goalLabel, intensity, experience, movement, access, timeBudget, flags };
}

export const PROFILE_LABELS = {
  intensity: { gentle: "Gentle", steady: "Steady", driven: "Driven", max: "All in" },
  experience: { novice: "Novice", beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" },
  movement: { cautious: "Cautious mover", moderate: "Moderate mover", confident: "Confident mover" },
  access: { full_gym: "Full gym", home_barbell: "Home barbell", home_minimal: "Home minimal", bodyweight: "Bodyweight only" },
  tier: { minimal: "Minimal time", standard: "Standard time", generous: "Generous time" },
} as const;

export function labelFor(field: Field, value: unknown): string {
  if (value == null || value === "") return "—";
  if (field.type === "select") {
    return field.options.find((o) => o.value === String(value))?.label ?? String(value);
  }
  if (field.type === "multi") {
    const list = Array.isArray(value) ? value : String(value).split(",");
    return list
      .map((v) => field.options.find((o) => o.value === String(v))?.label ?? String(v))
      .join(", ");
  }
  return String(value);
}
