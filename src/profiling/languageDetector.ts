/**
 * Advanced Language Detector
 * Provides sophisticated language detection beyond file extensions using AST analysis and pattern recognition
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { LanguageDetector, LanguageDetectionResult, ProfilingOptions, ProfilingPerformanceMetrics } from './types';
import { walkDirectory, countFileLines, cacheResult } from './languageDetectorHelpers';

// Language detection patterns for content-based analysis
interface LanguagePattern {
  language: string;
  patterns: RegExp[];
  shebangPatterns?: RegExp[];
  importPatterns?: RegExp[];
  syntaxPatterns?: RegExp[];
  weight: number;
}

// Language dialect detection
interface DialectPattern {
  language: string;
  dialect: string;
  patterns: RegExp[];
  imports?: RegExp[];
  syntax?: RegExp[];
}

// Language version detection
interface VersionPattern {
  language: string;
  version: string;
  patterns: RegExp[];
  features?: RegExp[];
}

// Content match result
interface ContentMatch {
  language: string;
  confidence: number;
  matches: number;
}

/**
 * Advanced language detector implementation
 */
export class AdvancedLanguageDetector implements LanguageDetector {
  private readonly languagePatterns: LanguagePattern[];
  private readonly dialectPatterns: DialectPattern[];
  private readonly versionPatterns: VersionPattern[];
  private readonly fileCache: Map<string, LanguageDetectionResult> = new Map();
  private readonly contentCache: Map<string, string> = new Map();
  private readonly maxCacheSize = 1000;
  private readonly maxContentCacheSize = 100;
  private readonly maxContentSizeBytes = 1024 * 1024; // 1MB
  private readonly minConfidenceThreshold = 0.6;
  private readonly binaryExtensions = new Set([
    '.exe', '.dll', '.so', '.dylib', '.bin', '.zip', '.tar', '.gz',
    '.jpg', '.jpeg', '.png', '.gif', '.pdf', '.mp4', '.avi', '.mov'
  ]);
  private performanceMetrics: ProfilingPerformanceMetrics;

  constructor() {
    this.languagePatterns = this.initializeLanguagePatterns();
    this.dialectPatterns = this.initializeDialectPatterns();
    this.versionPatterns = this.initializeVersionPatterns();
    this.performanceMetrics = this.initializePerformanceMetrics();
  }

