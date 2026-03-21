import 'dotenv/config';
import app from './app';

const port = Number(process.env.PORT ?? 8000);

// Run on startup — validates all required env vars
function validateEnvironment(): void {
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
  } else {
    console.log('');
    console.log('✅ All environment variables present');
    console.log('');
  }
}

validateEnvironment();

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`DevPath backend listening on port ${port}`);
});
