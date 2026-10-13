import { z } from 'zod';

export const NOTIFICATION_COLUMNS = 'id, type, title, message, data, link, read, created_at';

export const notificationRow = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  message: z.string(),
  data: z.record(z.string(), z.unknown()).nullable(),
  link: z.string().nullable(),
  read: z.boolean(),
  created_at: z.string(),
});
export type NotificationRow = z.infer<typeof notificationRow>;
