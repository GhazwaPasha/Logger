"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeDatabaseUrl = normalizeDatabaseUrl;
exports.createDb = createDb;
exports.createDbFromPool = createDbFromPool;
const node_postgres_1 = require("drizzle-orm/node-postgres");
const pg_1 = require("pg");
const schema = __importStar(require("./schema.js"));
__exportStar(require("./schema.js"), exports);
/**
 * pg/pg-connection-string warns that legacy sslmode values (require/prefer/verify-ca)
 * will change semantics in the next major. We normalize to verify-full to keep strict TLS.
 */
function normalizeDatabaseUrl(connectionString) {
    const raw = connectionString.trim();
    if (!raw)
        return connectionString;
    try {
        const url = new URL(raw);
        const sslmode = url.searchParams.get("sslmode");
        const useLibpqCompat = url.searchParams.get("uselibpqcompat") === "true";
        if (!useLibpqCompat && (sslmode === "prefer" || sslmode === "require" || sslmode === "verify-ca")) {
            url.searchParams.set("sslmode", "verify-full");
            return url.toString();
        }
        return raw;
    }
    catch {
        return connectionString;
    }
}
function createDb(connectionString) {
    const pool = new pg_1.Pool({ connectionString: normalizeDatabaseUrl(connectionString) });
    return (0, node_postgres_1.drizzle)(pool, { schema });
}
function createDbFromPool(pool) {
    return (0, node_postgres_1.drizzle)(pool, { schema });
}
