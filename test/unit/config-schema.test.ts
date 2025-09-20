import { validateGanttConfig } from '../../src/config/schema';

describe('validateGanttConfig', () => {
  it('should accept minimal valid config and apply defaults', () => {
    const input = {
      tasksField: 'tasks',
      startField: 'start',
      endField: 'end'
    } as const;

    const result = validateGanttConfig(input);
    expect(result).toEqual({
      tasksField: 'tasks',
      startField: 'start',
      endField: 'end',
      idField: 'id',
      titleField: 'title'
    });
  });

  it('should throw with a helpful message when required fields are missing', () => {
    expect(() => validateGanttConfig({})).toThrow(
      /tasksField,startField,endField are required/i
    );
  });

  it('should reject empty strings for field names', () => {
    expect(() => validateGanttConfig({
      tasksField: '',
      startField: 'start',
      endField: 'end'
    })).toThrow(/tasksField must be a non-empty string/i);
  });
});

