import { Router } from 'express';
import { clerkClient } from '@clerk/express';

import { supabaseAdmin } from '../lib/supabase';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

router.post('/sync', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const clerkUserId = req.clerkUserId;
    const clerkUser = await clerkClient.users.getUser(clerkUserId);

    const email = clerkUser.emailAddresses[0]?.emailAddress ?? '';
    const displayName =
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') ||
      email.split('@')[0] ||
      'Learner';
    const avatarUrl = clerkUser.imageUrl ?? null;

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .upsert(
        {
          id: userId,
          email,
          display_name: displayName,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'id',
          ignoreDuplicates: false,
        }
      )
      .select()
      .single();

    if (error) {
      throw error;
    }

    const { data: prefs } = await supabaseAdmin
      .from('user_preferences')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    const needsOnboarding = !prefs;

    return res.json({
      success: true,
      data: {
        userId: user.id,
        displayName: user.display_name,
        needsOnboarding,
      },
    });
  } catch (error) {
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

export default router;
