// src/services/chatDispatcher.ts
import { MeshTransport } from '../utils/meshTransport';
import { saveMessage } from '../utils/localCache';

export async function sendMessageUnified(
  text: string,
  chatId: string,
  targetUidOrGroupId: string,
  isGroup: boolean,
  currentUser: { uid: string; displayName?: string },
  socket: any
) {
  const msgId = `${currentUser.uid}_${Date.now()}`;
  const outgoingMessage = {
    id: msgId,
    chatId: chatId,
    senderId: currentUser.uid,
    senderName: currentUser.displayName || 'Пользователь',
    receiverId: isGroup ? undefined : targetUidOrGroupId,
    groupId: isGroup ? targetUidOrGroupId : undefined,
    text: text,
    content: text,
    createdAt: new Date().toISOString(),
    deliveryStatus: 'pending',
    status: 'pending'
  };

  // 1. Сохраняем сразу себе в локальную SQLite БД
  await saveMessage(outgoingMessage as any);

  // 2. Если есть интернет — пушим на сервер сокета
  if (socket && socket.connected) {
    try {
      socket.emit('chat:message', outgoingMessage);
    } catch (_) {}
  }

  // 3. Параллельно всегда шлем в радиоэфир BLE (для тех, кто рядом без интернета)
  await MeshTransport.sendMeshMessage(targetUidOrGroupId, outgoingMessage, isGroup);
}
