import * as React from "react";

type SiteIconProps = React.SVGProps<SVGSVGElement> & { strokeWidth?: number };
export type LucideIcon = React.ComponentType<SiteIconProps>;

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  vectorEffect: "non-scaling-stroke" as const,
};

function makeIcon(name: string, body: React.ReactNode, extra?: (props: SiteIconProps) => React.ReactNode) {
  const Icon = React.forwardRef<SVGSVGElement, SiteIconProps>(function SiteIcon({ className, strokeWidth = 1.55, ...props }, ref) {
    return (
      <svg
        ref={ref}
        aria-hidden={props["aria-label"] ? undefined : true}
        viewBox="0 0 24 24"
        className={className}
        strokeWidth={strokeWidth}
        {...base}
        {...props}
      >
        {extra ? extra({ className, strokeWidth, ...props }) : body}
      </svg>
    );
  });
  Icon.displayName = name;
  return Icon;
}

const ChevronDown = makeIcon("ChevronDown", <path d="M5.5 8.5 12 15l6.5-6.5" />);
const ChevronUp = makeIcon("ChevronUp", <path d="m5.5 15.5 6.5-6.5 6.5 6.5" />);
const ChevronLeft = makeIcon("ChevronLeft", <path d="m14.5 5.5-6.5 6.5 6.5 6.5" />);
const ChevronRight = makeIcon("ChevronRight", <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />);

const ArrowRight = makeIcon("ArrowRight", <>
  <path d="M4 12h15" />
  <path d="m13 6 6 6-6 6" />
  <path d="M19 12h1.2" opacity=".45" />
</>);
const ArrowLeft = makeIcon("ArrowLeft", <>
  <path d="M20 12H5" />
  <path d="m11 6-6 6 6 6" />
  <path d="M5 12H3.8" opacity=".45" />
</>);
const ArrowUp = makeIcon("ArrowUp", <>
  <path d="M12 20V5" />
  <path d="m6 11 6-6 6 6" />
</>);
const ArrowDown = makeIcon("ArrowDown", <>
  <path d="M12 4v15" />
  <path d="m6 13 6 6 6-6" />
</>);
const ArrowUpRight = makeIcon("ArrowUpRight", <>
  <path d="M5 19 19 5" />
  <path d="M9 5h10v10" />
  <path d="M19 5 21 3" opacity=".45" />
</>);

const Search = makeIcon("Search", <>
  <circle cx="10.5" cy="10.5" r="5.5" />
  <path d="m15 15 5 5" />
  <path d="M6 4.8 4.8 6" opacity=".5" />
</>);
const X = makeIcon("X", <>
  <path d="M6 6 18 18" />
  <path d="M18 6 6 18" />
  <path d="M4.5 4.5 6 6M19.5 19.5 18 18" opacity=".35" />
</>);
const Info = makeIcon("Info", <>
  <circle cx="12" cy="12" r="8.25" />
  <path d="M12 10.7v5.1" />
  <path d="M12 7.9h.01" strokeWidth={2.1} />
</>);

const ListOrdered = makeIcon("ListOrdered", <>
  <path d="M8.5 6h11" />
  <path d="M8.5 12h11" />
  <path d="M8.5 18h11" />
  <path d="M4.2 5.1v2.3" />
  <path d="M3.2 5.2 4.2 4.3l1 .9" />
  <path d="M3.2 10.8c.5-.5 1.2-.8 1.8-.2.5.5.2 1.2-.2 1.6l-1.7 1.7h2.1" />
  <path d="M3.3 17.3c.3-.5.8-.8 1.4-.8.8 0 1.4.5 1.4 1.2s-.7 1.3-1.5 1.3H3.3" />
</>);


