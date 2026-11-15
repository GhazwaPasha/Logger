import type { TrackerFormula, TrackerMetricUnit } from "@work-ledger/contracts";

/** A metric as the editor drafts it; ids are minted when a template is applied. */
export type TemplateMetric = {
  key: string;
  name: string;
  kind: "input" | "formula";
  unit: TrackerMetricUnit;
  target?: number;
  direction?: "at_least" | "at_most";
  /** For formulas: keys of two sibling metrics. */
  formula?: { op: TrackerFormula["op"]; a: string; b: string; percent?: boolean };
};

export type TrackerTemplate = {
  id: "sales" | "leads" | "clients" | "blank";
  name: string;
  /** Suggested tracker name. */
  title: string;
  blurb: string;
  metrics: TemplateMetric[];
};

/** Starting points, so the common cases are one click instead of a form to fill. */
export const TRACKER_TEMPLATES: TrackerTemplate[] = [
  {
    id: "sales",
    name: "Sales",
    title: "Sales",
    blurb: "Orders, revenue, and average order size",
    metrics: [
      { key: "orders", name: "Orders", kind: "input", unit: "count" },
      { key: "revenue", name: "Revenue", kind: "input", unit: "currency" },
      { key: "aos", name: "Avg order size", kind: "formula", unit: "currency", formula: { op: "div", a: "revenue", b: "orders" } },
    ],
  },
  {
    id: "leads",
    name: "Lead generation",
    title: "Leads",
    blurb: "Leads, qualified leads, and qualify rate",
    metrics: [
      { key: "leads", name: "Leads", kind: "input", unit: "count" },
      { key: "qualified", name: "Qualified", kind: "input", unit: "count" },
      { key: "rate", name: "Qualify rate", kind: "formula", unit: "percent", formula: { op: "div", a: "qualified", b: "leads", percent: true } },
    ],
  },
  {
    id: "clients",
    name: "New clients",
    title: "New clients",
    blurb: "Clients signed, contract value, and average contract",
    metrics: [
      { key: "clients", name: "Clients signed", kind: "input", unit: "count" },
      { key: "value", name: "Contract value", kind: "input", unit: "currency" },
      { key: "avg", name: "Avg contract", kind: "formula", unit: "currency", formula: { op: "div", a: "value", b: "clients" } },
    ],
  },
  {
    id: "blank",
    name: "Start blank",
    title: "",
    blurb: "Pick your own metrics",
    metrics: [{ key: "m1", name: "", kind: "input", unit: "count" }],
  },
];

export function trackerTemplateById(id: string | null | undefined): TrackerTemplate | undefined {
  return TRACKER_TEMPLATES.find((t) => t.id === id);
}
