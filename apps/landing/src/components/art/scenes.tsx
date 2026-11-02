import { ImageFrame, SceneSvg } from "./frame";
import { Bubble, Cloud, Device, P, Person, School, Sky, Tree, drift } from "./parts";

type Slot = { photo?: string; className?: string };

const ROLE_RATIO = "aspect-[4/3]";

function Plant({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0" cy="2" rx="22" ry="4" fill="#000" opacity="0.08" />
      <g className="drift" style={drift({ "--dx": "1px", "--dy": "-2px", "--dr": "1.5deg", "--fs": "6s" })}>
        <ellipse cx="-12" cy="-58" rx="8" ry="22" fill={P.leaf} transform="rotate(-28 -12 -38)" />
        <ellipse cx="0" cy="-62" rx="8" ry="25" fill={P.leaf2} />
        <ellipse cx="12" cy="-56" rx="7" ry="20" fill={P.leaf} transform="rotate(26 12 -38)" />
      </g>
      <path d="M-16 0l-4-38h36l-4 38z" transform="translate(2 0)" fill={P.terra} />
      <rect x="-20" y="-42" width="40" height="7" rx="3" fill={P.brick} />
    </g>
  );
}

/* ------------------------------------------------------------------ Owner */
export function OwnerScene({ photo, className }: Slot) {
  const alt = "A school owner reviewing the school on a tablet";
  return (
    <ImageFrame photo={photo} alt={alt} className={`${ROLE_RATIO} ${className ?? ""}`}>
      <SceneSvg viewBox="0 0 400 300" label={alt}>
        {/* wall + floor */}
        <rect width="400" height="300" fill="#F3E9D8" />
        <rect y="238" width="400" height="62" fill="#D9C3A0" />
        {/* window */}
        <path d="M30 176V96a52 52 0 0 1 104 0V176Z" fill={P.sky} />
        <path d="M82 44v132M30 108h104" stroke={P.white} strokeWidth="4" />
        <Cloud x={62} y={84} s={0.8} speed={12} dx={14} />
        <rect x="34" y="150" width="96" height="26" fill={P.leaf2} opacity="0.85" />
        <circle cx="52" cy="150" r="14" fill={P.leaf} />
        <circle cx="108" cy="148" r="17" fill={P.leaf} />
        <path d="M30 176V96a52 52 0 0 1 104 0V176Z" fill="none" stroke={P.white} strokeWidth="5" />
        <rect x="24" y="174" width="116" height="8" rx="3" fill={P.wood} />
        {/* plant */}
        <Plant x={46} y={246} />
        {/* person behind desk */}
        <Person x={188} y={332} s={1.3} seated skin={P.skinB} hair="short" top={P.navy} shirt={P.white} pose="desk" />
        {/* desk */}
        <ellipse cx="250" cy="252" rx="150" ry="6" fill="#000" opacity="0.08" />
        <rect x="110" y="190" width="276" height="9" rx="4.500" fill="#8E5E37" />
        <rect x="124" y="199" width="248" height="51" fill={P.wood} />
        <rect x="136" y="208" width="96" height="30" rx="5" fill="#A8743F" />
        <rect x="242" y="208" width="96" height="30" rx="5" fill="#A8743F" />
        <rect x="178" y="220" width="12" height="4" rx="2" fill={P.cream} />
        <rect x="284" y="220" width="12" height="4" rx="2" fill={P.cream} />
        <rect x="124" y="246" width="248" height="4" fill="#000" opacity="0.12" />
        {/* mug */}
        <rect x="124" y="166" width="16" height="20" rx="4" fill={P.teal} />
        <path d="M140 171h4a4 4 0 0 1 0 9h-4" stroke={P.teal} strokeWidth="3" fill="none" />
        {/* tablet on stand */}
        <rect x="312" y="180" width="26" height="6" rx="3" fill={P.ink} />
        <rect x="322" y="166" width="6" height="16" fill={P.ink} />
        <Device x={325} y={138} w={78} h={58} rx={8}>
          <rect x="-30" y="-20" width="28" height="5" rx="2.500" fill={P.ink} />
          <rect x="-30" y="-11" width="18" height="4" rx="2" fill="#C9D1D9" />
          {[0, 1, 2, 3, 4].map((i) => (
            <rect key={i} x={-30 + i * 12} y={22 - [8, 14, 11, 20, 16][i]} width="8" height={[8, 14, 11, 20, 16][i]} rx="2" fill={i === 3 ? P.accent : P.teal} />
          ))}
          <circle cx="24" cy="-10" r="9" fill="none" stroke="#DCE3E9" strokeWidth="4" />
          <path d="M24 -19a9 9 0 0 1 9 9" stroke={P.mustard} strokeWidth="4" strokeLinecap="round" fill="none" />
        </Device>
        <Bubble x={232} y={40} w={106} label="96% present" delay={-1} />
      </SceneSvg>
    </ImageFrame>
  );
}

