import { Message } from '../types';

/**
 * Normalizes any incoming message from Mesh, BLE, WebRTC, or Socket
 * to ensure bidirectional compatibility between `text` and `content`,
 * correct `chatId` derivation, and accurate message `type`.
 */
export function normalizeIncomingMeshMessage(rawMsg: any, myUid?: string): Message {
  if (!rawMsg) {
    return {
      id: 'msg_' + Date.now(),
      senderId: myUid || 'anonymous',
      text: '',
      content: '',
      type: 'text',
      createdAt: new Date().toISOString()
    };
  }

  // 1. Resolve text vs content conflict
  const textContent = (typeof rawMsg.text === 'string' && rawMsg.text.length > 0)
    ? rawMsg.text
    : (typeof rawMsg.content === 'string' && rawMsg.content.length > 0)
      ? rawMsg.content
      : (typeof rawMsg.text === 'string' ? rawMsg.text : (typeof rawMsg.content === 'string' ? rawMsg.content : ''));

  // 2. Guarantee proper chatId for 1-to-1 dialogs, groups, and broadcasts
  let chatId = rawMsg.chatId;
  if (!chatId && rawMsg.groupId) {
    chatId = rawMsg.groupId;
  } else if (!chatId && rawMsg.senderId && rawMsg.receiverId) {
    if (rawMsg.senderId === rawMsg.receiverId) {
      chatId = rawMsg.senderId;
    } else {
      chatId = [rawMsg.senderId, rawMsg.receiverId].sort().join('_');
    }
  } else if (!chatId && rawMsg.senderId && myUid) {
    chatId = rawMsg.senderId === myUid ? (rawMsg.receiverId || myUid) : rawMsg.senderId;
  }

  // 3. Enforce valid message type: if there is no fileUrl and not sticker/poll/audio/video/image, default to 'text'
  let msgType = rawMsg.type || 'text';
  const hasFile = Boolean(rawMsg.fileUrl);
  if (!hasFile && (msgType === 'file' || !['sticker', 'poll', 'system', 'audio', 'voice', 'video', 'image', 'game'].includes(msgType))) {
    msgType = 'text';
  } else if (hasFile && !msgType) {
    msgType = 'file';
  }

  return {
    ...rawMsg,
    id: rawMsg.id || (window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : 'msg_' + Date.now()),
    chatId: chatId || 'mesh_broadcast',
    text: textContent,
    content: textContent,
    type: msgType,
    senderId: rawMsg.senderId || myUid || 'anonymous',
    createdAt: rawMsg.createdAt || new Date().toISOString(),
    status: rawMsg.status || 'delivered',
    deliveryStatus: rawMsg.deliveryStatus || rawMsg.status || 'delivered',
    ttl: rawMsg.ttl !== undefined ? rawMsg.ttl : 5,
    version: rawMsg.version || Date.now(),
    isMesh: true
  };
}
