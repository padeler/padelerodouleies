import './Avatar.css';

interface AvatarProps {
  /** 'icon' renders a catalog SVG inset in the ring; 'image' fills the ring. */
  kind: string;
  value: string;
  /** Fixed pixel size. Omit to let `className` control the dimensions (e.g. responsive). */
  size?: number;
  className?: string;
  alt?: string;
}

/**
 * Circular avatar that renders consistently across the app (matching the login
 * screen): icon SVGs are padded inside the ring with `object-fit: contain` so
 * their edges are never clipped, while uploaded photos fill the ring with
 * `object-fit: cover`.
 */
export function Avatar({ kind, value, size, className = '', alt = '' }: AvatarProps) {
  const isImage = kind === 'image';
  const src = isImage ? value : `/api/icons/svg/${value}`;
  const style = size ? { width: size, height: size } : undefined;
  return (
    <span className={`avatar ${className}`.trim()} style={style}>
      <img src={src} alt={alt} className={isImage ? 'avatar-photo' : 'avatar-icon'} />
    </span>
  );
}
