"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_2 = require("@clerk/express");
const supabase_1 = require("../lib/supabase");
const requireAuth_1 = require("../middleware/requireAuth");
const router = (0, express_1.Router)();
router.post('/sync', requireAuth_1.requireAuth, async (req, res) => {
    try {
        const userId = req.userId;
        const clerkUserId = req.clerkUserId;
        // Fetch Clerk profile — use safe fallbacks if the API call fails
        let email = '';
        let displayName = 'Learner';
        let avatarUrl = null;
        try {
            const clerkUser = await express_2.clerkClient.users.getUser(clerkUserId);
            email = clerkUser.emailAddresses[0]?.emailAddress ?? '';
            displayName =
                [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') ||
                    email.split('@')[0] ||
                    'Learner';
            avatarUrl = clerkUser.imageUrl ?? null;
        }
        catch (clerkErr) {
            console.warn('Could not fetch Clerk profile, using fallbacks:', clerkErr);
            // Proceed with fallback values — still create the user row
        }
        const { data: user, error } = await supabase_1.supabaseAdmin
            .from('users')
            .upsert({
            id: userId,
            email,
            display_name: displayName,
            avatar_url: avatarUrl,
            updated_at: new Date().toISOString(),
        }, {
            onConflict: 'id',
            ignoreDuplicates: false,
        })
            .select()
            .single();
        if (error) {
            throw error;
        }
        // Auto-create default preferences if they don't exist so the user
        // goes straight to the dashboard after signup / login.
        await supabase_1.supabaseAdmin
            .from('user_preferences')
            .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });
        return res.json({
            success: true,
            data: {
                userId: user.id,
                displayName: user.display_name,
                needsOnboarding: false,
            },
        });
    }
    catch (error) {
        console.error('Auth sync error:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'SYNC_FAILED',
                message: 'Failed to sync user',
            },
        });
    }
});
exports.default = router;
