"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const pg_1 = require("pg");
let supabaseAdmin;
const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';
const TEST_USER_ID = '00000000-0000-0000-0000-000000000099';
function validateRequiredEnv() {
    // FIX: Added explicit preflight env validation for production check script.
    const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'DATABASE_URL'];
    return required.filter((key) => !process.env[key] || String(process.env[key]).trim().length === 0);
}
function deterministicUuid(seed) {
    return `00000000-0000-0000-0000-${seed.toString().padStart(12, '0')}`;
}
function runtimeUuid(seedPrefix) {
    const randomPart = Math.floor(Math.random() * 1000000)
        .toString()
        .padStart(6, '0');
    const suffix = `${Date.now()}${seedPrefix}${randomPart}`.slice(-12);
    return `00000000-0000-0000-0000-${suffix}`;
}
function toIsoDate(date) {
    return date.toISOString().slice(0, 10);
}
async function ensureTestUser() {
    const { error } = await supabaseAdmin.from('users').upsert({
        id: TEST_USER_ID,
        email: 'prod-check@devpath.app',
        display_name: 'Prod Check Bot',
        username: 'prod_check_bot',
        gamification_on: false,
        updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
    if (error) {
        throw new Error(`Failed to create test user: ${error.message}`);
    }
}
async function runCheck(name, fn) {
    try {
        await fn();
        console.log(`✅ ${name}`);
        return { name, passed: true };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.log(`❌ ${name}`);
        return { name, passed: false, details: message };
    }
}
async function checkSupabaseConnection() {
    const { data, error } = await supabaseAdmin.from('users').select('id').limit(1);
    if (error) {
        throw new Error(`Users query failed: ${error.message}`);
    }
    if (!Array.isArray(data)) {
        throw new Error('Users query returned invalid response.');
    }
}
async function checkMaterializedView() {
    const { data, error } = await supabaseAdmin.from('user_xp_totals').select('user_id,total_xp').limit(1);
    if (error) {
        throw new Error(`Materialized view query failed: ${error.message}`);
    }
    if (!Array.isArray(data)) {
        throw new Error('Materialized view query returned invalid response.');
    }
}
async function checkContributionTrigger() {
    await ensureTestUser();
    const todayIso = toIsoDate(new Date());
    const eventId = deterministicUuid(9001);
    const { error: insertError } = await supabaseAdmin.from('contribution_events').upsert({
        id: eventId,
        user_id: TEST_USER_ID,
        date: todayIso,
        event_type: 'solo_task',
        delta: 1.0,
        created_at: new Date().toISOString(),
    }, { onConflict: 'id' });
    if (insertError) {
        throw new Error(`Insert into contribution_events failed: ${insertError.message}`);
    }
    const { data: contributionRow, error: verifyError } = await supabaseAdmin
        .from('contributions')
        .select('count')
        .eq('user_id', TEST_USER_ID)
        .eq('date', todayIso)
        .maybeSingle();
    if (verifyError) {
        throw new Error(`Contribution verification query failed: ${verifyError.message}`);
    }
    const countValue = Number(contributionRow?.count ?? 0);
    if (!Number.isFinite(countValue) || countValue <= 0) {
        throw new Error('Contribution trigger did not update aggregated contributions.');
    }
    const { error: deleteEventError } = await supabaseAdmin.from('contribution_events').delete().eq('id', eventId);
    if (deleteEventError) {
        throw new Error(`Cleanup failed (contribution_events): ${deleteEventError.message}`);
    }
    const { error: deleteContributionError } = await supabaseAdmin
        .from('contributions')
        .delete()
        .eq('user_id', TEST_USER_ID)
        .eq('date', todayIso);
    if (deleteContributionError) {
        throw new Error(`Cleanup failed (contributions): ${deleteContributionError.message}`);
    }
}
async function checkXpTrigger() {
    await ensureTestUser();
    const eventId = runtimeUuid(9);
    const { data: beforeRow, error: beforeError } = await supabaseAdmin
        .from('user_xp_totals')
        .select('total_xp')
        .eq('user_id', TEST_USER_ID)
        .maybeSingle();
    if (beforeError) {
        throw new Error(`Pre-check user_xp_totals query failed: ${beforeError.message}`);
    }
    const beforeTotal = Number(beforeRow?.total_xp ?? 0);
    const { error: insertError } = await supabaseAdmin.from('xp_events').insert({
        id: eventId,
        user_id: TEST_USER_ID,
        amount: 11,
        reason: 'task_complete',
        created_at: new Date().toISOString(),
    });
    if (insertError) {
        throw new Error(`Insert into xp_events failed: ${insertError.message}`);
    }
    let refreshed = false;
    for (let attempt = 0; attempt < 10; attempt += 1) {
        const { data: afterRow, error: afterError } = await supabaseAdmin
            .from('user_xp_totals')
            .select('total_xp')
            .eq('user_id', TEST_USER_ID)
            .maybeSingle();
        if (afterError) {
            throw new Error(`Post-check user_xp_totals query failed: ${afterError.message}`);
        }
        const afterTotal = Number(afterRow?.total_xp ?? 0);
        if (afterTotal >= beforeTotal + 11) {
            refreshed = true;
            break;
        }
        await new Promise((resolve) => {
            setTimeout(resolve, 500);
        });
    }
    if (!refreshed) {
        throw new Error('XP trigger did not refresh user_xp_totals after insert.');
    }
    const { error: deleteError } = await supabaseAdmin.from('xp_events').delete().eq('id', eventId);
    if (deleteError) {
        throw new Error(`Cleanup failed (xp_events): ${deleteError.message}`);
    }
}
async function checkRealtimePublication() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error('DATABASE_URL is not set; cannot verify supabase_realtime publication.');
    }
    const client = new pg_1.Client({
        connectionString,
        ssl: { rejectUnauthorized: false },
    });
    try {
        await client.connect();
        const queryResult = await client.query(`
      SELECT tablename
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename IN ('room_daily_log', 'room_events')
      `);
        const tables = new Set(queryResult.rows.map((row) => row.tablename));
        if (!tables.has('room_daily_log') || !tables.has('room_events')) {
            throw new Error('supabase_realtime publication missing room_daily_log or room_events.');
        }
    }
    finally {
        await client.end();
    }
}
async function checkDemoAccount() {
    const { data, error } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', 'demo@devpath.app')
        .maybeSingle();
    if (error) {
        throw new Error(`Demo account lookup failed: ${error.message}`);
    }
    if (!data?.id) {
        throw new Error('Demo account does not exist.');
    }
}
async function checkDemoRoom() {
    const { data, error } = await supabaseAdmin
        .from('rooms')
        .select('id,status')
        .eq('code', 'KGEC42')
        .eq('status', 'active')
        .maybeSingle();
    if (error) {
        throw new Error(`Demo room lookup failed: ${error.message}`);
    }
    if (!data?.id) {
        throw new Error('Active room with code KGEC42 was not found.');
    }
}
async function checkDemoPlan() {
    const { data, error } = await supabaseAdmin
        .from('daily_plans')
        .select('id')
        .eq('user_id', DEMO_USER_ID)
        .limit(1)
        .maybeSingle();
    if (error) {
        throw new Error(`Demo plan lookup failed: ${error.message}`);
    }
    if (!data?.id) {
        throw new Error('No daily_plan found for the demo user.');
    }
}
async function run() {
    console.log('🔍 Running production readiness checks...');
    const missingEnv = validateRequiredEnv();
    if (missingEnv.length > 0) {
        console.error('❌ Missing required environment variables for production checks:');
        missingEnv.forEach((envKey) => console.error(` - ${envKey}`));
        process.exit(1);
        return;
    }
    ({ supabaseAdmin } = await Promise.resolve().then(() => __importStar(require('../lib/supabase'))));
    const checks = [
        () => runCheck('Supabase connection — can query users table', checkSupabaseConnection),
        () => runCheck('Materialized view — user_xp_totals is queryable', checkMaterializedView),
        () => runCheck('Contribution trigger — contribution_events -> contributions', checkContributionTrigger),
        () => runCheck('XP trigger — xp_events refreshes user_xp_totals', checkXpTrigger),
        () => runCheck('Realtime publication — room_daily_log + room_events included', checkRealtimePublication),
        () => runCheck('Demo account — demo@devpath.app exists', checkDemoAccount),
        () => runCheck('Demo room — KGEC42 exists and is active', checkDemoRoom),
        () => runCheck('Demo plan — daily_plan exists for demo user', checkDemoPlan),
    ];
    const results = [];
    for (const check of checks) {
        results.push(await check());
    }
    const failed = results.filter((result) => !result.passed);
    if (failed.length === 0) {
        console.log('✅ All production checks passed.');
        process.exit(0);
        return;
    }
    console.error('\n❌ Production checks failed:');
    failed.forEach((result, index) => {
        console.error(`${index + 1}. ${result.name}`);
        if (result.details) {
            console.error(`   -> ${result.details}`);
        }
    });
    process.exit(1);
}
run().catch((error) => {
    const message = error instanceof Error ? error.message : 'Unknown production-check error';
    console.error(`❌ Production check script crashed: ${message}`);
    process.exit(1);
});