const ArrowUpDown = makeIcon("ArrowUpDown", <><path d="M7 4v16" /><path d="m4 7 3-3 3 3" /><path d="M17 20V4" /><path d="m14 17 3 3 3-3" /></>);
const Filter = makeIcon("Filter", <><path d="M4 5h16l-6.2 7.1v5l-3.6 1.9v-6.9L4 5Z" /><path d="M8 8h8" opacity=".35" /></>);
const Pause = makeIcon("Pause", <><path d="M8 6v12M16 6v12" /></>);
const Play = makeIcon("Play", <path d="m9 6 8 6-8 6V6Z" />);
const Trophy = makeIcon("Trophy", <><path d="M7 5h10v4.5c0 3-2 5.2-5 5.2S7 12.5 7 9.5V5Z" /><path d="M7 7H4.5v1.5c0 2.4 1.6 3.8 3.5 3.9M17 7h2.5v1.5c0 2.4-1.6 3.8-3.5 3.9" /><path d="M12 14.7V19M8.5 20h7" /></>);
const Zap = makeIcon("Zap", <><path d="m13.5 3-7 9h5l-1 9 7-10h-5l1-8Z" /></>);

const Layers = makeIcon("Layers", <>
  <path d="m12 4 8 4-8 4-8-4 8-4Z" />
  <path d="m4 12 8 4 8-4" />
  <path d="m4 16 8 4 8-4" />
  <path d="M12 7.5 15.6 9.3" opacity=".35" />
</>);


const Archive = makeIcon("Archive", <>
  <path d="M4 7.5h16v12H4z" />
  <path d="M6 7.5 7 4h10l1 3.5" />
  <path d="M8.5 12h7" />
  <path d="M9.5 15.5h5" opacity=".45" />
</>);

const ClassMark = makeIcon("ClassMark", <>
  <path d="M5 5.5h8.5" />
  <path d="M5 9.5h11" />
  <path d="M5 13.5h11" />
  <path d="M5 17.5h8.5" />
  <path d="M17 6.5v11" />
  <path d="m17 6.5 2 1.6-2 1.6" />
  <path d="m17 14.3 2-1.6" opacity=".45" />
</>);

const BarChart3 = makeIcon("BarChart3", <>
  <path d="M5 19V11" />
  <path d="M10 19V7" />
  <path d="M15 19V13" />
  <path d="M20 19V5" />
  <path d="M3.5 19.5h18" opacity=".4" />
</>);
const BarChart2 = BarChart3;

const ClipboardList = makeIcon("ClipboardList", <>
  <rect x="6" y="4.5" width="12" height="16" rx="1.25" />
  <path d="M9 4.5V3h6v1.5" />
  <path d="M9 9h6" />
  <path d="M9 13h6" />
  <path d="M9 17h4" />
  <path d="M7.7 9h.01M7.7 13h.01M7.7 17h.01" strokeWidth={2.1} />
</>);

const Link2 = makeIcon("Link2", <>
  <path d="M9.5 14.5 7.8 16.2a3.25 3.25 0 1 1-4.6-4.6l2.3-2.3a3.25 3.25 0 0 1 4.6 0" />
  <path d="m14.5 9.5 1.7-1.7a3.25 3.25 0 1 1 4.6 4.6l-2.3 2.3a3.25 3.25 0 0 1-4.6 0" />
  <path d="m8.5 15.5 7-7" />
</>);

const GitCompareArrows = makeIcon("GitCompareArrows", <>
  <path d="M7 4v11" />
  <path d="m4 7 3-3 3 3" />
  <path d="M17 20V9" />
  <path d="m14 17 3 3 3-3" />
  <path d="M7 15c0 2.8 3 4.2 6 4.2" />
  <path d="M17 9c0-2.8-3-4.2-6-4.2" />
</>);

const BookOpen = makeIcon("BookOpen", <>
  <path d="M4.5 5.2c2.6-.9 5.1-.5 7.5 1.2v12c-2.4-1.7-4.9-2.1-7.5-1.2V5.2Z" />
  <path d="M19.5 5.2c-2.6-.9-5.1-.5-7.5 1.2v12c2.4-1.7 4.9-2.1 7.5-1.2V5.2Z" />
  <path d="M12 6.4v12" opacity=".55" />
</>);

const Bookmark = makeIcon("Bookmark", <>
  <path d="M7 4.5h10v15l-5-3.3-5 3.3v-15Z" />
  <path d="M9 7h6" opacity=".35" />
</>);

const Target = makeIcon("Target", <>
  <circle cx="12" cy="12" r="8.2" />
  <circle cx="12" cy="12" r="4.2" />
  <circle cx="12" cy="12" r="1.2" />
  <path d="M12 1.8v2.1M12 20.1v2.1M1.8 12h2.1M20.1 12h2.1" opacity=".42" />
</>);

