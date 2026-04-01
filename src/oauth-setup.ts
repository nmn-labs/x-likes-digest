import { TwitterApi } from 'twitter-api-v2';
import { createServer } from 'http';
import { URL } from 'url';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import 'dotenv/config';

const CLIENT_ID = process.env.X_CLIENT_ID!;
const CLIENT_SECRET = process.env.X_CLIENT_SECRET!;
const CALLBACK_URL = 'https://example.com/callback';

async function main() {
  const client = new TwitterApi({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET });

  const { url, codeVerifier, state } = client.generateOAuth2AuthLink(CALLBACK_URL, {
    scope: ['tweet.read', 'users.read', 'like.read', 'offline.access'],
  });

  console.log('\n=== OAuth 2.0 認証 ===');
  console.log('\n以下のURLをブラウザで開いてください:');
  console.log(`\n${url}\n`);
  console.log('認証後、リダイレクト先のURL全体をコピーして貼り付けてください:');

  const readline = await import('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  rl.question('\nリダイレクトURL: ', async (redirectUrl: string) => {
    try {
      const parsedUrl = new URL(redirectUrl.trim());
      const code = parsedUrl.searchParams.get('code');
      const returnedState = parsedUrl.searchParams.get('state');

      if (!code) {
        console.error('エラー: URLにcodeパラメータがありません');
        process.exit(1);
      }

      if (returnedState !== state) {
        console.warn('警告: stateが一致しません（続行します）');
      }

      const result = await client.loginWithOAuth2({
        code,
        codeVerifier,
        redirectUri: CALLBACK_URL,
      });

      const accessToken = result.accessToken;
      const refreshToken = result.refreshToken!;

      // Get user info
      const loggedClient = result.client;
      const me = await loggedClient.v2.me();
      console.log(`\n✅ 認証成功: @${me.data.username} (ID: ${me.data.id})`);

      // Update .env
      const envPath = resolve(process.cwd(), '.env');
      let envContent = readFileSync(envPath, 'utf-8');
      envContent = envContent.replace(/^X_ACCESS_TOKEN=.*$/m, `X_ACCESS_TOKEN=${accessToken}`);
      envContent = envContent.replace(/^X_REFRESH_TOKEN=.*$/m, `X_REFRESH_TOKEN=${refreshToken}`);

      // Add user ID if not present
      const currentIds = envContent.match(/^X_USER_IDS=(.*)$/m)?.[1] || '';
      if (!currentIds.includes(me.data.id)) {
        const newIds = currentIds ? `${currentIds},${me.data.id}` : me.data.id;
        envContent = envContent.replace(/^X_USER_IDS=.*$/m, `X_USER_IDS=${newIds}`);
      }

      writeFileSync(envPath, envContent, 'utf-8');
      console.log('\n✅ .env にトークン保存完了');
      console.log(`   User ID: ${me.data.id}`);
      console.log(`   Access Token: ${accessToken.slice(0, 20)}...`);
      console.log(`   Refresh Token: ${refreshToken.slice(0, 20)}...`);
      console.log('\n2つ目のアカウントがある場合は、もう一度このスクリプトを実行してください。');
    } catch (err) {
      console.error('エラー:', err);
    }
    rl.close();
  });
}

main();
