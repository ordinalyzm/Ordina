import { v4 as uuidv4 } from 'uuid';
import { BotConfig, BotRule } from '../components/BotConstructor';

/**
 * Generates standalone Python bot code compatible with modern aiogram 3.x / Telegram API.
 */
export function generateBotPython(bot: BotConfig): string {
  const botName = bot.name || 'OrdinaBot';
  const rules = bot.rules || [];

  let code = `"""
${botName} - Telegram / Ordina Bot
Сгенерировано в конструкторе Ордина
"""

import asyncio
import logging
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command

# Вставьте ваш API токен бота, полученный у @BotFather
BOT_TOKEN = "YOUR_BOT_TOKEN_HERE"

logging.basicConfig(level=logging.INFO)
bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()

`;

  // Process rules
  rules.forEach((rule, idx) => {
    const trigger = rule.trigger;
    const actions = rule.actions || [];
    const textAction = actions.find(a => a.type === 'send_message' || a.type === 'check_balance');
    const responseText = textAction?.params?.text || 'Здравствуйте!';

    if (trigger.type === 'command') {
      const cmd = (trigger.params?.command || 'start').replace(/^\//, '');
      code += `@dp.message(Command("${cmd}"))
async def handle_cmd_${cmd}_${idx}(message: types.Message):
    """Обработчик команды /${cmd}"""
    await message.answer("""${responseText.replace(/"/g, '\\"')}""")

`;
    } else if (trigger.type === 'text') {
      const txt = trigger.params?.text || '';
      code += `@dp.message(F.text.contains("${txt.replace(/"/g, '\\"')}"))
async def handle_text_${idx}(message: types.Message):
    """Обработчик текста с упоминанием: ${txt}"""
    await message.answer("""${responseText.replace(/"/g, '\\"')}""")

`;
    } else if (trigger.type === 'regex') {
      const pattern = trigger.params?.pattern || '.*';
      code += `@dp.message(F.text.regexp(r"${pattern}"))
async def handle_regex_${idx}(message: types.Message):
    """Обработчик по регулярному выражению: ${pattern}"""
    await message.answer("""${responseText.replace(/"/g, '\\"')}""")

`;
    } else if (trigger.type === 'new_member') {
      code += `@dp.message(F.new_chat_members)
async def handle_new_member_${idx}(message: types.Message):
    """Приветствие нового участника"""
    await message.answer("""${responseText.replace(/"/g, '\\"')}""")

`;
    }
  });

  // Default fallback if no rules
  if (rules.length === 0) {
    code += `@dp.message(Command("start"))
async def cmd_start(message: types.Message):
    await message.answer("Привет! Я бот ${botName}, запущенный из Ордины.")

`;
  }

  code += `async def main():
    print("Бот ${botName} успешно запущен и ожидает сообщений...")
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
`;

  return code;
}

/**
 * Generates standalone TypeScript / Node.js bot code using grammY / Telegraf.
 */
export function generateBotTypeScript(bot: BotConfig): string {
  const botName = bot.name || 'OrdinaBot';
  const rules = bot.rules || [];

  let code = `/**
 * ${botName} - Telegram & Ordina Node.js Bot
 * Сгенерировано в конструкторе Ордина
 */

import { Bot } from "grammy";

// Укажите токен бота от @BotFather
const BOT_TOKEN = process.env.BOT_TOKEN || "YOUR_BOT_TOKEN_HERE";
const bot = new Bot(BOT_TOKEN);

`;

  rules.forEach((rule, idx) => {
    const trigger = rule.trigger;
    const actions = rule.actions || [];
    const textAction = actions.find(a => a.type === 'send_message' || a.type === 'check_balance');
    const responseText = textAction?.params?.text || 'Здравствуйте!';

    if (trigger.type === 'command') {
      const cmd = (trigger.params?.command || 'start').replace(/^\//, '');
      code += `// Команда /${cmd}
bot.command("${cmd}", async (ctx) => {
  await ctx.reply(\`${responseText.replace(/`/g, '\\`')}\`);
});

`;
    } else if (trigger.type === 'text') {
      const txt = trigger.params?.text || '';
      code += `// Обработка фразы: ${txt}
bot.hears(/${txt}/i, async (ctx) => {
  await ctx.reply(\`${responseText.replace(/`/g, '\\`')}\`);
});

`;
    } else if (trigger.type === 'new_member') {
      code += `// Приветствие новых участников
bot.on("message:new_chat_members", async (ctx) => {
  await ctx.reply(\`${responseText.replace(/`/g, '\\`')}\`);
});

`;
    }
  });

  if (rules.length === 0) {
    code += `bot.command("start", async (ctx) => {
  await ctx.reply("Привет! Я бот ${botName}, перенесённый из Ордины.");
});

`;
  }

  code += `bot.start();
console.log("Бот ${botName} запущен в Node.js / TypeScript!");
`;

  return code;
}

/**
 * Generates portable JSON configuration for importing into other Ordina instances.
 */
export function generateBotJson(bot: BotConfig): string {
  return JSON.stringify(bot, null, 2);
}

/**
 * Parses raw code, JSON, or Telegram command descriptions into an Ordina BotConfig.
 */
