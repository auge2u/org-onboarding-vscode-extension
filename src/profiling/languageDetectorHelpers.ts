/**
 * Helper methods for the AdvancedLanguageDetector
 * Contains additional utility functions to support language detection
 */

import * as fs from 'fs';
import * as path from 'path';
import { LanguageDetectionResult, ProfilingPerformanceMetrics } from './types';

/**
 * Get file content with caching
 */
export function getFileContent(
  filePath: string, 
  contentCache: Map<string, string>,
  maxContentCacheSize: number,
  maxContentSizeBytes: number
): string | null {
  // Check cache
  if (contentCache.has(filePath)) {
    return contentCache.get(filePath)!;
  }

  try {
    // Check if file exists and is not too large
    const stats = fs.statSync(filePath);
    if (stats.size > maxContentSizeBytes) {
      return null;
    }

    // Read file content
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Cache content
    if (contentCache.size >= maxContentCacheSize) {
      // Remove oldest entry
      const oldestKey = contentCache.keys().next().value;
      if (oldestKey) {
        contentCache.delete(oldestKey);
      }
    }
    contentCache.set(filePath, content);
    
    return content;
  } catch (error) {
    console.warn(`Error reading file ${filePath}:`, error);
    return null;
  }
}

/**
 * Count lines in a file
 */
export function countFileLines(filePath: string): number {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content.split('\n').length;
  } catch (error) {
    return 0;
  }
}

/**
 * Cache a language detection result
 */
export function cacheResult(
  filePath: string, 
  result: LanguageDetectionResult,
  fileCache: Map<string, LanguageDetectionResult>,
  maxCacheSize: number
): void {
  if (fileCache.size >= maxCacheSize) {
    // Remove oldest entry
    const oldestKey = fileCache.keys().next().value;
    if (oldestKey) {
      fileCache.delete(oldestKey);
    }
  }
  fileCache.set(filePath, result);
}

/**
 * Walk a directory recursively
 */
export async function walkDirectory(
  dirPath: string,
  fileCallback: (filePath: string, depth: number) => Promise<void> | void,
  maxDepth: number = 5,
  depth: number = 0,
  skipPatterns: string[] = [
    'node_modules', '.git', '.svn', '.hg', 'vendor', 'target',
    'build', 'dist', '.next', '.nuxt', 'coverage', '.nyc_output',
    '__pycache__', '.pytest_cache', '.mypy_cache', '.venv', 'venv',
    '.idea', '.vscode', '.vs', '*.log', 'logs', 'tmp', 'temp'
  ]
): Promise<void> {
  if (depth > maxDepth) return;

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      // Skip hidden directories and common ignore patterns
      if (shouldSkipPath(entry.name, entry.isDirectory(), skipPatterns)) {
        continue;
      }

      if (entry.isDirectory()) {
        await walkDirectory(fullPath, fileCallback, maxDepth, depth + 1, skipPatterns);
      } else if (entry.isFile()) {
        await fileCallback(fullPath, depth);
      }
    }
  } catch (error) {
    // Skip directories we can't read
    console.warn(`Warning: Could not read directory ${dirPath}:`, error);
  }
}

/**
 * Check if a path should be skipped
 */
export function shouldSkipPath(
  name: string, 
  isDirectory: boolean, 
  skipPatterns: string[]
): boolean {
  if (name.startsWith('.') && isDirectory && !name.match(/^\.(github|vscode|trunk)$/)) {
    return true;
  }

  return skipPatterns.some(pattern => {
    if (pattern.includes('*')) {
      return new RegExp(pattern.replace(/\*/g, '.*')).test(name);
    }
    return name === pattern;
  });
}

/**
 * Extend the AdvancedLanguageDetector class with these helper methods
 */
export function extendLanguageDetector(detector: any): void {
  // Add missing methods to the detector
  detector.getFileContent = async function(filePath: string): Promise<string | null> {
    return getFileContent(filePath, this.contentCache, this.maxContentCacheSize, this.maxContentSizeBytes);
  };

  detector.countFileLines = function(filePath: string): number {
    return countFileLines(filePath);
  };

  detector.cacheResult = function(filePath: string, result: LanguageDetectionResult): void {
    cacheResult(filePath, result, this.fileCache, this.maxCacheSize);
  };

  detector.walkDirectory = async function(
    dirPath: string,
    fileCallback: (filePath: string, depth: number) => Promise<void> | void,
    maxDepth: number = 5
  ): Promise<void> {
    return walkDirectory(dirPath, fileCallback, maxDepth);
  };
}