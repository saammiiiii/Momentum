import React, { useEffect, useId, useRef } from "react";
import {
  Activity,
  ArrowDown,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ArrowUp,
  Award,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  Coffee,
  Dumbbell,
  Flame,
  Heart,
  History,
  Home,
  Leaf,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Trophy,
  Utensils,
  Weight,
  X,
  Zap,
  Pill,
  GlassWater,
  Download,
  Upload,
  Pencil,
  Play,
  Pause,
  RotateCcw,
  GripVertical,
  CheckCircle2,
  WifiOff,
  BarChart3,
  Timer,
  Circle,
  Scale,
  Footprints,
  Info,
  Monitor,
  Sun,
  Moon,
  Save,
  RefreshCw,
  Minus,
  Maximize2,
  List,
  Layers3,
  Repeat2,
  ChartLine,
  CalendarCheck,
  MessageSquare,
  LogOut,
} from "lucide-react";
const icons = {
  activity: Activity,
  "arrow-down": ArrowDown,
  download: Download,
  upload: Upload,
  "arrow-left": ArrowLeft,
  "arrow-right": ArrowRight,
  "arrow-up-right": ArrowUpRight,
  "arrow-up": ArrowUp,
  award: Award,
  bell: Bell,
  book: BookOpen,
  "book-open": BookOpen,
  calendar: CalendarDays,
  "calendar-days": CalendarDays,
  check: Check,
  "chevron-down": ChevronDown,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  help: CircleHelp,
  clock: Clock3,
  coffee: Coffee,
  dumbbell: Dumbbell,
  flame: Flame,
  heart: Heart,
  history: History,
  home: Home,
  leaf: Leaf,
  menu: Menu,
  more: MoreHorizontal,
  plus: Plus,
  search: Search,
  settings: Settings,
  shield: ShieldCheck,
  sliders: SlidersHorizontal,
  sparkles: Sparkles,
  target: Target,
  trash: Trash2,
  "trash-2": Trash2,
  "trending-up": TrendingUp,
  trophy: Trophy,
  utensils: Utensils,
  weight: Weight,
  x: X,
  zap: Zap,
  pill: Pill,
  glass: GlassWater,
  pencil: Pencil,
  play: Play,
  pause: Pause,
  reset: RotateCcw,
  grip: GripVertical,
  "check-circle": CheckCircle2,
  "wifi-off": WifiOff,
  chart: BarChart3,
  "bar-chart": BarChart3,
  timer: Timer,
  circle: Circle,
  scale: Scale,
  footprints: Footprints,
  info: Info,
  monitor: Monitor,
  sun: Sun,
  moon: Moon,
  save: Save,
  refresh: RefreshCw,
  minus: Minus,
  maximize: Maximize2,
  list: List,
  layers: Layers3,
  repeat: Repeat2,
  "chart-line": ChartLine,
  "calendar-check": CalendarCheck,
  "message-square": MessageSquare,
  "bar-chart-3": BarChart3,
  logout: LogOut,
};
export function Icon({ name = "activity", size = 20, ...props }) {
  const Component = icons[name] || Activity;
  return (
    <Component size={size} strokeWidth={1.7} aria-hidden="true" {...props} />
  );
}
export function Brand({ compact = false }) {
  return (
    <div className="brand">
      <svg viewBox="0 0 32 32" width="31" height="31" aria-hidden="true">
        <path
          d="M3 25V10l7-4 6 12 6-12 7 4v15h-6V15l-7 13-7-13v10z"
          fill="currentColor"
        />
      </svg>
      {!compact && (
        <span>
          momentum<span className="brand-dot">.</span>
        </span>
      )}
    </div>
  );
}
export function PageHeader({ eyebrow, title, description, children }) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children && <div className="heading-actions">{children}</div>}
    </div>
  );
}
export function Card({ children, className = "", ...props }) {
  return (
    <section className={`card ${className}`} {...props}>
      {children}
    </section>
  );
}
export function Button({
  children,
  variant = "primary",
  className = "",
  type = "button",
  ...props
}) {
  return (
    <button
      type={type}
      className={`btn btn-${variant} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
export function Field({ label, children, hint }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {React.isValidElement(children)
        ? React.cloneElement(children, { id: children.props.id || id })
        : children}
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}
export function Empty({ icon = "activity", title, description, action }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name={icon} size={25} />
      </span>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}
export function Badge({ children, tone = "accent" }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
export function ProgressBar({ value, max = 100 }) {
  const percent = Math.min(100, Math.max(0, max ? (value / max) * 100 : 0));
  return (
    <div
      className="progress-bar"
      role="progressbar"
      aria-label="Progression"
      aria-valuenow={Math.round(percent)}
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <span style={{ width: `${percent}%` }} />
    </div>
  );
}
export function StatCard({ label, value, unit, change, icon = "activity" }) {
  return (
    <Card className="stat-card">
      <div className="row between">
        <span className="stat-label">{label}</span>
        <Icon name={icon} size={18} />
      </div>
      <div className="stat-value">
        {value}
        {unit && <span>{unit}</span>}
      </div>
      {change && <div className="stat-foot">{change}</div>}
    </Card>
  );
}
export function Modal({ title, children, onClose, wide = false }) {
  const ref = useRef();
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const el = ref.current;
    (
      el?.querySelector("[autofocus]") ||
      el?.querySelector("input,select,textarea") ||
      el?.querySelector("button")
    )?.focus();
    function key(e) {
      if (e.key === "Escape") closeRef.current();
      if (e.key === "Tab") {
        const items = [
          ...el.querySelectorAll(
            'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]',
          ),
        ].filter((x) => x.offsetParent !== null);
        if (!items.length) return;
        if (e.shiftKey && document.activeElement === items[0]) {
          e.preventDefault();
          items.at(-1).focus();
        } else if (!e.shiftKey && document.activeElement === items.at(-1)) {
          e.preventDefault();
          items[0].focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={`modal ${wide ? "modal-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="row between modal-heading">
          <h2 id={titleId}>{title}</h2>
          <Button variant="ghost" aria-label="Fermer" onClick={onClose}>
            <Icon name="x" />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function LineChart({
  data = [],
  height = 210,
  unit = "",
  secondaryLabel,
}) {
  const id = useId().replace(/:/g, "");
  const [hover, setHover] = React.useState(null);
  const clean = data.filter((d) => Number.isFinite(d.value));
  if (!clean.length)
    return (
      <div className="chart-empty" style={{ height }}>
        <div className="chart-empty-grid" />
        <span>
          <Icon name="trending-up" size={26} />
          <strong>Votre progression commence ici</strong>
          <small>Vos premières données dessineront la courbe.</small>
        </span>
      </div>
    );
  const all = clean.flatMap((d) => [
    d.value,
    ...(Number.isFinite(d.secondary) ? [d.secondary] : []),
  ]);
  const min = Math.max(
    0,
    Math.min(...all) - (Math.max(...all) - Math.min(...all) || 10) * 0.18,
  );
  const max =
    Math.max(...all) + (Math.max(...all) - Math.min(...all) || 10) * 0.18;
  const w = 720,
    h = height,
    p = { t: 18, b: 34, l: 46, r: 18 };
  const x = (i) => p.l + (i * (w - p.l - p.r)) / Math.max(1, clean.length - 1);
  const y = (v) => p.t + ((max - v) / (max - min || 1)) * (h - p.t - p.b);
  const pts = clean.map((d, i) => `${x(i)},${y(d.value)}`).join(" ");
  const sec = clean
    .map((d, i) =>
      Number.isFinite(d.secondary) ? `${x(i)},${y(d.secondary)}` : null,
    )
    .filter(Boolean)
    .join(" ");
  const active = hover !== null ? clean[hover] : null;
  return (
    <div className="chart-container">
      {active && (
        <div className="chart-tooltip">
          {active.label} ·{" "}
          <strong>
            {active.value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}{" "}
            {unit}
          </strong>
          {Number.isFinite(active.secondary) && (
            <span>
              {" "}
              · moyenne{" "}
              {active.secondary.toLocaleString("fr-FR", {
                maximumFractionDigits: 1,
              })}{" "}
              {unit}
            </span>
          )}
        </div>
      )}
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="line-chart"
        role="img"
        aria-label={`Évolution : ${clean.map((d) => `${d.label}, ${d.value} ${unit}`).join(" ; ")}`}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`fill${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="var(--accent)" stopOpacity=".18" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((i) => {
          const val = min + ((max - min) * i) / 3;
          return (
            <g key={i}>
              <line
                x1={p.l}
                x2={w - p.r}
                y1={y(val)}
                y2={y(val)}
                className="chart-grid"
              />
              <text x={p.l - 10} y={y(val) + 4} textAnchor="end">
                {val.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}
              </text>
            </g>
          );
        })}
        <polygon
          points={`${x(0)},${h - p.b} ${pts} ${x(clean.length - 1)},${h - p.b}`}
          fill={`url(#fill${id})`}
        />
        {sec && (
          <polyline
            points={sec}
            fill="none"
            stroke="var(--muted)"
            strokeWidth="2"
            strokeDasharray="5 5"
          />
        )}
        <polyline
          points={pts}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {clean.map((d, i) => (
          <g key={i}>
            <circle
              cx={x(i)}
              cy={y(d.value)}
              r={clean.length < 20 ? 3.5 : 2}
              fill="var(--accent)"
            />
            <rect
              x={x(i) - Math.max(8, (w - p.l - p.r) / clean.length / 2)}
              y={p.t}
              width={Math.max(16, (w - p.l - p.r) / clean.length)}
              height={h - p.t - p.b}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
            {(i === 0 ||
              i === clean.length - 1 ||
              (clean.length > 5 && i === Math.floor(clean.length / 2))) && (
              <text
                x={x(i)}
                y={h - 7}
                textAnchor={
                  i === 0 ? "start" : i === clean.length - 1 ? "end" : "middle"
                }
              >
                {d.label}
              </text>
            )}
          </g>
        ))}
      </svg>
      {secondaryLabel && (
        <div className="chart-legend">
          <span>
            <i />
            Mesures
          </span>
          <span>
            <i className="secondary" />
            {secondaryLabel}
          </span>
        </div>
      )}
    </div>
  );
}
