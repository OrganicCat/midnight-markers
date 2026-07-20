export type Bookmark = {
  id: string;
  url: string;
  title: string;
  originalTitle: string;
  domain: string;
  faviconUrl: string | null;
  thumbnailUrl: string | null;
  description: string | null;
  excerpt: string | null;
  collectionId: string | null;
  tagIds: string[];
  starred: boolean;
  unread: boolean;
  note: string | null;
  createdAt: number;
  updatedAt: number;
  lastCheckedAt: number | null;
  isBroken: boolean;
};

export type Collection = {
  id: string;
  name: string;
  parentId: string | null;
  color: string;
  sortOrder: number;
  createdAt: number;
};

export type Tag = {
  id: string;
  name: string;
  count: number;
};

export type AIFeatures = {
  tags: boolean;
  title: boolean;
  collection: boolean;
};

export type Settings = {
  aiKey: string | null;
  aiModel: string;
  aiFeatures: AIFeatures;
  /**
   * Timestamp at which the user affirmatively consented to sending page data
   * to OpenRouter, or null if they never have. Nothing is transmitted while
   * this is null — see canUseAI() in $lib/ai/consent.
   */
  aiConsentAt: number | null;
  defaultView: 'grid' | 'list';
  defaultCollectionId: string | null;
  uiScale: number; // multiplier on root font-size; 1.0 = 100%, range 0.9–1.5
};

export type SmartFilter = 'recent' | 'unread' | 'starred' | 'untagged' | 'broken';

export type BookmarkFilter = {
  collectionId?: string | null;
  tagId?: string;
  smart?: SmartFilter;
  search?: string;
};
