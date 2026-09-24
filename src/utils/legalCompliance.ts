/**
 * Legal Compliance Checker ("Правовой щит Ordina")
 * 
 * 100% клиентский локальный анализ текста на соответствие нормам
 * законодательства Российской Федерации (УК РФ, КоАП РФ, 152-ФЗ).
 * 
 * ВАЖНО: Никакие данные никуда не отправляются! Анализ работает 
 * исключительно в браузере / на устройстве пользователя.
 * Пользователь может в любой момент включить или выключить данную
 * функцию в Настройках приложения.
 */

export interface LegalRiskItem {
  id: string;
  category: 'extremism' | 'insult' | 'defamation' | 'doxing' | 'drugs' | 'fraud' | 'violence' | 'copyright';
  severity: 'low' | 'medium' | 'high';
  title: string;
  article: string;
  description: string;
  recommendation: string;
  matchedKeywords: string[];
}

export interface LegalScanResult {
  hasRisk: boolean;
  maxSeverity: 'safe' | 'low' | 'medium' | 'high';
  risks: LegalRiskItem[];
}

interface KeywordRule {
  category: LegalRiskItem['category'];
  severity: LegalRiskItem['severity'];
  title: string;
  article: string;
  description: string;
  recommendation: string;
  patterns: RegExp[];
}