/* ---------------------------------------------------------------- Teacher */
export function TeacherScene({ photo, className }: Slot) {
  const alt = "A teacher at the blackboard holding a tablet";
  return (
    <ImageFrame photo={photo} alt={alt} className={`${ROLE_RATIO} ${className ?? ""}`}>
      <SceneSvg viewBox="0 0 400 300" label={alt}>
        <rect width="400" height="300" fill="#F4ECDD" />
        <rect y="244" width="400" height="56" fill="#D6BE98" />
        {/* blackboard */}
        <rect x="24" y="40" width="226" height="134" rx="8" fill={P.wood} />
        <rect x="30" y="46" width="214" height="122" rx="5" fill={P.board} />
        <rect x="24" y="174" width="226" height="8" rx="3" fill="#8E5E37" />
        <rect x="40" y="170" width="16" height="4" rx="2" fill={P.white} />
        <text x="48" y="82" fontSize="22" fontWeight="700" fill={P.white} fontFamily="inherit" opacity="0.92">
          Class 8-B
        </text>
        <path d="M48 94h96" stroke={P.white} strokeWidth="2.400" strokeLinecap="round" opacity="0.5" />
        <text x="48" y="130" fontSize="19" fontWeight="600" fill={P.white} fontFamily="inherit" opacity="0.85">
          12 + 8 = 20
        </text>
        <path d="M130 138h46" stroke={P.mustard} strokeWidth="3" strokeLinecap="round" />
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={170 + i * 18} y={150 - [14, 28, 20, 38][i]} width="11" height={[14, 28, 20, 38][i]} rx="2" fill="none" stroke={P.white} strokeWidth="2" opacity="0.7" />
        ))}
        <path d="M48 154h60" stroke={P.white} strokeWidth="2.400" strokeLinecap="round" strokeDasharray="2 7" opacity="0.5" />
        {/* clock */}
        <circle cx="360" cy="52" r="17" fill={P.white} stroke={P.terra} strokeWidth="4" />
        <path d="M360 42v11l7 4" stroke={P.ink} strokeWidth="3" strokeLinecap="round" fill="none" />
        {/* shelf with books */}
        <rect x="346" y="196" width="40" height="48" rx="4" fill={P.wood} />
        <rect x="350" y="200" width="32" height="40" rx="2" fill="#A8743F" />
        <rect x="352" y="204" width="8" height="32" rx="2" fill={P.teal} />
        <rect x="362" y="210" width="8" height="26" rx="2" fill={P.mustard} />
        <rect x="372" y="206" width="8" height="30" rx="2" fill={P.maroon} />
        {/* teacher */}
        <Person x={306} y={272} s={1.2} skin={P.skinA} hair="bun" top={P.sage} bottom={P.navy} shirt={P.white} pose="tablet">
          <line x1="-60" y1="-172" x2="-112" y2="-150" stroke={P.cream} strokeWidth="3.500" strokeLinecap="round" />
          <Device x={26} y={-104} w={36} h={46} rot={-8} rx={6}>
            <rect x="-12" y="-16" width="22" height="4" rx="2" fill={P.ink} />
            <circle cx="-9" cy="-4" r="3" fill={P.teal} />
            <rect x="-2" y="-6" width="12" height="4" rx="2" fill="#C9D1D9" />
            <circle cx="-9" cy="8" r="3" fill={P.mustard} />
            <rect x="-2" y="6" width="12" height="4" rx="2" fill="#C9D1D9" />
          </Device>
        </Person>
      </SceneSvg>
    </ImageFrame>
  );
}

