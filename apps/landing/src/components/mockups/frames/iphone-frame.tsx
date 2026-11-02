import { useId, type ReactNode } from "react";

/**
 * iPhone device frame: the supplied SVG (viewBox 460 x 962), unchanged except that ids are unique per instance.
 * The screen is the area inside the 20-unit black ring (x25..435, y25..937). `children` fill it; the frame is
 * drawn on top so the bezel and the Dynamic Island sit above the UI.
 */
export function IphoneFrame({ children, className }: { children: ReactNode; className?: string }) {
  const p = `ip${useId().replace(/[^a-zA-Z0-9]/g, "")}-`;
  return (
    <div className={`relative ${className ?? ""}`}>
      <div className="absolute overflow-hidden bg-bg" style={{ left: "5.435%", top: "2.598%", width: "89.13%", height: "94.8%", borderRadius: "15% / 6.8%" }}>
        {children}
      </div>
      <svg viewBox="0 0 460 962" fill="none" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true" className="pointer-events-none absolute inset-0 size-full overflow-visible">
        <rect x="167.5" y="26.33" width="125" height="36.67" rx="18.335" fill="black" />
        <mask id={`${p}stroke0_710_714`} maskUnits="userSpaceOnUse" x="5" y="5" width="450" height="952" fill="black">
          <rect fill="white" x="5" y="5" width="450" height="952" />
          <path d="M15 114.76C15 75.6863 15 56.1494 24.029 41.922C28.6037 34.7134 34.7134 28.6037 41.922 24.029C56.1494 15 75.6863 15 114.76 15H345.24C384.314 15 403.851 15 418.078 24.029C425.287 28.6037 431.396 34.7134 435.971 41.922C445 56.1494 445 75.6863 445 114.76V847.24C445 886.314 445 905.851 435.971 920.078C431.396 927.287 425.287 933.396 418.078 937.971C403.851 947 384.314 947 345.24 947H114.76C75.6863 947 56.1494 947 41.922 937.971C34.7134 933.396 28.6037 927.287 24.029 920.078C15 905.851 15 886.314 15 847.24V114.76Z" />
        </mask>
        <path d="M114.76 947H345.24C384.314 947 403.851 947 418.078 937.971C425.287 933.396 431.396 927.287 435.971 920.078C445 905.851 445 886.314 445 847.24V114.76C445 75.6863 445 56.1494 435.971 41.922C431.396 34.7134 425.287 28.6037 418.078 24.029C403.851 15 384.314 15 345.24 15H114.76C75.6863 15 56.1494 15 41.922 24.029C34.7134 28.6037 28.6037 34.7134 24.029 41.922C15 56.1494 15 75.6863 15 114.76V847.24C15 886.314 15 905.851 24.029 920.078C28.6037 927.287 34.7134 933.396 41.922 937.971C56.1494 947 75.6863 947 114.76 947Z" strokeWidth="20" stroke="black" mask={`url(#${p}stroke0_710_714)`} />
        <rect x="2.5" y="2.5" width="455" height="957" rx="70.5" stroke="#BDB8AF" strokeOpacity="0.62" strokeWidth="5" />
      </svg>
    </div>
  );
}
