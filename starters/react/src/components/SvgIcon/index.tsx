import { FC } from 'react';

interface IconProps {
  name: string;
  rotate?: boolean;
  size?: string;
  color?: string;
}

const SvgIcon: FC<IconProps> = ({
  name,
  rotate = false,
  size = '1.5rem',
  color = 'currentColor',
}) => {
  return (
    <svg
      className={`icon ${rotate ? 'rotate' : ''}`}
      style={{ width: size, height: size, color }}
      aria-hidden="true"
    >
      <use xlinkHref={`#icon-${name}`} />
    </svg>
  );
};

export default SvgIcon;
