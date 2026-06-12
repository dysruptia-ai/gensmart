"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
router.post('/auth/qr-generate', (_req, res) => res.json({ message: 'Mobile QR - Phase 11' }));
router.post('/auth/login', (_req, res) => res.json({ message: 'Mobile login - Phase 11' }));
router.get('/agents', (_req, res) => res.json({ message: 'Mobile agents - Phase 11' }));
exports.default = router;
//# sourceMappingURL=mobile.js.map