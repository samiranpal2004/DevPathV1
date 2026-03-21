"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = validate;
function validate(schema) {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body, { abortEarly: false });
        if (error) {
            res.status(400).json({
                error: 'Validation failed',
                details: error.details.map((d) => d.message),
            });
            return;
        }
        req.body = value;
        next();
    };
}