export function parseBotFromTelegramCode(rawInput: string, currentBot?: Partial<BotConfig>): {
  bot: BotConfig;
  importedRulesCount: number;
} {
  const trimmed = (rawInput || '').trim();
  const baseId = currentBot?.id || uuidv4();
  let botName = currentBot?.name || 'Импортированный бот';
  let botDesc = currentBot?.description || '';
  const parsedRules: BotRule[] = [];

  // 1. Try parsing directly as JSON
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const json = JSON.parse(trimmed);
      if (json.rules && Array.isArray(json.rules)) {
        return {
          bot: {
            ...json,
            id: json.id || baseId,
            name: json.name || botName,
            isActive: json.isActive ?? true,
            triggers: json.triggers || [],
            conditions: json.conditions || [],
            actions: json.actions || [],
            rules: json.rules
          },
          importedRulesCount: json.rules.length
        };
      }
    } catch (e) {}
  }

  // 2. Parse Python Telegram code (aiogram / telebot / python-telegram-bot)
  // Look for: Command("..."), commands=['...'], bot.command("..."), message.answer("...")
  const pyCommandRegex = /@(?:dp|bot)\.message\s*\(\s*(?:Command\(\s*["']([^"']+)["']\)|commands\s*=\s*\[["']([^"']+)["']\])/gi;
  let pyMatch;
  const commandIndices: { cmd: string; index: number }[] = [];

  while ((pyMatch = pyCommandRegex.exec(trimmed)) !== null) {
    const cmd = pyMatch[1] || pyMatch[2];
    if (cmd) {
      commandIndices.push({ cmd, index: pyMatch.index });
    }
  }

  // Also check Telebot style: @bot.message_handler(commands=['start', 'help'])
  const telebotRegex = /@bot\.message_handler\s*\(\s*commands\s*=\s*\[([^\]]+)\]/gi;
  let tbMatch;
  while ((tbMatch = telebotRegex.exec(trimmed)) !== null) {
    const cmdsStr = tbMatch[1];
    const cmds = cmdsStr.split(',').map(s => s.replace(/['"\s]/g, '')).filter(Boolean);
    cmds.forEach(cmd => {
      commandIndices.push({ cmd, index: tbMatch!.index });
    });
  }

  // Also check JavaScript/TypeScript: bot.command('...', ...)
  const jsCommandRegex = /bot\.command\s*\(\s*["']([^"']+)["']/gi;
  let jsMatch;
  while ((jsMatch = jsCommandRegex.exec(trimmed)) !== null) {
    commandIndices.push({ cmd: jsMatch[1], index: jsMatch.index });
  }

  // For each found command, find the following answer/reply text in that function
  if (commandIndices.length > 0) {
    // Sort by appearance index
    commandIndices.sort((a, b) => a.index - b.index);

    for (let i = 0; i < commandIndices.length; i++) {
      const item = commandIndices[i];
      const nextIndex = i + 1 < commandIndices.length ? commandIndices[i + 1].index : trimmed.length;
      const functionChunk = trimmed.slice(item.index, nextIndex);

      // Look for answer string: message.answer("..."), ctx.reply("..."), bot.send_message(..., "...")
      let replyText = `Ответ на команду /${item.cmd}`;
      const replyMatch = functionChunk.match(/(?:message\.answer|ctx\.reply|bot\.send_message|await\s+message\.reply)\s*\(\s*(?:"""([\s\S]*?)"""|'''([\s\S]*?)'''|"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|`([^`\\]*(?:\\.[^`\\]*)*)`)/i);

      if (replyMatch) {
        replyText = replyMatch[1] || replyMatch[2] || replyMatch[3] || replyMatch[4] || replyMatch[5] || replyText;
        // Clean escapes
        replyText = replyText.replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\n/g, '\n');
      }

      parsedRules.push({
        id: uuidv4(),
        trigger: {
          id: uuidv4(),
          type: 'command',
          params: { command: `/${item.cmd}` }
        },
        actions: [
          {
            id: uuidv4(),
            type: 'send_message',
            params: { text: replyText.trim() },
            order: 0
          }
        ]
      });
    }
  }

  // 3. Fallback: Parse BotFather command list format:
  // e.g.:
  // start - Главное меню
  // help - Справка и помощь
  // catalog - Каталог товаров
  if (parsedRules.length === 0) {
    const lines = trimmed.split(/\r?\n/);
    for (const line of lines) {
      const cleaned = line.trim();
      const listMatch = cleaned.match(/^[\/]?([a-zA-Z0-9_]{2,32})\s*[-—:]\s*(.+)$/);
      if (listMatch) {
        const cmd = listMatch[1];
        const desc = listMatch[2].trim();
        parsedRules.push({
          id: uuidv4(),
          trigger: {
            id: uuidv4(),
            type: 'command',
            params: { command: `/${cmd}` }
          },
          actions: [
            {
              id: uuidv4(),
              type: 'send_message',
              params: { text: `${desc} (Команда /${cmd})` },
              order: 0
            }
          ]
        });
      }
    }
  }

  // Default fallback if nothing detected
  if (parsedRules.length === 0) {
    parsedRules.push({
      id: uuidv4(),
      trigger: {
        id: uuidv4(),
        type: 'command',
        params: { command: '/start' }
      },
      actions: [
        {
          id: uuidv4(),
          type: 'send_message',
          params: { text: trimmed.slice(0, 300) || 'Здравствуйте! Я бот Ордины.' },
          order: 0
        }
      ]
    });
  }

  const resultBot: BotConfig = {
    id: baseId,
    name: currentBot?.name || (commandIndices.length > 0 ? `Telegram Бот (${commandIndices.length} ком.)` : botName),
    description: currentBot?.description || botDesc || 'Импортирован из Telegram кода',
    username: currentBot?.username || `tgbot_${Math.floor(1000 + Math.random() * 9000)}`,
    avatarUrl: currentBot?.avatarUrl,
    isActive: true,
    triggers: [],
    conditions: [],
    actions: [],
    rules: parsedRules
  };

  return {
    bot: resultBot,
    importedRulesCount: parsedRules.length
  };
}
