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

/**
 * Which vendor AI requests go to. One is active at a time and serves every AI
 * feature; both providers' keys are retained across a switch so flipping back
 * does not mean re-pasting.
 */
export type ProviderId = 'openrouter' | 'anthropic';

export type Settings = {
  aiProvider: ProviderId;
  /**
   * Per-provider key and model. Each key is sealed independently at rest — see
   * $lib/storage/settings. Pre-v0.4 installs stored the OpenRouter pair as
   * `aiKey`/`aiModel`; those are migrated on first read.
   */
  openrouterKey: string | null;
  openrouterModel: string;
  anthropicKey: string | null;
  anthropicModel: string;
  aiFeatures: AIFeatures;
  /**
   * Timestamp at which the user affirmatively consented to sending page data
   * to the active model provider, or null if they never have. Nothing is
   * transmitted while this is null — see canUseAI() in $lib/ai/consent.
   */
  aiConsentAt: number | null;
  defaultView: 'grid' | 'list';
  defaultCollectionId: string | null;
  uiScale: number; // multiplier on root font-size; 1.0 = 100%, range 0.9–1.5
  /**
   * Timestamp at which the guided tour was last *shown*. Null means the user
   * has never seen it, which is the one and only condition for auto-running it
   * on the new tab page. Written when the tour opens rather than when it
   * closes: closing the tab a moment after skipping would otherwise lose the
   * write and the tour would ambush them again on the next new tab.
   */
  tourSeenAt: number | null;
};

export type SmartFilter = 'recent' | 'unread' | 'starred' | 'untagged' | 'broken';

export type BookmarkFilter = {
  collectionId?: string | null;
  tagId?: string;
  smart?: SmartFilter;
  search?: string;
};
