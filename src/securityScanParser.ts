export interface SecurityVulnerability {
  severity: string;
  id: string;
  summary: string;
  details?: string;
  file?: string;
  line?: number;
  column?: number;
  linter?: string;
  rule?: string;
  fixable?: boolean;
}

export interface SecurityScanResult {
  critical: number;
  high: number;
  medium: number;
  low: number;
  summary: string[];
  vulnerabilities: SecurityVulnerability[];
  totalFiles?: number;
  executionTime?: number;
  linterResults?: LinterSecurityResult[];
}

export interface LinterSecurityResult {
  linter: string;
  status: 'success' | 'failure' | 'timeout' | 'skipped';
  issueCount: number;
  executionTime: number;
  issues: SecurityVulnerability[];
}

export interface MegaLinterResult {
  summary: {
    total_files: number;
    total_issues: number;
    errors: number;
    warnings: number;
    infos: number;
    execution_time: number;
    linters_run: number;
    linters_successful: number;
  };
  linters: Array<{
    linter: string;
    status: string;
    files_processed: number;
    issues: Array<{
      file: string;
      line: number;
      column: number;
      severity: string;
      message: string;
      rule: string;
      linter: string;
      fixable?: boolean;
    }>;
    execution_time: number;
  }>;
  version: string;
  timestamp: string;
}

export function parseOsvScanner(json: string): SecurityScanResult {
  try {
    const result = JSON.parse(json);
    let critical = 0, high = 0, medium = 0, low = 0;
    const summary: string[] = [];
    const vulnerabilities: SecurityVulnerability[] = [];
    
    for (const vuln of result.vulnerabilities || []) {
      const vulnerability: SecurityVulnerability = {
        severity: vuln.severity || 'UNKNOWN',
        id: vuln.id || vuln.aliases?.[0] || 'Unknown ID',
        summary: vuln.summary || 'No summary available',
        details: vuln.details
      };
      
      vulnerabilities.push(vulnerability);
      
      switch (vuln.severity) {
        case 'CRITICAL':
          critical++;
          summary.push(`🔴 CRITICAL: ${vulnerability.id} - ${vulnerability.summary}`);
          break;
        case 'HIGH':
          high++;
          summary.push(`🟠 HIGH: ${vulnerability.id} - ${vulnerability.summary}`);
          break;
        case 'MEDIUM':
          medium++;
          summary.push(`🟡 MEDIUM: ${vulnerability.id} - ${vulnerability.summary}`);
          break;
        case 'LOW':
          low++;
          summary.push(`🟢 LOW: ${vulnerability.id} - ${vulnerability.summary}`);
          break;
        default:
          summary.push(`⚪ UNKNOWN: ${vulnerability.id} - ${vulnerability.summary}`);
      }
    }
    
    return { critical, high, medium, low, summary, vulnerabilities };
  } catch (error) {
    return {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      summary: ['Error parsing OSV scanner results'],
      vulnerabilities: []
    };
  }
}

export function parseTrunk(json: string): SecurityScanResult {
  try {
    const result = JSON.parse(json);
    let critical = 0, high = 0, medium = 0, low = 0;
    const summary: string[] = [];
    const vulnerabilities: SecurityVulnerability[] = [];
    
    for (const file of result.files || []) {
      for (const issue of file.issues || []) {
        const severity = issue.level?.toUpperCase() || 'UNKNOWN';
        const vulnerability: SecurityVulnerability = {
          severity,
          id: issue.code || 'trunk-issue',
          summary: `${issue.message} in ${file.path}:${issue.line}`,
          details: issue.details
        };
        
        vulnerabilities.push(vulnerability);
        
        switch (severity) {
          case 'CRITICAL':
          case 'ERROR':
            critical++;
            summary.push(`🔴 ${severity}: ${vulnerability.summary}`);
            break;
          case 'HIGH':
          case 'WARNING':
            high++;
            summary.push(`🟠 ${severity}: ${vulnerability.summary}`);
            break;
          case 'MEDIUM':
          case 'INFO':
            medium++;
            summary.push(`🟡 ${severity}: ${vulnerability.summary}`);
            break;
          case 'LOW':
          case 'NOTICE':
            low++;
            summary.push(`🟢 ${severity}: ${vulnerability.summary}`);
            break;
          default:
            summary.push(`⚪ ${severity}: ${vulnerability.summary}`);
        }
      }
    }
    
    return { critical, high, medium, low, summary, vulnerabilities };
  } catch (error) {
    return {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      summary: ['Error parsing Trunk results'],
      vulnerabilities: []
    };
  }
}

