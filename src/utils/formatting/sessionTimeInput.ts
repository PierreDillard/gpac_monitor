const TIME_INPUT_PATTERN = /^(?:(\d+):)?([0-5]?\d):([0-5]\d)$/;

function insertColons(text: string): string {
  if (!/^\d{3,}$/.test(text)) return text;
  const seconds = text.slice(-2);
  const minutes = text.slice(-4, -2);
  const hours = text.slice(0, -4);
  return hours ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`;
}

/** Parses a typed session time (HH:MM:SS, hours may exceed 24, MM:SS, or digits only read from the right) into relative µs; null if invalid or past the session end. */
export function parseSessionTimeInput(
  input: string,
  sessionDurationUs: number,
): number | null {
  const match = TIME_INPUT_PATTERN.exec(insertColons(input.trim()));
  if (!match) return null;
  const [, hoursText, minutesText, secondsText] = match;
  const totalSeconds =
    Number(hoursText ?? 0) * 3600 +
    Number(minutesText) * 60 +
    Number(secondsText);
  const offsetUs = totalSeconds * 1_000_000;
  return offsetUs <= sessionDurationUs ? offsetUs : null;
}
