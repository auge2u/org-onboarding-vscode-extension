/**
 * Unit tests for the AdvancedFrameworkAnalyzer
 */

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { AdvancedFrameworkAnalyzer } from '../../profiling/frameworkAnalyzer';
import { FrameworkDetectionResult } from '../../profiling/types';

describe('AdvancedFrameworkAnalyzer', () => {
  let analyzer: AdvancedFrameworkAnalyzer;
  const testRepoPath = path.join(__dirname, '..', '..', '..', 'test-repo');

  before(() => {
    analyzer = new AdvancedFrameworkAnalyzer();
    
    // Create a test repository
    if (!fs.existsSync(testRepoPath)) {
      fs.mkdirSync(testRepoPath, { recursive: true });
    }
    
    // Create test files
    fs.writeFileSync(path.join(testRepoPath, 'package.json'), JSON.stringify({
      dependencies: {
        react: '17.0.2',
        express: '4.17.1'
      }
    }));
    
    fs.writeFileSync(path.join(testRepoPath, 'requirements.txt'), 'Django==3.2.8\nflask==2.0.2');
    fs.writeFileSync(path.join(testRepoPath, 'pom.xml'), '<dependencies><dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-web</artifactId></dependency></dependencies>');
    fs.writeFileSync(path.join(testRepoPath, 'go.mod'), 'require github.com/gin-gonic/gin v1.7.4');
    fs.writeFileSync(path.join(testRepoPath, 'Cargo.toml'), '[dependencies]\nactix-web = "4.0.0-beta.8"');
  });

  after(() => {
    // Clean up the test repository
    fs.rmSync(testRepoPath, { recursive: true, force: true });
  });

  it('should detect multiple frameworks in a repository', async () => {
    const results = await analyzer.analyze(testRepoPath);
    
    assert.ok(results.length >= 5, 'Should detect at least 5 frameworks');
    
    const frameworks = results.map(r => r.name);
    assert.ok(frameworks.includes('react'), 'Should detect React');
    assert.ok(frameworks.includes('express'), 'Should detect Express');
    assert.ok(frameworks.includes('django'), 'Should detect Django');
    assert.ok(frameworks.includes('spring'), 'Should detect Spring');
    assert.ok(frameworks.includes('gin'), 'Should detect Gin');
  });

  it('should detect the correct version for a framework', async () => {
    const reactVersion = await analyzer.detectVersion('react', [path.join(testRepoPath, 'package.json')]);
    assert.strictEqual(reactVersion, '17.0.2', 'Should detect correct React version');
    
    const djangoVersion = await analyzer.detectVersion('django', [path.join(testRepoPath, 'requirements.txt')]);
    assert.strictEqual(djangoVersion, '3.2.8', 'Should detect correct Django version');
  });

  it('should detect architecture patterns', async () => {
    // Create a test file structure for MVC
    const mvcPath = path.join(testRepoPath, 'src');
    fs.mkdirSync(path.join(mvcPath, 'controllers'), { recursive: true });
    fs.mkdirSync(path.join(mvcPath, 'models'), { recursive: true });
    fs.mkdirSync(path.join(mvcPath, 'views'), { recursive: true });
    
    fs.writeFileSync(path.join(mvcPath, 'controllers', 'test.js'), '');
    fs.writeFileSync(path.join(mvcPath, 'models', 'test.js'), '');
    fs.writeFileSync(path.join(mvcPath, 'views', 'test.js'), '');
    
    const results = await analyzer.detectArchitecturePatterns(testRepoPath);
    
    assert.ok(results.length > 0, 'Should detect at least one architecture pattern');
    
    const patterns = results.map(r => r.pattern);
    assert.ok(patterns.includes('MVC'), 'Should detect MVC pattern');
  });
});