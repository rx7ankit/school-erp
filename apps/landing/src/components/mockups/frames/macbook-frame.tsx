import { useId, type ReactNode } from "react";

/**
 * MacBook Pro device frame: the supplied SVG (viewBox 1216 x 735), unchanged except that ids are unique per instance
 * and the notch + camera are split into a second layer so they sit above the screen UI. The glass is
 * x112..1104.5, y4..657; `children` fill it.
 */
export function MacbookFrame({ children, className }: { children: ReactNode; className?: string }) {
  const p = `mb${useId().replace(/[^a-zA-Z0-9]/g, "")}-`;
  return (
    <div className={`relative ${className ?? ""}`}>
      <svg viewBox="0 0 1216 735" fill="none" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true" className="pointer-events-none absolute inset-0 size-full overflow-visible">
        <g clipPath={`url(#${p}clip0_601_140)`}>
          <path d="M1216 689.6V685H0V689.6C0 703.041 0 709.762 2.61584 714.896C4.91681 719.412 8.58832 723.083 13.1042 725.384C18.2381 728 24.9587 728 38.4 728H1177.6C1191.04 728 1197.76 728 1202.9 725.384C1207.41 723.083 1211.08 719.412 1213.38 714.896C1216 709.762 1216 703.041 1216 689.6Z" fill={`url(#${p}paint0_linear_601_140)`} />
          <path d="M1146 731C1147.6 730.6 1148.67 728.833 1149 728H1069.5C1069.83 728.833 1070.9 730.6 1072.5 731C1072.67 732.167 1073.4 734.5 1075 734.5H1143.5C1145.1 734.5 1145.83 732.167 1146 731Z" fill={`url(#${p}paint1_linear_601_140)`} />
          <path d="M1145.93 731.406V731.25H1072.54C1072.77 732.47 1073.51 734.5 1075 734.5H1143.5C1144.93 734.5 1145.67 732.635 1145.93 731.406Z" fillRule="evenodd" clipRule="evenodd" fill={`url(#${p}paint2_linear_601_140)`} />
          <path d="M1145.93 731.25V731.406C1145.85 731.754 1145.74 732.152 1145.59 732.545H1072.91C1072.73 732.092 1072.61 731.631 1072.54 731.25H1145.93Z" fillRule="evenodd" clipRule="evenodd" fill="#383838" />
          <path d="M142.5 731C144.1 730.6 145.167 728.833 145.5 728H66C66.3333 728.833 67.4 730.6 69 731C69.1667 732.167 69.9 734.5 71.5 734.5H140C141.6 734.5 142.333 732.167 142.5 731Z" fill={`url(#${p}paint3_linear_601_140)`} />
          <path d="M142.428 731.406V731.25H69.0414C69.2692 732.47 70.0075 734.5 71.5 734.5H140C141.43 734.5 142.168 732.635 142.428 731.406Z" fillRule="evenodd" clipRule="evenodd" fill={`url(#${p}paint4_linear_601_140)`} />
          <path d="M142.428 731.25V731.406C142.354 731.754 142.243 732.152 142.088 732.545H69.4123C69.2338 732.092 69.1127 731.631 69.0415 731.25H142.428Z" fillRule="evenodd" clipRule="evenodd" fill="#383838" />
          <path d="M502 685H713.5C713.5 694.113 706.113 701.5 697 701.5H518.5C509.387 701.5 502 694.113 502 685Z" fill={`url(#${p}paint5_linear_601_140)`} />
          <mask id={`${p}stroke0_601_140`} fill="white">
            <path d="M502 685H713.5C713.5 694.113 706.113 701.5 697 701.5H518.5C509.387 701.5 502 694.113 502 685Z" />
          </mask>
          <path d="M713.5 685H502C502 694.113 509.387 701.5 518.5 701.5H697C706.113 701.5 713.5 694.113 713.5 685Z" strokeWidth="2" stroke="white" strokeOpacity="0.1" mask={`url(#${p}stroke0_601_140)`} />
          <rect x="1121.5" y="685" width="81" height="33" fill={`url(#${p}paint6_linear_601_140)`} />
          <rect width="84" height="33" transform="matrix(-1 0 0 1 84.5 685)" fill={`url(#${p}paint7_linear_601_140)`} />
          <g filter={`url(#${p}filter0_f_601_140)`}>
            <path d="M1192.5 685H1205.5V705.112C1205.5 709.469 1201.97 713 1197.61 713C1194.79 713 1192.5 710.711 1192.5 707.888V685Z" fill="#D2D2DA" />
          </g>
          <g filter={`url(#${p}filter1_f_601_140)`}>
            <path d="M20.5 685H9.5V706.326C9.5 710.012 12.4881 713 16.1742 713C18.5633 713 20.5 711.063 20.5 708.674V685Z" fill="#D2D2DA" />
          </g>
        </g>
        <path d="M608.5 2H1078.5C1093.96 2 1106.5 14.536 1106.5 30V683H608.5H608H110V30C110 14.536 122.536 2 138 2H608H608.5Z" fill="black" />
        <path d="M1078.5 4H138C123.641 4 112 15.6406 112 30V681H1104.5V30C1104.5 15.6406 1092.86 4 1078.5 4ZM1078.5 2H138C122.536 2 110 14.536 110 30V683H1106.5V30C1106.5 14.536 1093.96 2 1078.5 2Z" fillRule="evenodd" clipRule="evenodd" fill="#201F24" />
        <path d="M1108.5 685H108V30C108 13.4315 121.431 0 138 0H1078.5C1095.07 0 1108.5 13.4315 1108.5 30V685ZM1078.5 2H138C122.536 2 110 14.536 110 30V683H1106.5V30C1106.5 14.536 1093.96 2 1078.5 2Z" fillRule="evenodd" clipRule="evenodd" fill="#7D7D7F" />
        <path d="M112.846 657H1103.5V676C1103.5 678.209 1101.71 680 1099.5 680H116.846C114.637 680 112.846 678.209 112.846 676V657Z" fill={`url(#${p}paint8_linear_601_140)`} />
        <defs>
          <filter id={`${p}filter0_f_601_140`} x="1184.5" y="677" width="29" height="44" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feFlood floodOpacity="0" result="BackgroundImageFix" />
            <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
            <feGaussianBlur stdDeviation="4" result="effect1_foregroundBlur_601_140" />
          </filter>
          <filter id={`${p}filter1_f_601_140`} x="-0.5" y="675" width="31" height="48" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feFlood floodOpacity="0" result="BackgroundImageFix" />
            <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
            <feGaussianBlur stdDeviation="5" result="effect1_foregroundBlur_601_140" />
          </filter>
          <linearGradient id={`${p}paint0_linear_601_140`} x1="608" y1="685" x2="608" y2="728" gradientUnits="userSpaceOnUse">
            <stop stopColor="#AEAFB4" />
            <stop offset="0.192522" stopColor="#AFB0B5" />
            <stop offset="0.376094" stopColor="#AFB0B5" />
            <stop offset="0.598958" stopColor="#7D7E82" />
            <stop offset="0.713542" stopColor="#696A6F" />
            <stop offset="0.852125" stopColor="#838489" />
            <stop offset="0.931356" stopColor="#ABACB0" />
          </linearGradient>
          <linearGradient id={`${p}paint1_linear_601_140`} x1="1069.5" y1="731.25" x2="1149" y2="731.25" gradientUnits="userSpaceOnUse">
            <stop stopColor="#8C8D91" />
            <stop offset="0.173014" stopColor="#525358" />
            <stop offset="0.31824" stopColor="#78797D" />
            <stop offset="0.465029" stopColor="#A0A0A2" />
            <stop offset="0.691458" stopColor="#9A9A9C" />
            <stop offset="0.825754" stopColor="#4F5055" />
            <stop offset="0.941311" stopColor="#9E9EA0" />
            <stop offset="1" stopColor="#848589" />
          </linearGradient>
          <linearGradient id={`${p}paint2_linear_601_140`} x1="1072.54" y1="732.875" x2="1145.93" y2="732.875" gradientUnits="userSpaceOnUse">
            <stop stopColor="#575757" />
            <stop offset="0.0827846" stopColor="#2D2D2D" />
            <stop offset="0.490477" stopColor="#4E4E4E" />
            <stop offset="0.824814" stopColor="#2A2A2A" />
            <stop offset="1" stopColor="#5C5C5C" />
          </linearGradient>
          <linearGradient id={`${p}paint3_linear_601_140`} x1="66" y1="731.25" x2="145.5" y2="731.25" gradientUnits="userSpaceOnUse">
            <stop stopColor="#8C8D91" />
            <stop offset="0.173014" stopColor="#525358" />
            <stop offset="0.31824" stopColor="#78797D" />
            <stop offset="0.465029" stopColor="#A0A0A2" />
            <stop offset="0.691458" stopColor="#9A9A9C" />
            <stop offset="0.825754" stopColor="#4F5055" />
            <stop offset="0.941311" stopColor="#9E9EA0" />
            <stop offset="1" stopColor="#848589" />
          </linearGradient>
          <linearGradient id={`${p}paint4_linear_601_140`} x1="69.0414" y1="732.875" x2="142.428" y2="732.875" gradientUnits="userSpaceOnUse">
            <stop stopColor="#575757" />
            <stop offset="0.0827846" stopColor="#2D2D2D" />
            <stop offset="0.490477" stopColor="#4E4E4E" />
            <stop offset="0.824814" stopColor="#2A2A2A" />
            <stop offset="1" stopColor="#5C5C5C" />
          </linearGradient>
          <linearGradient id={`${p}paint5_linear_601_140`} x1="502.5" y1="693" x2="713.5" y2="693" gradientUnits="userSpaceOnUse">
            <stop stopColor="#25262B" />
            <stop offset="0.015659" stopColor="#606166" />
            <stop offset="0.035819" stopColor="#9FA0A4" />
            <stop offset="0.0504351" stopColor="#C8C8CE" />
            <stop offset="0.479167" stopColor="#D7D8DD" />
            <stop offset="0.941214" stopColor="#CBCBD3" />
            <stop offset="0.970403" stopColor="#A7A8AC" />
            <stop offset="0.980129" stopColor="#595A5E" />
            <stop offset="1" stopColor="#27282C" />
          </linearGradient>
          <linearGradient id={`${p}paint6_linear_601_140`} x1="1202.5" y1="702" x2="1121.5" y2="702" gradientUnits="userSpaceOnUse">
            <stop stopColor="#65666B" stopOpacity="0" />
            <stop offset="0.259918" stopColor="#65666B" />
            <stop offset="1" stopColor="#65666B" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${p}paint7_linear_601_140`} x1="84" y1="17" x2="2.87514e-08" y2="17" gradientUnits="userSpaceOnUse">
            <stop stopColor="#65666B" stopOpacity="0" />
            <stop offset="0.259918" stopColor="#65666B" />
            <stop offset="1" stopColor="#65666B" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${p}paint8_linear_601_140`} x1="607.5" y1="657" x2="607.5" y2="680" gradientUnits="userSpaceOnUse">
            <stop stopColor="#222222" />
            <stop offset="0.0852114" stopColor="#242424" />
            <stop offset="0.830431" stopColor="#242424" />
            <stop offset="1" stopColor="#201F24" />
          </linearGradient>
          <clipPath id={`${p}clip0_601_140`}>
            <rect width="1216" height="49.5" fill="white" transform="translate(0 685)" />
          </clipPath>
        </defs>
      </svg>
      <div className="absolute overflow-hidden rounded-t-[2.2em] bg-bg" style={{ left: "9.21%", top: "0.544%", width: "81.62%", height: "88.84%" }}>
        {children}
      </div>
      <svg viewBox="0 0 1216 735" fill="none" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true" className="pointer-events-none absolute inset-0 size-full overflow-visible">
        <path d="M667 20.5C667 18 670 18 671.5 18H544.5C546 18 549 18 549 20.5V30C549 34.4183 552.582 38 557 38H659C663.418 38 667 34.4183 667 30V20.5Z" fill="black" />
        <path d="M611.779 24.0907C611.779 26.1778 610.087 27.8697 608 27.8697C605.913 27.8697 604.221 26.1778 604.221 24.0907C604.221 22.0036 605.913 20.3117 608 20.3117C610.087 20.3117 611.779 22.0036 611.779 24.0907Z" fill="#0F0F0F" strokeWidth="0.260621" stroke="#151515" />
        <circle cx="607.609" cy="25.0029" r="0.912175" fill="#16181E" />
        <circle cx="607.609" cy="23.6997" r="0.912175" fill="#0A0B0D" />
        <circle opacity="0.6" cx="608" cy="24.0907" r="1.30311" fill="#1F2531" />
      </svg>
    </div>
  );
}