const Database = makeIcon("Database", <>
  <ellipse cx="12" cy="6" rx="7.5" ry="3" />
  <path d="M4.5 6v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6" />
  <path d="M4.5 12v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6" />
  <path d="M6.8 8.3c1.4.5 3.2.8 5.2.8s3.8-.3 5.2-.8" opacity=".4" />
</>);

const History = makeIcon("History", <>
  <path d="M4.7 9A7.8 7.8 0 1 1 6 17.8" />
  <path d="M4.7 4.8V9h4.1" />
  <path d="M12 8v4.3l2.8 2" />
</>);

const Home = makeIcon("Home", <>
  <path d="m4.5 10.5 7.5-6 7.5 6v8.4a1.1 1.1 0 0 1-1.1 1.1H5.6a1.1 1.1 0 0 1-1.1-1.1v-8.4Z" />
  <path d="M9.2 20v-5.1h5.6V20" />
  <path d="M7 9.2h1.7M15.3 9.2H17" opacity=".35" />
</>);

const Users = makeIcon("Users", <>
  <circle cx="8.7" cy="9" r="2.6" />
  <path d="M3.8 18c.4-3.1 2.1-4.7 4.9-4.7s4.5 1.6 4.9 4.7" />
  <circle cx="16.8" cy="9.5" r="2.2" />
  <path d="M14.6 14c2.3-.2 4.1 1.1 4.7 3.8" />
</>);
const User = makeIcon("User", <>
  <circle cx="12" cy="8" r="3.1" />
  <path d="M5.8 19c.4-3.7 2.5-5.7 6.2-5.7s5.8 2 6.2 5.7" />
</>);
const UserPlus = makeIcon("UserPlus", <>
  <circle cx="9" cy="8" r="3" />
  <path d="M3.8 19c.4-3.5 2.2-5.3 5.2-5.3s4.8 1.8 5.2 5.3" />
  <path d="M18 8v6" />
  <path d="M15 11h6" />
</>);
const UserX = makeIcon("UserX", <>
  <circle cx="8.8" cy="8" r="3" />
  <path d="M3.6 19c.4-3.5 2.2-5.3 5.2-5.3s4.8 1.8 5.2 5.3" />
  <path d="m16 8 5 5M21 8l-5 5" />
</>);

const ShieldCheck = makeIcon("ShieldCheck", <>
  <path d="M12 3.5 19 6v5.8c0 4.2-2.5 7.1-7 8.7-4.5-1.6-7-4.5-7-8.7V6l7-2.5Z" />
  <path d="m8.6 12 2.2 2.2 4.8-4.8" />
</>);
const CheckCircle2 = makeIcon("CheckCircle2", <><circle cx="12" cy="12" r="8.4" /><path d="m8.4 12.2 2.2 2.2 5-5" /></>);
const XCircle = makeIcon("XCircle", <><circle cx="12" cy="12" r="8.4" /><path d="m9 9 6 6M15 9l-6 6" /></>);
const Check = makeIcon("Check", <path d="m5 12.5 4 4 10-10" />);

const Clock3 = makeIcon("Clock3", <>
  <circle cx="12" cy="12" r="8.5" />
  <path d="M12 7v5l3.2 2" />
  <path d="M12 1.8v1.4M22.2 12h-1.4M12 20.8v1.4M1.8 12h1.4" opacity=".35" />
</>);

const Sparkles = makeIcon("Sparkles", <>
  <path d="M12 3.5 13.3 8l4.2 1.3-4.2 1.3L12 15l-1.3-4.4-4.2-1.3L10.7 8 12 3.5Z" />
  <path d="m18.2 15.3.8 2.5 2.5.8-2.5.8-.8 2.5-.8-2.5-2.5-.8 2.5-.8.8-2.5Z" opacity=".75" />
</>);

const Compass = makeIcon("Compass", <>
  <circle cx="12" cy="12" r="8.4" />
  <path d="m15.8 8.2-2.1 4.7-4.7 2.1 2.1-4.7 4.7-2.1Z" />
  <path d="M12 2.3v1.4M21.7 12h-1.4M12 20.3v1.4M3.7 12H2.3" opacity=".35" />
</>);

