"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const agent_templates_seed_1 = require("./agent-templates.seed");
dotenv_1.default.config({ path: path_1.default.resolve(process.cwd(), '../../.env') });
const pool = new pg_1.Pool({
    connectionString: process.env['DATABASE_URL'] ?? 'postgresql://gensmart:gensmart@localhost:5432/gensmart',
});
async function seed() {
    console.log('Starting database seed...\n');
    console.log('--- Agent Templates ---');
    const { inserted, updated } = await (0, agent_templates_seed_1.seedAgentTemplates)(pool);
    console.log(`\nAgent templates: ${inserted} inserted, ${updated} updated\n`);
    console.log('Seeding completed successfully!');
    await pool.end();
}
seed().catch((err) => {
    console.error('Seeding failed:', err);
    pool.end().finally(() => process.exit(1));
});
//# sourceMappingURL=index.js.map