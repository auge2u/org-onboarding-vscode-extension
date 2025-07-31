/**
 * Helper methods for the AdvancedTeamAnalytics
 * Contains additional utility functions to support team analytics
 */

import { AuthorActivity } from './types';

/**
 * Get time of day preferences for an author
 */
export function getTimeOfDayPreferences(author: AuthorActivity): string[] {
  const timeOfDay = author.commitPattern.timeOfDay;
  const total = Object.values(timeOfDay).reduce((sum, count) => sum + count, 0);
  
  if (total === 0) {
    return [];
  }
  
  // Calculate percentages
  const percentages: Record<string, number> = {};
  for (const [time, count] of Object.entries(timeOfDay)) {
    percentages[time] = (count / total) * 100;
  }
  
  // Sort by percentage (descending)
  const sorted = Object.entries(percentages)
    .sort(([, a], [, b]) => b - a);
  
  // Return top preferences (>25%)
  return sorted
    .filter(([, percentage]) => percentage >= 25)
    .map(([time]) => time);
}

/**
 * Detect commit message style
 */
export function detectCommitMessageStyle(author: AuthorActivity): string {
  // This would analyze commit messages to detect patterns
  // For now, return a placeholder
  return 'conventional';
}

/**
 * Analyze commit messages to detect patterns
 */
export function analyzeCommitMessages(messages: string[]): string {
  if (messages.length === 0) {
    return 'unknown';
  }
  
  // Check for conventional commits (feat:, fix:, etc.)
  const conventionalCount = messages.filter(msg => 
    /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?:/.test(msg)
  ).length;
  
  // Check for issue references (#123)
  const issueRefCount = messages.filter(msg => 
    /#\d+/.test(msg)
  ).length;
  
  // Check for imperative mood (Add, Fix, Update)
  const imperativeCount = messages.filter(msg => 
    /^(Add|Fix|Update|Remove|Implement|Refactor|Improve|Change|Merge|Revert)\b/i.test(msg)
  ).length;
  
  const conventionalPercentage = (conventionalCount / messages.length) * 100;
  const issueRefPercentage = (issueRefCount / messages.length) * 100;
  const imperativePercentage = (imperativeCount / messages.length) * 100;
  
  if (conventionalPercentage >= 50) {
    return 'conventional';
  } else if (issueRefPercentage >= 50) {
    return 'issue-reference';
  } else if (imperativePercentage >= 50) {
    return 'imperative';
  }
  
  return 'mixed';
}

/**
 * Calculate developer activity score
 */
export function calculateActivityScore(author: AuthorActivity): number {
  // Calculate activity score based on commits, lines changed, and time span
  const commitScore = Math.min(author.commits / 10, 10); // Max 10 points for commits
  
  const linesChangedScore = Math.min((author.linesAdded + author.linesRemoved) / 1000, 10); // Max 10 points for lines
  
  // Calculate active days
  const firstDate = author.activeTimeSpan.first.getTime();
  const lastDate = author.activeTimeSpan.last.getTime();
  const activeDays = (lastDate - firstDate) / (1000 * 60 * 60 * 24);
  const activitySpanScore = Math.min(activeDays / 30, 10); // Max 10 points for 30+ days
  
  // Calculate files touched score
  const filesScore = Math.min(author.filesModified.length / 20, 10); // Max 10 points for 20+ files
  
  // Calculate total score (max 40 points)
  return commitScore + linesChangedScore + activitySpanScore + filesScore;
}

/**
 * Identify primary contributors
 */
export function identifyPrimaryContributors(authors: AuthorActivity[]): string[] {
  if (authors.length === 0) {
    return [];
  }
  
  // Calculate activity scores
  const authorScores = authors.map(author => ({
    name: author.name,
    score: calculateActivityScore(author)
  }));
  
  // Sort by score (descending)
  authorScores.sort((a, b) => b.score - a.score);
  
  // Return top contributors (score > 20 or top 20%)
  const threshold = Math.max(
    20, // Minimum score threshold
    authorScores[Math.floor(authorScores.length * 0.2)]?.score || 0 // Top 20% threshold
  );
  
  return authorScores
    .filter(author => author.score >= threshold)
    .map(author => author.name);
}

/**
 * Analyze team collaboration patterns
 */
