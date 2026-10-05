import { Box, type BoxProps } from './Box';

export function Stack(props: BoxProps) {
  return <Box {...props} style={{ flexDirection: 'column', ...props.style }} />;
}

export function Inline(props: BoxProps & { align?: 'center' | 'flex-start' | 'flex-end' }) {
  const { align = 'center', ...rest } = props;
  return <Box {...rest} style={{ flexDirection: 'row', alignItems: align, ...props.style }} />;
}
