"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
router.get('/:agentId', (_req, res) => res.json({ message: 'Knowledge base - Phase 4' }));
router.post('/:agentId', (_req, res) => res.json({ message: 'Upload knowledge - Phase 4' }));
exports.default = router;
//# sourceMappingURL=knowledge.js.map