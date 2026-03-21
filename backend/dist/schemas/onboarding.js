"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseUrlSchema = exports.preferencesSchema = exports.quizResultSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.quizResultSchema = joi_1.default.object({
    // answers: array of booleans (true = correct). Gemini may return 3–10 questions.
    answers: joi_1.default.array()
        .items(joi_1.default.boolean().required())
        .min(1)
        .required()
        .messages({
        'any.required': 'answers is required',
    }),
});
exports.preferencesSchema = joi_1.default.object({
    goal: joi_1.default.string()
        .valid('job', 'course', 'dsa', 'general')
        .required()
        .messages({
        'any.only': 'goal must be one of: job, course, dsa, general',
        'any.required': 'goal is required',
    }),
    daily_time_minutes: joi_1.default.number()
        .valid(15, 20, 30)
        .required()
        .messages({
        'any.only': 'daily_time_minutes must be 15, 20, or 30',
        'any.required': 'daily_time_minutes is required',
    }),
});
exports.parseUrlSchema = joi_1.default.object({
    url: joi_1.default.string().uri().required().messages({
        'string.uri': 'url must be a valid URI',
        'any.required': 'url is required',
    }),
    fallback_topic: joi_1.default.string().trim().min(2).max(100).optional(),
});
