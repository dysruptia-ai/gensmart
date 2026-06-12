"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
exports.errorHandler = errorHandler;
class AppError extends Error {
    statusCode;
    message;
    code;
    details;
    constructor(statusCode, message, code, details) {
        super(message);
        this.statusCode = statusCode;
        this.message = message;
        this.code = code;
        this.details = details;
        this.name = 'AppError';
    }
}
exports.AppError = AppError;
function errorHandler(err, _req, res, _next) {
    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            error: {
                message: err.message,
                code: err.code,
                ...(err.details ? { details: err.details } : {}),
            },
        });
        return;
    }
    if (err.name === 'ZodError') {
        res.status(400).json({
            error: {
                message: 'Validation error',
                code: 'VALIDATION_ERROR',
                details: err.errors,
            },
        });
        return;
    }
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: {
            message: 'Internal server error',
            code: 'INTERNAL_ERROR',
        },
    });
}
//# sourceMappingURL=errorHandler.js.map