import { jsxs, jsx } from 'react/jsx-runtime';

// src/cn.ts
function cn(...inputs) {
  const out = [];
  const push = (v) => {
    if (!v) return;
    if (typeof v === "string" || typeof v === "number") {
      out.push(String(v));
    } else if (Array.isArray(v)) {
      v.forEach(push);
    } else if (typeof v === "object") {
      for (const key in v) if (v[key]) out.push(key);
    }
  };
  inputs.forEach(push);
  return out.join(" ");
}
var VARIANTS = {
  primary: "bg-brand-600 hover:bg-brand-700 text-white shadow-soft",
  secondary: "bg-white border border-brand-200 text-brand-600 hover:bg-brand-50",
  ghost: "bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-700",
  danger: "bg-red-600 hover:bg-red-700 text-white"
};
var SIZES = {
  sm: "text-xs px-3 py-1.5 gap-1.5 rounded-md",
  md: "text-sm px-4 py-2.5 gap-2 rounded-lg",
  lg: "text-base px-5 py-3 gap-2 rounded-xl"
};
function Button({ variant = "primary", size = "md", icon, className, children, ...rest }) {
  return /* @__PURE__ */ jsxs(
    "button",
    {
      className: cn(
        "inline-flex items-center justify-center font-semibold transition disabled:opacity-50 disabled:pointer-events-none",
        VARIANTS[variant],
        SIZES[size],
        className
      ),
      ...rest,
      children: [
        icon,
        children
      ]
    }
  );
}
var TONES = {
  brand: "bg-brand-100 text-brand-700",
  slate: "bg-slate-100 text-slate-600",
  green: "bg-green-100 text-green-700",
  amber: "bg-amber-100 text-amber-700",
  red: "bg-red-100 text-red-700",
  indigo: "bg-indigo-100 text-indigo-700",
  emerald: "bg-emerald-100 text-emerald-700"
};
function Badge({ tone = "slate", children, className }) {
  return /* @__PURE__ */ jsx("span", { className: cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold", TONES[tone], className), children });
}
function Card({ children, className, onClick }) {
  return /* @__PURE__ */ jsx(
    "div",
    {
      onClick,
      className: cn(
        "bg-white border border-surface-border rounded-lg",
        onClick && "cursor-pointer hover:shadow-card transition",
        className
      ),
      children
    }
  );
}
function KpiCard({ label, value, hint, icon, className }) {
  return /* @__PURE__ */ jsxs("div", { className: cn("bg-white border border-surface-border rounded-lg p-[18px]", className), children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
      /* @__PURE__ */ jsx("span", { className: "text-xs font-semibold text-slate-500", children: label }),
      icon && /* @__PURE__ */ jsx("span", { className: "text-brand-600", children: icon })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "mt-1 text-2xl font-bold text-slate-800", children: value }),
    hint && /* @__PURE__ */ jsx("div", { className: "mt-1 text-xs text-slate-400", children: hint })
  ] });
}
function Input({ label, icon, className, ...rest }) {
  return /* @__PURE__ */ jsxs("label", { className: "block space-y-1", children: [
    label && /* @__PURE__ */ jsx("span", { className: "text-xs font-semibold text-slate-600", children: label }),
    /* @__PURE__ */ jsxs("span", { className: "relative block", children: [
      icon && /* @__PURE__ */ jsx("span", { className: "absolute top-1/2 -translate-y-1/2 right-3 w-4 h-4 text-slate-400 pointer-events-none", children: icon }),
      /* @__PURE__ */ jsx(
        "input",
        {
          className: cn(
            "w-full px-3 py-2.5 text-sm rounded-lg border border-surface-border bg-surface-muted placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition",
            icon && "pr-9",
            className
          ),
          ...rest
        }
      )
    ] })
  ] });
}
function Select({ label, className, children, ...rest }) {
  return /* @__PURE__ */ jsxs("label", { className: "block space-y-1", children: [
    label && /* @__PURE__ */ jsx("span", { className: "text-xs font-semibold text-slate-600", children: label }),
    /* @__PURE__ */ jsx(
      "select",
      {
        className: cn(
          "w-full px-3 py-2.5 text-sm rounded-lg border border-surface-border bg-surface-muted focus:outline-none focus:ring-2 focus:ring-brand-500 transition",
          className
        ),
        ...rest,
        children
      }
    )
  ] });
}
var TONES2 = {
  brand: "bg-brand-100 text-brand-700",
  amber: "bg-amber-400/20 text-amber-300",
  slate: "bg-slate-200 text-slate-600"
};
function Avatar({ name, tone = "brand", size = 36, className }) {
  return /* @__PURE__ */ jsx(
    "span",
    {
      className: cn("inline-flex items-center justify-center rounded-full font-bold flex-shrink-0", TONES2[tone], className),
      style: { width: size, height: size, fontSize: Math.round(size * 0.4) },
      children: (name?.[0] ?? "?").toUpperCase()
    }
  );
}
function Modal({ open, onClose, title, subtitle, width = 460, children }) {
  if (!open) return null;
  return /* @__PURE__ */ jsx(
    "div",
    {
      className: "fixed inset-0 z-50 flex items-center justify-center p-4 re-fade-in",
      style: { background: "rgba(15,31,61,.45)" },
      onClick: onClose,
      dir: "rtl",
      children: /* @__PURE__ */ jsxs(
        "div",
        {
          className: "bg-white rounded-2xl shadow-2xl w-full overflow-hidden",
          style: { maxWidth: width },
          onClick: (e) => e.stopPropagation(),
          children: [
            (title || subtitle) && /* @__PURE__ */ jsxs("div", { className: "px-5 pt-5 pb-3 border-b border-surface-border", children: [
              title && /* @__PURE__ */ jsx("h3", { className: "text-base font-bold text-slate-800", children: title }),
              subtitle && /* @__PURE__ */ jsx("p", { className: "text-xs text-slate-500 mt-0.5", children: subtitle })
            ] }),
            /* @__PURE__ */ jsx("div", { className: "p-5", children })
          ]
        }
      )
    }
  );
}
function Sidebar({
  brandLabel = "Real Estate Lead",
  brandSubLabel,
  logo,
  logoText = "RE",
  user,
  highlightUser,
  items,
  activeKey,
  onSelect,
  footer,
  className
}) {
  return /* @__PURE__ */ jsxs("aside", { dir: "rtl", className: cn("w-[220px] flex-shrink-0 flex flex-col h-screen bg-navy text-white", className), children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2.5 px-4 pt-5 pb-4 border-b border-white/10", children: [
      logo ?? /* @__PURE__ */ jsx("div", { className: "w-8 h-8 rounded-md bg-brand-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0", children: logoText }),
      /* @__PURE__ */ jsxs("div", { className: "leading-tight min-w-0", children: [
        /* @__PURE__ */ jsx("div", { className: "text-white font-bold text-[15px]", children: brandLabel }),
        brandSubLabel && /* @__PURE__ */ jsx("div", { className: "text-brand-400 text-[11px] mt-0.5", children: brandSubLabel })
      ] })
    ] }),
    user && /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2.5 px-4 py-3 border-b border-white/10", children: [
      /* @__PURE__ */ jsx(Avatar, { name: user.name, tone: highlightUser ? "amber" : "brand", size: 36 }),
      /* @__PURE__ */ jsxs("div", { className: "overflow-hidden", children: [
        /* @__PURE__ */ jsx("div", { className: "text-white text-[13px] font-semibold truncate", children: user.name ?? "\u05DE\u05E9\u05EA\u05DE\u05E9" }),
        user.role && /* @__PURE__ */ jsx("div", { className: cn("text-[11px]", highlightUser ? "text-amber-300" : "text-brand-400"), children: user.role })
      ] })
    ] }),
    /* @__PURE__ */ jsx("nav", { className: "flex-1 px-2 py-2.5 flex flex-col gap-0.5 overflow-y-auto", children: items.map((it) => {
      const active = it.key === activeKey;
      return /* @__PURE__ */ jsxs(
        "button",
        {
          onClick: () => onSelect(it.key),
          className: cn(
            "flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium transition-colors text-right",
            active ? "bg-brand-600 text-white" : it.locked ? "text-slate-500 hover:bg-white/5 hover:text-slate-300" : "text-slate-400 hover:bg-white/10 hover:text-white"
          ),
          children: [
            it.icon,
            /* @__PURE__ */ jsx("span", { className: cn(it.locked && "opacity-90"), children: it.label }),
            it.trailing && /* @__PURE__ */ jsx("span", { className: "mr-auto flex items-center", children: it.trailing })
          ]
        },
        it.key
      );
    }) }),
    footer && /* @__PURE__ */ jsx("div", { className: "px-2 pb-4 pt-2 border-t border-white/10 flex flex-col gap-0.5", children: footer })
  ] });
}
function Spinner({ size = 32, className }) {
  return /* @__PURE__ */ jsx(
    "span",
    {
      role: "status",
      "aria-label": "\u05D8\u05D5\u05E2\u05DF",
      className: cn("inline-block rounded-full border-4 border-brand-200 border-t-brand-600 animate-spin", className),
      style: { width: size, height: size }
    }
  );
}
var TONES3 = {
  default: "text-slate-300 hover:text-slate-600 hover:bg-slate-100",
  brand: "text-slate-300 hover:text-brand-600 hover:bg-brand-50",
  danger: "text-slate-300 hover:text-red-600 hover:bg-red-50"
};
function IconButton({ icon, tone = "default", className, ...rest }) {
  return /* @__PURE__ */ jsx(
    "button",
    {
      className: cn("inline-flex items-center justify-center w-8 h-8 rounded-lg transition", TONES3[tone], className),
      ...rest,
      children: icon
    }
  );
}
function EmptyState({ icon, title, description, action }) {
  return /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center justify-center gap-3 py-16 text-center text-slate-400", children: [
    icon && /* @__PURE__ */ jsx("div", { className: "w-16 h-16 rounded-full bg-surface-subtle flex items-center justify-center text-slate-300", children: icon }),
    /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsx("p", { className: "text-base font-semibold text-slate-500", children: title }),
      description && /* @__PURE__ */ jsx("p", { className: "text-sm mt-1 text-slate-400", children: description })
    ] }),
    action
  ] });
}
var TONES4 = {
  default: "bg-slate-900 text-white",
  success: "bg-emerald-600 text-white",
  error: "bg-red-600 text-white"
};
function Toast({ children, tone = "default", className }) {
  return /* @__PURE__ */ jsx(
    "div",
    {
      role: "status",
      className: cn(
        "fixed bottom-5 left-1/2 -translate-x-1/2 z-50 text-xs font-medium px-4 py-2.5 rounded-lg re-fade-in",
        TONES4[tone],
        className
      ),
      children
    }
  );
}
function Stat({ label, value, className }) {
  return /* @__PURE__ */ jsxs("div", { className: cn("bg-surface-muted rounded-md px-2 py-1.5 text-center", className), children: [
    /* @__PURE__ */ jsx("p", { className: "text-xs text-slate-400", children: label }),
    /* @__PURE__ */ jsx("p", { className: "text-sm font-bold text-slate-800", children: value })
  ] });
}
function SectionHeader({ title, subtitle, actions }) {
  return /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-4", children: [
    /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsx("h1", { className: "text-xl font-bold text-slate-900", children: title }),
      subtitle && /* @__PURE__ */ jsx("p", { className: "text-sm mt-0.5 text-slate-500", children: subtitle })
    ] }),
    actions && /* @__PURE__ */ jsx("div", { className: "flex items-center gap-2", children: actions })
  ] });
}
var fmt = (n) => n.toLocaleString("he-IL");
function ListingCard({
  title,
  subtitle,
  address,
  price,
  rooms,
  floor,
  totalFloors,
  sizeSqm,
  source,
  listedBy,
  sourceUrl,
  linkIcon,
  onClick,
  className
}) {
  const floorLabel = floor === 0 ? "\u05E7\u05E8\u05E7\u05E2" : totalFloors ? `${floor} \u05DE\u05EA\u05D5\u05DA ${totalFloors}` : floor ?? "\u2014";
  return /* @__PURE__ */ jsxs(Card, { onClick, className: cn("p-4", className), children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between mb-2 gap-2", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("h3", { className: "text-sm font-semibold text-slate-900 leading-tight", children: title }),
        subtitle && /* @__PURE__ */ jsx("p", { className: "text-xs text-slate-400 mt-0.5", children: subtitle })
      ] }),
      sourceUrl && /* @__PURE__ */ jsx(
        "a",
        {
          href: sourceUrl,
          target: "_blank",
          rel: "noopener noreferrer",
          onClick: (e) => e.stopPropagation(),
          "aria-label": "\u05E4\u05EA\u05D7 \u05D0\u05EA \u05D4\u05DE\u05D5\u05D3\u05E2\u05D4 \u05D4\u05DE\u05E7\u05D5\u05E8\u05D9\u05EA",
          className: "text-slate-300 hover:text-brand-600 transition flex-shrink-0",
          children: linkIcon ?? "\u2197"
        }
      )
    ] }),
    address && /* @__PURE__ */ jsx("p", { className: "text-xs text-slate-500 mb-2", children: address }),
    /* @__PURE__ */ jsxs("div", { className: "flex items-baseline justify-between mb-3", children: [
      /* @__PURE__ */ jsxs("span", { className: "text-base font-bold text-slate-900", children: [
        "\u20AA",
        fmt(price)
      ] }),
      sizeSqm > 0 && /* @__PURE__ */ jsxs("span", { className: "text-xs text-slate-400", children: [
        "\u20AA",
        fmt(Math.round(price / sizeSqm)),
        "/\u05DE\u05F4\u05E8"
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-3 gap-2 mb-3", children: [
      /* @__PURE__ */ jsx(Stat, { label: "\u05D7\u05D3\u05E8\u05D9\u05DD", value: rooms }),
      /* @__PURE__ */ jsx(Stat, { label: "\u05E7\u05D5\u05DE\u05D4", value: floorLabel }),
      /* @__PURE__ */ jsx(Stat, { label: "\u05DE\u05F4\u05E8", value: sizeSqm })
    ] }),
    (source || listedBy) && /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1.5", children: [
      source && /* @__PURE__ */ jsx(Badge, { tone: "amber", children: source }),
      listedBy && /* @__PURE__ */ jsx(Badge, { tone: listedBy === "\u05E4\u05E8\u05D8\u05D9" ? "emerald" : "indigo", children: listedBy })
    ] })
  ] });
}

export { Avatar, Badge, Button, Card, EmptyState, IconButton, Input, KpiCard, ListingCard, Modal, SectionHeader, Select, Sidebar, Spinner, Stat, Toast, cn };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map