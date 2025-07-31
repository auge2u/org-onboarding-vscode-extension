/**
 * Unit tests for the AdvancedTeamAnalytics
 */

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { AdvancedTeamAnalytics } from '../../profiling/teamAnalytics';
import { TeamPreferences } from '../../profiling/types';

describe('AdvancedTeamAnalytics', () => {
  let analyzer: AdvancedTeamAnalytics;
  const testRepoPath = path.join(__dirname, '..', '..', '..', 'test-repo-team');

  before(() => {
    analyzer = new AdvancedTeamAnalytics();
    
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

  it('should analyze git history', async () => {
    const history = await analyzer.analyzeGitHistory(testRepoPath);
    
    assert.strictEqual(history.totalCommits, 2, 'Should have 2 commits');
    assert.strictEqual(history.authors.length, 1, 'Should have 1 author');
    assert.strictEqual(history.authors[0].name, 'Test User', 'Should have correct author name');
  });

  it('should detect coding preferences', async () => {
    const preferences = await analyzer.detectCodingPreferences(testRepoPath);
    
    assert.strictEqual(preferences.indentationStyle, 'spaces', 'Should detect spaces indentation');
    assert.strictEqual(preferences.lineEndingStyle, 'LF', 'Should detect LF line endings');
  });

  it('should map code ownership', async () => {
    const ownership = await analyzer.mapCodeOwnership(testRepoPath);
    
    assert.ok(ownership['test.js'], 'Should have ownership for test.js');
    assert.strictEqual(ownership['test.js'][0], 'Test User', 'Should have correct owner for test.js');
  });
});