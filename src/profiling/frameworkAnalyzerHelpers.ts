/**
 * Helper methods for the AdvancedFrameworkAnalyzer
 * Contains additional utility functions to support framework detection
 */

import * as fs from 'fs';
import * as path from 'path';
import { FrameworkDetectionResult, ArchitecturePatternResult } from './types';
import { walkDirectory } from './languageDetectorHelpers';

/**
 * Analyze a package file for framework detection
 */
export async function analyzePackageFile(
  filePath: string, 
  languages: string[],
  frameworkPatterns: any[]
): Promise<FrameworkDetectionResult[]> {
  const results: FrameworkDetectionResult[] = [];
  const ext = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath).toLowerCase();
  
  try {
    // Filter framework patterns by supported languages
    const relevantPatterns = frameworkPatterns.filter(pattern => 
      pattern.languages.some((lang: string) => languages.includes(lang))
    );
    
    if (relevantPatterns.length === 0) {
      return results;
    }
    
    // Read file content
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check each framework pattern
    for (const pattern of relevantPatterns) {
      let matches = 0;
      let totalPatterns = 0;
      
      // Check package patterns
      if (pattern.packagePatterns && fileName === 'package.json') {
        try {
          const packageJson = JSON.parse(content);
          
          for (const [key, regex] of Object.entries(pattern.packagePatterns)) {
            totalPatterns++;
            
            // Navigate nested properties (e.g., dependencies.react)
            const parts = key.split('.');
            let value = packageJson;
            
            for (const part of parts) {
              if (value && typeof value === 'object') {
                value = value[part];
              } else {
                value = undefined;
                break;
              }
            }
            
            if (value !== undefined && (regex as RegExp).test(value)) {
              matches++;
            }
          }
        } catch (error) {
          // Ignore JSON parsing errors
        }
      }
      
      // Check file patterns
      if (pattern.filePatterns) {
        // This is just checking if the current file matches any pattern
        // In a real implementation, we would check all files in the repository
        for (const filePattern of pattern.filePatterns) {
          totalPatterns++;
          
          if (minimatch(filePath, filePattern)) {
            matches++;
          }
        }
      }
      
      // Check import patterns
      if (pattern.importPatterns) {
        for (const regex of pattern.importPatterns) {
          totalPatterns++;
          
          if (regex.test(content)) {
            matches++;
          }
        }
      }
      
      // Check code patterns
      if (pattern.codePatterns) {
        for (const regex of pattern.codePatterns) {
          totalPatterns++;
          
          if (regex.test(content)) {
            matches++;
          }
        }
      }
      
      // Calculate confidence
      if (matches > 0 && totalPatterns > 0) {
        const confidence = (matches / totalPatterns) * pattern.weight;
        
        if (confidence >= 0.3) { // Minimum threshold for a match
          results.push({
            name: pattern.name,
            confidence,
            usage: 'minimal', // Will be determined later
            dependencies: [],
            files: [filePath]
          });
        }
      }
    }
    
    return results;
  } catch (error) {
    console.warn(`Error analyzing package file ${filePath}:`, error);
    return [];
  }
}

/**
 * Analyze code patterns for framework detection
 */
export async function analyzeCodePatterns(
  languages: string[],
  packageFiles: string[],
  frameworkPatterns: any[],
  repositoryPath: string,
  maxDepth: number = 5
): Promise<FrameworkDetectionResult[]> {
  const frameworkMatches: Map<string, FrameworkDetectionResult> = new Map();
  
  // Filter framework patterns by supported languages
  const relevantPatterns = frameworkPatterns.filter(pattern => 
    pattern.languages.some((lang: string) => languages.includes(lang))
  );
  
  if (relevantPatterns.length === 0) {
    return [];
  }
  
  // Get file extensions for the detected languages
  const extensions = getLanguageExtensions(languages);
  
  // Analyze code files
  await walkDirectory(
    repositoryPath,
    async (filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      
      // Skip if not a relevant file extension
      if (!extensions.includes(ext)) {
        return;
      }
      
      try {
        // Read file content
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Check each framework pattern
        for (const pattern of relevantPatterns) {
          let matches = 0;
          let totalPatterns = 0;
          
          // Check import patterns
          if (pattern.importPatterns) {
            for (const regex of pattern.importPatterns) {
              totalPatterns++;
              
              if (regex.test(content)) {
                matches++;
              }
            }
          }
          
          // Check code patterns
          if (pattern.codePatterns) {
            for (const regex of pattern.codePatterns) {
              totalPatterns++;
              
              if (regex.test(content)) {
                matches++;
              }
            }
          }
          
          // Calculate confidence
          if (matches > 0 && totalPatterns > 0) {
            const confidence = (matches / totalPatterns) * pattern.weight;
            
            if (confidence >= 0.3) { // Minimum threshold for a match
              if (frameworkMatches.has(pattern.name)) {
                const existing = frameworkMatches.get(pattern.name)!;
                existing.confidence = Math.max(existing.confidence, confidence);
                existing.files.push(filePath);
              } else {
                frameworkMatches.set(pattern.name, {
                  name: pattern.name,
                  confidence,
                  usage: 'minimal', // Will be determined later
                  dependencies: [],
                  files: [filePath]
                });
              }
            }
          }
        }
      } catch (error) {
        // Skip files we can't read
      }
    },
    maxDepth
  );
  
  return Array.from(frameworkMatches.values());
}

