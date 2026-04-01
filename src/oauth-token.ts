import { TwitterApi } from 'twitter-api-v2';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import 'dotenv/config';

const CLIENT_ID = process.env.X_CLIENT_ID!;
const CLIENT_SECRET = process.env.X_CLIENT_SECRET!;
const CALLBACK_URL = 'https://example.com/callback';

async function main() {
  const code = process.argv[2];
  if (!code) {
    console.error('Usage: npx tsx src/oauth-token.ts <code>');
    process.exit(1);
  }

  const stateFile = resolve(process.cwd(), '.oauth-state.json');
  const { codeVerifier } = JSON.parse(readFileSync(stateFile, 'utf-8'));

  const client = new TwitterApi({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET });

  const result = await client.loginWithOAuth2({
    code,
    codeVerifier,
    redirectUri: CALLBACK_URL,
  });

  const me = await result.client.v2.me();
  console.log(`User: @${me.data.username} (ID: ${me.data.id})`);

  // Update .env
  const envPath = resolve(process.cwd(), '.env');
  let env = readFileSync(envPath, 'utf-8');
  env = env.replace(/^X_ACCESS_TOKEN=.*$/m, `X_ACCESS_TOKEN=${result.accessToken}`);
  env = env.replace(/^X_REFRESH_TOKEN=.*$/m, `X_REFRESH_TOKEN=${result.refreshToken}`);
  
  const currentIds = env.match(/^X_USER_IDS=(.*)$/m)?.[1] || '';
  if (!currentIds.includes(me.data.id)) {
    const newIds = currentIds ? `${currentIds},${me.data.id}` : me.data.id;
    env = env.replace(/^X_USER_IDS=.*$/m, `X_USER_IDS=${newIds}`);
  }
  writeFileSync(envPath, env);
  
  console.log('✅ .env updated');
  console.log(`ACCESS_TOKEN: ${result.accessToken.slice(0, 20)}...`);
  console.log(`REFRESH_TOKEN: ${result.refreshToken?.slice(0, 20)}...`);
}

main().catch(console.error);
