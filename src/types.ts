export interface Like {
  id?: number;
  tweet_id: string;
  account: string;
  author_username?: string;
  author_name?: string;
  text?: string;
  created_at?: string;
  liked_at?: string;
  has_media: boolean;
  has_link: boolean;
  has_article: boolean;
  media_urls?: string;
  link_urls?: string;
  category?: string;
  summary?: string;
  image_description?: string;
  link_summary?: string;
  article_content?: string;
  raw_json?: string;
  processed: boolean;
  created?: string;
}

export interface Recommendation {
  id?: number;
  tweet_id: string;
  recommended_date: string;
  reason?: string;
  was_liked?: boolean | null;
  checked_at?: string;
  created?: string;
}

export interface InterestProfile {
  id?: number;
  category: string;
  keyword: string;
  weight: number;
  last_updated?: string;
}

export interface SyncState {
  id?: number;
  account: string;
  last_tweet_id?: string;
  last_sync_at?: string;
}

export interface Config {
  x_bearer_token: string;
  x_client_id: string;
  x_client_secret: string;
  x_access_token: string;
  x_refresh_token: string;
  twitterapi_io_key: string;
  anthropic_api_key: string;
  telegram_bot_token: string;
  telegram_channel_id: string;
  x_user_ids: string[];
}

export interface TweetMedia {
  type: string;
  url?: string;
  preview_image_url?: string;
}

export interface TweetUrl {
  url: string;
  expanded_url: string;
  display_url: string;
}

export interface RawTweetData {
  id: string;
  text: string;
  created_at?: string;
  author_id?: string;
  attachments?: {
    media_keys?: string[];
  };
  entities?: {
    urls?: TweetUrl[];
  };
  includes?: {
    media?: TweetMedia[];
    users?: Array<{
      id: string;
      username: string;
      name: string;
    }>;
  };
}

export interface DigestItem {
  like: Like;
  summaryText: string;
}
