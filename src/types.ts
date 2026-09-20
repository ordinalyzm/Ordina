export interface Sticker {
  id: string;
  url: string;
  emoji?: string;
}

export interface StickerPack {
  id: string;
  name: string;
  creatorId: string;
  stickers: Sticker[];
  createdAt: string;
}

export interface UserTitle {
  id: string;
  text: string;
  color: string;
  font: string;
  flagId?: string;
  border?: string;      // Border color
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
  background?: string;   // Background color for the title
  glowColor?: string;    // Glow color (shadow)
  animation?: 'none' | 'pulse' | 'rainbow' | 'shimmer' | 'bounce';
}

export interface UserDevice {
  id: string;
  name: string;
  type: 'phone' | 'pc' | 'tablet' | 'unknown';
  lastActive: string;
  isApproved: boolean;
  location: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL?: string;
  profileBackgroundURL?: string; // Background image for profile
  email?: string;
  status: 'auto' | 'online' | 'offline' | 'away' | 'busy' | 'dnd';
  customStatus?: string;
  mutedChats?: { [chatId: string]: number };
  lastSeen: string;
  meshPosition?: {
    x?: number;
    y?: number;
    lat?: number;
    lng?: number;
  };
  bio?: string;
  username?: string; // Unique ID for search
  meshKey?: string; // Cryptographic public key representation
  pinnedChats?: string[]; // Chats pinned to the top
  hiddenChats?: string[]; // List of UIDs for hidden private chats
  activeChats?: string[]; // List of UIDs for users we have chatted with
  hiddenMessages?: string[]; // List of message IDs hidden by the user
  typingTo?: string | null; // UID of the user this user is currently typing to
  blockedUsers?: string[]; // List of UIDs blocked by this user
  savedStickerPacks?: string[]; // List of sticker pack IDs
  activeTitleId?: string; // ID of the currently active title
  grantedTitles?: UserTitle[]; // Titles granted to this user
  isBot?: boolean;
  isVerified?: boolean;
  role?: string;
  isAdmin?: boolean;
  usersList?: string[];
  devices?: UserDevice[]; // Registered devices tracking
}

export type GroupRole = 'owner' | 'admin' | 'member';

export interface GroupMember {
  uid: string;
  role: GroupRole;
  joinedAt: string;
}

export interface PollOption {
  id: string;
  text: string;
  votes: string[];
}

export interface PollData {
  question: string;
  options: PollOption[];
  isAnonymous: boolean;
  isMultipleChoice: boolean;
  closed?: boolean;
}

export interface Message {
  id: string;
  chatId?: string;
  senderId: string;
  receiverId?: string;
  groupId?: string;
  text: string;
  content?: string; // Mesh compatibility alias
  type: 'text' | 'image' | 'video' | 'file' | 'poll' | 'game' | 'sticker' | 'audio' | 'voice' | 'system';
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  audioDuration?: number;
  voiceDuration?: number;
  createdAt: string;
  updatedAt?: string;
  inlineButtons?: { text: string; callbackData?: string; url?: string }[][];
  deleted?: boolean;
  replyToId?: string;
  threadId?: string; // ID of the parent message for comments
  forwardedFrom?: string;
  stickerPackId?: string;
  relayPath?: string[]; // The path the message took through the mesh
  relayTo?: string; // The next node targeted by the relay
  isEncrypted?: boolean;
  encryptionMethod?: 'simple-xor' | 'aes-256'; // For future expansion
  status?: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  deliveryStatus?: 'pending' | 'sent' | 'relayed' | 'delivered' | 'read' | 'sending' | 'failed';
  ttl?: number; // Time-to-live for mesh multi-hop (default 5)
  version?: number; // Incremental sync version
  readBy?: string[]; // List of UIDs who have read the message
  deliveredDevices?: Record<string, boolean>; // Maps deviceId to delivered (true/false)
  asChannel?: boolean; // Whether the user posted this message as the channel
  isEdited?: boolean;
  poll?: PollData;
  gameType?: string;
  gameState?: any;
  reactions?: Record<string, string[]>; // emoji -> array of user IDs
  quote?: {
    text: string;
    originalSenderId: string;
  };
  isMesh?: boolean;
  meshHops?: number;
  meshRoute?: string[];
  signature?: string;
  encryptedPayload?: string;
}

export interface Chat {
  id: string;
  type: 'user' | 'group' | 'channel';
  name?: string;
  photoURL?: string;
  version?: number;
  lastMessage?: Message;
  unreadCount?: number;
  updatedAt?: string;
  members?: string[];
}

export interface GroupPermissions {
  canSendMessages: boolean;
  canSendMedia: boolean;
  canAddMembers: boolean;
  canDeleteForEveryone: boolean;
  canBanUsers: boolean;
  canChangeProfile: boolean;
  canComment: boolean;
  canSendMediaInComments?: boolean;
  canSendPhotosInComments?: boolean;
  canSendVideosInComments?: boolean;
  canSendStickersInComments?: boolean;
  canSendFilesInComments?: boolean;
  canUseReactions?: boolean;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  type: 'group' | 'channel';
  ownerId: string;
  members: string[]; // List of UIDs for easy querying
  memberRoles: Record<string, GroupRole>; // Detailed roles
  createdAt: string;
  photoURL?: string;
  isPublic: boolean;
  isGlobal?: boolean;
  isVerified?: boolean;
  version?: number;
  bannedUsers?: string[];
  bannedFromComments?: string[]; // List of UIDs banned from commenting
  permissions?: {
    member: GroupPermissions;
    admin: GroupPermissions;
  };
  createdTitles?: UserTitle[]; // Global titles created by the owner
}

export const DEFAULT_GLOBAL_CHANNEL: Group = {
  id: 'global_channel',
  name: 'Ордина Глобал 🌐',
  description: 'Главный канал мессенджера Ордина. Общайтесь, задавайте вопросы и делитесь идеями!',
  ownerId: 'le6qifgHZsV99qTBzSe3VZpYVlE2',
  createdAt: '2026-09-17T00:00:00.000Z',
  photoURL: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=80',
  type: 'channel',
  isPublic: true,
  isGlobal: true,
  isVerified: true,
  members: ['le6qifgHZsV99qTBzSe3VZpYVlE2'],
  memberRoles: { 'le6qifgHZsV99qTBzSe3VZpYVlE2': 'owner' },
  version: 1,
  bannedUsers: [],
  permissions: {
    member: {
      canSendMessages: true,
      canSendMedia: true,
      canAddMembers: true,
      canDeleteForEveryone: false,
      canBanUsers: false,
      canChangeProfile: false,
      canComment: true
    },
    admin: {
      canSendMessages: true,
      canSendMedia: true,
      canAddMembers: true,
      canDeleteForEveryone: true,
      canBanUsers: true,
      canChangeProfile: true,
      canComment: true
    }
  }
};

export interface MeshNode {
  id: string;
  displayName: string;
  photoURL?: string;
  x?: number;
  y?: number;
  lat?: number;
  lng?: number;
  isOnline?: boolean;
  status?: 'active' | 'relaying' | 'offline';
  rssi?: number;
  ping?: number;
  hops?: number;
  lastSeen?: string;
  publicKey?: string;
  address?: string;
  capabilities?: ('relay' | 'storage' | 'gateway')[];
  nodeType?: 'peer' | 'relay' | 'bot' | 'me';
  transportType?: 'ble' | 'webrtc' | 'websocket' | 'broadcast_channel' | 'hybrid_bridge';
  estimatedModemRangeMeters?: number;
  isBridge?: boolean;
  carriedPacketCount?: number;
  hardwareModel?: string;
}
