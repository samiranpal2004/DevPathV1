"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabaseAnon = exports.supabaseAdmin = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl) {
    throw new Error('Missing SUPABASE_URL environment variable.');
}
if (!supabaseServiceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable.');
}
exports.supabaseAdmin = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceRoleKey);
exports.supabaseAnon = (0, supabase_js_1.createClient)(supabaseUrl, supabaseAnonKey || supabaseServiceRoleKey);
