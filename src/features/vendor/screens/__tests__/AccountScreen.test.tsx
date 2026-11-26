import { fireEvent, render, screen } from '@testing-library/react-native';

import { accountLinks } from '@/features/vendor/domain/accountLinks';
import { AccountScreen } from '@/features/vendor/screens/AccountScreen';

const noop = () => undefined;
const base = {
  businessName: 'Swift Haulage',
  kindWord: 'Logistics',
  email: 'ops@swifthaulage.ng',
  links: accountLinks('logistics'),
  onOpenLink: noop,
  onEmailSupport: noop,
  onSwitchToBooking: noop,
  onSignOut: noop,
};

describe('AccountScreen', () => {
  it('the business, approved, and who is signed in', async () => {
    await render(<AccountScreen {...base} />);
    expect(screen.getByText('Swift Haulage')).toBeTruthy();
    expect(screen.getByText('Approved')).toBeTruthy();
    expect(screen.getByText('ops@swifthaulage.ng')).toBeTruthy();
  });

  it('web settings say they open bookhushly.com, and open their own page', async () => {
    const onOpenLink = jest.fn();
    await render(<AccountScreen {...base} onOpenLink={onOpenLink} />);
    await fireEvent.press(
      screen.getByLabelText('Vehicles and drivers, Add and edit your fleet. Opens bookhushly.com'),
    );
    expect(onOpenLink).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/vendor/dashboard/fleet' }),
    );
  });

  it('switch to booking and sign out', async () => {
    const onSwitchToBooking = jest.fn();
    const onSignOut = jest.fn();
    await render(
      <AccountScreen {...base} onSwitchToBooking={onSwitchToBooking} onSignOut={onSignOut} />,
    );
    await fireEvent.press(screen.getByTestId('vendor-switch-booking'));
    await fireEvent.press(screen.getByTestId('vendor-sign-out'));
    expect(onSwitchToBooking).toHaveBeenCalled();
    expect(onSignOut).toHaveBeenCalled();
  });

  it('no switch when the account can’t book', async () => {
    await render(<AccountScreen {...base} onSwitchToBooking={null} />);
    expect(screen.queryByTestId('vendor-switch-booking')).toBeNull();
  });
});
