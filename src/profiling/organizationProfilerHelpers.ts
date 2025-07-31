/**
 * Helper methods for the AdvancedOrganizationProfiler
 * Contains additional utility functions to support organization analysis
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Check for semantic versioning in a repository
 */
export function checkForSemanticVersioning(repositoryPath: string): boolean {
  try {
    // Check package.json for semantic versioning
    const packageJsonPath = path.join(repositoryPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      // Check if version follows semantic versioning pattern
      if (packageJson.version && /^\d+\.\d+\.\d+/.test(packageJson.version)) {
        return true;
      }
    }
    
    // Check for version tags in git
    const gitTagsPath = path.join(repositoryPath, '.git', 'refs', 'tags');
    if (fs.existsSync(gitTagsPath)) {
      try {
        const tags = fs.readdirSync(gitTagsPath);
        
        // Check if any tags follow semantic versioning pattern
        for (const tag of tags) {
          if (/^v?\d+\.\d+\.\d+/.test(tag)) {
            return true;
          }
        }
      } catch (error) {
        // Ignore directory read errors
      }
    }
    
    // Check for CHANGELOG.md with semantic versioning
    const changelogPath = path.join(repositoryPath, 'CHANGELOG.md');
    if (fs.existsSync(changelogPath)) {
      const changelog = fs.readFileSync(changelogPath, 'utf8');
      
      // Check if changelog contains semantic version headers
      if (/##\s+\[?\d+\.\d+\.\d+\]?/.test(changelog)) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.warn(`Error checking semantic versioning for ${repositoryPath}:`, error);
    return false;
  }
}

/**
 * Compare repositories for similarity
 */
export function compareRepositories(repoA: any, repoB: any): number {
  let similarityScore = 0;
  let totalFactors = 0;
  
  // Compare languages
  const languageSimilarity = calculateJaccardSimilarity(
    new Set(repoA.languages.map((lang: any) => lang.language)),
    new Set(repoB.languages.map((lang: any) => lang.language))
  );
  similarityScore += languageSimilarity;
  totalFactors++;
  
  // Compare frameworks
  const frameworkSimilarity = calculateJaccardSimilarity(
    new Set(repoA.frameworks.map((fw: any) => fw.name)),
    new Set(repoB.frameworks.map((fw: any) => fw.name))
  );
  similarityScore += frameworkSimilarity;
  totalFactors++;
  
  // Compare team preferences if available
  if (repoA.teamPreferences && repoB.teamPreferences) {
    // Compare indentation style
    if (repoA.teamPreferences.indentationStyle === repoB.teamPreferences.indentationStyle) {
      similarityScore += 1;
    } else {
      similarityScore += 0;
    }
    totalFactors++;
    
    // Compare indent size
    if (repoA.teamPreferences.indentSize === repoB.teamPreferences.indentSize) {
      similarityScore += 1;
    } else {
      similarityScore += 0;
    }
    totalFactors++;
    
    // Compare line ending style
    if (repoA.teamPreferences.lineEndingStyle === repoB.teamPreferences.lineEndingStyle) {
      similarityScore += 1;
    } else {
      similarityScore += 0;
    }
    totalFactors++;
  }
  
  // Calculate average similarity
  return totalFactors > 0
    ? similarityScore / totalFactors
    : 0;
}

/**
 * Calculate Jaccard similarity between two sets
 */
export function calculateJaccardSimilarity(setA: Set<any>, setB: Set<any>): number {
  if (setA.size === 0 && setB.size === 0) {
    return 1; // Both empty sets are identical
  }
  
  // Calculate intersection size
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  
  // Calculate union size
  const union = new Set([...setA, ...setB]);
  
  // Calculate Jaccard similarity
  return intersection.size / union.size;
}

/**
 * Group repositories by similarity
 */
export function groupRepositoriesBySimilarity(
  repositories: any[],
  similarityThreshold: number = 0.7
): any[][] {
  if (repositories.length <= 1) {
    return [repositories];
  }
  
  // Initialize groups with the first repository
  const groups: any[][] = [[repositories[0]]];
  
  // Try to assign each repository to an existing group
  for (let i = 1; i < repositories.length; i++) {
    const repo = repositories[i];
    let assigned = false;
    
    // Check each group for similarity
    for (const group of groups) {
      // Calculate average similarity with all repositories in the group
      let totalSimilarity = 0;
      
      for (const groupRepo of group) {
        totalSimilarity += compareRepositories(repo, groupRepo);
      }
      
      const avgSimilarity = totalSimilarity / group.length;
      
      // If similar enough, add to this group
      if (avgSimilarity >= similarityThreshold) {
        group.push(repo);
        assigned = true;
        break;
      }
    }
    
    // If not assigned to any group, create a new group
    if (!assigned) {
      groups.push([repo]);
    }
  }
  
  return groups;
}

/**
 * Identify common patterns across repositories
 */
export function identifyCommonPatterns(repositories: any[]): Record<string, number> {
  const patterns: Record<string, number> = {};
  
  // Check for common file structures
  const fileStructurePatterns = [
    'src/components',
    'src/pages',
    'src/utils',
    'src/services',
    'src/models',
    'src/api',
    'src/hooks',
    'src/context',
    'src/store',
    'src/assets',
    'src/styles',
    'src/tests',
    'src/config',
    'src/constants',
    'src/types',
    'src/interfaces',
    'src/lib',
    'src/helpers',
    'src/middleware',
    'src/controllers',
    'src/routes',
    'src/views',
    'src/templates',
    'src/public',
    'src/static',
    'src/data',
    'src/schemas',
    'src/migrations',
    'src/scripts',
    'src/docs'
  ];
  
  // Check each repository for each pattern
  for (const pattern of fileStructurePatterns) {
    let count = 0;
    
    for (const repo of repositories) {
      const patternPath = path.join(repo.path, pattern);
      
      if (fs.existsSync(patternPath)) {
        count++;
      }
    }
    
    // Calculate percentage of repositories with this pattern
    const percentage = (count / repositories.length) * 100;
    
    if (percentage >= 30) { // At least 30% of repositories
      patterns[`structure:${pattern}`] = percentage;
    }
  }
  
  // Check for common configuration files
  const configFilePatterns = [
    '.eslintrc.js',
    '.eslintrc.json',
    '.prettierrc',
    'tsconfig.json',
    'jest.config.js',
    'babel.config.js',
    'webpack.config.js',
    'rollup.config.js',
    'vite.config.js',
    '.github/workflows/ci.yml',
    '.github/workflows/cd.yml',
    '.github/workflows/release.yml',
    '.github/dependabot.yml',
    'docker-compose.yml',
    'Dockerfile',
    '.dockerignore',
    '.gitignore',
    '.npmignore',
    'LICENSE',
    'CONTRIBUTING.md',
    'CODE_OF_CONDUCT.md'
  ];
  
  // Check each repository for each config file
  for (const pattern of configFilePatterns) {
    let count = 0;
    
    for (const repo of repositories) {
      const patternPath = path.join(repo.path, pattern);
      
      if (fs.existsSync(patternPath)) {
        count++;
      }
    }
    
    // Calculate percentage of repositories with this config file
    const percentage = (count / repositories.length) * 100;
    
    if (percentage >= 30) { // At least 30% of repositories
      patterns[`config:${pattern}`] = percentage;
    }
  }
  
  return patterns;
}

/**
 * Generate organization-wide recommendations
 */
export function generateOrganizationRecommendations(
  repositories: any[],
  crossRepoPatterns: any
): string[] {
  const recommendations: string[] = [];
  
  // Check consistency score
  if (crossRepoPatterns.consistencyScore < 50) {
    recommendations.push('Improve technology consistency across repositories');
  }
  
  // Check for outlier repositories
  if (crossRepoPatterns.outlierRepositories.length > 0) {
    recommendations.push(`Align outlier repositories (${crossRepoPatterns.outlierRepositories.join(', ')}) with organization standards`);
  }
  
  // Check best practice adoption
  for (const [practice, adoption] of Object.entries(crossRepoPatterns.bestPracticeAdoption)) {
    if ((adoption as number) < 50) {
      recommendations.push(`Increase adoption of ${practice} (currently at ${adoption}%)`);
    }
  }
  
  // Check for shared technologies
  if (crossRepoPatterns.sharedTechnologies.length < 3) {
    recommendations.push('Standardize core technologies across repositories');
  }
  
  // Check for common patterns
  const commonPatterns = identifyCommonPatterns(repositories);
  
  if (Object.keys(commonPatterns).length < 5) {
    recommendations.push('Establish more common patterns and structures across repositories');
  }
  
  // Add specific recommendations based on technology distribution
  const techDistribution = crossRepoPatterns.technologyDistribution;
  
  // Find fragmented technologies (used in less than 30% of repos)
  const fragmentedTechs = Object.entries(techDistribution)
    .filter(([, percentage]) => (percentage as number) < 30 && (percentage as number) > 10)
    .map(([tech]) => tech);
  
  if (fragmentedTechs.length > 5) {
    recommendations.push('Reduce technology fragmentation by standardizing on fewer technologies');
  }
  
  return recommendations;
}

/**
 * Calculate organization maturity score
 */
export function calculateOrganizationMaturityScore(
  repositories: any[],
  crossRepoPatterns: any
): number {
  let score = 0;
  
  // Consistency contributes up to 30 points
  score += (crossRepoPatterns.consistencyScore / 100) * 30;
  
  // Best practice adoption contributes up to 40 points
  const avgBestPracticeAdoption = Object.values(crossRepoPatterns.bestPracticeAdoption)
    .reduce((sum: number, value) => sum + (value as number), 0) /
    Math.max(1, Object.values(crossRepoPatterns.bestPracticeAdoption).length);
  
  score += (avgBestPracticeAdoption / 100) * 40;
  
  // Outlier percentage contributes up to 15 points
  const outlierPercentage = (crossRepoPatterns.outlierRepositories.length / repositories.length) * 100;
  score += ((100 - outlierPercentage) / 100) * 15;
  
  // Shared technology count contributes up to 15 points
  const sharedTechScore = Math.min(crossRepoPatterns.sharedTechnologies.length / 5, 1) * 15;
  score += sharedTechScore;
  
  return Math.round(score);
}

/**
 * Detect organization-wide coding standards
 */
export function detectOrganizationStandards(repositories: any[]): Record<string, any> {
  const standards: Record<string, any> = {};
  
  // Skip if no repositories
  if (repositories.length === 0) {
    return standards;
  }
  
  // Collect team preferences from all repositories
  const teamPreferences = repositories
    .map(repo => repo.teamPreferences)
    .filter(prefs => prefs !== null);
  
  if (teamPreferences.length === 0) {
    return standards;
  }
  
  // Detect indentation style standard
  const indentationStyles = teamPreferences.map(prefs => prefs.indentationStyle);
  standards.indentationStyle = findMostCommon(indentationStyles);
  
  // Detect indent size standard
  const indentSizes = teamPreferences.map(prefs => prefs.indentSize);
  standards.indentSize = findMostCommon(indentSizes);
  
  // Detect line ending style standard
  const lineEndingStyles = teamPreferences.map(prefs => prefs.lineEndingStyle);
  standards.lineEndingStyle = findMostCommon(lineEndingStyles);
  
  // Detect naming convention standards
  const variableConventions = teamPreferences
    .map(prefs => prefs.namingConventions?.variables)
    .filter(conv => conv && conv !== 'unknown' && conv !== 'mixed');
  
  const functionConventions = teamPreferences
    .map(prefs => prefs.namingConventions?.functions)
    .filter(conv => conv && conv !== 'unknown' && conv !== 'mixed');
  
  const classConventions = teamPreferences
    .map(prefs => prefs.namingConventions?.classes)
    .filter(conv => conv && conv !== 'unknown' && conv !== 'mixed');
  
  standards.namingConventions = {
    variables: findMostCommon(variableConventions) || 'camelCase',
    functions: findMostCommon(functionConventions) || 'camelCase',
    classes: findMostCommon(classConventions) || 'PascalCase'
  };
  
  return standards;
}

/**
 * Find the most common value in an array
 */
export function findMostCommon<T>(values: T[]): T | null {
  if (values.length === 0) {
    return null;
  }
  
  const counts = new Map<T, number>();
  
  for (const value of values) {
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  
  let maxCount = 0;
  let mostCommon: T | null = null;
  
  for (const [value, count] of counts.entries()) {
    if (count > maxCount) {
      maxCount = count;
      mostCommon = value;
    }
  }
  
  return mostCommon;
}