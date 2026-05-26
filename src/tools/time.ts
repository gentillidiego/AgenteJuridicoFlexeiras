export const timeToolConfig = {
  type: 'function' as const,
  function: {
    name: 'get_current_time',
    description: 'Get the current local time.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
};

export function getCurrentTime(): string {
  const now = new Date();
  return now.toISOString();
}
