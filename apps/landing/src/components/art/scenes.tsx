import { ImageFrame, SceneSvg } from "./frame";
import { Bubble, Cloud, Device, P, Person, School, Tree, drift } from "./parts";

type Slot = { photo?: string; className?: string };

const ROLE_RATIO = "aspect-[4/3]";

/* ------------------------------------------------------------------ Owner */
export function OwnerScene({ photo, className }: Slot) {
  const alt = "A school owner reviewing the school on a tablet";
  return (
    <ImageFrame photo={photo} alt={alt} className={`${ROLE_RATIO} ${className ?? ""}`}>
      <SceneSvg viewBox="0 0 400 300" label={alt}>
        <rect width="400" height="300" fill={P.g1} />
        <rect y="238" width="400" height="62" fill={P.g2} />
        {/* window */}
        <path d="M30 176V96a52 52 0 0 1 104 0V176Z" fill={P.white} />
        <path d="M82 44v132M30 108h104" stroke={P.g2} strokeWidth="4" />
        <path d="M30 176V96a52 52 0 0 1 104 0V176Z" fill="none" stroke={P.g3} strokeWidth="4" />
        <Cloud x={62} y={84} s={0.8} speed={12} dx={14} />
        <rect x="34" y="150" width="96" height="22" fill={P.g1} />
        <circle cx="52" cy="150" r="14" fill={P.g3} />
        <circle cx="108" cy="148" r="17" fill={P.g3} />
        <rect x="26" y="174" width="112" height="8" rx="3" fill={P.g3} />
        {/* frame on wall */}
        <rect x="286" y="52" width="68" height="50" rx="3" fill={P.white} stroke={P.ink} strokeWidth="3" />
        <rect x="298" y="64" width="44" height="5" rx="2.500" fill={P.g3} />
        <rect x="298" y="76" width="30" height="4" rx="2" fill={P.g2} />
        <circle cx="338" cy="86" r="5" fill={P.ink} />
        {/* plant */}
        <path d="M30 244l-4-38h36l-4 38z" fill={P.white} />
        <g className="drift" style={drift({ "--dx": "1px", "--dy": "-2px", "--dr": "1.5deg", "--fs": "6s" })}>
          <ellipse cx="34" cy="186" rx="8" ry="22" fill={P.mid} transform="rotate(-28 34 206)" />
          <ellipse cx="46" cy="182" rx="8" ry="25" fill={P.g4} />
          <ellipse cx="58" cy="188" rx="7" ry="20" fill={P.mid} transform="rotate(26 58 206)" />
        </g>
        {/* person behind desk */}
        <Person x={188} y={332} s={1.3} seated skin="#B4B4BA" hair="short" top="#3A3A3C" shirt={P.white} pose="desk" />
        {/* desk */}
        <rect x="110" y="186" width="276" height="12" rx="5" fill={P.ink} />
        <rect x="124" y="198" width="248" height="52" fill={P.white} />
        <rect x="136" y="208" width="96" height="30" rx="5" fill={P.g1} />
        <rect x="242" y="208" width="96" height="30" rx="5" fill={P.g1} />
        <rect x="178" y="220" width="12" height="4" rx="2" fill={P.g4} />
        <rect x="284" y="220" width="12" height="4" rx="2" fill={P.g4} />
        <rect x="124" y="250" width="248" height="4" fill={P.g3} />
        {/* mug */}
        <rect x="124" y="166" width="16" height="20" rx="4" fill={P.white} />
        <path d="M140 171h4a4 4 0 0 1 0 9h-4" stroke={P.white} strokeWidth="3" fill="none" />
        {/* tablet on stand */}
        <rect x="312" y="180" width="26" height="6" rx="3" fill={P.dark} />
        <rect x="322" y="166" width="6" height="16" fill={P.dark} />
        <Device x={325} y={138} w={78} h={58} rx={8}>
          <rect x="-30" y="-20" width="28" height="5" rx="2.500" fill={P.ink} />
          <rect x="-30" y="-11" width="18" height="4" rx="2" fill={P.g3} />
          {[0, 1, 2, 3, 4].map((i) => (
            <rect key={i} x={-30 + i * 12} y={22 - [8, 14, 11, 20, 16][i]} width="8" height={[8, 14, 11, 20, 16][i]} rx="2" fill={i === 3 ? P.accent : P.g3} />
          ))}
          <circle cx="24" cy="-10" r="9" fill="none" stroke={P.g2} strokeWidth="4" />
          <path d="M24 -19a9 9 0 0 1 9 9" stroke={P.ink} strokeWidth="4" strokeLinecap="round" fill="none" />
        </Device>
        <Bubble x={226} y={46} w={106} label="96% present" delay={-1} />
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
        <rect width="400" height="300" fill={P.g1} />
        <rect y="244" width="400" height="56" fill={P.g2} />
        {/* blackboard */}
        <rect x="24" y="40" width="226" height="134" rx="8" fill={P.white} />
        <rect x="30" y="46" width="214" height="122" rx="5" fill={P.ink} />
        <rect x="24" y="174" width="226" height="8" rx="3" fill={P.g4} />
        <rect x="40" y="170" width="16" height="4" rx="2" fill={P.white} />
        <text x="48" y="82" fontSize="22" fontWeight="700" fill={P.white} fontFamily="inherit" opacity="0.92">
          Class 8-B
        </text>
        <path d="M48 94h96" stroke={P.white} strokeWidth="2.400" strokeLinecap="round" opacity="0.5" />
        <text x="48" y="130" fontSize="19" fontWeight="600" fill={P.white} fontFamily="inherit" opacity="0.8">
          12 + 8 = 20
        </text>
        <path d="M130 138h46" stroke={P.accent} strokeWidth="3" strokeLinecap="round" />
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={170 + i * 18} y={150 - [14, 28, 20, 38][i]} width="11" height={[14, 28, 20, 38][i]} rx="2" fill="none" stroke={P.white} strokeWidth="2" opacity="0.7" />
        ))}
        <path d="M48 154h60" stroke={P.white} strokeWidth="2.400" strokeLinecap="round" strokeDasharray="2 7" opacity="0.5" />
        {/* clock */}
        <circle cx="332" cy="62" r="20" fill={P.white} stroke={P.ink} strokeWidth="4" />
        <path d="M332 50v13l8 5" stroke={P.ink} strokeWidth="3" strokeLinecap="round" fill="none" />
        {/* shelf with books */}
        <rect x="346" y="196" width="40" height="48" rx="4" fill={P.white} />
        <rect x="352" y="204" width="8" height="32" rx="2" fill={P.ink} />
        <rect x="362" y="210" width="8" height="26" rx="2" fill={P.g4} />
        <rect x="372" y="206" width="8" height="30" rx="2" fill={P.g3} />
        {/* teacher */}
        <Person x={306} y={272} s={1.2} skin="#C8C8CD" hair="bun" hairColor="#2C2C2E" top="#8E8E93" bottom={P.dark} shirt={P.white} pose="tablet">
          <line x1="-60" y1="-172" x2="-112" y2="-150" stroke={P.ink} strokeWidth="3.500" strokeLinecap="round" />
          <Device x={26} y={-104} w={36} h={46} rot={-8} rx={6}>
            <rect x="-12" y="-16" width="22" height="4" rx="2" fill={P.ink} />
            <circle cx="-9" cy="-4" r="3" fill={P.g3} />
            <rect x="-2" y="-6" width="12" height="4" rx="2" fill={P.g2} />
            <circle cx="-9" cy="8" r="3" fill={P.g3} />
            <rect x="-2" y="6" width="12" height="4" rx="2" fill={P.g2} />
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
        <rect width="400" height="300" fill={P.g1} />
        <circle cx="200" cy="150" r="118" fill={P.white} />
        <rect y="248" width="400" height="52" fill={P.g2} />
        {/* sofa edge + lamp */}
        <rect x="-10" y="196" width="104" height="56" rx="18" fill={P.white} />
        <rect x="-10" y="186" width="30" height="66" rx="12" fill={P.g3} />
        <path d="M352 250V148" stroke={P.mid} strokeWidth="4" strokeLinecap="round" />
        <path d="M334 148l8-26h20l8 26z" fill={P.white} />
        <ellipse cx="352" cy="252" rx="16" ry="4" fill={P.g3} />
        <Cloud x={70} y={64} s={0.8} speed={13} dx={12} />
        <Cloud x={338} y={50} s={0.7} speed={10} dx={-10} delay={-3} />
        <Person x={200} y={274} s={1.25} skin="#9C9CA2" hair="long" hairColor={P.ink} top={P.ink} dress pose="phone">
          <Device x={5} y={-124} w={22} h={36} rot={-10} rx={5}>
            <rect x="-6" y="-12" width="12" height="4" rx="2" fill={P.g3} />
            <rect x="-6" y="-5" width="9" height="3" rx="1.500" fill={P.g2} />
            <rect x="-6" y="2" width="12" height="9" rx="3" fill={P.g1} />
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
        <rect width="400" height="440" fill={P.g1} />
        <circle cx="200" cy="230" r="168" fill={P.white} />
        <Cloud x={70} y={70} s={0.9} speed={13} dx={14} />
        <Cloud x={344} y={120} s={0.7} speed={10} dx={-10} delay={-4} />
        <School x={292} y={380} s={0.74} />
        <rect y="380" width="400" height="60" fill={P.g2} />
        <rect x="0" y="380" width="400" height="3" fill={P.g3} />
        <Tree x={36} y={380} s={1.1} />
        <Tree x={372} y={380} s={0.8} tone="b" sway={7} />
        <Person x={128} y={420} s={1.2} skin="#A4A4AA" hair="long" top={P.dark} dress pose="hold" />
        <Person x={236} y={420} s={0.8} skin="#CFCFD4" hair="curly" hairColor={P.ink} top={P.white} bottom={P.dark} pose="up" bag bob={3.2} />
        <Bubble x={150} y={46} w={118} label="Aarav is present" dot delay={-1} />
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
        <rect width="400" height="300" fill={P.g1} />
        <circle cx="200" cy="150" r="124" fill={P.white} />
        <Cloud x={62} y={64} s={0.9} speed={13} dx={14} />
        <Cloud x={338} y={88} s={0.7} speed={11} dx={-12} delay={-3} />
        <rect y="238" width="400" height="62" fill={P.g2} />
        <rect y="238" width="400" height="3" fill={P.g3} />
        <Tree x={28} y={238} s={1} />
        <Tree x={374} y={238} s={0.9} tone="b" sway={7} />
        <School x={200} y={238} s={1.02} flagColor={P.accent} />
        <Person x={96} y={284} s={0.46} skin="#CFCFD4" hair="short" top={P.white} pose="stand" bag bob={3} />
        <Person x={128} y={290} s={0.52} skin="#A4A4AA" hair="curly" top={P.dark} pose="stand" bag bob={3.6} />
        <Person x={300} y={288} s={0.5} skin="#B4B4BA" hair="bun" top="#8E8E93" dress pose="wave" bob={4} />
      </SceneSvg>
    </ImageFrame>
  );
}
