import { Message } from '../types';

/**
 * Calculates the ISO week string (e.g., "2026-W28") for a given date.
 */
export function getWeekYearString(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'unknown-week';
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/**
 * Saves a single message to the client's local weekly cache.
 */
export function saveMessageToLocalCache(chatId: string, msg: Message): void {
  try {
    const week = getWeekYearString(msg.createdAt);
    const key = `ordina_chat_${chatId}_week_${week}`;
    
    // Track weeks for this chat
    const weeksKey = `ordina_chat_${chatId}_weeks`;
    const weeksStr = localStorage.getItem(weeksKey);
    let weeks: string[] = [];
    if (weeksStr) {
      try {
        weeks = JSON.parse(weeksStr);
      } catch (e) {
        weeks = [];
      }
    }
    if (!weeks.includes(week)) {
      weeks.push(week);
      localStorage.setItem(weeksKey, JSON.stringify(weeks));
    }

    // Save/merge message
    const existingStr = localStorage.getItem(key);
    let msgs: Message[] = [];
    if (existingStr) {
      try {
        msgs = JSON.parse(existingStr);
      } catch (e) {
        msgs = [];
      }
    }

    const index = msgs.findIndex(m => m.id === msg.id);
    if (index !== -1) {
      msgs[index] = { ...msgs[index], ...msg };
    } else {
      msgs.push(msg);
    }

    // Sort by creation time
    msgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    localStorage.setItem(key, JSON.stringify(msgs));
  } catch (err) {
    console.error('[LocalCache] Error saving message to cache:', err);
  }
}

/**
 * Saves/merges an array of messages into the local weekly cache.
 */
export function saveMessagesToLocalCache(chatId: string, messages: Message[]): void {
  messages.forEach(msg => {
    saveMessageToLocalCache(chatId, msg);
  });
}

/**
 * Loads all cached messages for a given chat across all recorded weeks.
 */
export function loadMessagesFromLocalCache(chatId: string): Message[] {
  try {
    const weeksKey = `ordina_chat_${chatId}_weeks`;
    const weeksStr = localStorage.getItem(weeksKey);
    if (!weeksStr) return [];

    let weeks: string[] = [];
    try {
      weeks = JSON.parse(weeksStr);
    } catch (e) {
      return [];
    }

    let allMessages: Message[] = [];
    weeks.forEach(week => {
      const key = `ordina_chat_${chatId}_week_${week}`;
      const dataStr = localStorage.getItem(key);
      if (dataStr) {
        try {
          const msgs = JSON.parse(dataStr);
          if (Array.isArray(msgs)) {
            allMessages = allMessages.concat(msgs);
          }
        } catch (e) {
          console.error('[LocalCache] Error parsing weekly data for:', key);
        }
      }
    });

    // Remove duplicates
    const seen = new Set<string>();
    const unique: Message[] = [];
    allMessages.forEach(m => {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        unique.push(m);
      }
    });

    // Sort by creation time
    unique.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return unique;
  } catch (err) {
    console.error('[LocalCache] Error loading messages from cache:', err);
    return [];
  }
}

/**
 * Removes cached messages for a chat.
 */
export function clearChatLocalCache(chatId: string): void {
  try {
    const weeksKey = `ordina_chat_${chatId}_weeks`;
    const weeksStr = localStorage.getItem(weeksKey);
    if (weeksStr) {
      const weeks: string[] = JSON.parse(weeksStr);
      weeks.forEach(week => {
        localStorage.removeItem(`ordina_chat_${chatId}_week_${week}`);
      });
    }
    localStorage.removeItem(weeksKey);
  } catch (err) {
    console.error('[LocalCache] Error clearing chat cache:', err);
  }
}
