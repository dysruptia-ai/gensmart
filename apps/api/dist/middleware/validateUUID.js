"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateUUID = validateUUID;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validateUUID(...paramNames) {
    return (req, res, next) => {
        for (const param of paramNames) {
            const value = String(req.params[param] ?? '');
            if (value && !UUID_REGEX.test(value)) {
                res.status(400).json({
                    error: {
                        message: `Invalid ${param}: must be a valid UUID`,
                        code: 'INVALID_UUID',
                    },
                });
                return;
            }
        }
        next();
    };
}
//# sourceMappingURL=validateUUID.js.map