export const gateKeys = {
  events: (userId: string) => ['gate', 'events', userId] as const,
  summary: (eventId: string) => ['gate', 'summary', eventId] as const,
};