const LEGAL_RULES: KeywordRule[] = [
  {
    category: 'insult',
    severity: 'medium',
    title: 'Нецензурная брань / Оскорбление чести и достоинства',
    article: 'Ст. 5.61, 20.1 КоАП РФ',
    description: 'Использование ненормативной лексики (мата) или унижение чести и достоинства в неприличной форме.',
    recommendation: 'Исключите бранные выражения и оскорбления. Изложите мысль уважительно и конструктивно без перехода на личности.',
    patterns: [
      // Базовые корни русского мата и производные с честными Unicode границами слов
      /(?<![\p{L}\p{N}_])(ху[йияеё]|ху[её]в\w*|ху[её]сос\w*|поху[йия]\w*|наху[йия]|заху[яе]\w*|ни[ху][яе]\w*)(?![\p{L}\p{N}_])/iu,
      /(?<![\p{L}\p{N}_])(пизд[аеёиыуя]\w*|распизд\w*|отпизд\w*|пиздец\w*|пиздабол\w*|пиздюк\w*|пиздят)(?![\p{L}\p{N}_])/iu,
      /(?<![\p{L}\p{N}_])(еб[аеёиу]\\w*|ебл\w*|ебн\w*|ебать\w*|заеб\w*|выеб\w*|доеб\w*|поеб\w*|въеб\w*|уеб\w*|разъеб\w*|ебуч\w*)(?![\p{L}\p{N}_])/iu,
      /(?<![\p{L}\p{N}_])(бля[дт]\w*|блять|бляди|блядств\w*)(?![\p{L}\p{N}_])/iu,
      /(?<![\p{L}\p{N}_])(сук[аиое]\w*|сучар\w*|сучк\w*)(?![\p{L}\p{N}_])/iu,
      /(?<![\p{L}\p{N}_])(мудак\w*|мудил\w*|гондон\w*|гандон\w*|пидор\w*|пидарас\w*|педик\w*|пидрила\w*)(?![\p{L}\p{N}_])/iu,
      /(?<![\p{L}\p{N}_])(шлюх\w*|шалав\w*|проститут\w*|ублюд[окае]\w*|мраз[ьие]\w*|твар[ьие]\w*|выродок\w*|чмошник\w*|даун\w*)(?![\p{L}\p{N}_])/iu,
      /(?<![\p{L}\p{N}_])(пошел|иди)\s+на\s*(хуй|хер)\w*/iu,
      /(?<![\p{L}\p{N}_])ты\s+(урод|мразь|тварь|шлюха|пидор|ублюдок|гондон|чмо|дебил|идиот)\w*/iu
    ]
  },
  {
    category: 'extremism',
    severity: 'high',
    title: 'Призывы к экстремизму / разжигание ненависти',
    article: 'Ст. 280, 282 УК РФ',
    description: 'Публичные призывы к экстремистской деятельности, возбуждение ненависти либо вражды по признакам национальности, расы, религии.',
    recommendation: 'Исключите агрессивные обобщения и враждебную риторику в отношении социальных или этнических групп.',
    patterns: [
      /(?<![\p{L}\p{N}_])(смерть|убивать|резать|вешать|уничтожать)\s+(русских|украинцев|кавказцев|евреев|мигрантов|чурок|хачей|хохлов|москалей)/iu,
      /(?<![\p{L}\p{N}_])(бей|мочи|дави)\s+(чурок|хачей|хохлов|москалей|жидов)/iu,
      /(?<![\p{L}\p{N}_])(террористическ\w+|диверси\w+|взорвать|бомбу|подрыв)\s+(мост|вокзал|метро|здание|администраци\w+|пути)/iu,
      /(?<![\p{L}\p{N}_])(вступайте|присоединяйтесь)\s+в\s+(игил|азов|ргк|легион)/iu
    ]
  },
  {
    category: 'violence',
    severity: 'high',
    title: 'Угрозы причинения вреда здоровью или убийством',
    article: 'Ст. 119 УК РФ',
    description: 'Угроза убийством или причинением тяжкого вреда здоровью.',
    recommendation: 'Любые прямые физические угрозы недопустимы. Держите диалог в рамках ненасильственного общения.',
    patterns: [
      /(?<![\p{L}\p{N}_])(я\s+тебя|мы\s+тебя)\s+(убью|зарежу|найду\s+и\s+убью|закопаю|прикончу|порежу)/iu,
      /(?<![\p{L}\p{N}_])тебе\s+(пизда|конец|смерть)\s*,?\s*жди\s+нас/iu,
      /(?<![\p{L}\p{N}_])(переломаю|выбью)\s+(ноги|руки|зубы|череп)/iu
    ]
  },
  {
    category: 'doxing',
    severity: 'high',
    title: 'Незаконная публикация персональных данных (Доксинг)',
    article: 'Ст. 137 УК РФ, 152-ФЗ',
    description: 'Нарушение неприкосновенности частной жизни, распространение паспортных данных, адресов проживания, телефонов.',
    recommendation: 'Никогда не публикуйте чужие паспорта, адреса проживания и конфиденциальные данные без согласия их владельца.',
    patterns: [
      /(?<![\p{L}\p{N}_])пасп(орт)?\s*(серия|\d{2}\s*\d{2})\s*\d{6}/iu,
      /(?<![\p{L}\p{N}_])(сливаю|деанон|пробив|слив)\s+(данных|адреса|номера|паспорта|родных)/iu,
      /(?<![\p{L}\p{N}_])(вот\s+его|вот\s+ее)\s+(адрес|телефон|прописка|паспорт)/iu,
      /(?<![\p{L}\p{N}_])г\.\s*[А-Яа-я\-]+,\s*ул\.\s*[А-Яа-я0-9\-]+,\s*д\.\s*\d+/iu
    ]
  },
  {
    category: 'drugs',
    severity: 'high',
    title: 'Пропаганда или оборот запрещенных веществ',
    article: 'Ст. 228.1 УК РФ, ст. 6.13 КоАП РФ',
    description: 'Упоминания закладок, покупки или распространения наркотических средств.',
    recommendation: 'Любые темы, связанные с приобретением или рекламой запрещенных веществ, строго запрещены.',
    patterns: [
      /(?<![\p{L}\p{N}_])(закладк\w+|клад|магнит|прикоп)\s+(меф|соль|фен|шишки|гаш|героин|кокаин|alpha-pvp)/iu,
      /(?<![\p{L}\p{N}_])(купить|продать|взять)\s+(меф|соли|шишки|бошки|гашиш|экстази|мдма|лсд)/iu,
      /(?<![\p{L}\p{N}_])(гидра|солярис|kraken|blackpr)\b/iu,
      /(?<![\p{L}\p{N}_])ищу\s+курьера\s+(на\s+закладки|склад|мск|спб)/iu
    ]
  },
  {
    category: 'fraud',
    severity: 'medium',
    title: 'Мошенничество, фишинг и вымогательство',
    article: 'Ст. 159, 163 УК РФ',
    description: 'Хищение чужого имущества, требование передачи конфиденциальных банковских данных или кодов.',
    recommendation: 'Не запрашивайте CVV/CVC коды, коды из СМС и не принуждайте к переводам.',
    patterns: [
      /(?<![\p{L}\p{N}_])(назови|скинь|скажи)\s+(код\s+из\s+смс|cvv|cvc|пароль\s+от\s+банка)/iu,
      /(?<![\p{L}\p{N}_])(переведи|плати)\s+(деньги|крипту)\s+иначе\s+(разошлю|солью|узнают)/iu,
      /(?<![\p{L}\p{N}_])служба\s+безопасности\s+(сбербанка|банка|фсб|мвд)/iu
    ]
  },
  {
    category: 'defamation',
    severity: 'medium',
    title: 'Клевета и распространение заведомо ложных сведений',
    article: 'Ст. 128.1 УК РФ',
    description: 'Распространение заведомо ложных сведений, порочащих честь и достоинство другого лица.',
    recommendation: 'Если у вас нет официальных подтверждений или решения суда, используйте оценочные суждения.',
    patterns: [
      /(?<![\p{L}\p{N}_])(он|она)\s+(вор|педофил|мошенник|взяточник|убийца)/iu,
      /(?<![\p{L}\p{N}_])украл(а)?\s+деньги\s+из\s+бюджета/iu,
      /(?<![\p{L}\p{N}_])(берет|брал)\s+взятки/iu
    ]
  }
];

