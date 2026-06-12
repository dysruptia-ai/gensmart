"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.query = query;
exports.getClient = getClient;
const pg_1 = require("pg");
const env_1 = require("./env");
exports.pool = new pg_1.Pool({
    connectionString: env_1.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});
exports.pool.on('connect', () => {
    console.log('PostgreSQL connected');
});
exports.pool.on('error', (err) => {
    console.error('Unexpected PostgreSQL error', err);
});
async function query(text, params) {
    const start = Date.now();
    const result = await exports.pool.query(text, params);
    const duration = Date.now() - start;
    if (env_1.env.NODE_ENV === 'development' && duration > 1000) {
        console.warn('Slow query detected', { text, duration });
    }
    return result;
}
async function getClient() {
    return exports.pool.connect();
}
//# sourceMappingURL=database.js.map