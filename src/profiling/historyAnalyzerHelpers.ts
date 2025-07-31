/**
 * Helper methods for the AdvancedHistoryAnalyzer
 * Contains additional utility functions to support history analysis
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Check if a file is a binary file
 */
export function isBinaryFile(filePath: string): boolean {
  const binaryExtensions = new Set([
    '.exe', '.dll', '.so', '.dylib', '.bin', '.zip', '.tar', '.gz',
    '.jpg', '.jpeg', '.png', '.gif', '.pdf', '.mp4', '.avi', '.mov'
  ]);
  
  const ext = path.extname(filePath).toLowerCase();
  return binaryExtensions.has(ext);
}

/**
 * Check if a file is a source code file
 */
export function isSourceFile(filePath: string): boolean {
  const sourceExtensions = new Set([
    '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.go', '.rs',
    '.rb', '.php', '.cs', '.c', '.cpp', '.h', '.hpp', '.swift',
    '.kt', '.scala', '.html', '.css', '.scss', '.less', '.vue',
    '.svelte', '.sh', '.bash', '.ps1'
  ]);
  
  const ext = path.extname(filePath).toLowerCase();
  return sourceExtensions.has(ext);
}

/**
 * Calculate trend direction
 */
export function calculateTrendDirection(values: number[], higherIsBetter: boolean = false): 'improving' | 'stable' | 'declining' {
  if (values.length < 2) {
    return 'stable';
  }
  
  // Calculate linear regression slope
  const n = values.length;
  const indices = Array.from({ length: n }, (_, i) => i);
  
  const sumX = indices.reduce((sum, x) => sum + x, 0);
  const sumY = values.reduce((sum, y) => sum + y, 0);
  const sumXY = indices.reduce((sum, x, i) => sum + x * values[i], 0);
  const sumXX = indices.reduce((sum, x) => sum + x * x, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  
  // Determine trend direction
  const threshold = 0.05; // Minimum slope to consider a trend
  
  if (Math.abs(slope) < threshold) {
    return 'stable';
  }
  
  if (higherIsBetter) {
    return slope > 0 ? 'improving' : 'declining';
  } else {
    return slope < 0 ? 'improving' : 'declining';
  }
}

/**
 * Calculate overall debt score
 */
export function calculateOverallDebtScore(
  highChurnFileCount: number,
  oldFileCount: number,
  complexFileCount: number,
  refactoringOpportunityCount: number
): number {
  // Calculate weighted score
  const score = 
    highChurnFileCount * 10 +
    oldFileCount * 8 +
    complexFileCount * 12 +
    refactoringOpportunityCount * 5;
  
  // Normalize to 0-100 scale
  return Math.min(100, Math.max(0, score));
}

/**
 * Calculate technical debt score
 */
export function calculateTechnicalDebtScore(
  complexity: number,
  duplication: number,
  testCoverage: number,
  lintErrors: number,
  lintWarnings: number
): number {
  // Calculate weighted score
  const score = 
    complexity * 2 +
    duplication * 1.5 +
    (100 - testCoverage) * 1.2 +
    lintErrors * 2 +
    lintWarnings * 0.5;
  
  // Normalize to 0-100 scale
  return Math.min(100, Math.max(0, score));
}

/**
 * Calculate velocity impact
 */
export function calculateVelocityImpact(debtScore: number): number {
  // Calculate velocity impact as a percentage
  // Higher debt score means higher velocity impact
  return Math.min(100, Math.max(0, debtScore * 0.8));
}

/**
 * Determine technical debt trend
 */
export async function determineTechnicalDebtTrend(repositoryPath: string): Promise<'increasing' | 'stable' | 'decreasing'> {
  try {
    // This would analyze commit history to determine debt trend
    // For now, return a placeholder based on recent commit messages
    
    // Get recent commit messages
    const { stdout: logOutput } = await execAsync(
      'git log --pretty=format:"%s" --max-count=50',
      { cwd: repositoryPath }
    );
    
    const commitMessages = logOutput.split('\n').filter(line => line.trim());
    
    // Count refactoring and debt-related commits
    const refactoringCount = commitMessages.filter(msg => 
      /\b(refactor|clean|simplify|improve|optimize|restructure)\b/i.test(msg)
    ).length;
    
    const debtIncreasingCount = commitMessages.filter(msg => 
      /\b(hack|workaround|todo|fixme|quick fix|temporary)\b/i.test(msg)
    ).length;
    
    // Determine trend
    const refactoringPercentage = (refactoringCount / commitMessages.length) * 100;
    const debtIncreasingPercentage = (debtIncreasingCount / commitMessages.length) * 100;
    
    if (refactoringPercentage > debtIncreasingPercentage + 10) {
      return 'decreasing';
    } else if (debtIncreasingPercentage > refactoringPercentage + 5) {
      return 'increasing';
    } else {
      return 'stable';
    }
  } catch (error) {
    console.warn('Error determining technical debt trend:', error);
    return 'stable';
  }
}

/**
 * Estimate test coverage
 */
export async function estimateTestCoverage(repositoryPath: string): Promise<number> {
  try {
    // Count source files and test files
    let sourceFileCount = 0;
    let testFileCount = 0;
    
    await walkDirectory(
      repositoryPath,
      (filePath) => {
        const relativePath = path.relative(repositoryPath, filePath);
        
        // Skip binary files
        if (isBinaryFile(filePath)) {
          return;
        }
        
        // Check if it's a test file
        const isTestFile = 
          relativePath.includes('/test/') ||
          relativePath.includes('/tests/') ||
          relativePath.includes('/spec/') ||
          relativePath.includes('/__tests__/') ||
          relativePath.match(/\.(test|spec)\.[^.]+$/);
        
        if (isTestFile && isSourceFile(filePath)) {
          testFileCount++;
        } else if (isSourceFile(filePath)) {
          sourceFileCount++;
        }
      }
    );
    
    if (sourceFileCount === 0) {
      return 0;
    }
    
    // Calculate coverage ratio
    const coverageRatio = testFileCount / sourceFileCount;
    
    // Convert to percentage (0-100)
    return Math.min(100, Math.round(coverageRatio * 100));
  } catch (error) {
    console.warn('Error estimating test coverage:', error);
    return 0;
  }
}

/**
 * Estimate lint issues
 */
export async function estimateLintIssues(repositoryPath: string): Promise<{ errors: number; warnings: number }> {
  try {
    // This would run linters to get actual issues
    // For now, estimate based on code patterns
    
    let errors = 0;
    let warnings = 0;
    
    await walkDirectory(
      repositoryPath,
      (filePath) => {
        try {
          // Skip binary files and non-source files
          if (isBinaryFile(filePath) || !isSourceFile(filePath)) {
            return;
          }
          
          // Read file content
          const content = fs.readFileSync(filePath, 'utf8');
          
          // Count potential errors
          const errorPatterns = [
            /TODO/g,
            /FIXME/g,
            /console\.log/g,
            /alert\(/g,
            /eval\(/g,
            /===/g, // Missing strict equality
            /!=/g, // Non-strict inequality
            /catch\s*\(\s*\)/g, // Empty catch block
            /if\s*\([^)]*\)\s*;/g // Empty if statement
          ];
          
          for (const pattern of errorPatterns) {
            const matches = content.match(pattern);
            if (matches) {
              errors += matches.length;
            }
          }
          
          // Count potential warnings
          const warningPatterns = [
            /\/\/\s*[^TODO|FIXME]/g, // Comments
            /debugger/g,
            /\.length\s*==\s*0/g, // Could use isEmpty
            /\.indexOf\([^)]+\)\s*[!=]=\s*-1/g, // Could use includes
            /\t/g // Tabs instead of spaces
          ];
          
          for (const pattern of warningPatterns) {
            const matches = content.match(pattern);
            if (matches) {
              warnings += matches.length;
            }
          }
        } catch (error) {
          // Skip files with errors
        }
      }
    );
    
    return { errors, warnings };
  } catch (error) {
    console.warn('Error estimating lint issues:', error);
    return { errors: 0, warnings: 0 };
  }
}

/**
 * Import missing functions
 */
import { exec } from 'child_process';
import { promisify } from 'util';
import { walkDirectory } from './languageDetectorHelpers';

const execAsync = promisify(exec);