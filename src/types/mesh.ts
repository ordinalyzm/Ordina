// src/types/mesh.ts

export type MeshPacketType = 'text' | 'ack_read' | 'ack_delivered' | 'packet';

export interface MeshPacket {
  id: string;                // Уникальный ID сообщения
  type?: MeshPacketType;     // 'text' или 'ack_read'
  senderId: string;          // Firebase UID автора
  senderName: string;        // Никнейм автора
  receiverId?: string;       // UID адресата (для личных чатов)
  groupId?: string;          // ID группы (для группового меша)
  chatId: string;            // ID диалога
  encryptedPayload?: string; // Зашифрованное тело (почтальон не может прочесть)
  readMessageIds?: string[]; // Массив прочитанных ID (для ack_read)
  createdAt: string;         // ISO 8601
  ttl?: number;              // Лимит скачков (Time-To-Live)
  hops: number;              // Пройдено скачков
  maxHops?: number;          // Максимальное число скачков
  relayPath?: string[];      // Список UID узлов для исключения петель
  isAck?: boolean;           // Флаг квитанции
  isInternetBridge?: boolean;// Флаг прохождения через интернет-шлюз
}

export interface PeerNode {
  id?: string;
  uid: string;
  mac?: string;
  name: string;
  hops: number;              // 1 = Напрямую, 2 = Через соседа, 3 = Дальний меш
  viaMac?: string;
  lastSeen: number;
  transport?: 'ble' | 'wifi' | 'radio' | 'p2p';
  ip?: string;
  rssi?: number;
}
