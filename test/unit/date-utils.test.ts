import { parseInputToUTCDate, formatDateUTCToYMD, addDaysUTC } from '../../src/utils/date-utils';

describe('date-utils', () => {
  it('parses YYYY-MM-DD and formats as YYYY-MM-DD (UTC)', () => {
    const d = parseInputToUTCDate('2024-01-05')!;
    expect(formatDateUTCToYMD(d)).toBe('2024-01-05');
  });

  it('parses YYYY/MM/DD and formats as YYYY-MM-DD (UTC)', () => {
    const d = parseInputToUTCDate('2024/1/5')!;
    expect(formatDateUTCToYMD(d)).toBe('2024-01-05');
  });

  it('parses MM/DD/YYYY and formats as YYYY-MM-DD (UTC)', () => {
    const d = parseInputToUTCDate('1/5/2024')!;
    expect(formatDateUTCToYMD(d)).toBe('2024-01-05');
  });

  it('parses ISO with timezone and normalizes to UTC date', () => {
    const d = parseInputToUTCDate('2024-01-05T23:00:00-02:00')!; // = 2024-01-06T01:00:00Z
    expect(formatDateUTCToYMD(d)).toBe('2024-01-06');
  });

  it('addDaysUTC adds days based on UTC calendar', () => {
    const start = parseInputToUTCDate('2024-01-01')!;
    const end = addDaysUTC(start, 5);
    expect(formatDateUTCToYMD(end)).toBe('2024-01-06');
  });
});

