"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRoomCode = generateRoomCode;
const crypto_1 = __importDefault(require("crypto"));
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O,0,I,1
function generateRoomCode() {
    const bytes = crypto_1.default.randomBytes(6);
    return Array.from(bytes)
        .map((byte) => CHARSET[byte % CHARSET.length])
        .join('');
}
