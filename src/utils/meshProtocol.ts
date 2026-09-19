// src/utils/meshProtocol.ts

export type PacketType = 
  | 'HANDSHAKE_REQ'    // Запрос авторизации в зоне видимости
  | 'HANDSHAKE_RESP'   // Ответ с открытым ключом и именем
  | 'ROUTING_TABLE'    // Обмен известными цепочками (кто через кого доступен)
  | 'MESSAGE'          // Пользовательские зашифрованные данные
  | 'MULE_SYNC_HAVE'   // "Почтальон": список ID сообщений, которые есть на борту
  | 'MULE_SYNC_WANT';  // "Почтальон": запрос недостающих сообщений

export interface MeshPacket {
  id: string;              // UUID пакета для дедупликации
  fromId: string;          // Persistent User ID автора
  toId: string;            // Persistent User ID адресата (или '*' для всех)
  type: PacketType;
  payload: string;         // E2EE зашифрованный текст или системный JSON
  senderName: string;      // Отображаемое имя
  ts: number;              // Timestamp создания
  ttl: number;             // Оставшееся число прыжков (Time To Live)
  hops: number;            // Сколько хопов уже пройдено
  route: string[];         // Цепочка узлов [nodeA, nodeB] для защиты от петель
  signature?: string;      // ЭЦП (опционально)
}

export interface RouteEntry {
  targetUserId: string;
  nextHopEndpoint: string; // Через какой физический линк слать
  hops: number;            // Дистанция
  lastSeen: number;
}
