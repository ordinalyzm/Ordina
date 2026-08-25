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
  status: 'online' | 'offline' | 'away' | 'busy' | 'dnd';
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
  senderId: string;
  receiverId?: string;
  groupId?: string;
  text: string;
  type: 'text' | 'image' | 'video' | 'file' | 'poll' | 'game' | 'sticker' | 'audio';
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
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
  status?: 'sent' | 'delivered' | 'read';
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
  bannedUsers: string[];
  bannedFromComments?: string[]; // List of UIDs banned from commenting
  permissions: {
    member: GroupPermissions;
    admin: GroupPermissions;
  };
  createdTitles?: UserTitle[]; // Global titles created by the owner
}

export interface MeshNode {
  id: string;
  displayName: string;
  x?: number;
  y?: number;
  lat?: number;
  lng?: number;
  isOnline: boolean;
}
