export interface SecurityVulnerability {
  severity: string;
  id: string;
  summary: string;
  details?: string;
}

export interface SecurityScanResult {
  critical: number;
  high: number;
  medium: number;
  low: number;
  summary: string[];
  vulnerabilities: SecurityVulnerability[];
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