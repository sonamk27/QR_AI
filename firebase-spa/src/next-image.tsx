import type { ImgHTMLAttributes } from "react";

type Props = ImgHTMLAttributes<HTMLImageElement> & {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  priority?: boolean;
};

export default function Image({ priority: _priority, ...props }: Props) {
  return <img {...props} loading={_priority ? "eager" : props.loading} />;
}
