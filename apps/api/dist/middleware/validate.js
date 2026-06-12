"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = validate;
function validate(schema, source = 'body') {
    return (req, res, next) => {
        const result = schema.safeParse(req[source]);
        if (!result.success) {
            res.status(400).json({
                error: {
                    message: 'Validation error',
                    code: 'VALIDATION_ERROR',
                    details: result.error.errors,
                },
            });
            return;
        }
        req[source] = result.data;
        next();
    };
}
//# sourceMappingURL=validate.js.map