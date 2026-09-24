// src/types/mesh.ts

export type MeshPacketType = 'text' | 'ack_read' | 'ack_delivered';

export interface MeshPacket {
  id: string;              // Уникальный ID сообщения
  type: MeshPacketType;    // Тип пакета: текст, подтверждение прочтения или доставки
  senderId: string;        // UID создателя
  senderName: string;      // Никнейм создателя для отображения
  receiverId?: string;     // UID адресата (для личных чатов)
  groupId?: string;        // ID группы (для групповых чатов)
  chatId: string;          // ID диалога
  encryptedPayload?: string;// Зашифрованный текст (почтальон не имеет ключа!)
  readMessageIds?: string[];// Список ID прочитанных сообщений (для ack_read)
  createdAt: string;       // Дата создания
  ttl: number;             // Оставшееся число скачков (по умолчанию 4-5)
  hops: number;            // Число уже пройденных скачков (начинается с 0)
  relayPath: string[];     // Список UID узлов, исключающий зацикливание
  isInternetBridge?: boolean; // Флаг: передан ли через интернет-шлюз
  text?: string;           // Опциональный плейнтекст для обратной совместимости
  content?: string;
}

export interface PeerNode {
  uid: string;
  id?: string;             // UID alias
  mac: string;
  name: string;
  hops: number;            // 1 = напрямую, 2 = через соседа, 3 = меш
  viaMac?: string;         // Через кого доступен
  lastSeen: number;
  isResolved?: boolean;
  transport?: 'ble' | 'lan' | 'wifi' | 'web';
  ip?: string;
  rssi?: number;
}

export type DiscoveredPeer = PeerNode;
