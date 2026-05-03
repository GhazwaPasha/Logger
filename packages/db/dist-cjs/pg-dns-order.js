"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_dns_1 = __importDefault(require("node:dns"));
/**
 * Prefer IPv4 when a hostname has both A and AAAA records.
 * Some networks advertise IPv6 that does not route to the internet; `pg` then hangs until TCP timeout.
 * `ipv4first` still returns only-AAAA when no A record exists (IPv6-only deployments).
 *
 * Must run before any `pg` connection. Import this module from `@work-ledger/db` entrypoints and CLI scripts.
 */
if (typeof node_dns_1.default.setDefaultResultOrder === "function") {
    node_dns_1.default.setDefaultResultOrder("ipv4first");
}
