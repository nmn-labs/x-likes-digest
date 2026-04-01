import { TwitterApi } from 'twitter-api-v2';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import 'dotenv/config';

const CLIENT_ID = process.env.X_CLIENT_ID!;
const CLIENT_SECRET = process.env.X_CLIENT_SECRET!;
const CALLBACK_URL = 'https://example.com/callback';

async function main() {
  const client = new TwitterApi({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET });

  // Step 1: Generate auth link and save code_verifier
  const { url, codeVerifier, state } = client.generateOAuth2AuthLink(CALLBACK_URL, {
    scope: ['tweet.read', 'users.read', 'like.read', 'offline.access'],
  });

  // Save for step 2
  const stateFile = resolve(process.cwd(), '.oauth-state.json');
  writeFileSync(stateFile, JSON.stringify({ codeVerifier, state }));

  console.log('AUTH_URL=' + url);
  console.log('STATE_FILE saved to .oauth-state.json');
}

main().catch(console.error);