/**
 * Analyze file structure for architecture pattern detection
 */
export async function analyzeFileStructure(
  repositoryPath: string,
  maxDepth: number = 5
): Promise<string[]> {
  const fileStructure: string[] = [];
  
  await walkDirectory(
    repositoryPath,
    (filePath) => {
      const relativePath = path.relative(repositoryPath, filePath);
      fileStructure.push(relativePath);
    },
    maxDepth
  );
  
  return fileStructure;
}

/**
 * Analyze code patterns for architecture detection
 */
export async function analyzeCodePatternsForArchitecture(
  repositoryPath: string,
  patterns: RegExp[]
): Promise<{ matchCount: number; locations: string[] }> {
  let matchCount = 0;
  const locations: string[] = [];
  
  await walkDirectory(
    repositoryPath,
    (filePath) => {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        
        for (const pattern of patterns) {
          if (pattern.test(content)) {
            matchCount++;
            locations.push(filePath);
            break; // Count each file only once
          }
        }
      } catch (error) {
        // Skip files we can't read
      }
    }
  );
  
  return { matchCount, locations };
}

/**
 * Analyze config patterns for architecture detection
 */
export async function analyzeConfigPatternsForArchitecture(
  repositoryPath: string,
  patterns: Record<string, RegExp>
): Promise<{ matchCount: number; locations: string[] }> {
  let matchCount = 0;
  const locations: string[] = [];
  
  for (const [configFile, pattern] of Object.entries(patterns)) {
    const filePath = path.join(repositoryPath, configFile);
    
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        
        if (pattern.test(content)) {
          matchCount++;
          locations.push(filePath);
        }
      }
    } catch (error) {
      // Skip files we can't read
    }
  }
  
  return { matchCount, locations };
}

/**
 * Enhance framework results with architecture patterns
 */
export function enhanceWithArchitecturePatterns(
  frameworks: FrameworkDetectionResult[],
  architecturePatterns: ArchitecturePatternResult[]
): FrameworkDetectionResult[] {
  // Clone the frameworks array to avoid modifying the original
  const enhancedResults = [...frameworks];
  
  // Add architecture patterns as "frameworks"
  for (const pattern of architecturePatterns) {
    if (pattern.confidence >= 0.6) { // Only include high-confidence patterns
      enhancedResults.push({
        name: `architecture:${pattern.pattern}`,
        confidence: pattern.confidence,
        usage: 'architecture',
        dependencies: [],
        files: pattern.locations
      });
    }
  }
  
  return enhancedResults;
}

/**
 * Extract version from a dependency string
 */
export function extractVersion(versionString: string): string | null {
  // Handle version ranges like ^1.2.3, ~1.2.3, >=1.2.3
  const match = versionString.match(/[\^~>=]*([0-9]+\.[0-9]+\.[0-9]+)/);
  if (match) {
    return match[1];
  }
  return null;
}

/**
 * Get file extensions for the detected languages
 */
export function getLanguageExtensions(languages: string[]): string[] {
  const extensionMap: Record<string, string[]> = {
    'javascript': ['.js', '.jsx', '.mjs', '.cjs'],
    'typescript': ['.ts', '.tsx'],
    'python': ['.py', '.pyw'],
    'java': ['.java'],
    'go': ['.go'],
    'rust': ['.rs'],
    'ruby': ['.rb'],
    'php': ['.php'],
    'csharp': ['.cs']
  };
  
  return languages.flatMap(lang => extensionMap[lang] || []);
}

/**
 * Simple implementation of minimatch for pattern matching
 */
export function minimatch(filePath: string, pattern: string): boolean {
  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]');
  
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(filePath);
}