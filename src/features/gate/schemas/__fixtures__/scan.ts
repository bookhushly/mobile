// Contract fixtures for POST /api/events/{id}/scan and GET …/scan/summary.
// Source: web scan/route.js + admit_ticket + scan_summary, read 2026-10-05.
export const TICKET_ID = '3f2b8c4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f';
const BOOKING_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

const refusal = (code: string, error: string) => ({
  error,
  code,
  checked_in_at: null,
  scanned_by: null,
  ticket: null,
  ticket_count: null,
});

export const fx = {
  admitted: {
    status: 200,
    body: {
      ok: true,
      ticket: {
        id: TICKET_ID,
        ticket_type: 'Regular',
        ticket_index: 2,
        checked_in_at: '2026-10-05T18:04:00.000Z',
        seat: null,
      },
      booking: {
        id: BOOKING_ID,
        contact_email: 'guest@example.com',
        contact_phone: '+2348000000000',
        total_tickets: 3,
        checked_in_count: 2,
        tickets: [],
      },
    },
  },
  usedByName: {
    status: 409,
    body: {
      error: 'Ticket already checked in',
      code: 'already_checked_in',
      checked_in_at: '2026-10-05T17:30:00.000Z',
      scanned_by: 'Ada Gate',
      ticket: { ticket_type: 'Regular', ticket_index: 1 },
      ticket_count: null,
    },
  },
  usedByMe: {
    status: 409,
    body: {
      error: 'Ticket already checked in',
      code: 'already_checked_in',
      checked_in_at: '2026-10-05T17:30:00.000Z',
      scanned_by: 'Ada Gate',
      by_me: true,
      ticket: { ticket_type: 'Regular', ticket_index: 1 },
      ticket_count: null,
    },
  },
  usedNotMe: {
    status: 409,
    body: {
      error: 'Ticket already checked in',
      code: 'already_checked_in',
      checked_in_at: '2026-10-05T17:30:00.000Z',
      scanned_by: 'Ada Gate',
      by_me: false,
      ticket: { ticket_type: 'Regular', ticket_index: 1 },
      ticket_count: null,
    },
  },
  usedByEmail: {
    status: 409,
    body: {
      error: 'Ticket already checked in',
      code: 'already_checked_in',
      checked_in_at: '2026-10-05T17:30:00.000Z',
      scanned_by: 'scanner@example.com',
      ticket: { ticket_type: 'VIP', ticket_index: 1 },
      ticket_count: null,
    },
  },
  notFound: { status: 404, body: refusal('not_found', 'Ticket not found') },
  forbidden: { status: 403, body: refusal('forbidden', "You aren't assigned to this event") },
  bookingQr: { status: 409, body: refusal('booking_qr', 'Old ticket format') },
  wrongEvent: { status: 409, body: refusal('wrong_event', 'This ticket is for a different event') },
  notConfirmed: { status: 409, body: refusal('not_confirmed', 'Booking is not confirmed') },
  staticNotAllowed: { status: 409, body: refusal('static_not_allowed', 'Live code required') },
  expiredCode: { status: 409, body: { error: 'Code expired', code: 'expired_code' } },
  invalidRotating: { status: 409, body: { error: 'Invalid ticket code', code: 'invalid_code' } },
  invalidStatic: { status: 400, body: { error: 'Not a Bookhushly ticket', code: 'invalid_code' } },
  missingId: { status: 400, body: { error: 'ticket_id is required' } },
  lookupFailed: { status: 503, body: { error: "Couldn't read the ticket", code: 'lookup_failed' } },
  unauthorized: { status: 401, body: { error: 'Unauthorized' } },
  rateLimited: { status: 429, body: { error: 'Too many requests' } },
  summary: {
    status: 200,
    body: {
      admitted: 41,
      total: 120,
      recent: [
        {
          id: TICKET_ID,
          ticket_type: 'Regular',
          checked_in_at: '2026-10-05T18:04:00.000Z',
          scanned_by_me: true,
        },
        {
          id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
          ticket_type: null,
          checked_in_at: '2026-10-05T18:01:00.000Z',
          scanned_by_me: null,
        },
      ],
    },
  },
  summaryForbidden: { status: 403, body: { error: 'Forbidden' } },
  summaryFailed: { status: 503, body: { error: "Couldn't load totals" } },
} as const;
