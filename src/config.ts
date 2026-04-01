import dotenv from 'dotenv';
import { Config } from './types.js';

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string): string {
  return process.env[name] ?? '';
}

export function loadConfig(): Config {
  return {
    x_bearer_token: requireEnv('X_BEARER_TOKEN'),
    x_client_id: requireEnv('X_CLIENT_ID'),
    x_client_secret: requireEnv('X_CLIENT_SECRET'),
    x_access_token: requireEnv('X_ACCESS_TOKEN'),
    x_refresh_token: requireEnv('X_REFRESH_TOKEN'),
    twitterapi_io_key: requireEnv('TWITTERAPI_IO_KEY'),
    anthropic_api_key: optionalEnv('ANTHROPIC_API_KEY'),
    telegram_bot_token: optionalEnv('TELEGRAM_BOT_TOKEN'),
    telegram_channel_id: optionalEnv('TELEGRAM_CHANNEL_ID'),
    x_user_ids: requireEnv('X_USER_IDS').split(',').map(id => id.trim()).filter(Boolean),
  };
}
