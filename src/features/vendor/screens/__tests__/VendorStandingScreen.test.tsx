import { fireEvent, render, screen } from '@testing-library/react-native';

import type { VendorProfile } from '@/features/vendor/domain/vendorProfile';
import { VendorStandingScreen } from '@/features/vendor/screens/VendorStandingScreen';

const vendor = (
  standing: VendorProfile['standing'],
  kind: VendorProfile['kind'] = 'logistics',
) => ({
  status: 'ready' as const,
  vendor: { id: 'v1', name: 'Swift Haulage', kind, standing },
});

const noop = () => undefined;

describe('VendorStandingScreen', () => {
  it('no business row: says to finish on the web, and opens it', async () => {
    const onOpenWeb = jest.fn();
    await render(
      <VendorStandingScreen state={{ status: 'none' }} onOpenWeb={onOpenWeb} onSignOut={noop} />,
    );
    expect(screen.getByRole('header', { name: 'Finish setting up your business' })).toBeTruthy();
    await fireEvent.press(screen.getByTestId('vendor-open-web'));
    expect(onOpenWeb).toHaveBeenCalled();
  });

  it('waiting for approval names the business', async () => {
    await render(
      <VendorStandingScreen
        state={vendor({ kind: 'waiting' })}
        onOpenWeb={noop}
        onSignOut={noop}
      />,
    );
    expect(screen.getByRole('header', { name: 'Your business is being reviewed' })).toBeTruthy();
    expect(screen.getByText(/checking Swift Haulage’s details/)).toBeTruthy();
  });

  it('rejected shows the reason when there is one', async () => {
    await render(
      <VendorStandingScreen
        state={vendor({ kind: 'rejected', reason: 'The ID photo was unreadable.' })}
        onOpenWeb={noop}
        onSignOut={noop}
      />,
    );
    expect(screen.getByText(/The ID photo was unreadable\./)).toBeTruthy();
  });

  it('suspended', async () => {
    await render(
      <VendorStandingScreen
        state={vendor({ kind: 'suspended' })}
        onOpenWeb={noop}
        onSignOut={noop}
      />,
    );
    expect(screen.getByRole('header', { name: 'Swift Haulage is suspended' })).toBeTruthy();
  });

  it('a kind of business the app does not serve goes to the web', async () => {
    await render(
      <VendorStandingScreen
        state={vendor({ kind: 'ready' }, 'other')}
        onOpenWeb={noop}
        onSignOut={noop}
      />,
    );
    expect(
      screen.getByRole('header', { name: 'Use bookhushly.com for your business' }),
    ).toBeTruthy();
  });

  it('a failed load is "try again", never a refusal', async () => {
    const retry = jest.fn();
    await render(
      <VendorStandingScreen state={{ status: 'error', retry }} onOpenWeb={noop} onSignOut={noop} />,
    );
    expect(screen.getByText('We couldn’t load your business')).toBeTruthy();
  });
});
