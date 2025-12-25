/**
 * Type definitions for AI Analysis
 */

export interface Threat {
  type: 'spoofing' | 'phishing' | 'unauthorized_sender' | 'policy_violation' | 'other';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  source_ips: string[];
  evidence: string;
}

export interface TrendData {
  total_messages: number;
  pass_rate: number;
  fail_rate: number;
  top_sources: Array<{
    ip: string;
    count: number;
    country?: string;
  }>;
  disposition_summary: {
    none: number;
    quarantine: number;
    reject: number;
  };
}

export interface ClaudeAnalysisResponse {
  compliance_status: 'PASS' | 'PARTIAL' | 'FAIL';
  compliance_score: number; // 0-100
  threats: Threat[];
  threat_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  trends: TrendData;
  recommendations: string[];
  summary: string;
}
