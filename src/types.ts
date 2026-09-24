export type MessageType = 'text' | 'image' | 'video' | 'voice' | 'audio' | 'file' | 'poll' | 'sticker' | 'game' | string;

export interface MessageReaction {
  emoji: string;
  count: number;
  users: string[];
}

export interface PollOption {
  id: string;
  text: string;
  votes: string[];
}

export interface Message {
  id: string;
  senderId: string;
  senderName?: string;
  receiverId?: string;
  groupId?: string;
  chatId?: string;
  text: string;
  content?: string;
  type: MessageType;
  createdAt: string;
  updatedAt?: string;
  status?: 'pending' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed' | string;
  deliveryStatus?: 'pending' | 'sending' | 'sent' | 'delivered' | 'failed' | string;
  isEncrypted?: boolean;
  encryptedPayload?: string;
  asChannel?: boolean;
  silent?: boolean;
  replyToId?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  duration?: number;
  audioDuration?: number;
  voiceDuration?: number;
  reactions?: Record<string, string[]> | MessageReaction[] | any;
  pollOptions?: PollOption[];
  pollQuestion?: string;
  isPinned?: boolean;
  subtitles?: string;
  version?: number;
  ttl?: number;
  hops?: number;
  meshHops?: number;
  meshRoute?: string[];
  relayPath?: string[];
  inlineButtons?: any[];
  [key: string]: any;
}

export interface GroupPermissions {
  canSendMessages?: boolean;
  canSendMedia?: boolean;
  canAddMembers?: boolean;
  canDeleteForEveryone?: boolean;
  canBanUsers?: boolean;
  canChangeProfile?: boolean;
  canComment?: boolean;
  canSendMediaInComments?: boolean;
  canSendPhotosInComments?: boolean;
  canSendVideosInComments?: boolean;
  canSendStickersInComments?: boolean;
  canSendFilesInComments?: boolean;
  canUseReactions?: boolean;
  [key: string]: any;
}

export interface Chat {
  id: string;
  name: string;
  photoURL?: string;
  type: 'direct' | 'group' | 'channel' | string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
  isPublic?: boolean;
  isGlobal?: boolean;
  isVerified?: boolean;
  description?: string;
  members?: string[];
  memberRoles?: Record<string, string>;
  ownerId?: string;
  pinnedMessageId?: string;
  createdAt?: string;
  version?: number;
  permissions?: {
    member?: GroupPermissions;
    admin?: GroupPermissions;
    [key: string]: any;
  };
  commentsDisabled?: boolean;
  reactionsDisabled?: boolean;
  slowModeSeconds?: number;
  [key: string]: any;
}

export type Group = Chat;

export const DEFAULT_GLOBAL_CHANNEL: Group = {
  id: 'global_channel',
  name: 'Ордина Глобал 🌐',
  description: 'Главный канал мессенджера Ордина. Общайтесь, задавайте вопросы и делитесь идеями!',
  ownerId: 'le6qifgHZsV99qTBzSe3VZpYVlE2',
  createdAt: '2025-01-01T00:00:00.000Z',
  photoURL: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=80',
  type: 'channel',
  isPublic: true,
  isGlobal: true,
  isVerified: true,
  members: ['le6qifgHZsV99qTBzSe3VZpYVlE2'],
  memberRoles: { 'le6qifgHZsV99qTBzSe3VZpYVlE2': 'owner' }
};

export interface UserWarning {
  id: string;
  text: string;
  reason?: string;
  createdAt: string;
  moderatorName?: string;
  targetType?: 'message' | 'user' | 'group';
  pardoned?: boolean;
  pardonedBy?: string;
}

export interface UserDevice {
  id: string;
  name: string;
  type: 'phone' | 'desktop' | 'tablet' | string;
  lastActive?: string;
  ip?: string;
  location?: string;
  os?: string;
  browser?: string;
}

export interface UserTitle {
  id: string;
  text: string;
  color?: string;
  font?: string;
  flag?: string;
  glowColor?: string;
  background?: string;
  border?: string;
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
  animation?: 'none' | 'pulse' | 'rainbow' | 'shimmer' | 'bounce' | string;
  [key: string]: any;
}

export interface UserProfile {
  uid: string;
  email?: string;
  displayName: string;
  username?: string;
  photoURL?: string;
  bio?: string;
  role?: string;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  isModerator?: boolean;
  online?: boolean;
  status?: string;
  customStatus?: string;
  lastSeen?: string;
  cannotInitiateDmsUntil?: string | null;
  cannotInitiateReason?: string | null;
  warnings?: UserWarning[];
  activeChats?: string[];
  devices?: UserDevice[];
  savedStickerPacks?: string[];
  meshPosition?: {
    x?: number;
    y?: number;
    lat?: number;
    lng?: number;
  };
  grantedTitles?: UserTitle[];
  activeTitleId?: string;
  [key: string]: any;
}

export interface Sticker {
  id: string;
  url: string;
  emoji?: string;
  packId?: string;
}

export interface StickerPack {
  id: string;
  name: string;
  stickers: Sticker[];
  authorId?: string;
  authorName?: string;
  isCustom?: boolean;
  createdAt?: string;
  [key: string]: any;
}

export interface MeshNode {
  id: string;
  displayName: string;
  photoURL?: string;
  x?: number;
  y?: number;
  lat?: number;
  lng?: number;
  isOnline?: boolean;
  rssi?: number;
  ping?: number;
  hops?: number;
  nodeType?: 'me' | 'direct' | 'mesh' | string;
  estimatedModemRangeMeters?: number;
  [key: string]: any;
}

export type ReportCategory = 
  | 'extremism'
  | 'insult'
  | 'doxing'
  | 'fraud'
  | 'spam'
  | 'csam'
  | 'violence'
  | 'drugs'
  | 'copyright'
  | 'other';

export interface Report {
  id: string;
  reporterId: string;
  reporterName?: string;
  targetType: 'message' | 'user' | 'group';
  targetId: string;
  targetName?: string;
  chatId?: string;
  reasonCategory: ReportCategory;
  reasonCategoryTitle: string;
  legalBasis: string;
  description?: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  createdAt: string;
  messageContext?: {
    messageId?: string;
    text?: string;
    senderId?: string;
    senderName?: string;
    fileUrl?: string;
    chatId?: string;
  };
  moderatorNotes?: string;
  resolvedBy?: string;
  resolvedByName?: string;
  resolvedAt?: string;
  resolutionAction?: ModerationActionType | string;
  [key: string]: any;
}

export type ModerationActionType = 
  | 'ban_dms_temporary'
  | 'warning'
  | 'delete_message_with_warning'
  | 'delete_group_with_warning'
  | 'delete_account_with_warning'
  | 'ban_account_email'
  | 'lift_restriction'
  | 'unban_email'
  | 'dismiss';

export interface BotTrigger {
  id: string;
  pattern: string;
  response: string;
  type: 'exact' | 'contains' | 'regex' | 'command';
}

export interface BotDefinition {
  id: string;
  name: string;
  username: string;
  description: string;
  avatarUrl?: string;
  triggers: BotTrigger[];
  welcomeMessage?: string;
  isActive: boolean;
  createdAt: string;
}
