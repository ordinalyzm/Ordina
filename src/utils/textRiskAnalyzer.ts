import { PHRASE_RISK_RULES } from '../data/phraseRiskRules';
import { DetectedRisk, TextRiskAnalysis, RiskLevel } from '../types/legalShield';

export function analyzeTextForLegalRisks(text: string): TextRiskAnalysis {
  if (!text || !text.trim()) {
    return {
      hasRisks: false,
      score: 0,
      criticalCount: 0,
      warningCount: 0,
      infoCount: 0,
      risks: [],
      suggestedSafeText: text || ''
    };
  }

  const detectedRisks: DetectedRisk[] = [];
  let safeText = text;

  // Track matched regions to prevent double-replacement overlaps
  for (const rule of PHRASE_RISK_RULES) {
    const flags = new Set(rule.dangerPattern.flags);
    flags.add('g');
    const regex = new RegExp(rule.dangerPattern.source, Array.from(flags).join(''));

    let match: RegExpExecArray | null;
    let occurrences = 0;
    while ((match = regex.exec(text)) !== null && occurrences < 10) {
      occurrences++;
      const matchedString = match[0];
      const matchIndex = match.index;

      // Check if already covered by an identical range
      const alreadyCaptured = detectedRisks.some(
        (existing) =>
          Math.abs(existing.index - matchIndex) < 2 &&
          existing.matchedText.toLowerCase() === matchedString.toLowerCase()
      );

      if (!alreadyCaptured) {
        detectedRisks.push({
          id: `${rule.id}-${matchIndex}`,
          rule,
          matchedText: matchedString,
          index: matchIndex,
          length: matchedString.length,
          riskLevel: rule.riskLevel as RiskLevel,
          riskTitle: rule.riskTitle,
          riskDescription: rule.riskDescription,
          safeReplacement: rule.safeReplacement,
          constitutionArticle: rule.constitutionArticle,
          ukArticle: rule.ukArticle,
          koapArticle: rule.koapArticle,
          statutoryReference: rule.statutoryReference
        });
      }

      if (regex.lastIndex === matchIndex) {
        regex.lastIndex++;
      }
    }
  }

  // Generate suggested safe text
  if (detectedRisks.length > 0) {
    // If text is predominantly the violation, replace with highest-severity safeReplacement
    const primaryRisk = detectedRisks[0];
    const isShortSentence = text.trim().length <= primaryRisk.matchedText.length + 15;

    if (isShortSentence) {
      safeText = primaryRisk.safeReplacement;
    } else {
      // Replace offending parts cleanly
      let replaced = text;
      for (const r of detectedRisks) {
        const escaped = r.matchedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const rRegex = new RegExp(`\\b${escaped}\\b`, 'gi');
        replaced = replaced.replace(rRegex, '').replace(/\s{2,}/g, ' ').trim();
      }
      safeText = replaced || primaryRisk.safeReplacement;
    }
  }

  let criticalCount = 0;
  let warningCount = 0;
  let infoCount = 0;

  for (const r of detectedRisks) {
    if (r.riskLevel === 'critical') criticalCount++;
    else if (r.riskLevel === 'warning') warningCount++;
    else infoCount++;
  }

  // Calculate danger score (0 - 100)
  const rawScore = (criticalCount * 45) + (warningCount * 25) + (infoCount * 10);
  const score = Math.min(100, rawScore);

  return {
    hasRisks: detectedRisks.length > 0,
    score,
    criticalCount,
    warningCount,
    infoCount,
    risks: detectedRisks,
    suggestedSafeText: safeText
  };
}

/**
 * Removes dangerous matched fragments from the message, leaving safe words
 */
export function removeOffendingWordsFromText(text: string, risks: DetectedRisk[]): string {
  if (!text || !risks.length) return text;
  let cleaned = text;
  for (const r of risks) {
    const escaped = r.matchedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(`\\b${escaped}\\b`, 'gi');
    cleaned = cleaned.replace(rx, '');
  }
  return cleaned.replace(/\s{2,}/g, ' ').replace(/^\s*[,.;:-]+\s*/, '').trim();
}

/**
 * Asynchronously checks text against Gemini AI on the server.
 * Returns DetectedRisk or null if text is legal.
 */
export async function checkTextWithAi(text: string): Promise<DetectedRisk | null> {
  if (!text || !text.trim() || text.trim().length < 3) return null;
  try {
    const res = await fetch('/api/legal-shield/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.hasRisks) return null;

    const matchedStr = data.matchedText || text;
    const matchIdx = text.toLowerCase().indexOf(matchedStr.toLowerCase());

    const detected: DetectedRisk = {
      id: `ai-risk-${Date.now()}`,
      rule: {
        id: `ai-rule-${Date.now()}`,
        category: (data.category as any) || 'conflict',
        dangerPattern: new RegExp(matchedStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
        riskLevel: (data.riskLevel as any) || 'critical',
        riskTitle: data.riskTitle || 'Правовой риск (ИИ-анализ)',
        riskDescription: data.riskDescription || 'Выявлен риск нарушения норм законодательства РФ.',
        safeReplacement: data.safeReplacement || 'Формулировка требует коррекции.',
        statutoryReference: data.lawArticle || ''
      },
      matchedText: matchedStr,
      index: matchIdx >= 0 ? matchIdx : 0,
      length: matchedStr.length,
      riskLevel: (data.riskLevel as any) || 'critical',
      riskTitle: data.riskTitle || 'Правовой риск (ИИ-анализ)',
      riskDescription: data.riskDescription || 'Выявлен риск нарушения норм законодательства РФ.',
      safeReplacement: data.safeReplacement || 'Формулировка требует коррекции.',
      statutoryReference: data.lawArticle || '',
      isAiGenerated: true,
      aiLawArticle: data.lawArticle || ''
    };
    return detected;
  } catch (e) {
    return null;
  }
}

