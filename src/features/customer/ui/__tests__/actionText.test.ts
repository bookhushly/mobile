import { cancelNotice, transferNotice } from '@/features/customer/ui/actionText';

it('a changed booking says to go back and pull to refresh (U8)', () => {
  expect(cancelNotice({ kind: 'refused', reason: 'bookingChanged' })).toEqual({
    tone: 'warning',
    message: 'This booking changed — go back and pull to refresh.',
  });
});

it('a transfer 400 covers the contact-email case (K2)', () => {
  expect(transferNotice({ kind: 'refused', reason: 'notTransferable' })).toEqual({
    tone: 'danger',
    message: 'These tickets can’t be sent to that address right now.',
  });
});
