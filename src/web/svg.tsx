import type { SVGProps } from 'react';

type SvgProps = SVGProps<SVGSVGElement> & { size?: number };
type CircleProps = SVGProps<SVGCircleElement> & { rotation?: string; origin?: string };

export function Svg({ children, width, height, ...props }: SvgProps) {
  return (
    <svg width={width} height={height} {...props}>
      {children}
    </svg>
  );
}
export default Svg;

export function Circle({ rotation: _rotation, origin: _origin, ...props }: CircleProps) {
  return <circle {...props} />;
}

export function Path(props: SVGProps<SVGPathElement>) {
  return <path {...props} />;
}
