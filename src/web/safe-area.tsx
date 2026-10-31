import type { ComponentProps } from 'react';
import { View } from 'react-native-web';

export function SafeAreaView({
  children,
  ...props
}: ComponentProps<typeof View> & { edges?: string[] }) {
  return <View {...props}>{children}</View>;
}
