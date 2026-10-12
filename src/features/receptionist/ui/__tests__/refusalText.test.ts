import { refusalText } from '@/features/receptionist/ui/refusalText';

it('words every check-in refusal (spec §4), refusals never neutral', () => {
  expect(refusalText({ kind: 'cancelled' })).toEqual({
    message: 'This booking was cancelled.',
    tone: 'danger',
    chooseRoom: false,
  });
  expect(refusalText({ kind: 'unpaid' }).tone).toBe('warning');
  expect(refusalText({ kind: 'alreadyIn', at: '2026-10-11T09:42:00Z' })).toMatchObject({
    message: 'Already checked in at 10:42.',
    tone: 'warning',
  });
  expect(refusalText({ kind: 'alreadyIn', at: null }).message).toBe('Already checked in.');
  expect(refusalText({ kind: 'alreadyOut' }).message).toBe('This guest has already checked out.');
  expect(refusalText({ kind: 'roomOccupied', roomNumber: 204 })).toEqual({
    message: 'Room 204 still has a guest checked in.',
    tone: 'warning',
    chooseRoom: true,
  });
  expect(refusalText({ kind: 'roomOccupied', roomNumber: null }).message).toBe(
    'The room still has a guest checked in.',
  );
  // The server omitted the number: the booking's room stands in.
  expect(refusalText({ kind: 'roomOccupied', roomNumber: null }, { roomNumber: 204 }).message).toBe(
    'Room 204 still has a guest checked in.',
  );
  expect(
    refusalText({ kind: 'roomUnavailable', roomNumber: null, roomStatus: null }, { roomNumber: 204 })
      .message,
  ).toBe("Room 204 isn't available.");
  expect(
    refusalText({ kind: 'roomUnavailable', roomNumber: 204, roomStatus: 'under_maintenance' }),
  ).toEqual({ message: 'Room 204 is under maintenance.', tone: 'warning', chooseRoom: true });
  expect(
    refusalText({ kind: 'roomUnavailable', roomNumber: 204, roomStatus: 'out_of_service' }).message,
  ).toBe('Room 204 is out of service.');
  expect(refusalText({ kind: 'roomUnavailable', roomNumber: 204, roomStatus: null }).message).toBe(
    "Room 204 isn't available.",
  );
  expect(refusalText({ kind: 'forbidden' })).toMatchObject({
    message: "You can't check in guests at this hotel.",
    tone: 'danger',
  });
  expect(refusalText({ kind: 'notFound' }).message).toBe('This booking no longer exists.');
  expect(refusalText({ kind: 'invalid' }).message).toBe(
    "Couldn't check in this booking. Try again or use the web dashboard.",
  );
  expect(refusalText({ kind: 'notCheckedIn' }).message).toBe("This guest isn't checked in.");
});

it('words reassign refusals for the room, not the guest', () => {
  expect(refusalText({ kind: 'roomTaken' }, { act: 'reassign', roomNumber: 305 })).toEqual({
    message: 'Room 305 was just taken. Choose another.',
    tone: 'warning',
    chooseRoom: false,
  });
  expect(refusalText({ kind: 'roomTaken' }, { act: 'reassign' }).message).toBe(
    'That room was just taken. Choose another.',
  );
  expect(refusalText({ kind: 'forbidden' }, { act: 'reassign' }).message).toBe(
    "You can't change rooms at this hotel.",
  );
  expect(refusalText({ kind: 'invalid' }, { act: 'reassign' }).message).toBe(
    "Couldn't move this booking. Try again or use the web dashboard.",
  );
});
