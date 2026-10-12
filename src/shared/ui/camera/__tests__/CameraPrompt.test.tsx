import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

import { color } from '@/shared/theme';
import { CameraPrompt } from '@/shared/ui/camera';

const copy = {
  askTitle: 'Allow camera to scan check-in codes',
  body: 'The camera is only used to read check-in codes. Nothing is recorded.',
  byHandLabel: 'Type the code instead',
};

type Style = ViewStyle & TextStyle;
type Styled = { props: { style?: Style | Style[] } };
const styleOf = (el: Styled): Style => StyleSheet.flatten<Style>(el.props.style);
const bg = (el: Styled) => styleOf(el).backgroundColor;
const fg = (el: Styled) => styleOf(el).color;

it('default tone: ink text and the ordinary violet primary on a light surface', async () => {
  const onAllow = jest.fn();
  const onEnterByHand = jest.fn();
  await render(
    <CameraPrompt
      state="ask"
      canAsk
      {...copy}
      tone="default"
      onAllow={onAllow}
      onOpenSettings={jest.fn()}
      onEnterByHand={onEnterByHand}
    />,
  );
  const title = screen.getByRole('header', { name: copy.askTitle });
  expect(fg(title)).toBe(color.textPrimary);
  expect(fg(screen.getByText(copy.body))).toBe(color.textSecondary);
  const allow = screen.getByRole('button', { name: 'Allow camera' });
  expect(bg(allow)).toBe(color.actionFill);
  expect(fg(screen.getByText('Allow camera'))).toBe(color.onAction);
  const byHand = screen.getByRole('button', { name: copy.byHandLabel });
  expect(bg(byHand)).toBe(color.surface);
  await fireEvent.press(allow);
  await fireEvent.press(byHand);
  expect(onAllow).toHaveBeenCalledTimes(1);
  expect(onEnterByHand).toHaveBeenCalledTimes(1);
});

it('inverse tone (gate) keeps white text and a white primary', async () => {
  await render(
    <CameraPrompt
      state="denied"
      canAsk={false}
      {...copy}
      tone="inverse"
      onAllow={jest.fn()}
      onOpenSettings={jest.fn()}
      onEnterByHand={jest.fn()}
    />,
  );
  expect(fg(screen.getByRole('header', { name: 'Camera is off for Bookhushly' }))).toBe(
    color.onInverse,
  );
  expect(bg(screen.getByRole('button', { name: 'Open settings' }))).toBe(color.onInverse);
});
