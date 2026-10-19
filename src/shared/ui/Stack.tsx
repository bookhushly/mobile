import { Box, type BoxProps } from './Box';

export function Stack(props: BoxProps) {
  return <Box {...props} style={{ flexDirection: 'column', ...props.style }} />;
}

type Justify = 'flex-start' | 'center' | 'flex-end' | 'space-between';

export function Inline(
  props: BoxProps & { align?: 'center' | 'flex-start' | 'flex-end'; justify?: Justify },
) {
  const { align = 'center', justify, ...rest } = props;
  return (
    <Box
      {...rest}
      style={{ flexDirection: 'row', alignItems: align, justifyContent: justify, ...props.style }}
    />
  );
}
