/**
 * Unit tests for the AdvancedOrganizationProfiler
 */

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { AdvancedOrganizationProfiler } from '../../profiling/organizationProfiler';
import { CrossRepositoryPatterns, ComplianceMetrics } from '../../profiling/types';

describe('AdvancedOrganizationProfiler', () => {
  let profiler: AdvancedOrganizationProfiler;
  const orgPath = path.join(__dirname, '..', '..', '..', 'test-org');
  const repo1Path = path.join(orgPath, 'repo1');
  const repo2Path = path.join(orgPath, 'repo2');

  before(() => {
    profiler = new AdvancedOrganizationProfiler();
    
    // Create a test organization with two repositories
    if (!fs.existsSync(orgPath)) {
      fs.mkdirSync(orgPath, { recursive: true });
    }
    
    // Create repo1
    fs.mkdirSync(repo1Path, { recursive: true });
    fs.writeFileSync(path.join(repo1Path, 'package.json'), JSON.stringify({
      dependencies: {
        react: '17.0.2'
      }
    }));
    
    // Create repo2
    fs.mkdirSync(repo2Path, { recursive: true });
    fs.writeFileSync(path.join(repo2Path, 'package.json'), JSON.stringify({
      dependencies: {
        react: '17.0.2',
        express: '4.17.1'
      }
    }));
  });

  after(() => {
    // Clean up the test organization
    fs.rmSync(orgPath, { recursive: true, force: true });
  });

  it('should analyze multiple repositories', async () => {
    const patterns = await profiler.analyzeMultipleRepositories([repo1Path, repo2Path]);
    
    assert.ok(patterns.sharedTechnologies.length > 0, 'Should have shared technologies');
    assert.ok(patterns.consistencyScore >= 0, 'Should have a consistency score');
  });

  it('should compare standards compliance', async () => {
    const compliance = await profiler.compareStandardsCompliance([repo1Path, repo2Path]);
    
    assert.ok(compliance.overallCompliance >= 0, 'Should have an overall compliance score');
  });

  it('should identify best practices', async () => {
    const practices = await profiler.identifyBestPractices([repo1Path, repo2Path]);
    
    assert.ok(Object.keys(practices).length > 0, 'Should identify best practices');
  });

  it('should visualize technology stack', async () => {
    const stack = await profiler.visualizeTechnologyStack([repo1Path, repo2Path]);
    
    assert.ok(Object.keys(stack).length > 0, 'Should have a technology stack');
  });
});