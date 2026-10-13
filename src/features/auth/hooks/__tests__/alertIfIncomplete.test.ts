import { Alert } from 'react-native';

import { alertIfIncomplete } from '@/features/auth/hooks/useSignOut';

jest.mock('@/features/auth/hooks/useAuth', () => ({ useAuth: jest.fn() }));

it('tells the user neutrally when sign-out could not finish, and only then', () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  alertIfIncomplete({ blocked: null });
  expect(alert).not.toHaveBeenCalled();
  alertIfIncomplete({ blocked: null, incomplete: true });
  expect(alert).toHaveBeenCalledWith('Couldn’t finish signing out — try again');
  alert.mockRestore();
});
