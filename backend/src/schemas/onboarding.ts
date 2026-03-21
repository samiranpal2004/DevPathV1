import Joi from 'joi';

export const quizResultSchema = Joi.object({
    // answers: array of 5 booleans (true = correct)
    answers: Joi.array()
        .items(Joi.boolean().required())
        .length(5)
        .required()
        .messages({
            'array.length': 'Exactly 5 answers required',
            'any.required': 'answers is required',
        }),
});

export const preferencesSchema = Joi.object({
    goal: Joi.string()
        .valid('job', 'course', 'dsa', 'general')
        .required()
        .messages({
            'any.only': 'goal must be one of: job, course, dsa, general',
            'any.required': 'goal is required',
        }),
    daily_time_minutes: Joi.number()
        .valid(15, 20, 30)
        .required()
        .messages({
            'any.only': 'daily_time_minutes must be 15, 20, or 30',
            'any.required': 'daily_time_minutes is required',
        }),
});

export const parseUrlSchema = Joi.object({
    url: Joi.string().uri().required().messages({
        'string.uri': 'url must be a valid URI',
        'any.required': 'url is required',
    }),
    fallback_topic: Joi.string().trim().min(2).max(100).optional(),
});
