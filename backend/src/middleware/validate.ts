/**
 * Joi validation middleware factory.
 * Usage: router.post('/path', validate(schema), handler)
 */
import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

export function validate(schema: Joi.ObjectSchema) {
    return (req: Request, res: Response, next: NextFunction): void => {
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
