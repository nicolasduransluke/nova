export const DEFAULT_TIMEZONE = 'America/New_York';

/**
 * Convert a UTC Date to a YYYY-MM-DD string in the given timezone.
 * Uses Intl.DateTimeFormat('en-CA') which natively formats as YYYY-MM-DD.
 */
export function toDateKeyInTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(date);
}

/**
 * Returns { start, end } as UTC Dates representing the boundaries of
 * "today" in the user's timezone.
 */
export function getUserTodayRange(timezone: string): { start: Date; end: Date } {
  const todayKey = toDateKeyInTimezone(new Date(), timezone);
  // todayKey is "YYYY-MM-DD" in user's local tz
  // Build start/end by computing the UTC instant for midnight of that day in the tz
  const start = toUTCFromTzMidnight(todayKey, timezone);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

/**
 * Returns the UTC Date for midnight of the user's current local date.
 */
export function getUserLocalMidnight(timezone: string): Date {
  const todayKey = toDateKeyInTimezone(new Date(), timezone);
  return toUTCFromTzMidnight(todayKey, timezone);
}

/**
 * Given "YYYY-MM-DD" and a timezone, compute the UTC Date for midnight of that day
 * in the given timezone by binary-searching with Intl.DateTimeFormat.
 *
 * Simpler approach: parse the date parts and use the timezone offset to reconstruct.
 */
function toUTCFromTzMidnight(dateKey: string, timezone: string): Date {
  // Start with a rough guess: interpret dateKey as UTC midnight
  const [year, month, day] = dateKey.split('-').map(Number);
  const guess = new Date(Date.UTC(year, month - 1, day));

  // Get the offset between UTC and the target timezone at this moment
  // by formatting the guess in the target tz and comparing
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  // Format the guess in the target tz to find what time it is there
  const parts = formatter.formatToParts(guess);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value ?? '0';
  const tzHour = parseInt(getPart('hour'), 10);
  const tzMinute = parseInt(getPart('minute'), 10);

  // The offset is: how many minutes ahead the tz is from UTC
  // If guess = UTC midnight and tz shows 19:00 (7PM previous day), offset = -5h
  // Midnight in tz = guess + (24 - tzHour)*60 - tzMinute ... but this gets tricky with day wraps
  // Simpler: just subtract the tz time from the guess to get tz midnight
  let offsetMs = (tzHour * 60 + tzMinute) * 60 * 1000;

  // Check if the tz date matches; if tz day is before our target day, we overshot
  const tzDay = parseInt(getPart('day'), 10);
  if (tzDay !== day) {
    // tz is in the previous day, so the offset wraps around
    offsetMs = offsetMs - 24 * 60 * 60 * 1000;
  }

  const midnight = new Date(guess.getTime() - offsetMs);

  // Verify: the result formatted in tz should give us the target dateKey at 00:00
  const verify = toDateKeyInTimezone(midnight, timezone);
  if (verify !== dateKey) {
    // Fallback: try shifting by 1 day
    const shifted = new Date(midnight.getTime() + 24 * 60 * 60 * 1000);
    if (toDateKeyInTimezone(shifted, timezone) === dateKey) {
      return shifted;
    }
  }

  return midnight;
}
