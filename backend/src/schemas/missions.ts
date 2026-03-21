import Joi from 'joi';

export const completeTaskSchema = Joi.object({
    task_num: Joi.number().valid(1, 2).required().messages({
        'any.only': 'task_num must be 1 or 2',
        'any.required': 'task_num is required',
    }),
    day_number: Joi.number().integer().min(1).required(),
    room_id: Joi.string().uuid().optional(),
});

export const submitPracticeSchema = Joi.object({
    plan_id: Joi.string().uuid().required(),
    day_number: Joi.number().integer().min(1).required(),
    passed: Joi.boolean().required(),
    submitted_code: Joi.string().allow('', null).optional(),
    error_type: Joi.string().allow('', null).optional(),
    hint_used: Joi.boolean().default(false),
    room_id: Joi.string().uuid().optional(),
});

export const stuckSchema = Joi.object({
    plan_id: Joi.string().uuid().required(),
    day_number: Joi.number().integer().min(1).required(),
    problem: Joi.string().min(1).required(),
    topic: Joi.string().min(1).required(),
});