export function parseMegaLinter(json: string): SecurityScanResult {
  try {
    const result: MegaLinterResult = JSON.parse(json);
    let critical = 0, high = 0, medium = 0, low = 0;
    const summary: string[] = [];
    const vulnerabilities: SecurityVulnerability[] = [];
    const linterResults: LinterSecurityResult[] = [];
    
    // Process each linter's results
    for (const linter of result.linters || []) {
      const linterSecurityResult: LinterSecurityResult = {
        linter: linter.linter,
        status: linter.status as any,
        issueCount: linter.issues?.length || 0,
        executionTime: linter.execution_time || 0,
        issues: []
      };
      
      // Process issues from this linter
      for (const issue of linter.issues || []) {
        const severity = mapMegaLinterSeverity(issue.severity);
        const vulnerability: SecurityVulnerability = {
          severity,
          id: issue.rule || `${linter.linter}-${issue.line}`,
          summary: issue.message,
          details: `${issue.file}:${issue.line}:${issue.column}`,
          file: issue.file,
          line: issue.line,
          column: issue.column,
          linter: issue.linter,
          rule: issue.rule,
          fixable: issue.fixable
        };
        
        vulnerabilities.push(vulnerability);
        linterSecurityResult.issues.push(vulnerability);
        
        // Count by severity
        switch (severity) {
          case 'CRITICAL':
            critical++;
            summary.push(`🔴 CRITICAL: ${vulnerability.id} - ${vulnerability.summary} (${vulnerability.file}:${vulnerability.line})`);
            break;
          case 'HIGH':
            high++;
            summary.push(`🟠 HIGH: ${vulnerability.id} - ${vulnerability.summary} (${vulnerability.file}:${vulnerability.line})`);
            break;
          case 'MEDIUM':
            medium++;
            summary.push(`🟡 MEDIUM: ${vulnerability.id} - ${vulnerability.summary} (${vulnerability.file}:${vulnerability.line})`);
            break;
          case 'LOW':
            low++;
            summary.push(`🟢 LOW: ${vulnerability.id} - ${vulnerability.summary} (${vulnerability.file}:${vulnerability.line})`);
            break;
          default:
            low++;
            summary.push(`⚪ ${severity}: ${vulnerability.id} - ${vulnerability.summary} (${vulnerability.file}:${vulnerability.line})`);
        }
      }
      
      linterResults.push(linterSecurityResult);
    }
    
    return {
      critical,
      high,
      medium,
      low,
      summary,
      vulnerabilities,
      totalFiles: result.summary?.total_files,
      executionTime: result.summary?.execution_time,
      linterResults
    };
  } catch (error) {
    console.error('Error parsing MegaLinter results:', error);
    return {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      summary: ['Error parsing MegaLinter results'],
      vulnerabilities: []
    };
  }
}

function mapMegaLinterSeverity(severity: string): string {
  const normalizedSeverity = severity.toUpperCase();
  
  // Map various severity formats to standard levels
  switch (normalizedSeverity) {
    case 'ERROR':
    case 'CRITICAL':
    case 'BLOCKER':
      return 'CRITICAL';
    case 'WARNING':
    case 'HIGH':
    case 'MAJOR':
      return 'HIGH';
    case 'INFO':
    case 'MEDIUM':
    case 'MINOR':
      return 'MEDIUM';
    case 'LOW':
    case 'NOTICE':
    case 'SUGGESTION':
      return 'LOW';
    default:
      return normalizedSeverity;
  }
}

export function formatSecuritySummary(result: SecurityScanResult): string {
  const totalVulns = result.critical + result.high + result.medium + result.low;
  
  if (totalVulns === 0) {
    return '✅ No security vulnerabilities detected';
  }
  
  let summary = `⚠️ Found ${totalVulns} security issues: `;
  const parts: string[] = [];
  
  if (result.critical > 0) parts.push(`${result.critical} critical`);
  if (result.high > 0) parts.push(`${result.high} high`);
  if (result.medium > 0) parts.push(`${result.medium} medium`);
  if (result.low > 0) parts.push(`${result.low} low`);
  
  return summary + parts.join(', ');
}

export function formatMegaLinterSummary(result: SecurityScanResult): string {
  const totalVulns = result.critical + result.high + result.medium + result.low;
  
  if (totalVulns === 0) {
    const filesScanned = result.totalFiles ? ` (${result.totalFiles} files scanned)` : '';
    const executionTime = result.executionTime ? ` in ${Math.round(result.executionTime / 1000)}s` : '';
    return `✅ No issues detected${filesScanned}${executionTime}`;
  }
  
  let summary = `⚠️ MegaLinter found ${totalVulns} issues: `;
  const parts: string[] = [];
  
  if (result.critical > 0) parts.push(`${result.critical} critical`);
  if (result.high > 0) parts.push(`${result.high} high`);
  if (result.medium > 0) parts.push(`${result.medium} medium`);
  if (result.low > 0) parts.push(`${result.low} low`);
  
  const filesScanned = result.totalFiles ? ` across ${result.totalFiles} files` : '';
  const executionTime = result.executionTime ? ` (${Math.round(result.executionTime / 1000)}s)` : '';
  const linterCount = result.linterResults ? ` using ${result.linterResults.length} linters` : '';
  
  return summary + parts.join(', ') + filesScanned + linterCount + executionTime;
}

export function getSecurityIssuesByFile(result: SecurityScanResult): Map<string, SecurityVulnerability[]> {
  const fileIssues = new Map<string, SecurityVulnerability[]>();
  
  for (const vulnerability of result.vulnerabilities) {
    if (vulnerability.file) {
      const existing = fileIssues.get(vulnerability.file) || [];
      existing.push(vulnerability);
      fileIssues.set(vulnerability.file, existing);
    }
  }
  
  return fileIssues;
}

export function getSecurityIssuesByLinter(result: SecurityScanResult): Map<string, SecurityVulnerability[]> {
  const linterIssues = new Map<string, SecurityVulnerability[]>();
  
  for (const vulnerability of result.vulnerabilities) {
    if (vulnerability.linter) {
      const existing = linterIssues.get(vulnerability.linter) || [];
      existing.push(vulnerability);
      linterIssues.set(vulnerability.linter, existing);
    }
  }
  
  return linterIssues;
}

export function getFixableIssues(result: SecurityScanResult): SecurityVulnerability[] {
  return result.vulnerabilities.filter(v => v.fixable === true);
}