export function isLegalShieldEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const stored = localStorage.getItem('ordina_legal_shield_enabled');
  if (stored === null) return true; // Enabled by default for safety
  return stored === 'true';
}

export function setLegalShieldEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('ordina_legal_shield_enabled', enabled ? 'true' : 'false');
  window.dispatchEvent(new CustomEvent('ordina:legal_shield_changed', { detail: { enabled } }));
}

/**
 * Быстрое сканирование текста сообщения на правовые риски (100% локально).
 */
export function checkTextCompliance(text: string): LegalScanResult {
  if (!text || typeof text !== 'string' || text.trim().length < 2) {
    return { hasRisk: false, maxSeverity: 'safe', risks: [] };
  }

  const cleanText = text.trim();
  const detectedRisks: LegalRiskItem[] = [];

  for (const rule of LEGAL_RULES) {
    const matchedWords: string[] = [];
    for (const pattern of rule.patterns) {
      const match = cleanText.match(pattern);
      if (match) {
        matchedWords.push(match[0]);
      }
    }

    if (matchedWords.length > 0) {
      detectedRisks.push({
        id: rule.category + '_' + Date.now(),
        category: rule.category,
        severity: rule.severity,
        title: rule.title,
        article: rule.article,
        description: rule.description,
        recommendation: rule.recommendation,
        matchedKeywords: Array.from(new Set(matchedWords))
      });
    }
  }

  if (detectedRisks.length === 0) {
    return { hasRisk: false, maxSeverity: 'safe', risks: [] };
  }

  let maxSev: LegalScanResult['maxSeverity'] = 'low';
  if (detectedRisks.some(r => r.severity === 'high')) {
    maxSev = 'high';
  } else if (detectedRisks.some(r => r.severity === 'medium')) {
    maxSev = 'medium';
  }

  return {
    hasRisk: true,
    maxSeverity: maxSev,
    risks: detectedRisks
  };
}

export const scanTextForLegalRisks = checkTextCompliance;
