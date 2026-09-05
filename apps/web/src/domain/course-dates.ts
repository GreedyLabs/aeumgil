const DAY_MS = 86_400_000;

/** YYYY-MM-DD를 UTC 날짜 번호로 바꿔 시간대·일광절약시간·월말에 영향을 받지 않는다. */
export function calendarDay(date: string): number | undefined {
  if (!/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(0);
  parsed.setUTCFullYear(year!, month! - 1, day!);
  parsed.setUTCHours(0, 0, 0, 0);
  return parsed.toISOString().slice(0, 10) === date ? parsed.getTime() / DAY_MS : undefined;
}

export function calendarDateAt(startDate: string | undefined, day: number): string | undefined {
  const first = startDate ? calendarDay(startDate) : undefined;
  if (first === undefined || !Number.isSafeInteger(day) || day < 1) return undefined;
  const time = (first + day - 1) * DAY_MS;
  if (!Number.isFinite(time) || Math.abs(time) > 8.64e15) return undefined;
  const date = new Date(time).toISOString().slice(0, 10);
  return calendarDay(date) === undefined ? undefined : date;
}

export function courseDateCount(startDate?: string, endDate?: string): number | undefined {
  const start = startDate ? calendarDay(startDate) : undefined;
  const end = endDate ? calendarDay(endDate) : undefined;
  return start !== undefined && end !== undefined && end >= start ? end - start + 1 : undefined;
}

export function dayForCalendarDate(startDate: string, date: string): number | undefined {
  return courseDateCount(startDate, date);
}

export function courseDayLabel(day: number, startDate?: string): string {
  const date = calendarDateAt(startDate, day);
  return date ? `${date.replaceAll("-", ".")} · Day ${day}` : `Day ${day}`;
}

export interface CourseDates {
  startDate?: string;
  endDate?: string;
}

/** 날짜 미정은 허용한다. 기간을 줄여도 기존 항목은 버리지 않고 범위 오류를 알린다. */
export function courseDateProblem(
  dates: CourseDates,
  items: ReadonlyArray<{ day: number }>,
): string | undefined {
  if (!dates.startDate && !dates.endDate) return undefined;
  if (!dates.startDate || !dates.endDate) return "여행 시작일과 종료일을 모두 선택해 주세요.";
  const count = courseDateCount(dates.startDate, dates.endDate);
  if (count === undefined)
    return "종료일은 시작일과 같거나 늦어야 해요. 실제 날짜를 확인해 주세요.";
  const outside = [
    ...new Set(items.filter((item) => item.day > count).map((item) => item.day)),
  ].sort((a, b) => a - b);
  if (!outside.length) return undefined;
  const days = outside
    .slice(0, 3)
    .map((day) => courseDayLabel(day, dates.startDate))
    .join(", ");
  return `${days}${outside.length > 3 ? ` 외 ${outside.length - 3}일` : ""}에 장소가 남아 있어요. 종료일을 늘리거나 해당 장소를 기간 안으로 옮겨 주세요. 장소는 삭제되지 않았어요.`;
}
