import React, { useState, useEffect, useRef } from "react";
import {
  AlertTriangle, ArrowLeftRight, Building2, Calculator, CheckCircle2, Compass, Gauge,
  GitCompare, HandCoins, HardHat, Home, Info, Lightbulb, MapPin, Menu, Percent, Scale,
  Search, ShieldCheck, Sparkles, Train, TrendingDown, TrendingUp, Wallet, X, XCircle,
} from "lucide-react";
import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip,
} from "recharts";

/* ============================================================================
   TYPE SHAPES (JSDoc — mirrors the LocalityData / SHAPFactor / MacroEconomicMetrics
   / ForecastPoint interfaces shipped in types.ts for the production TS build)

   @typedef {Object} SHAPFactor
   @property {string} id
   @property {string} label        // plain-language reason, no jargon
   @property {number} amount       // signed ₹/month contribution to the rent change
   @property {Function} icon       // lucide-react icon component

   @typedef {Object} MacroEconomicMetrics
   @property {number} repoRate
   @property {number} residexDelta
   @property {number} cementPPI
   @property {number} migrationIndex

   @typedef {Object} ForecastPoint
   @property {number} idx
   @property {string} dateLabel
   @property {number|null} actual
   @property {number|null} predicted
   @property {number|null} base
   @property {number|null} band

   @typedef {Object} LocalityData
   @property {string} id
   @property {string} name
   @property {string} zone
   @property {number} lat
   @property {number} lng
   @property {number} medianRent          // ₹/month, 2BHK
   @property {number} yoy                 // surge, %
   @property {SHAPFactor[]} factors
   @property {string} biggestReason
   @property {number} fairnessDeltaPct    // + overpriced, - undervalued, vs model fair-value
   @property {number} forecastMonths
   @property {number} unitsIncoming
   @property {string} negotiationTip
   @property {number} fairHikeBenchmarkPct
   @property {{transit:number,water:number,roads:number,overall:number}} liveability
   @property {number} avgCommuteMin
   @property {number} predicted2yrGrowthPct
   @property {ForecastPoint[]} series
   ============================================================================ */

/* ---------------------------------- helpers ---------------------------------- */

const NOW = new Date(2026, 7, 1); // "as of" anchor: August 2026

