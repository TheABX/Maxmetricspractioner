import {
  fmtWeekday,
  nextSessionAfter,
  ordinalDay,
  sessionDate,
  sessionHeadline,
  sessionOnDate,
} from "../lib/programs/types";

function fail(msg: string): never {
  console.error("FAIL", msg);
  process.exit(1);
}

if (ordinalDay(1) !== "1st") fail("1st");
if (ordinalDay(2) !== "2nd") fail("2nd");
if (ordinalDay(3) !== "3rd") fail("3rd");
if (ordinalDay(11) !== "11th") fail("11th");
if (ordinalDay(16) !== "16th") fail("16th");
if (ordinalDay(21) !== "21st") fail("21st");
if (ordinalDay(22) !== "22nd") fail("22nd");
if (ordinalDay(23) !== "23rd") fail("23rd");

const mon = sessionDate("2026-09-14", 1, 1, 3);
if (!mon || fmtWeekday(mon) !== "Monday 14th") fail(`day 1 should be Monday 14th, got ${fmtWeekday(mon)}`);
const wed = sessionDate("2026-09-14", 1, 2, 3);
if (!wed || fmtWeekday(wed) !== "Wednesday 16th") fail(`day 2 should be Wednesday 16th, got ${fmtWeekday(wed)}`);
const fri = sessionDate("2026-09-14", 1, 3, 3);
if (!fri || fmtWeekday(fri) !== "Friday 18th") fail(`day 3 should be Friday 18th, got ${fmtWeekday(fri)}`);

const sessions = [
  { id: "a", program_id: "p", week: 1, day: 1, title: "Day 1", focus: "Lower" },
  { id: "b", program_id: "p", week: 1, day: 2, title: "Upper", focus: null },
  { id: "c", program_id: "p", week: 1, day: 3, title: "Day 3", focus: "Full" },
];
const program = { start_date: "2026-09-14", days_per_week: 3 };
const today = sessionOnDate(sessions, program, new Date(2026, 8, 16));
if (today?.session.id !== "b") fail("Wednesday should map to the second session");
if (sessionHeadline(today!.session) !== "Upper") fail("should use session title when it is not Day N");
if (sessionHeadline(sessions[0]) !== "Lower") fail("Day 1 title should fall back to focus");

const next = nextSessionAfter(sessions, program, new Date(2026, 8, 16));
if (next?.session.id !== "c") fail("next after Wednesday should be Friday");
const rest = sessionOnDate(sessions, program, new Date(2026, 8, 17));
if (rest) fail("Thursday should have no planned session");

console.log("ok");