  /**
   * Analyze repository to detect languages with confidence scores
   */
  async analyze(repositoryPath: string, options?: ProfilingOptions): Promise<LanguageDetectionResult[]> {
    const startTime = Date.now();
    const maxDepth = options?.maxDepth || 5;
    const maxFiles = options?.maxFiles || 1000;
    const cacheResults = options?.cacheResults !== false;
    const timeoutMs = options?.timeoutMs || 30000;

    // Reset performance metrics
    this.performanceMetrics = this.initializePerformanceMetrics();
    this.performanceMetrics.operationName = 'language-detection';

    try {
      // Track file counts by language
      const languageFiles: Map<string, string[]> = new Map();
      const languageLines: Map<string, number> = new Map();
      const languageConfidence: Map<string, number[]> = new Map();
      let filesProcessed = 0;
      const timeoutTime = Date.now() + timeoutMs;

      // Walk the repository
      await walkDirectory(
        repositoryPath,
        async (filePath: string) => {
          // Check timeout
          if (Date.now() > timeoutTime) {
            console.warn('Language detection timeout reached');
            return;
          }

          // Check max files limit
          if (filesProcessed >= maxFiles) {
            return;
          }

          try {
            // Detect language for this file
            const result = await this.detectLanguage(filePath);
            if (result && result.confidence >= this.minConfidenceThreshold) {
              // Track files by language
              if (!languageFiles.has(result.language)) {
                languageFiles.set(result.language, []);
                languageLines.set(result.language, 0);
                languageConfidence.set(result.language, []);
              }
              
              languageFiles.get(result.language)!.push(filePath);
              languageLines.set(
                result.language,
                (languageLines.get(result.language) || 0) + countFileLines(filePath)
              );
              languageConfidence.get(result.language)!.push(result.confidence);
              
              filesProcessed++;
            }
          } catch (error) {
            console.warn(`Error detecting language for ${filePath}:`, error);
          }
        },
        maxDepth
      );

      // Calculate results
      const results: LanguageDetectionResult[] = [];
      const totalFiles = filesProcessed;
      const totalLines = Array.from(languageLines.values()).reduce((sum, count) => sum + count, 0);

      for (const [language, files] of languageFiles.entries()) {
        const lines = languageLines.get(language) || 0;
        const confidenceScores = languageConfidence.get(language) || [];
        const avgConfidence = confidenceScores.length > 0
          ? confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length
          : 0;

        // Detect dialect and version for this language
        const sampleFile = files[0];
        const dialect = await this.detectDialect(language, sampleFile);
        const version = await this.detectVersion(language, sampleFile);

        results.push({
          language,
          confidence: avgConfidence,
          dialect: dialect || undefined,
          version: version || undefined,
          files: files.length,
          lines,
          percentage: totalLines > 0 ? (lines / totalLines) * 100 : 0
        });
      }

      // Sort by percentage (descending)
      results.sort((a, b) => b.percentage - a.percentage);

      // Update performance metrics
      this.performanceMetrics.executionTime = Date.now() - startTime;
      
      return results;
    } catch (error) {
      console.error('Error in language detection:', error);
      throw new Error(`Language detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Detect language for a specific file
   */
  async detectLanguage(filePath: string): Promise<LanguageDetectionResult | null> {
    // Check cache first
    if (this.fileCache.has(filePath)) {
      this.performanceMetrics.cacheHits++;
      return this.fileCache.get(filePath)!;
    }
    this.performanceMetrics.cacheMisses++;

    try {
      const ext = path.extname(filePath).toLowerCase();
      const fileName = path.basename(filePath).toLowerCase();
      
      // Skip binary files
      if (this.isBinaryFile(filePath)) {
        return null;
      }

      // Initial language guess based on extension
      let initialLanguage = this.detectLanguageByExtension(ext, fileName);
      let initialConfidence = initialLanguage ? 0.7 : 0;

      // Read file content for deeper analysis
      const content = await this.getFileContent(filePath);
      if (!content) {
        // If we can't read the file but have an extension match, return that
        if (initialLanguage) {
          const result: LanguageDetectionResult = {
            language: initialLanguage,
            confidence: initialConfidence,
            files: 1,
            lines: 0,
            percentage: 0
          };
          cacheResult(filePath, result, this.fileCache, this.maxCacheSize);
          return result;
        }
        return null;
      }

      // Analyze content patterns
      const contentMatches = this.analyzeContentPatterns(content);
      
      // If we have content matches
      if (contentMatches.length > 0) {
        // If the top content match agrees with extension match, increase confidence
        if (contentMatches[0].language === initialLanguage) {
          const result: LanguageDetectionResult = {
            language: initialLanguage,
            confidence: Math.min(0.95, initialConfidence + contentMatches[0].confidence),
            files: 1,
            lines: content.split('\n').length,
            percentage: 0
          };
          cacheResult(filePath, result, this.fileCache, this.maxCacheSize);
          return result;
        }
        
        // If extension match disagrees with content match
        if (initialLanguage && contentMatches[0].confidence > 0.8) {
          // Content match is very confident, prefer it
          const result: LanguageDetectionResult = {
            language: contentMatches[0].language,
            confidence: contentMatches[0].confidence,
            files: 1,
            lines: content.split('\n').length,
            percentage: 0
          };
          cacheResult(filePath, result, this.fileCache, this.maxCacheSize);
          return result;
        }
        
        // Extension match exists but content match isn't very confident
        if (initialLanguage) {
          const result: LanguageDetectionResult = {
            language: initialLanguage,
            confidence: initialConfidence,
            files: 1,
            lines: content.split('\n').length,
            percentage: 0
          };
          cacheResult(filePath, result, this.fileCache, this.maxCacheSize);
          return result;
        }
        
        // No extension match, use content match
        const result: LanguageDetectionResult = {
          language: contentMatches[0].language,
          confidence: contentMatches[0].confidence,
          files: 1,
          lines: content.split('\n').length,
          percentage: 0
        };
        cacheResult(filePath, result, this.fileCache, this.maxCacheSize);
        return result;
      }
      
      // If we have an extension match but no content matches
      if (initialLanguage) {
        const result: LanguageDetectionResult = {
          language: initialLanguage,
          confidence: initialConfidence,
          files: 1,
          lines: content.split('\n').length,
          percentage: 0
        };
        cacheResult(filePath, result, this.fileCache, this.maxCacheSize);
        return result;
      }
      
      // No matches at all
      return null;
    } catch (error) {
      console.warn(`Error detecting language for ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Detect dialect for a specific language and file
   */
  async detectDialect(language: string, filePath: string): Promise<string | null> {
    try {
      // Get relevant dialect patterns for this language
      const relevantPatterns = this.dialectPatterns.filter(p => p.language === language);
      if (relevantPatterns.length === 0) {
        return null;
      }

      // Read file content
      const content = await this.getFileContent(filePath);
      if (!content) {
        return null;
      }

      // Check each dialect pattern
      for (const pattern of relevantPatterns) {
        let matches = 0;
        
        // Check regular patterns
        for (const regex of pattern.patterns) {
          if (regex.test(content)) {
            matches++;
          }
        }
        
        // Check import patterns if available
        if (pattern.imports) {
          for (const regex of pattern.imports) {
            if (regex.test(content)) {
              matches++;
            }
          }
        }
        
        // Check syntax patterns if available
        if (pattern.syntax) {
          for (const regex of pattern.syntax) {
            if (regex.test(content)) {
              matches++;
            }
          }
        }
        
        // If we have enough matches, return this dialect
        if (matches >= 2) {
          return pattern.dialect;
        }
      }
      
      return null;
    } catch (error) {
      console.warn(`Error detecting dialect for ${language} in ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Detect version for a specific language and file
   */
  async detectVersion(language: string, filePath: string): Promise<string | null> {
    try {
      // Get relevant version patterns for this language
      const relevantPatterns = this.versionPatterns.filter(p => p.language === language);
      if (relevantPatterns.length === 0) {
        return null;
      }

      // Read file content
      const content = await this.getFileContent(filePath);
      if (!content) {
        return null;
      }

      // Check each version pattern
      for (const pattern of relevantPatterns) {
        let matches = 0;
        
        // Check regular patterns
        for (const regex of pattern.patterns) {
          if (regex.test(content)) {
            matches++;
          }
        }
        
        // Check feature patterns if available
        if (pattern.features) {
          for (const regex of pattern.features) {
            if (regex.test(content)) {
              matches++;
            }
          }
        }
        
        // If we have enough matches, return this version
        if (matches >= 2) {
          return pattern.version;
        }
      }
      
      // Special case for package.json files
      if (language === 'javascript' || language === 'typescript') {
        const packageJsonPath = path.join(path.dirname(filePath), 'package.json');
        if (fs.existsSync(packageJsonPath)) {
          try {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            
            // Check TypeScript version
            if (language === 'typescript' && packageJson.devDependencies?.typescript) {
              const version = packageJson.devDependencies.typescript.replace(/[^0-9.]/g, '');
              return version.split('.')[0];
            }
            
            // Check Node.js version
            if (packageJson.engines?.node) {
              const version = packageJson.engines.node.replace(/[^0-9.]/g, '');
              return version.split('.')[0];
            }
          } catch (error) {
            // Ignore package.json parsing errors
          }
        }
      }
      
      return null;
    } catch (error) {
      console.warn(`Error detecting version for ${language} in ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Calculate confidence score for language detection
   */
  async calculateConfidence(language: string, filePath: string): Promise<number> {
    try {
      const result = await this.detectLanguage(filePath);
      if (result && result.language === language) {
        return result.confidence;
      }
      return 0;
    } catch (error) {
      console.warn(`Error calculating confidence for ${language} in ${filePath}:`, error);
      return 0;
    }
  }

  /**
   * Get capabilities of this analyzer
   */
  getCapabilities(): string[] {
    return [
      'language-detection',
      'dialect-detection',
      'version-detection',
      'confidence-scoring',
      'mixed-language-analysis'
    ];
  }

  /**
   * Check if this analyzer is available
   */
  async isAvailable(): Promise<boolean> {
    return true;
  }

  /**
   * Get performance metrics for the last operation
   */
  getPerformanceMetrics(): ProfilingPerformanceMetrics {
    return this.performanceMetrics;
  }

  // Private helper methods

  /**
   * Initialize language detection patterns
   */
  private initializeLanguagePatterns(): LanguagePattern[] {
    return [
      // JavaScript
      {
        language: 'javascript',
        patterns: [
          /\bfunction\s+\w+\s*\(/,
          /\bconst\s+\w+\s*=/,
          /\blet\s+\w+\s*=/,
          /\bvar\s+\w+\s*=/,
          /\bimport\s+.*\s+from\s+['"]/,
          /\bexport\s+(default\s+)?(function|class|const|let|var)/,
          /\bdocument\.getElementById\(/,
          /\bconsole\.log\(/
        ],
        shebangPatterns: [/^#!.*\bnode\b/],
        importPatterns: [/\brequire\s*\(\s*['"][^'"]+['"]\s*\)/],
        syntaxPatterns: [/\b(if|else|for|while|switch|try|catch)\s*\(/],
        weight: 1.0
      },
      // TypeScript
      {
        language: 'typescript',
        patterns: [
          /\binterface\s+\w+\s*\{/,
          /\btype\s+\w+\s*=/,
          /:\s*(string|number|boolean|any|void|never)\b/,
          /\bimport\s+\{[^}]*\}\s+from\s+['"]/,
          /\bexport\s+(interface|type|class|enum)\b/,
          /\bnamespace\s+\w+\s*\{/,
          /\benum\s+\w+\s*\{/
        ],
        importPatterns: [/\bimport\s+\*\s+as\s+\w+\s+from\s+['"]/],
        syntaxPatterns: [/<\w+>\s*\(/],
        weight: 1.0
      },
      // Python
      {
        language: 'python',
        patterns: [
          /\bdef\s+\w+\s*\(/,
          /\bclass\s+\w+(\s*\([\w,\s]*\))?\s*:/,
          /\bimport\s+\w+/,
          /\bfrom\s+\w+\s+import\s+/,
          /\bif\s+__name__\s*==\s*['"]__main__['"]\s*:/
        ],
        shebangPatterns: [/^#!.*\bpython\d*\b/],
        importPatterns: [/\bimport\s+\w+(\.\w+)*/],
        syntaxPatterns: [/\b(if|elif|else|for|while|try|except|with)\s*:/],
        weight: 1.0
      },
      // Java
      {
        language: 'java',
        patterns: [
          /\bpublic\s+(class|interface|enum)\s+\w+/,
          /\bprivate\s+(static\s+)?(final\s+)?\w+\s+\w+\s*=/,
          /\bprotected\s+\w+\s+\w+\s*=/,
          /\bimport\s+\w+(\.\w+)*;/,
          /\bpackage\s+\w+(\.\w+)*;/
        ],
        importPatterns: [/\bimport\s+static\s+\w+(\.\w+)*\.\w+;/],
        syntaxPatterns: [/\b(if|else|for|while|switch|try|catch)\s*\(/],
        weight: 1.0
      },
      // Go
      {
        language: 'go',
        patterns: [
          /\bpackage\s+\w+/,
          /\bfunc\s+\w+\s*\(/,
          /\bimport\s+\(/,
          /\bimport\s+["']\w+["']/,
          /\btype\s+\w+\s+struct\s*\{/,
          /\bgo\s+func\s*\(/
        ],
        importPatterns: [/\bimport\s+\(\s*\n(\s*["']\w+(\.\w+)*["']\s*\n)+\s*\)/],
        syntaxPatterns: [/\b(if|else|for|switch|select|defer)\s*\{/],
        weight: 1.0
      }
    ];
  }

  /**
   * Initialize dialect detection patterns
   */
  private initializeDialectPatterns(): DialectPattern[] {
    return [
      // JavaScript dialects
      {
        language: 'javascript',
        dialect: 'ES5',
        patterns: [
          /\bvar\s+\w+\s*=/,
          /\bfunction\s+\w+\s*\(/,
          /\bnew\s+\w+\s*\(/
        ],
        imports: [/\brequire\s*\(\s*['"][^'"]+['"]\s*\)/]
      },
      {
        language: 'javascript',
        dialect: 'ES6+',
        patterns: [
          /\bconst\s+\w+\s*=/,
          /\blet\s+\w+\s*=/,
          /\bclass\s+\w+\s*\{/,
          /=>\s*\{/,
          /\.\.\.\w+/,
          /\bimport\s+.*\s+from\s+['"]/
        ],
        imports: [/\bimport\s*\{[^}]*\}\s*from\s*/]
      },
      {
        language: 'javascript',
        dialect: 'Node.js',
        patterns: [
          /\brequire\s*\(\s*['"][^'"]+['"]\s*\)/,
          /\bmodule\.exports\s*=/,
          /\bprocess\.\w+/,
          /\bfs\.\w+/,
          /\bpath\.\w+/
        ]
      },
      // Python dialects
      {
        language: 'python',
        dialect: 'Python2',
        patterns: [
          /\bprint\s+[^(]/,
          /\bxrange\s*\(/,
          /\bunicode\s*\(/,
          /\b__future__\b/,
          /\braw_input\s*\(/
        ]
      },
      {
        language: 'python',
        dialect: 'Python3',
        patterns: [
          /\bprint\s*\(/,
          /\binput\s*\(/,
          /\basync\s+def\s+/,
          /\bawait\s+/,
          /\bf"[^"]*"/,
          /\bfrom\s+__future__\s+import\s+annotations/
        ]
      }
    ];
  }

  /**
   * Initialize version detection patterns
   */
  private initializeVersionPatterns(): VersionPattern[] {
    return [
      // JavaScript versions
      {
        language: 'javascript',
        version: 'ES5',
        patterns: [
          /\bvar\s+\w+\s*=/,
          /\bfunction\s+\w+\s*\(/,
          /\bnew\s+\w+\s*\(/
        ]
      },
      {
        language: 'javascript',
        version: 'ES6',
        patterns: [
          /\bconst\s+\w+\s*=/,
          /\blet\s+\w+\s*=/,
          /\bclass\s+\w+\s*\{/,
          /=>\s*\{/,
          /\.\.\.\w+/,
          /\bimport\s+.*\s+from\s+['"]/
        ]
      },
      {
        language: 'javascript',
        version: 'ES2020',
        patterns: [
          /\?\?/,
          /\?\./,
          /\bBigInt\b/,
          /\bPromise\.allSettled\b/
        ]
      },
      // TypeScript versions
      {
        language: 'typescript',
        version: '2.x',
        patterns: [
          /\binterface\s+\w+\s*\{/,
          /\btype\s+\w+\s*=/,
          /:\s*(string|number|boolean|any|void|never)\b/
        ]
      },
      {
        language: 'typescript',
        version: '3.x',
        patterns: [
          /\bunknown\b/,
          /\bReadonly\b/,
          /\bconst\s+enum\b/
        ]
      },
      {
        language: 'typescript',
        version: '4.x',
        patterns: [
          /\btemplate\s+literal\s+types\b/,
          /\?\.\[/,
          /\bas\s+const\b/
        ]
      },
      // Python versions
      {
        language: 'python',
        version: '2.x',
        patterns: [
          /\bprint\s+[^(]/,
          /\bxrange\s*\(/,
          /\bunicode\s*\(/,
          /\b__future__\b/,
          /\braw_input\s*\(/
        ]
      },
      {
        language: 'python',
        version: '3.x',
        patterns: [
          /\bprint\s*\(/,
          /\binput\s*\(/,
          /\basync\s+def\s+/,
          /\bawait\s+/
        ]
      },
      {
        language: 'python',
        version: '3.8+',
        patterns: [
          /\bf"[^"]*"/,
          /\bfrom\s+__future__\s+import\s+annotations/,
          /\:\s*=\s*/
        ]
      }
    ];
  }

  /**
   * Initialize performance metrics
   */
  private initializePerformanceMetrics(): ProfilingPerformanceMetrics {
    return {
      operationName: 'language-detection',
      executionTime: 0,
      memoryUsage: 0,
      cacheHits: 0,
      cacheMisses: 0,
      incrementalUpdates: 0
    };
  }

  /**
   * Detect language by file extension
   */
  private detectLanguageByExtension(ext: string, fileName: string): string | null {
    const extensionMap: Record<string, string> = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.mjs': 'javascript',
      '.cjs': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.pyw': 'python',
      '.java': 'java',
      '.go': 'go',
      '.rs': 'rust',
      '.c': 'c',
      '.h': 'c',
      '.cpp': 'cpp',
      '.hpp': 'cpp',
      '.cc': 'cpp',
      '.html': 'html',
      '.htm': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.sass': 'scss',
      '.less': 'less',
      '.php': 'php',
      '.rb': 'ruby',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.scala': 'scala',
      '.cs': 'csharp',
      '.fs': 'fsharp',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.xml': 'xml',
      '.md': 'markdown',
      '.sh': 'shell',
      '.bash': 'shell',
      '.zsh': 'shell',
      '.ps1': 'powershell'
    };

    // Special case for Dockerfile
    if (fileName === 'dockerfile' || fileName.startsWith('dockerfile.')) {
      return 'dockerfile';
    }

    // Special case for Makefile
    if (fileName === 'makefile' || fileName === 'makefile.inc') {
      return 'makefile';
    }

    return extensionMap[ext] || null;
  }

  /**
   * Analyze content patterns to detect language
   */
  private analyzeContentPatterns(content: string): ContentMatch[] {
    const matches: ContentMatch[] = [];
    const firstLines = content.split('\n').slice(0, 50).join('\n');

    // Check for shebang first
    const shebangMatch = this.detectLanguageByShebang(firstLines);
    if (shebangMatch) {
      matches.push({
        language: shebangMatch,
        confidence: 0.9,
        matches: 1
      });
    }

    // Check language patterns
    for (const pattern of this.languagePatterns) {
      let patternMatches = 0;
      let totalPatterns = 0;

      // Check regular patterns
      for (const regex of pattern.patterns) {
        totalPatterns++;
        if (regex.test(content)) {
          patternMatches++;
        }
      }

      // Check shebang patterns
      if (pattern.shebangPatterns) {
        for (const regex of pattern.shebangPatterns) {
          totalPatterns++;
          if (regex.test(firstLines)) {
            patternMatches += 2; // Shebang is a strong indicator
          }
        }
      }

      // Check import patterns
      if (pattern.importPatterns) {
        for (const regex of pattern.importPatterns) {
          totalPatterns++;
          if (regex.test(content)) {
            patternMatches++;
          }
        }
      }

      // Check syntax patterns
      if (pattern.syntaxPatterns) {
        for (const regex of pattern.syntaxPatterns) {
          totalPatterns++;
          if (regex.test(content)) {
            patternMatches++;
          }
        }
      }

      // Calculate confidence
      if (patternMatches > 0) {
        const confidence = (patternMatches / totalPatterns) * pattern.weight;
        if (confidence >= 0.3) { // Minimum threshold for a match
          matches.push({
            language: pattern.language,
            confidence,
            matches: patternMatches
          });
        }
      }
    }

    // Sort by confidence (descending)
    return matches.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Detect language by shebang
   */
  private detectLanguageByShebang(content: string): string | null {
    const shebangRegex = /^#!.*?(\w+)$/m;
    const match = content.match(shebangRegex);
    
    if (match) {
      const interpreter = match[1].toLowerCase();
      
      if (interpreter.includes('node')) return 'javascript';
      if (interpreter.includes('python')) return 'python';
      if (interpreter.includes('ruby')) return 'ruby';
      if (interpreter.includes('perl')) return 'perl';
      if (interpreter.includes('bash') || interpreter.includes('sh')) return 'shell';
      if (interpreter.includes('php')) return 'php';
    }
    
    return null;
  }

  /**
   * Check if a file is binary
   */
  private isBinaryFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return this.binaryExtensions.has(ext);
  }

  /**
   * Get file content with caching
   */
  private async getFileContent(filePath: string): Promise<string | null> {
    // Check cache
    if (this.contentCache.has(filePath)) {
      return this.contentCache.get(filePath)!;
    }
    try {
      const stats = fs.statSync(filePath);
      if (stats.size > this.maxContentSizeBytes) {
        return null;
      }
      const content = fs.readFileSync(filePath, 'utf8');
      if (this.contentCache.size >= this.maxContentCacheSize) {
        const oldestKey = this.contentCache.keys().next().value;
        if (oldestKey) {
          this.contentCache.delete(oldestKey);
        }
      }
      this.contentCache.set(filePath, content);
      return content;
    } catch (error) {
      return null;
    }
  }
}