export function analyzeCollaborationPatterns(authors: AuthorActivity[], codeOwnership: Record<string, string[]>): Record<string, string[]> {
  const collaboration: Record<string, string[]> = {};
  
  // Skip if not enough data
  if (authors.length < 2 || Object.keys(codeOwnership).length === 0) {
    return collaboration;
  }
  
  // Create a map of author names to their objects
  const authorMap = new Map<string, AuthorActivity>();
  for (const author of authors) {
    authorMap.set(author.name, author);
  }
  
  // Analyze file co-ownership
  for (const [file, owners] of Object.entries(codeOwnership)) {
    if (owners.length >= 2) {
      // For each pair of authors
      for (let i = 0; i < owners.length; i++) {
        for (let j = i + 1; j < owners.length; j++) {
          const author1 = owners[i];
          const author2 = owners[j];
          
          // Add to collaboration map
          if (!collaboration[author1]) {
            collaboration[author1] = [];
          }
          if (!collaboration[author2]) {
            collaboration[author2] = [];
          }
          
          if (!collaboration[author1].includes(author2)) {
            collaboration[author1].push(author2);
          }
          
          if (!collaboration[author2].includes(author1)) {
            collaboration[author2].push(author1);
          }
        }
      }
    }
  }
  
  return collaboration;
}

/**
 * Detect team workflow patterns
 */
export function detectWorkflowPatterns(authors: AuthorActivity[]): string[] {
  const patterns: string[] = [];
  
  // Skip if not enough data
  if (authors.length === 0) {
    return patterns;
  }
  
  // Analyze commit frequency distribution
  const commitCounts = authors.map(author => author.commits);
  const totalCommits = commitCounts.reduce((sum, count) => sum + count, 0);
  
  // Calculate Gini coefficient (measure of inequality)
  const gini = calculateGiniCoefficient(commitCounts);
  
  if (gini > 0.8) {
    patterns.push('Highly centralized development (few core contributors)');
  } else if (gini > 0.5) {
    patterns.push('Moderately distributed development');
  } else {
    patterns.push('Evenly distributed development');
  }
  
  // Analyze commit timing
  const dayOfWeekCounts: Record<string, number> = {
    'Monday': 0,
    'Tuesday': 0,
    'Wednesday': 0,
    'Thursday': 0,
    'Friday': 0,
    'Saturday': 0,
    'Sunday': 0
  };
  
  const timeOfDayCounts: Record<string, number> = {
    'Morning (6-12)': 0,
    'Afternoon (12-18)': 0,
    'Evening (18-24)': 0,
    'Night (0-6)': 0
  };
  
  for (const author of authors) {
    for (const [day, count] of Object.entries(author.commitPattern.dayOfWeek)) {
      dayOfWeekCounts[day] += count;
    }
    
    for (const [time, count] of Object.entries(author.commitPattern.timeOfDay)) {
      timeOfDayCounts[time] += count;
    }
  }
  
  // Detect day of week patterns
  const weekdayCount = dayOfWeekCounts['Monday'] + dayOfWeekCounts['Tuesday'] + 
                       dayOfWeekCounts['Wednesday'] + dayOfWeekCounts['Thursday'] + 
                       dayOfWeekCounts['Friday'];
  const weekendCount = dayOfWeekCounts['Saturday'] + dayOfWeekCounts['Sunday'];
  
  const totalDayCount = weekdayCount + weekendCount;
  if (totalDayCount > 0) {
    const weekendPercentage = (weekendCount / totalDayCount) * 100;
    
    if (weekendPercentage > 25) {
      patterns.push('Significant weekend development activity');
    } else {
      patterns.push('Primarily weekday development activity');
    }
  }
  
  // Detect time of day patterns
  const businessHoursCount = timeOfDayCounts['Morning (6-12)'] + timeOfDayCounts['Afternoon (12-18)'];
  const afterHoursCount = timeOfDayCounts['Evening (18-24)'] + timeOfDayCounts['Night (0-6)'];
  
  const totalTimeCount = businessHoursCount + afterHoursCount;
  if (totalTimeCount > 0) {
    const afterHoursPercentage = (afterHoursCount / totalTimeCount) * 100;
    
    if (afterHoursPercentage > 50) {
      patterns.push('Significant after-hours development activity');
    } else {
      patterns.push('Primarily business hours development activity');
    }
  }
  
  return patterns;
}

/**
 * Calculate Gini coefficient (measure of inequality)
 */
export function calculateGiniCoefficient(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  
  // Sort values in ascending order
  const sortedValues = [...values].sort((a, b) => a - b);
  
  const n = sortedValues.length;
  const sum = sortedValues.reduce((acc, val) => acc + val, 0);
  
  if (sum === 0) {
    return 0;
  }
  
  let numerator = 0;
  
  for (let i = 0; i < n; i++) {
    numerator += (2 * i - n + 1) * sortedValues[i];
  }
  
  return numerator / (n * sum);
}