function formatMonth(offsetMonths) {
  const d = new Date(NOW.getFullYear(), NOW.getMonth() + offsetMonths, 1);
  return d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function formatINR(n) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function buildSeries(baseRent, annualTrendPct, volAmp, seed) {
  // 24 months history + 12 months forecast, "now" at idx 23
  const monthlyRate = annualTrendPct / 1200;
  const noise = (i) => Math.sin((i + seed) * 0.7) * volAmp * 0.4 + Math.cos((i + seed) * 1.3) * volAmp * 0.2;
  const points = [];
  for (let idx = 0; idx <= 35; idx++) {
    const offset = idx - 23;
    const dateLabel = formatMonth(offset);
    if (idx <= 23) {
      const value = baseRent / Math.pow(1 + monthlyRate, 23 - idx) + noise(idx);
      const point = { idx, dateLabel, actual: Math.round(value), base: null, band: null };
      if (idx === 23) {
        point.predicted = point.actual;
        point.base = point.actual;
        point.band = 0;
      } else {
        point.predicted = null;
      }
      points.push(point);
    } else {
      const monthsFwd = idx - 23;
      const growth = Math.pow(1 + monthlyRate * 0.85, monthsFwd);
      const predicted = baseRent * growth + noise(idx) * 0.5;
      const bandPct = 0.015 + (monthsFwd / 12) * 0.08 * (volAmp / 3);
      const lower = predicted * (1 - bandPct);
      const upper = predicted * (1 + bandPct);
      points.push({
        idx, dateLabel, actual: null,
        predicted: Math.round(predicted),
        base: Math.round(lower),
        band: Math.round(upper - lower),
      });
    }
  }
  return points;
}

function surgeTone(yoy) {
  if (yoy >= 10) return { hex: "#e11d48", bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200", label: "High Surge" };
  if (yoy >= 5) return { hex: "#f59e0b", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", label: "Rising" };
  return { hex: "#10b981", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", label: "Stable" };
}

function fairnessTone(pct) {
  if (pct >= 6) return { label: "Overpriced", text: "text-rose-600", chip: "bg-rose-50 text-rose-700 border-rose-200" };
  if (pct <= -4) return { label: "Undervalued — good deal", text: "text-emerald-600", chip: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  return { label: "Fair Value", text: "text-indigo-600", chip: "bg-indigo-50 text-indigo-700 border-indigo-200" };
}

function buildSummary(locality) {
  return `Median Rent: ${formatINR(locality.medianRent)}/mo (Surged ${locality.yoy >= 0 ? "+" : ""}${locality.yoy}% YoY)`;
}

function buildForecastText(locality) {
  return `Rents in ${locality.name} are projected to stabilize within the next ${locality.forecastMonths} months as ${locality.unitsIncoming.toLocaleString("en-IN")} new residential units hit the market.`;
}

/* ---------------------------------- mock data ---------------------------------- */

const RAW = [
  {
    id: "wf", name: "Whitefield", zone: "East Bengaluru", lat: 12.9698, lng: 77.75, medianRent: 38500, yoy: 14.2, trend: 12.5, volAmp: 3.2, seed: 3,
    biggestReason: "New Yellow Line Metro Station opening nearby", fairnessDeltaPct: 8, forecastMonths: 8, unitsIncoming: 1200,
    negotiationTip: "Leases signed in Q4 see 4–6% lower hikes than the June–July peak intake cycle.", fairHikeBenchmarkPct: 9.9,
    liveability: { transit: 72, water: 58, roads: 55, overall: 62 }, avgCommuteMin: 42, predicted2yrGrowthPct: 19,
    factors: [
      { id: "wf1", label: "New Yellow Line Metro Station opening nearby", amount: 2900, icon: Train },
      { id: "wf2", label: "IT corridor office mandates & tech park influx", amount: 2150, icon: Building2 },
      { id: "wf3", label: "New high-rise completions cooling supply", amount: -1075, icon: HardHat },
      { id: "wf4", label: "Macro inflation & interest rates", amount: 813, icon: TrendingUp },
    ]
  },
  {
    id: "kb", name: "Koramangala", zone: "Central Bengaluru", lat: 12.9352, lng: 77.6146, medianRent: 46000, yoy: 5.6, trend: 5.0, volAmp: 1.6, seed: 7,
    biggestReason: "High startup & office demand density", fairnessDeltaPct: 2, forecastMonths: 5, unitsIncoming: 300,
    negotiationTip: "Owner-occupied buildings rarely negotiate — but multi-unit landlords often accept 3–5% lower asks in November.", fairHikeBenchmarkPct: 4.5,
    liveability: { transit: 80, water: 70, roads: 68, overall: 73 }, avgCommuteMin: 18, predicted2yrGrowthPct: 9,
    factors: [
      { id: "kb1", label: "High startup & office demand density", amount: 1300, icon: Building2 },
      { id: "kb2", label: "Very few new apartments being built nearby", amount: 900, icon: Home },
      { id: "kb3", label: "Macro inflation & interest rates", amount: 540, icon: TrendingUp },
      { id: "kb4", label: "A little new supply easing pressure slightly", amount: -300, icon: HardHat },
    ]
  },
  {
    id: "ir", name: "Indiranagar", zone: "Central-East Bengaluru", lat: 12.9719, lng: 77.6412, medianRent: 48000, yoy: 4.1, trend: 3.6, volAmp: 1.2, seed: 11,
    biggestReason: "Existing metro station premium holding steady", fairnessDeltaPct: 0, forecastMonths: 6, unitsIncoming: 150,
    negotiationTip: "Rents here move slowly — a 90-day notice period is your best negotiating leverage.", fairHikeBenchmarkPct: 3.8,
    liveability: { transit: 78, water: 72, roads: 70, overall: 75 }, avgCommuteMin: 22, predicted2yrGrowthPct: 7,
    factors: [
      { id: "ir1", label: "Existing metro station premium holding steady", amount: 900, icon: Train },
      { id: "ir2", label: "Retail & restaurant demand spilling into rents", amount: 700, icon: Building2 },
      { id: "ir3", label: "Macro inflation & interest rates", amount: 290, icon: TrendingUp },
    ]
  },
  {
    id: "hsr", name: "HSR Layout", zone: "South Bengaluru", lat: 12.9116, lng: 77.6473, medianRent: 35000, yoy: 12.8, trend: 11.0, volAmp: 3.0, seed: 5,
    biggestReason: "ORR tech-corridor overflow demand", fairnessDeltaPct: 11, forecastMonths: 7, unitsIncoming: 900,
    negotiationTip: "This pocket sees the sharpest June hikes — signing in Q1 (Jan–Mar) typically locks a 5–7% lower rate.", fairHikeBenchmarkPct: 9.0,
    liveability: { transit: 62, water: 50, roads: 52, overall: 55 }, avgCommuteMin: 35, predicted2yrGrowthPct: 17,
    factors: [
      { id: "hsr1", label: "ORR tech-corridor overflow demand", amount: 2100, icon: Building2 },
      { id: "hsr2", label: "New tech campuses opening in Sector 1–7", amount: 1300, icon: Train },
      { id: "hsr3", label: "Macro inflation & interest rates", amount: 572, icon: TrendingUp },
    ]
  },
  {
    id: "ec", name: "Electronic City", zone: "Far South Bengaluru", lat: 12.8452, lng: 77.6602, medianRent: 21000, yoy: 2.1, trend: 2.0, volAmp: 0.7, seed: 13,
    biggestReason: "Elevated expressway cut commute times", fairnessDeltaPct: -6, forecastMonths: 4, unitsIncoming: 2000,
    negotiationTip: "With plenty of vacant units nearby, most landlords accept the first reasonable counter-offer.", fairHikeBenchmarkPct: 3.0,
    liveability: { transit: 55, water: 65, roads: 60, overall: 60 }, avgCommuteMin: 48, predicted2yrGrowthPct: 5,
    factors: [
      { id: "ec1", label: "Elevated expressway cut commute times", amount: 280, icon: Train },
      { id: "ec2", label: "Macro inflation & interest rates", amount: 250, icon: TrendingUp },
      { id: "ec3", label: "Ample new supply keeping this pocket affordable", amount: -98, icon: HardHat },
    ]
  },
  {
    id: "jn", name: "Jayanagar", zone: "South-West Bengaluru", lat: 12.9308, lng: 77.5838, medianRent: 42000, yoy: 2.4, trend: 2.2, volAmp: 0.6, seed: 17,
    biggestReason: "Established, low-turnover residential premium", fairnessDeltaPct: -3, forecastMonths: 5, unitsIncoming: 120,
    negotiationTip: "Long-term tenants have strong leverage here — landlords prize stability over a quick hike.", fairHikeBenchmarkPct: 3.2,
    liveability: { transit: 68, water: 75, roads: 72, overall: 72 }, avgCommuteMin: 26, predicted2yrGrowthPct: 6,
    factors: [
      { id: "jn1", label: "Established, low-turnover residential premium", amount: 600, icon: Home },
      { id: "jn2", label: "Macro inflation & interest rates", amount: 384, icon: TrendingUp },
    ]
  },
  {
    id: "hb", name: "Hebbal", zone: "North Bengaluru", lat: 13.0355, lng: 77.597, medianRent: 33000, yoy: 8.9, trend: 8.0, volAmp: 2.2, seed: 19,
    biggestReason: "Signal-free airport-corridor flyover access", fairnessDeltaPct: 5, forecastMonths: 6, unitsIncoming: 750,
    negotiationTip: "New towers are completing soon — waiting 2–3 months could open up better terms.", fairHikeBenchmarkPct: 6.5,
    liveability: { transit: 65, water: 60, roads: 63, overall: 63 }, avgCommuteMin: 30, predicted2yrGrowthPct: 12,
    factors: [
      { id: "hb1", label: "Signal-free airport-corridor flyover access", amount: 1400, icon: Train },
      { id: "hb2", label: "New business park cluster opened nearby", amount: 900, icon: Building2 },
      { id: "hb3", label: "Macro inflation & interest rates", amount: 697, icon: TrendingUp },
      { id: "hb4", label: "New towers completing, easing some pressure", amount: -300, icon: HardHat },
    ]
  },
  {
    id: "mh", name: "Marathahalli", zone: "East-Central Bengaluru", lat: 12.9569, lng: 77.6974, medianRent: 30000, yoy: 11.5, trend: 10.2, volAmp: 2.8, seed: 23,
    biggestReason: "Overflow demand from Whitefield & Bellandur", fairnessDeltaPct: 9, forecastMonths: 8, unitsIncoming: 1100,
    negotiationTip: "This corridor tends to cool once Whitefield's own new supply lands — worth waiting if you can.", fairHikeBenchmarkPct: 8.2,
    liveability: { transit: 60, water: 52, roads: 48, overall: 53 }, avgCommuteMin: 38, predicted2yrGrowthPct: 15,
    factors: [
      { id: "mh1", label: "Overflow demand from Whitefield & Bellandur", amount: 1700, icon: Building2 },
      { id: "mh2", label: "ORR–Sarjapur junction relief project underway", amount: 900, icon: Train },
      { id: "mh3", label: "Aging drainage & road strain", amount: 250, icon: HardHat },
      { id: "mh4", label: "Macro inflation & interest rates", amount: 244, icon: TrendingUp },
    ]
  },
];

const LOCALITIES = RAW.map((l) => ({ ...l, series: buildSeries(l.medianRent, l.trend, l.volAmp, l.seed) }));

/* ---------------------------------- small atoms ---------------------------------- */

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-emerald-500 text-sm font-bold text-white shadow-sm">RT</div>
      <div className="leading-tight">
        <div className="font-semibold tracking-tight text-slate-900">RentTrace</div>
        <div className="hidden text-[11px] text-slate-500 sm:block">Know your neighborhood. Know your rent.</div>
      </div>
    </div>
  );
}

function SurgeBadge({ yoy, size = "md" }) {
  const tone = surgeTone(yoy);
  const pad = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border font-semibold ${tone.bg} ${tone.text} ${tone.border} ${pad}`}>
      {yoy >= 5 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />} {yoy >= 0 ? "+" : ""}{yoy}%
    </span>
  );
}

function FairnessGauge({ pct }) {
  const clamped = clamp(pct, -15, 15);
  const pos = ((clamped + 15) / 30) * 100;
  const tone = fairnessTone(pct);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-slate-500">
        <span>Undervalued</span><span>Fair Value</span><span>Overpriced</span>
      </div>
      <div className="relative h-2.5 w-full rounded-full bg-gradient-to-r from-emerald-400 via-slate-200 to-rose-400">
        <div className="absolute top-1/2 h-4 w-4 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 border-white bg-slate-900 shadow" style={{ left: `${pos}%` }} />
      </div>
      <p className={`mt-2 flex items-center gap-1.5 text-sm font-semibold ${tone.text}`}>
        <Scale className="h-4 w-4" /> {tone.label}{pct !== 0 ? ` (${pct > 0 ? "+" : ""}${pct}% vs. fair-value model)` : ""}
      </p>
    </div>
  );
}

function FactorRow({ f, maxAbs }) {
  const positive = f.amount >= 0;
  const width = (Math.abs(f.amount) / maxAbs) * 100;
  const Icon = f.icon;
  return (
    <div className="py-2">
      <div className="mb-1 flex items-center gap-2 text-sm">
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${positive ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="flex-1 text-slate-700">{f.label}</span>
        <span className={`shrink-0 font-semibold ${positive ? "text-amber-600" : "text-emerald-600"}`}>
          {positive ? "+" : "-"}{formatINR(Math.abs(f.amount))}/mo
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-100">
        <div className={`h-1.5 rounded-full ${positive ? "bg-amber-400" : "bg-emerald-400"}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function RentTrendChart({ locality }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <ComposedChart data={locality.series} margin={{ top: 6, right: 8, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="rt-band" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4F46E5" stopOpacity={0.22} />
            <stop offset="100%" stopColor="#4F46E5" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="dateLabel" interval={5} tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} />
        <YAxis hide domain={["auto", "auto"]} />
        <RTooltip contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 12 }} labelStyle={{ color: "#64748b" }} />
        <Area type="monotone" dataKey="base" stackId="ci" stroke="none" fill="transparent" isAnimationActive={false} />
        <Area type="monotone" dataKey="band" stackId="ci" stroke="none" fill="url(#rt-band)" isAnimationActive={false} />
        <Line type="monotone" dataKey="actual" stroke="#0f172a" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls={false} />
        <Line type="monotone" dataKey="predicted" stroke="#4F46E5" strokeWidth={2} strokeDasharray="4 3" dot={false} isAnimationActive={false} connectNulls={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function LiveabilityBar({ label, value, color }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-xs text-slate-500">{label}</span>
      <div className="h-2 flex-1 rounded-full bg-slate-100">
        <div className="h-2 rounded-full" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
      <span className="w-8 shrink-0 text-right text-xs font-semibold text-slate-600">{value}</span>
    </div>
  );
}

/* ---------------------------------- real Leaflet map ---------------------------------- */

function useLeaflet() {
  const [status, setStatus] = useState("loading");
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.L) { setStatus("ready"); return; }
    if (!document.getElementById("rt-leaflet-css")) {
      const link = document.createElement("link");
      link.id = "rt-leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
      document.head.appendChild(link);
    }
    let script = document.getElementById("rt-leaflet-js");
    let created = false;
    if (!script) {
      script = document.createElement("script");
      script.id = "rt-leaflet-js";
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
      script.async = true;
      created = true;
    }
    const onLoad = () => setStatus("ready");
    const onError = () => setStatus("error");
    script.addEventListener("load", onLoad);
    script.addEventListener("error", onError);
    if (created) document.body.appendChild(script);
    if (window.L) setStatus("ready");
    return () => {
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
    };
  }, []);
  return status;
}

function MapFallback({ onSelect }) {
  return (
    <div className="grid h-full grid-cols-1 gap-3 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3">
      <div className="col-span-full mb-1 flex items-center gap-2 text-sm text-slate-500">
        <Info className="h-4 w-4" /> Live map tiles didn't load on this network — here's the same data as a list.
      </div>
      {LOCALITIES.map((l) => {
        const tone = surgeTone(l.yoy);
        return (
          <button key={l.id} onClick={() => onSelect(l.id)} className="rounded-xl border border-slate-200 p-3 text-left transition hover:border-indigo-300 hover:shadow-sm">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-semibold text-slate-900">{l.name}</span>
              <SurgeBadge yoy={l.yoy} size="sm" />
            </div>
            <div className="text-sm text-slate-600">{formatINR(l.medianRent)}/mo</div>
            <div className="mt-1 text-xs text-slate-500">{l.biggestReason}</div>
          </button>
        );
      })}
    </div>
  );
}

function LeafletMap({ onSelect, selectedId, onMapReady }) {
  const status = useLeaflet();
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});

  useEffect(() => {
    if (status !== "ready" || !containerRef.current || mapRef.current) return;
    const L = window.L;
    const map = L.map(containerRef.current, { zoomControl: true, scrollWheelZoom: true }).setView([12.965, 77.655], 11);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);

    LOCALITIES.forEach((loc) => {
      const tone = surgeTone(loc.yoy);
      const circle = L.circle([loc.lat, loc.lng], {
        radius: 1100, color: tone.hex, weight: 1, fillColor: tone.hex, fillOpacity: 0.12,
      }).addTo(map);
      const icon = L.divIcon({
        className: "",
        html: `<div class="rt-pin" data-id="${loc.id}" style="border-color:${tone.hex}">
                 <span class="rt-pin-name">${loc.name}</span>
                 <span class="rt-pin-rent" style="color:${tone.hex}">${formatINR(loc.medianRent)} · ${loc.yoy >= 0 ? "+" : ""}${loc.yoy}%</span>
               </div>`,
        iconSize: null,
      });
      const marker = L.marker([loc.lat, loc.lng], { icon }).addTo(map);
      marker.bindTooltip(`Biggest reason: ${loc.biggestReason}`, { direction: "top", offset: [0, -10] });
      marker.on("click", () => onSelect(loc.id));
      markersRef.current[loc.id] = { marker, circle };
    });

    mapRef.current = map;
    if (onMapReady) onMapReady(map);
    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    Object.entries(markersRef.current).forEach(([id, refs]) => {
      const el = refs.marker.getElement && refs.marker.getElement();
      const pinEl = el && el.querySelector ? el.querySelector(".rt-pin") : null;
      if (pinEl) pinEl.classList.toggle("rt-pin-active", id === selectedId);
    });
  }, [selectedId, status]);

  if (status === "error") return <MapFallback onSelect={onSelect} />;

  return (
    <div className="relative h-full min-h-[420px] w-full overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
      <div ref={containerRef} className="h-full w-full" />
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
          <div className="flex items-center gap-2 text-sm text-slate-500"><Compass className="h-4 w-4 animate-spin" /> Loading the live map…</div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- search ---------------------------------- */

function LocalitySearch({ onSelect, onFlyTo }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const matches = query ? LOCALITIES.filter((l) => l.name.toLowerCase().includes(query.toLowerCase())) : [];
  return (
    <div className="relative w-full sm:w-72">
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm focus-within:border-indigo-400">
        <Search className="h-4 w-4 shrink-0 text-slate-400" />
        <input value={query} onChange={(e) => { setQuery(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
          placeholder="Search your neighborhood…" className="w-full bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none" />
        {query && <button onClick={() => { setQuery(""); setOpen(false); }}><X className="h-3.5 w-3.5 text-slate-400" /></button>}
      </div>
      {open && matches.length > 0 && (
        <div className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          {matches.map((m) => (
            <button key={m.id} onClick={() => { onSelect(m.id); onFlyTo && onFlyTo(m); setQuery(m.name); setOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50">
              <MapPin className="h-3.5 w-3.5 text-slate-400" /> {m.name}
              <span className="ml-auto text-xs text-slate-400">{m.zone}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- Citizen Rent Audit ---------------------------------- */

function CitizenAuditPanel({ locality, variant = "inline", onClose, onCompare, onCheckHike }) {
  if (!locality) return null;
  const maxAbs = Math.max(...locality.factors.map((f) => Math.abs(f.amount)));
  const isDrawer = variant === "drawer";

  return (
    <div className={isDrawer ? "flex h-full flex-col" : "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"}>
      <div className={`flex items-start justify-between gap-3 ${isDrawer ? "border-b border-slate-200 p-4" : "mb-4"}`}>
        <div>
          <div className="mb-0.5 flex items-center gap-2">
            <h3 className="text-lg font-bold text-slate-900">{locality.name}</h3>
            <SurgeBadge yoy={locality.yoy} />
          </div>
          <p className="text-sm text-slate-500">{locality.zone}</p>
        </div>
        {isDrawer && onClose && (
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-4.5 w-4.5" /></button>
        )}
      </div>

      <div className={isDrawer ? "flex-1 overflow-y-auto p-4" : ""}>
        <div className="mb-5 rounded-xl bg-slate-50 p-4">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">{formatINR(locality.medianRent)}</span>
            <span className="text-sm font-medium text-slate-500">/mo</span>
          </div>
          <p className="mt-1 text-sm text-slate-600">{buildSummary(locality)}</p>
        </div>

        <div className="mb-5">
          <FairnessGauge pct={locality.fairnessDeltaPct} />
        </div>

        <div className="mb-5">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <Scale className="h-3.5 w-3.5" /> Why your rent is changing
          </div>
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 px-3">
            {[...locality.factors].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).map((f) => (
              <FactorRow key={f.id} f={f} maxAbs={maxAbs} />
            ))}
          </div>
        </div>

        <div className="mb-5 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-indigo-500">
            <Sparkles className="h-3.5 w-3.5" /> Rent forecast
          </div>
          <p className="text-sm text-slate-700">{buildForecastText(locality)}</p>
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-white p-3">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <p className="text-sm text-slate-600"><span className="font-semibold text-slate-800">Tip for renters: </span>{locality.negotiationTip}</p>
          </div>
        </div>

        <div className="mb-5">
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Rent history & outlook</div>
          <div className="rounded-xl border border-slate-200 p-2">
            <RentTrendChart locality={locality} />
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button onClick={() => onCompare && onCompare(locality.id)} className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-600">
            <GitCompare className="h-4 w-4" /> Compare with another area
          </button>
          <button onClick={() => onCheckHike && onCheckHike(locality.id)} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500">
            <Calculator className="h-4 w-4" /> Check my hike
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- Map Explorer ---------------------------------- */

function MapExplorerView({ selectedId, setSelectedId, drawerOpen, setDrawerOpen, onCompare, onCheckHike }) {
  const mapInstanceRef = useRef(null);
  const selected = LOCALITIES.find((l) => l.id === selectedId) || null;

  const handleSelect = (id) => { setSelectedId(id); setDrawerOpen(true); };
  const handleFlyTo = (loc) => { if (mapInstanceRef.current) mapInstanceRef.current.flyTo([loc.lat, loc.lng], 14, { duration: 0.8 }); };

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Explore rent trends near you</h2>
          <p className="text-sm text-slate-500">Tap any neighborhood to see why rents are moving.</p>
        </div>
        <LocalitySearch onSelect={handleSelect} onFlyTo={handleFlyTo} />
      </div>

      <div className="relative flex-1">
        <LeafletMap onSelect={handleSelect} selectedId={selectedId} onMapReady={(m) => { mapInstanceRef.current = m; }} />
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-xl border border-slate-200 bg-white/95 p-3 text-xs shadow-sm">
          <div className="mb-1.5 font-semibold text-slate-600">Rent surge, year over year</div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-slate-500"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Stable</span>
            <span className="flex items-center gap-1 text-slate-500"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Rising</span>
            <span className="flex items-center gap-1 text-slate-500"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> High surge</span>
          </div>
        </div>
        {drawerOpen && selected && (
          <>
            <div className="fixed inset-0 z-30 bg-slate-900/30 lg:hidden" onClick={() => setDrawerOpen(false)} />
            <div className="fixed inset-y-0 right-0 z-40 w-full border-l border-slate-200 bg-white shadow-2xl sm:w-[420px]">
              <CitizenAuditPanel locality={selected} variant="drawer" onClose={() => setDrawerOpen(false)} onCompare={onCompare} onCheckHike={onCheckHike} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------- Neighborhood Audit tab ---------------------------------- */

function NeighborhoodAuditView({ selectedId, setSelectedId, onCompare, onCheckHike }) {
  const selected = LOCALITIES.find((l) => l.id === selectedId) || null;
  return (
    <div className="grid h-full grid-cols-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[280px_1fr] lg:overflow-hidden">
      <div className="overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 lg:h-full">
        <div className="p-2 text-xs font-semibold uppercase tracking-wide text-slate-400">All neighborhoods</div>
        <div className="flex flex-col gap-1">
          {LOCALITIES.map((l) => (
            <button key={l.id} onClick={() => setSelectedId(l.id)}
              className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition ${selectedId === l.id ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"}`}>
              <span className="font-medium">{l.name}</span>
              <SurgeBadge yoy={l.yoy} size="sm" />
            </button>
          ))}
        </div>
      </div>
      <div className="lg:h-full lg:overflow-y-auto">
        {selected ? (
          <CitizenAuditPanel locality={selected} variant="inline" onCompare={onCompare} onCheckHike={onCheckHike} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 py-16 text-center text-slate-400">
            <Home className="mb-3 h-8 w-8" />
            <p className="text-sm">Pick a neighborhood on the left to see its full rent audit.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------- Compare tab ---------------------------------- */

function buildTakeaway(a, b) {
  const rentDiff = a.medianRent - b.medianRent;
  if (rentDiff === 0) return `${a.name} and ${b.name} cost about the same — the bigger difference is commute and liveability.`;
  const cheaper = rentDiff > 0 ? b : a;
  const pricier = rentDiff > 0 ? a : b;
  const savings = Math.abs(rentDiff);
  const commuteDelta = cheaper.avgCommuteMin - pricier.avgCommuteMin;
  const commutePhrase = commuteDelta > 0
    ? `but adds about ${commuteDelta} minutes to your commute`
    : commuteDelta < 0
      ? `and even shortens your commute by about ${Math.abs(commuteDelta)} minutes`
      : `with about the same commute`;
  return `Moving from ${pricier.name} to ${cheaper.name} could save you ${formatINR(savings)}/month, ${commutePhrase}.`;
}

function CompareView({ compareIds, setCompareIds }) {
  const a = LOCALITIES.find((l) => l.id === compareIds[0]) || LOCALITIES[0];
  const b = LOCALITIES.find((l) => l.id === compareIds[1]) || LOCALITIES[3];

  const rows = [
    { label: "Median Rent (2BHK)", a: formatINR(a.medianRent) + "/mo", b: formatINR(b.medianRent) + "/mo" },
    { label: "Avg. commute to tech hub", a: `${a.avgCommuteMin} min`, b: `${b.avgCommuteMin} min` },
    { label: "Predicted 2-yr rent growth", a: `${a.predicted2yrGrowthPct}%`, b: `${b.predicted2yrGrowthPct}%` },
  ];

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mb-1 flex items-center gap-2">
        <ArrowLeftRight className="h-5 w-5 text-indigo-600" />
        <h2 className="text-lg font-bold text-slate-900">Should I rent here — or move?</h2>
      </div>
      <p className="mb-4 text-sm text-slate-500">Compare two neighborhoods side by side before you sign a new lease.</p>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <select value={a.id} onChange={(e) => setCompareIds([e.target.value, b.id])} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 shadow-sm">
          {LOCALITIES.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <select value={b.id} onChange={(e) => setCompareIds([a.id, e.target.value])} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 shadow-sm">
          {LOCALITIES.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>

      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 grid grid-cols-2 gap-3 text-center">
          <div className="rounded-xl bg-slate-50 py-3">
            <div className="font-bold text-slate-900">{a.name}</div>
            <div className="text-xs text-slate-500">{a.zone}</div>
          </div>
          <div className="rounded-xl bg-slate-50 py-3">
            <div className="font-bold text-slate-900">{b.name}</div>
            <div className="text-xs text-slate-500">{b.zone}</div>
          </div>
        </div>
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-t border-slate-100 py-3 text-sm">
            <div className="text-right font-semibold text-slate-800">{r.a}</div>
            <div className="whitespace-nowrap text-center text-xs text-slate-400">{r.label}</div>
            <div className="text-left font-semibold text-slate-800">{r.b}</div>
          </div>
        ))}
        <div className="border-t border-slate-100 pt-3">
          <div className="mb-2 text-center text-xs text-slate-400">Liveability & infrastructure</div>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <LiveabilityBar label="Transit" value={a.liveability.transit} color="#4F46E5" />
              <LiveabilityBar label="Water" value={a.liveability.water} color="#4F46E5" />
              <LiveabilityBar label="Roads" value={a.liveability.roads} color="#4F46E5" />
            </div>
            <div className="space-y-2">
              <LiveabilityBar label="Transit" value={b.liveability.transit} color="#10B981" />
              <LiveabilityBar label="Water" value={b.liveability.water} color="#10B981" />
              <LiveabilityBar label="Roads" value={b.liveability.roads} color="#10B981" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
        <HandCoins className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        <p className="text-sm text-slate-700">{buildTakeaway(a, b)}</p>
      </div>
    </div>
  );
}

/* ---------------------------------- Rent-hike calculator ---------------------------------- */

function hikeVerdict(diff) {
  if (diff <= 1.5) return { label: "Justified", tone: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", icon: CheckCircle2 };
  if (diff <= 5) return { label: "Slightly high — room to negotiate", tone: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", icon: AlertTriangle };
  return { label: "Likely unjustified — push back", tone: "text-rose-600", bg: "bg-rose-50", border: "border-rose-200", icon: XCircle };
}

function CalculatorView({ localityId, setLocalityId }) {
  const locality = LOCALITIES.find((l) => l.id === localityId) || LOCALITIES[0];
  const [currentRent, setCurrentRent] = useState(String(locality.medianRent));
  const [hikePct, setHikePct] = useState("10");
  const [result, setResult] = useState(null);

  useEffect(() => { setCurrentRent(String(locality.medianRent)); setResult(null); }, [localityId]);

  const evaluate = () => {
    const rent = Number(currentRent) || 0;
    const hike = Number(hikePct) || 0;
    const benchmark = locality.fairHikeBenchmarkPct;
    const diff = hike - benchmark;
    const verdict = hikeVerdict(diff);
    const demandedRent = rent * (1 + hike / 100);
    const fairRent = rent * (1 + benchmark / 100);
    setResult({ rent, hike, benchmark, diff, verdict, demandedRent, fairRent, gap: demandedRent - fairRent });
  };

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mb-1 flex items-center gap-2">
        <Calculator className="h-5 w-5 text-indigo-600" />
        <h2 className="text-lg font-bold text-slate-900">Is your rent hike fair?</h2>
      </div>
      <p className="mb-4 text-sm text-slate-500">Benchmark your landlord's demand against real infrastructure and RESIDEX data for your area.</p>

      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="mb-1.5 block text-xs font-semibold text-slate-500">Your locality</label>
        <select value={localityId} onChange={(e) => setLocalityId(e.target.value)} className="mb-4 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800">
          {LOCALITIES.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>

        <label className="mb-1.5 block text-xs font-semibold text-slate-500">Your current rent (₹/month)</label>
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5">
          <Wallet className="h-4 w-4 text-slate-400" />
          <input type="number" value={currentRent} onChange={(e) => setCurrentRent(e.target.value)} className="w-full bg-transparent text-sm text-slate-800 outline-none" />
        </div>

        <label className="mb-1.5 block text-xs font-semibold text-slate-500">Landlord's demanded hike (%)</label>
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5">
          <Percent className="h-4 w-4 text-slate-400" />
          <input type="number" value={hikePct} onChange={(e) => setHikePct(e.target.value)} className="w-full bg-transparent text-sm text-slate-800 outline-none" />
        </div>

        <button onClick={evaluate} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500">
          <Gauge className="h-4 w-4" /> Check if this is fair
        </button>

        {result && (
          <div className="mt-5 border-t border-slate-100 pt-5">
            <div className={`mb-4 flex items-center gap-2 rounded-xl border p-3 ${result.verdict.bg} ${result.verdict.border}`}>
              <result.verdict.icon className={`h-5 w-5 shrink-0 ${result.verdict.tone}`} />
              <span className={`text-sm font-semibold ${result.verdict.tone}`}>{result.verdict.label}</span>
            </div>
            <p className="mb-4 text-sm text-slate-600">
              {locality.name}'s public data supports roughly a <span className="font-semibold text-slate-800">{result.benchmark}%</span> increase this cycle, driven mainly by <span className="font-medium text-slate-800">{locality.biggestReason.toLowerCase()}</span>. Your landlord is asking for <span className="font-semibold text-slate-800">{result.hike}%</span>.
            </p>
            <div className="mb-4 grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="text-xs text-slate-400">Fair rent estimate</div>
                <div className="font-bold text-emerald-600">{formatINR(result.fairRent)}/mo</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="text-xs text-slate-400">Landlord's ask</div>
                <div className="font-bold text-slate-800">{formatINR(result.demandedRent)}/mo</div>
              </div>
            </div>
            {result.gap > 100 && (
              <p className="mb-3 text-sm text-slate-600">That's about <span className="font-semibold text-rose-600">{formatINR(result.gap)}/month</span> above what local data supports.</p>
            )}
            <div className="flex items-start gap-2 rounded-lg bg-indigo-50/60 p-3">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <p className="text-sm text-slate-600">{locality.negotiationTip}</p>
            </div>
            <p className="mt-3 text-[11px] text-slate-400">This is a directional estimate from public indices, not legal advice.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------- App shell ---------------------------------- */

const TABS = [
  { id: "map", label: "Map Explorer", icon: MapPin },
  { id: "audit", label: "Neighborhood Audit", icon: Scale },
  { id: "compare", label: "Compare", icon: ArrowLeftRight },
  { id: "calculator", label: "Rent-Hike Calculator", icon: Calculator },
];

export default function RentTraceApp() {
  const [tab, setTab] = useState("map");
  const [selectedId, setSelectedId] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [compareIds, setCompareIds] = useState(["wf", "hsr"]);
  const [calculatorLocalityId, setCalculatorLocalityId] = useState("wf");
  const [navOpen, setNavOpen] = useState(false);

  const goCompare = (id) => { setCompareIds(([, b]) => [id, b === id ? (LOCALITIES.find((l) => l.id !== id) || LOCALITIES[0]).id : b]); setTab("compare"); setDrawerOpen(false); };
  const goCalculator = (id) => { setCalculatorLocalityId(id); setTab("calculator"); setDrawerOpen(false); };

  return (
    <div className="flex h-screen flex-col bg-slate-50 text-slate-800">
      <style>{`
        .rt-pin { display:flex; flex-direction:column; align-items:flex-start; gap:2px; background:#ffffff; border:2px solid #94a3b8; border-radius:10px; padding:5px 9px; box-shadow:0 2px 8px rgba(15,23,42,0.18); font-family: Inter, ui-sans-serif, system-ui, sans-serif; white-space:nowrap; transform: translate(2px,-34px); cursor:pointer; }
        .rt-pin-name { font-size:11px; font-weight:700; color:#0f172a; line-height:1.2; }
        .rt-pin-rent { font-size:11px; font-weight:700; line-height:1.2; }
        .rt-pin-active { outline: 3px solid #4F46E5; outline-offset:1px; }
        .leaflet-container { font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
      `}</style>

      <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <Logo />
        <nav className="hidden items-center gap-1 rounded-xl bg-slate-100 p-1 lg:flex">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${tab === t.id ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 sm:flex">
            <ShieldCheck className="h-3.5 w-3.5" /> Free & open for everyone
          </div>
          <button onClick={() => setNavOpen((o) => !o)} className="rounded-lg border border-slate-200 p-2 text-slate-600 lg:hidden"><Menu className="h-4.5 w-4.5" /></button>
        </div>
      </header>

      {navOpen && (
        <div className="flex flex-wrap gap-1.5 border-b border-slate-200 bg-white px-4 py-2 lg:hidden">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => { setTab(t.id); setNavOpen(false); }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${tab === t.id ? "bg-indigo-50 text-indigo-700" : "text-slate-500"}`}>
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>
      )}

      <main className="min-h-0 flex-1">
        {tab === "map" && (
          <MapExplorerView selectedId={selectedId} setSelectedId={setSelectedId} drawerOpen={drawerOpen} setDrawerOpen={setDrawerOpen} onCompare={goCompare} onCheckHike={goCalculator} />
        )}
        {tab === "audit" && (
          <NeighborhoodAuditView selectedId={selectedId} setSelectedId={setSelectedId} onCompare={goCompare} onCheckHike={goCalculator} />
        )}
        {tab === "compare" && <CompareView compareIds={compareIds} setCompareIds={setCompareIds} />}
        {tab === "calculator" && <CalculatorView localityId={calculatorLocalityId} setLocalityId={setCalculatorLocalityId} />}
      </main>
    </div>
  );
}
