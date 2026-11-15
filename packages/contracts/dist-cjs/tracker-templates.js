"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRACKER_TEMPLATES = void 0;
exports.trackerTemplateById = trackerTemplateById;
/** Starting points, so the common cases are one click instead of a form to fill. */
exports.TRACKER_TEMPLATES = [
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
function trackerTemplateById(id) {
    return exports.TRACKER_TEMPLATES.find((t) => t.id === id);
}
