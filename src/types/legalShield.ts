export type RiskLevel = 'critical' | 'warning' | 'info';

export type RiskCategory = 
  | 'conflict' 
  | 'labor_rights' 
  | 'economic_tax' 
  | 'digital_data' 
  | 'extremism' 
  | 'defamation' 
  | 'consumer' 
  | string;

export interface PhraseRiskRule {
  id: string;
  category: RiskCategory;
  dangerPattern: RegExp;
  matchedSampleText?: string;
  riskLevel: RiskLevel;
  riskTitle: string;
  riskDescription: string;
  safeReplacement: string;
  constitutionArticle?: string;
  ukArticle?: string;
  koapArticle?: string;
  statutoryReference?: string;
}

export interface PhraseRiskMatch {
  rule: PhraseRiskRule;
  matchedText: string;
  index: number;
}

export interface DetectedRisk {
  id: string;
  rule: PhraseRiskRule;
  matchedText: string;
  index: number;
  length: number;
  riskLevel: RiskLevel;
  riskTitle: string;
  riskDescription: string;
  safeReplacement: string;
  constitutionArticle?: string;
  ukArticle?: string;
  koapArticle?: string;
  statutoryReference?: string;
  isAiGenerated?: boolean;
  aiLawArticle?: string;
}

export interface TextRiskAnalysis {
  hasRisks: boolean;
  score: number; // 0 - 100
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  risks: DetectedRisk[];
  suggestedSafeText: string;
}

export interface AdministrativeCodeArticle {
  number: string;
  title: string;
  chapter: string;
  disposition: string;
  sanctionSummary: string;
  practicalAdvice: string;
}

export interface CriminalCodeArticle {
  number: string;
  title: string;
  chapter?: string;
  disposition: string;
  sanctionSummary: string;
  practicalAdvice?: string;
}

export interface ConstitutionArticle {
  number: string | number;
  title?: string;
  chapterTitle: string;
  text: string;
  content?: string;
  practicalMeaning?: string;
}
