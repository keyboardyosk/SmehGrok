/** WORLD_TIME is minutes since Д1 00:00. */

export function formatWorldTime(minutes: number): string {
  const day = Math.floor(minutes / 1440) + 1;
  const rem = ((minutes % 1440) + 1440) % 1440;
  const hh = Math.floor(rem / 60);
  const mm = rem % 60;
  return `Д${day} ${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function formatDuration(minutes: number): string {
  const abs = Math.max(0, Math.round(minutes));
  if (abs < 60) return `${abs} мин`;
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (m === 0) return `${h} ч`;
  return `${h} ч ${m} мин`;
}

export function minutesOfDay(minutes: number): number {
  return ((minutes % 1440) + 1440) % 1440;
}

export function etaLabel(now: number, eta: number): string {
  const delta = eta - now;
  if (delta <= 0) return "прибытие";
  return `до планеты: ${formatDuration(delta)}`;
}

export function deadlineLabel(deadline: number): string {
  return `до: ${formatWorldTime(deadline)}`;
}

export function slackLabel(now: number, deadline: number): string {
  return `запас: ${formatDuration(deadline - now)}`;
}
