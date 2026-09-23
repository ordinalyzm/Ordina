/**
 * Legal Compliance Checker ("Правовой щит" / "Соучастник")
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
    category: 'extremism',
    severity: 'high',
    title: 'Призывы к экстремизму / разжигание ненависти',
    article: 'Ст. 280, 282 УК РФ',
    description: 'Публичные призывы к экстремистской деятельности, возбуждение ненависти либо вражды по признакам национальности, расы, религии.',
    recommendation: 'Исключите агрессивные обобщения и враждебную риторику в отношении социальных или этнических групп. Выражайте позицию в рамках правовой дискуссии.',
    patterns: [
      /\b(смерть|убивать|резать|вешать|уничтожать)\s+(русских|украинцев|кавказцев|евреев|мигрантов|чурок|хачей|хохлов|москалей)\b/iu,
      /\b(бей|мочи|дави)\s+(чурок|хачей|хохлов|москалей|жидов)\b/iu,
      /\b(террористическ\w+|диверси\w+|взорвать|бомбу|подрыв)\s+(мост|вокзал|метро|здание|администраци\w+|пути)\b/iu,
      /\b(вступайте|присоединяйтесь)\s+в\s+(игил|азов|ргк|легион)\b/iu
    ]
  },
  {
    category: 'insult',
    severity: 'medium',
    title: 'Оскорбление чести и достоинства',
    article: 'Ст. 5.61 КоАП РФ',
    description: 'Оскорбление, то есть унижение чести и достоинства другого лица, выраженное в неприличной или иной противоречащей общепринятым нормам форме.',
    recommendation: 'Замените нецензурные или уничижительные выражения на конструктивную критику поступков или аргументов без перехода на личности.',
    patterns: [
      /\bты\s+(урод|мразь|тварина|шлюха|пидор|ублюдок|гондон|даун|конченый|чмо)\b/iu,
      /\b(пошел|иди)\s+на\s*(хуй|хер)\b/iu,
      /\b(сука|тварь|мразь)\s+ты\b/iu,
      /\bебать\s+ты\s+(лох|тупой|дебил)\b/iu
    ]
  },
  {
    category: 'defamation',
    severity: 'medium',
    title: 'Клевета и распространение заведомо ложных сведений',
    article: 'Ст. 128.1 УК РФ',
    description: 'Распространение заведомо ложных сведений, порочащих честь и достоинство другого лица или подрывающих его репутацию.',
    recommendation: 'Если у вас нет официальных подтверждений или решения суда, используйте формулировки «по моему оценочному суждению» или воздержитесь от обвинений.',
    patterns: [
      /\b(он|она)\s+(вор|педофил|мошенник|взяточник|убийца)\b/iu,
      /\bукрал(а)?\s+деньги\s+из\s+бюджета\b/iu,
      /\b(берет|брал)\s+взятки\b/iu
    ]
  },
  {
    category: 'doxing',
    severity: 'high',
    title: 'Незаконный сбор и публикация персональных данных (Доксинг)',
    article: 'Ст. 137 УК РФ, 152-ФЗ',
    description: 'Нарушение неприкосновенности частной жизни, незаконное распространение паспортных данных, адресов проживания, номеров телефонов без согласия.',
    recommendation: 'Никогда не публикуйте чужие паспорта, адреса проживания и конфиденциальные данные без согласия их владельца.',
    patterns: [
      /\bпасп(орт)?\s*(серия|\d{2}\s*\d{2})\s*\d{6}\b/iu,
      /\b(сливаю|деанон|пробив|слив)\s+(данных|адреса|номера|паспорта|родных)\b/iu,
      /\b(вот\s+его|вот\s+ее)\s+(адрес|телефон|прописка|паспорт)\b/iu,
      /\bг\.\s*[А-Яа-я\-]+,\s*ул\.\s*[А-Яа-я0-9\-]+,\s*д\.\s*\d+\b/iu
    ]
  },
  {
    category: 'drugs',
    severity: 'high',
    title: 'Пропаганда или незаконный оборот наркотических средств',
    article: 'Ст. 228.1 УК РФ, ст. 6.13 КоАП РФ',
    description: 'Незаконное производство, сбыт, реклама или пересылка наркотических средств, психотропных веществ или их прекурсоров (включая упоминания закладок).',
    recommendation: 'Любые темы, связанные с приобретением, координатами или рекламой запрещенных веществ, строго запрещены законом и правилами платформы.',
    patterns: [
      /\b(закладк\w+|клад|магнит|прикоп)\s+(меф|соль|фен|шишки|гаш|героин|кокаин|alpha-pvp)\b/iu,
      /\b(купить|продать|взять)\s+(меф|соли|шишки|бошки|гашиш|экстази|мдма|лсд)\b/iu,
      /\b(гидра|мега|солярис|kraken|blackpr)\b/iu,
      /\bищу\s+курьера\s+(на\s+закладки|склад|мск|спб)\b/iu
    ]
  },
  {
    category: 'fraud',
    severity: 'medium',
    title: 'Мошенничество, фишинг и вымогательство',
    article: 'Ст. 159, 163 УК РФ',
    description: 'Хищение чужого имущества или приобретение права на чужое имущество путем обмана или злоупотребления доверием, требование передачи денег под угрозой.',
    recommendation: 'Не запрашивайте CVV/CVC коды, коды из СМС и не принуждайте к денежным переводам под предлогом блокировки или шантажа.',
    patterns: [
      /\b(назови|скинь|скажи)\s+(код\s+из\s+смс|cvv|cvc|пароль\s+от\s+банка)\b/iu,
      /\b(переведи|плати)\s+(деньги|крипту)\s+иначе\s+(разошлю|солью|узнают)\b/iu,
      /\bслужба\s+безопасности\s+(сбербанка|банка|фсб|мвд)\b/iu
    ]
  },
  {
    category: 'violence',
    severity: 'high',
    title: 'Угрозы причинения тяжкого вреда здоровью или убийством',
    article: 'Ст. 119 УК РФ',
    description: 'Угроза убийством или причинением тяжкого вреда здоровью, если имелись основания опасаться осуществления этой угрозы.',
    recommendation: 'Любые прямые физические угрозы недопустимы. Держите дискуссию в рамках ненасильственного общения.',
    patterns: [
      /\b(я\s+тебя|мы\s+тебя)\s+(убью|зарежу|найду\s+и\s+убью|закопаю|прикончу|порежу)\b/iu,
      /\bтебе\s+(пизда|конец|смерть)\s+жди\s+нас\b/iu
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
  if (!text || typeof text !== 'string' || text.trim().length < 3) {
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
