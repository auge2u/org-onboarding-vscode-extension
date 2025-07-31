/**
 * Unit tests for the AdvancedHistoryAnalyzer
 */

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { AdvancedHistoryAnalyzer } from '../../profiling/historyAnalyzer';
import { QualityTrend, TechnicalDebtMetrics } from '../../profiling/types';

describe('AdvancedHistoryAnalyzer', () => {
  let analyzer: AdvancedHistoryAnalyzer;
  const testRepoPath = path.join(__dirname, '..', '..', '..', 'test-repo-history');

  before(() => {
    analyzer = new AdvancedHistoryAnalyzer();
    
    // Create a test repository with git history
    if (!fs.existsSync(testRepoPath)) {
      fs.mkdirSync(testRepoPath, { recursive: true });
    }
    
    // Initialize git repository
    execSync('git init', { cwd: testRepoPath });
    execSync('git config user.name "Test User"', { cwd: testRepoPath });
    execSync('git config user.email "test@example.com"', { cwd: testRepoPath });
    
    // Create and commit test files
    fs.writeFileSync(path.join(testRepoPath, 'test.js'), 'console.log("hello");\n');
    execSync('git add .', { cwd: testRepoPath });
    execSync('git commit -m "feat: initial commit"', { cwd: testRepoPath });
    
    fs.writeFileSync(path.join(testRepoPath, 'test.js'), 'console.log("hello world");\n');
    execSync('git add .', { cwd: testRepoPath });
    execSync('git commit -m "fix: update message"', { cwd: testRepoPath });
  });

  after(() => {
    // Clean up the test repository
    fs.rmSync(testRepoPath, { recursive: true, force: true });
  });

  it('should analyze quality trends', async () => {
    const trends = await analyzer.analyzeQualityTrends(testRepoPath);
    
    assert.ok(trends.length > 0, 'Should have at least one quality trend');
    
    const complexityTrend = trends.find(t => t.metric === 'complexity');
    assert.ok(complexityTrend, 'Should have a complexity trend');
  });

  it('should analyze technical debt', async () => {
    const debt = await analyzer.analyzeTechnicalDebt(testRepoPath);
    
    assert.ok(debt.overallDebtScore >= 0, 'Should have a technical debt score');
    assert.ok(debt.debtByCategory, 'Should have debt by category');
  });

  it('should identify refactoring opportunities', async () => {
    const opportunities = await analyzer.identifyRefactoringOpportunities(testRepoPath);
    
    assert.ok(Array.isArray(opportunities), 'Should return an array of opportunities');
  });

  it('should track development velocity', async () => {
    const velocity = await analyzer.trackVelocity(testRepoPath);
    
    assert.ok(velocity >= 0, 'Should have a velocity score');
  });
});