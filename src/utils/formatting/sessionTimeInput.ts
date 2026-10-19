const TIME_INPUT_PATTERN = /^(?:(\d+):)?([0-5]?\d):([0-5]\d)$/;
const DAY_PREFIX_PATTERN = /^(\d+)d\s*(.*)$/;

function insertColons(text: string): string {
  if (!/^\d{3,}$/.test(text)) return text;
  const seconds = text.slice(-2);
  const minutes = text.slice(-4, -2);
  const hours = text.slice(0, -4);
  return hours ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`;
}

function parseClockSeconds(text: string): number | null {
  const match = TIME_INPUT_PATTERN.exec(insertColons(text));
  if (!match) return null;
  const [, hoursText, minutesText, secondsText] = match;
  return (
    Number(hoursText ?? 0) * 3600 +
    Number(minutesText) * 60 +
    Number(secondsText)
  );
}

/** Parses a typed session time (Nd HH:MM:SS, Nd, HH:MM:SS, hours may exceed 24, MM:SS, or digits only read from the right) into relative µs; null if invalid or past the session end. */
export function parseSessionTimeInput(
  input: string,
  sessionDurationUs: number,
): number | null {
  const trimmed = input.trim();
  const dayMatch = DAY_PREFIX_PATTERN.exec(trimmed);
  const days = dayMatch ? Number(dayMatch[1]) : 0;
  const clockText = dayMatch ? dayMatch[2] : trimmed;
  const clockSeconds =
    dayMatch && clockText === '' ? 0 : parseClockSeconds(clockText);
  if (clockSeconds === null) return null;
  const offsetUs = (days * 86400 + clockSeconds) * 1_000_000;
  return offsetUs <= sessionDurationUs ? offsetUs : null;
}
