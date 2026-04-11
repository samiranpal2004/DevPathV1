import 'dotenv/config';
import { lookup } from 'node:dns/promises';
import app from './app';

const port = Number(process.env.PORT ?? 8000);

// Run on startup — validates all required env vars
function validateEnvironment(): boolean {
  console.log('');
  console.log('╔══════════════════════════════════╗');
  console.log('║   DevPath Backend — Env Check    ║');
  console.log('╚══════════════════════════════════╝');

  const checks = [
    {
      name: 'GEMINI_API_KEY',
      value: process.env.GEMINI_API_KEY,
      preview: process.env.GEMINI_API_KEY?.slice(0, 8),
    },
    {
      name: 'SUPABASE_URL',
      value: process.env.SUPABASE_URL,
      preview: process.env.SUPABASE_URL?.slice(0, 30),
    },
    {
      name: 'SUPABASE_SERVICE_ROLE_KEY',
      value: process.env.SUPABASE_SERVICE_ROLE_KEY,
      preview: process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 8),
    },
    {
      name: 'CLERK_SECRET_KEY',
      value: process.env.CLERK_SECRET_KEY,
      preview: process.env.CLERK_SECRET_KEY?.slice(0, 8),
    },
  ];

  let allValid = true;

  for (const check of checks) {
    if (!check.value) {
      console.error(`❌ ${check.name}: MISSING`);
      allValid = false;
    } else {
      console.log(`✅ ${check.name}: present (${check.preview}...)`);
    }
  }

  if (!allValid) {
    console.error('');
    console.error('⛔ Missing environment variables!');
    console.error('Check your .env file.');
    console.error('');
    return false;
  } else {
    console.log('');
    console.log('✅ All environment variables present');
    console.log('');
    return true;
  }
}

async function validateSupabaseConnection(): Promise<boolean> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return false;
  }

  console.log('╔══════════════════════════════════╗');
  console.log('║  DevPath Backend — DB Health     ║');
  console.log('╚══════════════════════════════════╝');

  let hostname: string;
  try {
    hostname = new URL(supabaseUrl).hostname;
  } catch {
    console.error(`❌ Invalid SUPABASE_URL format: ${supabaseUrl}`);
    console.error('Expected format: https://<project-ref>.supabase.co');
    console.error('');
    return false;
  }

  try {
    await lookup(hostname);
    console.log(`✅ DNS resolved: ${hostname}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Supabase DNS lookup failed for ${hostname}`);
    console.error(`   ${message}`);
    console.error('   Check SUPABASE_URL in backend/.env and verify the project is active.');
    console.error('');
    return false;
  }

  try {
    const healthUrl = `${supabaseUrl}/auth/v1/health`;
    const response = await fetch(healthUrl, {
      method: 'GET',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    });

    if (!response.ok) {
      console.error(`❌ Supabase health check failed: HTTP ${response.status}`);
      console.error(`   URL: ${healthUrl}`);
      console.error('   Check project URL/key pair and network connectivity.');
      console.error('');
      return false;
    }

    console.log('✅ Supabase connectivity check passed');
    console.log('');
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ Supabase connectivity check failed');
    console.error(`   ${message}`);
    console.error('   This usually means DNS/network issues or an invalid project URL.');
    console.error('');
    return false;
  }
}

async function bootstrap(): Promise<void> {
  const envOk = validateEnvironment();
  if (!envOk) process.exit(1);

  const supabaseOk = await validateSupabaseConnection();
  if (!supabaseOk) process.exit(1);

  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`DevPath backend listening on port ${port}`);
  });
}

void bootstrap();
