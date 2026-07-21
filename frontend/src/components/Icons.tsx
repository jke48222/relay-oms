// Minimal 20px outline icon set (stroke = currentColor), hand-rolled so the
// bundle carries no icon library.

interface IconProps {
  size?: number
}

function base(size: number) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
}

export function IconGrid({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
    </svg>
  )
}

export function IconCart({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M3.5 4.5h2l2.2 11h11l2-8H7" />
      <circle cx="9.5" cy="19" r="1.4" />
      <circle cx="16.5" cy="19" r="1.4" />
    </svg>
  )
}

export function IconBox({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 3.2 20 7v10l-8 3.8L4 17V7l8-3.8Z" />
      <path d="M4 7l8 3.8L20 7" />
      <path d="M12 10.8V20.8" />
    </svg>
  )
}

export function IconLayers({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="m12 3.5 8.5 4.5L12 12.5 3.5 8 12 3.5Z" />
      <path d="m4 12.5 8 4.3 8-4.3" />
      <path d="m4 16.5 8 4.3 8-4.3" />
    </svg>
  )
}

export function IconBlueprint({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="6" cy="6" r="2.4" />
      <circle cx="18" cy="6" r="2.4" />
      <circle cx="12" cy="18" r="2.4" />
      <path d="M8.4 6h7.2M7 8.2l3.6 7.4M17 8.2l-3.6 7.4" />
    </svg>
  )
}

export function IconSearch({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-3.8-3.8" />
    </svg>
  )
}

export function IconBell({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 4a5.5 5.5 0 0 0-5.5 5.5c0 4.2-1.6 5.6-2 6h15c-.4-.4-2-1.8-2-6A5.5 5.5 0 0 0 12 4Z" />
      <path d="M10 18.6a2 2 0 0 0 4 0" />
    </svg>
  )
}

export function IconChevron({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="m9 5 7 7-7 7" />
    </svg>
  )
}

export function IconCollapse({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="m11 6-5 6 5 6" />
      <path d="m18 6-5 6 5 6" />
    </svg>
  )
}

export function IconArrowLeft({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M19 12H5" />
      <path d="m11 6-6 6 6 6" />
    </svg>
  )
}

export function IconPlus({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function IconX({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  )
}

export function IconZap({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M13 2.5 4.5 13.5H11l-1 8L18.5 10H12l1-7.5Z" />
    </svg>
  )
}
