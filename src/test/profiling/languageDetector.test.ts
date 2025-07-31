/**
 * Unit tests for the AdvancedLanguageDetector
 */

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { AdvancedLanguageDetector } from '../../profiling/languageDetector';
import { LanguageDetectionResult } from '../../profiling/types';

describe('AdvancedLanguageDetector', () => {
  let detector: AdvancedLanguageDetector;
  const testRepoPath = path.join(__dirname, '..', '..', '..', 'test-repo');

  before(() => {
    detector = new AdvancedLanguageDetector();
    
    // Create a test repository
    if (!fs.existsSync(testRepoPath)) {
      fs.mkdirSync(testRepoPath, { recursive: true });
    }
    
    // Create test files
    fs.writeFileSync(path.join(testRepoPath, 'test.js'), 'console.log("hello world");');
    fs.writeFileSync(path.join(testRepoPath, 'test.ts'), 'const x: number = 1;');
    fs.writeFileSync(path.join(testRepoPath, 'test.py'), 'print("hello world")');
    fs.writeFileSync(path.join(testRepoPath, 'test.java'), 'public class Test {}');
    fs.writeFileSync(path.join(testRepoPath, 'test.go'), 'package main');
    fs.writeFileSync(path.join(testRepoPath, 'test.rs'), 'fn main() {}');
    fs.writeFileSync(path.join(testRepoPath, 'Dockerfile'), 'FROM node:14');
  });

  after(() => {
    // Clean up the test repository
    fs.rmSync(testRepoPath, { recursive: true, force: true });
  });

  it('should detect multiple languages in a repository', async () => {
    const results = await detector.analyze(testRepoPath);
    
    assert.ok(results.length >= 7, 'Should detect at least 7 languages');
    
    const languages = results.map(r => r.language);
    assert.ok(languages.includes('javascript'), 'Should detect JavaScript');
    assert.ok(languages.includes('typescript'), 'Should detect TypeScript');
    assert.ok(languages.includes('python'), 'Should detect Python');
    assert.ok(languages.includes('java'), 'Should detect Java');
    assert.ok(languages.includes('go'), 'Should detect Go');
    assert.ok(languages.includes('rust'), 'Should detect Rust');
    assert.ok(languages.includes('dockerfile'), 'Should detect Dockerfile');
  });

  it('should detect the correct language for a specific file', async () => {
    const jsResult = await detector.detectLanguage(path.join(testRepoPath, 'test.js'));
    assert.strictEqual(jsResult?.language, 'javascript', 'Should detect JavaScript');
    
    const tsResult = await detector.detectLanguage(path.join(testRepoPath, 'test.ts'));
    assert.strictEqual(tsResult?.language, 'typescript', 'Should detect TypeScript');
    
    const pyResult = await detector.detectLanguage(path.join(testRepoPath, 'test.py'));
    assert.strictEqual(pyResult?.language, 'python', 'Should detect Python');
  });

  it('should return a confidence score for each language', async () => {
    const results = await detector.analyze(testRepoPath);
    
    for (const result of results) {
      assert.ok(result.confidence >= 0.6, `Confidence score for ${result.language} should be >= 0.6`);
    }
  });

  it('should detect dialects for languages', async () => {
    const jsContent = 'const x = () => {};';
    const jsFilePath = path.join(testRepoPath, 'test_es6.js');
    fs.writeFileSync(jsFilePath, jsContent);
    
    const dialect = await detector.detectDialect('javascript', jsFilePath);
    assert.strictEqual(dialect, 'ES6+', 'Should detect ES6+ dialect for JavaScript');
  });

  it('should detect versions for languages', async () => {
    const pyContent = 'print("hello")';
    const pyFilePath = path.join(testRepoPath, 'test_py3.py');
    fs.writeFileSync(pyFilePath, pyContent);
    
    const version = await detector.detectVersion('python', pyFilePath);
    assert.strictEqual(version, '3.x', 'Should detect Python 3.x version');
  });
});