import type { Round } from "./types.js";

export interface TournamentMilestone {
  round: Round | "Registration" | "Champion";
  label: string;
  date: string;
  kind: "open" | "deadline" | "results" | "vote" | "crown";
}

export const tournamentMilestones: TournamentMilestone[] = [
  { round: "Registration", label: "Registration opens", date: "2026-06-15", kind: "open" },
  { round: "Group Stage", label: "Group Stage submissions close", date: "2026-06-23", kind: "deadline" },
  { round: "Group Stage", label: "Top 32 announced", date: "2026-06-27", kind: "results" },
  { round: "Round of 32", label: "R32 submissions close", date: "2026-06-28", kind: "deadline" },
  { round: "Round of 32", label: "Top 16 announced", date: "2026-07-03", kind: "results" },
  { round: "Round of 16", label: "R16 submissions close", date: "2026-07-04", kind: "deadline" },
  { round: "Round of 16", label: "Top 8 announced", date: "2026-07-07", kind: "results" },
  { round: "Quarter Finals", label: "Final build lock", date: "2026-07-08", kind: "deadline" },
  { round: "Quarter Finals", label: "Community voting", date: "2026-07-10", kind: "vote" },
  { round: "Semi Finals", label: "Community voting", date: "2026-07-14", kind: "vote" },
  { round: "Final", label: "Final community voting closes", date: "2026-07-18", kind: "vote" },
  { round: "Champion", label: "Champion crowned", date: "2026-07-19", kind: "crown" }
];

export function nextMilestone(now = new Date()): TournamentMilestone {
  return tournamentMilestones.find((item) => new Date(`${item.date}T23:59:59Z`) >= now) ?? tournamentMilestones[tournamentMilestones.length - 1];
}
