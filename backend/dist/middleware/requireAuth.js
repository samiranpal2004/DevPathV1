"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clerkAuth = void 0;
exports.requireAuth = requireAuth;
const express_1 = require("@clerk/express");
const userId_1 = require("../utils/userId");
exports.clerkAuth = (0, express_1.clerkMiddleware)();
function requireAuth(req, res, next) {
    const { userId: clerkUserId } = (0, express_1.getAuth)(req);
    if (!clerkUserId) {
        res.status(401).json({
            success: false,
            error: {
                code: 'UNAUTHORIZED',
                message: 'Authentication required',
            },
        });
        return;
    }
    req.clerkUserId = clerkUserId;
    req.userId = (0, userId_1.toInternalUserId)(clerkUserId);
    // Inject so existing route handlers that read req.headers['x-user-id'] work transparently
    req.headers['x-user-id'] = req.userId;
    next();
}
