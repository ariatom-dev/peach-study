const PATHS = {
  library: <><path d="M4 4.5v15" /><path d="M9 4.5v15" /><path d="M14.2 5.3l4.1 14" /><path d="M3 19.5h12" /></>,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  sliders: <><path d="M4 7h9" /><path d="M17 7h3" /><circle cx="15" cy="7" r="2" /><path d="M4 17h3" /><path d="M11 17h9" /><circle cx="9" cy="17" r="2" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" /></>,
  moon: <path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z" />,
  back: <><path d="M19 12H5" /><path d="M11 6l-6 6 6 6" /></>,
  chevron: <path d="M9 6l6 6-6 6" />,
  x: <><path d="M6 6l12 12" /><path d="M18 6L6 18" /></>,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  bookmark: <path d="M7 4h10v16l-5-3.5L7 20z" />,
  shuffle: <><path d="M4 7h3.5c2.5 0 3.5 1.5 5 4s2.5 4 5 4H20" /><path d="M4 17h3.5c1.4 0 2.3-.5 3.1-1.4" /><path d="M13 8.3c.8-.8 1.8-1.3 3.5-1.3H20" /><path d="M17.5 4.5L20 7l-2.5 2.5" /><path d="M17.5 12.5L20 15l-2.5 2.5" /></>,
  download: <><path d="M12 4v11" /><path d="M7 10.5l5 5 5-5" /><path d="M5 20h14" /></>,
  upload: <><path d="M12 15V4" /><path d="M7 8.5l5-5 5 5" /><path d="M5 20h14" /></>,
  trash: <><path d="M5 7h14" /><path d="M9 7V4.5h6V7" /><path d="M7 7l1 13h8l1-13" /></>,
  user: <><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" /></>,
  monitor: <><rect x="3.5" y="5" width="17" height="11" rx="1.5" /><path d="M9 20h6M12 16v4" /></>,
};

export default function Icon({ name, size = 20, className = '' }) {
  return (
    <svg
      className={`icon ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