/* ----------------------------------------------------------------- Parent */
export function ParentScene({ photo, className }: Slot) {
  const alt = "A parent holding a phone with school notifications";
  return (
    <ImageFrame photo={photo} alt={alt} className={`${ROLE_RATIO} ${className ?? ""}`}>
      <SceneSvg viewBox="0 0 400 300" label={alt}>
        <rect width="400" height="300" fill="#F4ECDD" />
        <circle cx="200" cy="150" r="118" fill="#FBF6EC" />
        <rect y="248" width="400" height="52" fill="#D9C3A0" />
        {/* plant + lamp */}
        <Plant x={58} y={254} />
        <path d="M352 250V148" stroke={P.ink} strokeWidth="4" strokeLinecap="round" />
        <path d="M334 148l8-26h20l8 26z" fill={P.mustard} />
        <ellipse cx="352" cy="252" rx="16" ry="4" fill="#000" opacity="0.12" />
        <Cloud x={70} y={64} s={0.8} speed={13} dx={12} />
        <Cloud x={338} y={50} s={0.7} speed={10} dx={-10} delay={-3} />
        <Person x={200} y={274} s={1.25} skin={P.skinB} hair="long" top={P.teal} dress pose="phone">
          <Device x={5} y={-124} w={22} h={36} rot={-10} rx={5}>
            <rect x="-6" y="-12" width="12" height="4" rx="2" fill={P.ink} />
            <rect x="-6" y="-5" width="9" height="3" rx="1.500" fill="#C9D1D9" />
            <rect x="-6" y="2" width="12" height="9" rx="3" fill={P.sage} />
          </Device>
        </Person>
        <Bubble x={236} y={60} w={112} label="Aarav is present" dot delay={-1} speed={6.5} />
        <Bubble x={52} y={104} w={104} label="Results out" dark delay={-3} speed={7.5} />
        <Bubble x={246} y={118} w={96} label="Fee ₹1,800" dark={false} delay={-5} speed={8} />
      </SceneSvg>
    </ImageFrame>
  );
}

/* ----------------------------------------------------------------- Family */
export function FamilyScene({ photo, className }: Slot) {
  const alt = "A parent and child with a school bag walking to school";
  return (
    <ImageFrame photo={photo} alt={alt} sizes="(min-width: 1024px) 40vw, 100vw" className={className}>
      <SceneSvg viewBox="0 0 400 440" label={alt} align="xMidYMax">
        <Sky id="sky-family" w={400} h={440} />
        <circle cx="190" cy="262" r="140" fill={P.white} opacity="0.45" />
        <Cloud x={70} y={70} s={0.9} speed={13} dx={14} />
        <Cloud x={344} y={120} s={0.7} speed={10} dx={-10} delay={-4} />
        <School x={296} y={380} s={0.6} />
        <rect y="380" width="400" height="60" fill={P.grass} />
        <rect y="380" width="400" height="4" fill={P.leaf2} opacity="0.6" />
        <path d="M0 416Q200 396 400 416V440H0Z" fill="#E6D8BC" />
        <Tree x={36} y={380} s={1.1} />
        <Tree x={372} y={380} s={0.8} tone="b" sway={7} />
        <Person x={120} y={420} s={1.2} skin={P.skinB} hair="long" top={P.maroon} dress pose="hold" />
        <Person x={226} y={420} s={0.8} skin={P.skinC} hair="curly" top={P.white} bottom={P.navy} pose="up" bag bob={3.2} />
        <Bubble x={150} y={46} w={118} label="Aarav is present" delay={-1} />
        <Bubble x={46} y={142} w={96} label="Bus on time" dark delay={-3} speed={7.5} />
      </SceneSvg>
    </ImageFrame>
  );
}

/* ------------------------------------------------------------ Contact side */
export function SchoolScene({ photo, className }: Slot) {
  const alt = "A school building with a flag";
  return (
    <ImageFrame photo={photo} alt={alt} sizes="(min-width: 1024px) 40vw, 100vw" className={`${ROLE_RATIO} ${className ?? ""}`}>
      <SceneSvg viewBox="0 0 400 300" label={alt}>
        <Sky id="sky-school" w={400} h={300} />
        <circle cx="200" cy="150" r="124" fill={P.white} opacity="0.4" />
        <Cloud x={62} y={64} s={0.9} speed={13} dx={14} />
        <Cloud x={338} y={88} s={0.7} speed={11} dx={-12} delay={-3} />
        <rect y="238" width="400" height="62" fill={P.grass} />
        <rect y="238" width="400" height="3" fill={P.leaf2} />
        <path d="M0 272Q200 258 400 272V300H0Z" fill="#E6D8BC" />
        <Tree x={28} y={238} s={1} />
        <Tree x={374} y={238} s={0.9} tone="b" sway={7} />
        <School x={200} y={238} s={1.02} />
        <Person x={96} y={284} s={0.46} skin={P.skinC} hair="short" top={P.white} bottom={P.navy} pose="stand" bag bob={3} />
        <Person x={128} y={290} s={0.52} skin={P.skinA} hair="curly" top={P.white} bottom={P.navy} pose="stand" bag bob={3.6} />
        <Person x={300} y={288} s={0.5} skin={P.skinB} hair="bun" top={P.mustard} dress pose="wave" bob={4} />
      </SceneSvg>
    </ImageFrame>
  );
}