const CornerDownLeft = makeIcon("CornerDownLeft", <><path d="M19 5v7a4 4 0 0 1-4 4H5" /><path d="m8 13-3 3 3 3" /></>);
const Inbox = makeIcon("Inbox", <><path d="M4 6.5h16v11H4z" /><path d="M4 13h4l1.5 2h5L16 13h4" /><path d="M8 9.5h8" opacity=".4" /></>);
const KeyRound = makeIcon("KeyRound", <><circle cx="8.4" cy="15.6" r="3.1" /><path d="m10.8 13.2 7.7-7.7" /><path d="m15.3 8.7 2 2" /><path d="m17.3 6.7 2 2" /></>);
const LogIn = makeIcon("LogIn", <><path d="M4 4.5h8v15H4" /><path d="M11 12h9" /><path d="m16.5 8.5 3.5 3.5-3.5 3.5" /></>);
const LogOut = makeIcon("LogOut", <><path d="M20 12H7" /><path d="m16 8 4 4-4 4" /><path d="M4 4.5v15h7" /></>);
const Mail = makeIcon("Mail", <><rect x="4" y="5.5" width="16" height="13" rx="1" /><path d="m5 7 7 6 7-6" /></>);
const LayoutGrid = makeIcon("LayoutGrid", <><rect x="4" y="4" width="6" height="6" /><rect x="14" y="4" width="6" height="6" /><rect x="4" y="14" width="6" height="6" /><rect x="14" y="14" width="6" height="6" /></>);
const RotateCcw = makeIcon("RotateCcw", <><path d="M5 9V5H9" /><path d="M5.3 9a7.4 7.4 0 1 1 1.8 7.8" /></>);
const Share2 = makeIcon("Share2", <><circle cx="6" cy="12" r="2" /><circle cx="18" cy="6" r="2" /><circle cx="18" cy="18" r="2" /><path d="m7.8 11 8.4-4M7.8 13l8.4 4" /></>);
const Copy = makeIcon("Copy", <><rect x="8" y="8" width="10" height="10" rx="1" /><path d="M6 16H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" /></>);
const Shuffle = makeIcon("Shuffle", <><path d="M4 7h3c4 0 6 10 10 10h3" /><path d="m17 14 3 3-3 3" /><path d="M4 17h3c1.1 0 2-.4 2.8-1.1M14.2 8.1C15 7.4 16 7 17 7h3" /><path d="m17 4 3 3-3 3" /></>);
const TrendingUp = makeIcon("TrendingUp", <><path d="M4 16 9 11l3.3 3.3L20 6.5" /><path d="M15 6.5h5v5" /></>);
const TrendingDown = makeIcon("TrendingDown", <><path d="M4 8 9 13l3.3-3.3L20 17.5" /><path d="M15 17.5h5v-5" /></>);
const Trash2 = makeIcon("Trash2", <><path d="M5 7h14" /><path d="M9 4h6l1 3H8l1-3Z" /><path d="M7 7l.7 13h8.6L17 7" /><path d="M10 10v7M14 10v7" opacity=".5" /></>);
const AlertTriangle = makeIcon("AlertTriangle", <><path d="m12 4 8 15H4L12 4Z" /><path d="M12 9v4" /><path d="M12 16h.01" strokeWidth={2.1} /></>);
const Menu = makeIcon("Menu", <><path d="M4 7h16M4 12h16M4 17h16" /></>);
const Loader2 = makeIcon("Loader2", <circle cx="12" cy="12" r="8" strokeDasharray="18 32" />);
const Shield = ShieldCheck;

export {
  AlertTriangle, Archive, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight,
  BarChart2, BarChart3, BookOpen, Bookmark, Check, CheckCircle2, ChevronDown,
  ChevronLeft, ChevronRight, ChevronUp, ClipboardList, Clock3, Compass, Copy,
  CornerDownLeft, Database, GitCompareArrows, History, Home, Inbox, Info, KeyRound,
  Layers, LayoutGrid, Link2, ListOrdered, Loader2, LogIn, LogOut, Mail, Menu,
  RotateCcw, Search, Share2, ShieldCheck, Shuffle, Sparkles, Target, Trash2,
  TrendingDown, TrendingUp, User, UserPlus, UserX, Users, X, XCircle, Shield, ClassMark, ArrowUpDown, Filter, Pause, Play, Trophy, Zap,
};
