/**
 * Unit tests for RepositoryProfiler
 */

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { RepositoryProfiler } from '../../megalinter/profiler';

describe('RepositoryProfiler', () => {
  let profiler: RepositoryProfiler;
  let testRepoPath: string;

  beforeEach(() => {
    profiler = new RepositoryProfiler();
    testRepoPath = path.join(__dirname, '../fixtures/test-repo');
  });

  describe('detectLanguages', () => {
    it('should detect JavaScript files', async () => {
      // Create mock repo structure
      const mockRepo = createMockRepo({
        'index.js': 'console.log("hello");',
        'app.js': 'const express = require("express");'
      });

      const languages = await profiler.detectLanguages(mockRepo);
      assert(languages.includes('javascript'), 'Should detect JavaScript');
    });

    it('should detect TypeScript files', async () => {
      const mockRepo = createMockRepo({
        'main.ts': 'interface User { name: string; }',
        'app.tsx': 'export const App = () => <div>Hello</div>;'
      });

      const languages = await profiler.detectLanguages(mockRepo);
      assert(languages.includes('typescript'), 'Should detect TypeScript');
    });

    it('should detect Python files', async () => {
      const mockRepo = createMockRepo({
        'main.py': 'def hello(): print("world")',
        'requirements.txt': 'flask==2.0.0'
      });

      const languages = await profiler.detectLanguages(mockRepo);
      assert(languages.includes('python'), 'Should detect Python');
    });
  });

  describe('detectFrameworks', () => {
    it('should detect React framework', async () => {
      const mockRepo = createMockRepo({
        'package.json': JSON.stringify({
          dependencies: { react: '^18.0.0' }
        })
      });

      const frameworks = await profiler.detectFrameworks(mockRepo, ['javascript']);
      assert(frameworks.includes('react'), 'Should detect React framework');
    });

    it('should detect Django framework', async () => {
      const mockRepo = createMockRepo({
        'requirements.txt': 'Django==4.0.0\npsycopg2==2.9.0',
        'manage.py': '#!/usr/bin/env python'
      });

      const frameworks = await profiler.detectFrameworks(mockRepo, ['python']);
      assert(frameworks.includes('django'), 'Should detect Django framework');
    });
  });

  describe('analyzeComplexity', () => {
    it('should classify simple repository correctly', async () => {
      const mockRepo = createMockRepo({
        'index.js': 'console.log("hello");',
        'package.json': '{"name": "test"}'
      });

      const complexity = await profiler.analyzeComplexity(mockRepo);
      assert.strictEqual(complexity, 'simple', 'Should classify as simple');
    });

    it('should classify complex repository correctly', async () => {
      const files: Record<string, string> = {};
      
      // Create a complex repo structure
      for (let i = 0; i < 100; i++) {
        files[`src/components/Component${i}.tsx`] = `export const Component${i} = () => <div/>;`;
        files[`src/services/Service${i}.ts`] = `export class Service${i} {}`;
        files[`src/utils/Utils${i}.ts`] = `export const util${i} = () => {};`;
      }
      
      files['package.json'] = JSON.stringify({
        dependencies: { react: '^18.0.0', typescript: '^4.0.0' }
      });

      const mockRepo = createMockRepo(files);
      const complexity = await profiler.analyzeComplexity(mockRepo);
      assert.strictEqual(complexity, 'complex', 'Should classify as complex');
    });
  });

  describe('analyzeRepository', () => {
    it('should return complete language profile', async () => {
      const mockRepo = createMockRepo({
        'src/index.ts': 'console.log("TypeScript");',
        'src/App.tsx': 'export const App = () => <div>React</div>;',
        'package.json': JSON.stringify({
          dependencies: { react: '^18.0.0', typescript: '^4.0.0' }
        }),
        'tsconfig.json': '{"compilerOptions": {}}',
        '.eslintrc.js': 'module.exports = {};'
      });

      const profile = await profiler.analyzeRepository(mockRepo);
      
      assert(profile.primary.includes('typescript'), 'Should detect TypeScript as primary');
      assert(profile.frameworks.includes('react'), 'Should detect React framework');
      assert(profile.buildTools.includes('npm'), 'Should detect npm build tool');
      assert(profile.configFiles['eslint_0'], 'Should find ESLint config');
      assert(typeof profile.confidence === 'number', 'Should calculate confidence score');
      assert(profile.confidence > 0 && profile.confidence <= 1, 'Confidence should be between 0 and 1');
    });
  });

  // Helper function to create mock repository structure
  function createMockRepo(files: Record<string, string>): string {
    const tmpDir = path.join(__dirname, '../tmp', `test-repo-${Date.now()}`);
    
    // Create directory structure
    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = path.join(tmpDir, filePath);
      const dir = path.dirname(fullPath);
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Write file
      fs.writeFileSync(fullPath, content, 'utf8');
    }
    
    return tmpDir;
  }

  afterEach(() => {
    // Clean up temporary test directories
    const tmpDir = path.join(__dirname, '../tmp');
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});