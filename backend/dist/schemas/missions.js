"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stuckSchema = exports.submitPracticeSchema = exports.completeTaskSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.completeTaskSchema = joi_1.default.object({
    task_num: joi_1.default.number().valid(1, 2).required().messages({
        'any.only': 'task_num must be 1 or 2',
        'any.required': 'task_num is required',
    }),
    day_number: joi_1.default.number().integer().min(1).required(),
    room_id: joi_1.default.string().uuid().optional(),
});
exports.submitPracticeSchema = joi_1.default.object({
    plan_id: joi_1.default.string().uuid().required(),
    day_number: joi_1.default.number().integer().min(1).required(),
    passed: joi_1.default.boolean().required(),
    submitted_code: joi_1.default.string().allow('', null).optional(),
    error_type: joi_1.default.string().allow('', null).optional(),
    hint_used: joi_1.default.boolean().default(false),
    room_id: joi_1.default.string().uuid().optional(),
});
exports.stuckSchema = joi_1.default.object({
    plan_id: joi_1.default.string().uuid().required(),
    day_number: joi_1.default.number().integer().min(1).required(),
    problem: joi_1.default.string().min(1).required(),
    topic: joi_1.default.string().min(1).required(),
});
