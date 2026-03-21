"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toInternalUserId = toInternalUserId;
const crypto_1 = require("crypto");
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function toInternalUserId(externalUserId) {
    if (UUID_REGEX.test(externalUserId)) {
        return externalUserId.toLowerCase();
    }
    const hash = (0, crypto_1.createHash)('sha256').update(externalUserId).digest('hex');
    const segment1 = hash.slice(0, 8);
    const segment2 = hash.slice(8, 12);
    const segment3 = `4${hash.slice(13, 16)}`;
    const firstClockSeqByte = ((parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80)
        .toString(16)
        .padStart(2, '0');
    const segment4 = `${firstClockSeqByte}${hash.slice(18, 20)}`;
    const segment5 = hash.slice(20, 32);
    return `${segment1}-${segment2}-${segment3}-${segment4}-${segment5}`;
}
