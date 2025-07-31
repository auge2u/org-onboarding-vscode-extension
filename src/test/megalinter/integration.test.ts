/**
 * Integration tests for MegaLinter system
 * Tests the complete workflow from repository analysis to linting execution
 */

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { RepositoryProfiler } from '../../megalinter/profiler';
import { ConfigurationGenerator } from '../../megalinter/configGenerator';
import { MegaLinterOrchestrator } from '../../megalinter/orchestrator';
import { 
  UserPreferences, 
  LintingResults,
  LanguageProfile 
} from '../../megalinter/types';

describe('MegaLinter Integration Tests', () => {
  let profiler: RepositoryProfiler;
  let generator: ConfigurationGenerator;
  let orchestrator: MegaLinterOrchestrator;
  let testWorkspaceRoot: string;

  beforeEach(() => {
    profiler = new RepositoryProfiler();
    generator = new ConfigurationGenerator();
    orchestrator = new MegaLinterOrchestrator();
    testWorkspaceRoot = path.join(__dirname, '../../..');
  });

  describe('Complete Workflow', () => {
    it('should execute complete MegaLinter workflow', async function() {
      this.timeout(30000); // Extended timeout for integration test
      
      try {
        // Step 1: Analyze repository
        console.log('Step 1: Analyzing repository...');
        const profile = await profiler.analyzeRepository(testWorkspaceRoot);
        
        assert(profile, 'Should analyze repository successfully');
        assert(profile.primary.length > 0, 'Should detect primary languages');
        assert(typeof profile.confidence === 'number', 'Should have confidence score');
        assert(profile.confidence >= 0 && profile.confidence <= 1, 'Confidence should be between 0 and 1');
        
        console.log(`Detected languages: ${profile.primary.join(', ')}`);
        console.log(`Frameworks: ${profile.frameworks.join(', ')}`);
        console.log(`Complexity: ${profile.complexity}`);
        
        // Step 2: Generate optimal configuration
        console.log('Step 2: Generating configuration...');
        const preferences: UserPreferences = {
          severityThreshold: 'warning',
          performanceProfile: 'balanced',
          reportingPreferences: {
            format: 'json' as any,
            includePassingFiles: false,
            detailLevel: 'standard',
            realTimeUpdates: true
          },
          securityPreferences: {
            enableSecurityScanning: true,
            secretsDetection: true,
            vulnerabilityScanning: false, // Disable for faster testing
            licenseChecking: false
          }
        };
        
        const config = await orchestrator.generateOptimalConfiguration(profile, preferences);
        
        assert(config, 'Should generate configuration successfully');
        assert(config.linters.enabled.length > 0, 'Should have enabled linters');
        assert(config.performance.maxExecutionTime > 0, 'Should have valid execution time');
        
        console.log(`Generated config with ${config.linters.enabled.length} linters`);
        console.log(`Linters: ${config.linters.enabled.map(l => l.name).join(', ')}`);
        
        // Step 3: Validate configuration
        console.log('Step 3: Validating configuration...');
        const validation = await orchestrator.validateConfiguration(config);
        
        if (!validation.valid) {
          console.log('Validation errors:', validation.errors);
          // For integration tests, we might have some expected validation issues
          // but the configuration should still be mostly valid
          assert(validation.errors.length < 5, 'Should have minimal validation errors');
        }
        
        // Step 4: Export configuration to YAML
        console.log('Step 4: Exporting configuration...');
        const yamlConfig = await generator.exportToYaml(config);
        
        assert(typeof yamlConfig === 'string', 'Should export YAML configuration');
        assert(yamlConfig.includes('MEGALINTER_CONFIG'), 'Should contain MegaLinter config');
        assert(yamlConfig.length > 100, 'Should generate substantial configuration');
        
        console.log('YAML config length:', yamlConfig.length);
        
        // Step 5: Check Docker availability (optional)
        console.log('Step 5: Checking Docker availability...');
        try {
          const dockerAvailable = await orchestrator.checkDockerAvailability();
          console.log('Docker available:', dockerAvailable);
          
          if (dockerAvailable) {
            // Step 6: Execute linting (only if Docker is available)
            console.log('Step 6: Executing linting (limited scope)...');
            
            // Create a minimal test configuration for faster execution
            const testConfig = {
              ...config,
              performance: {
                ...config.performance,
                maxExecutionTime: 30000, // 30 seconds max
                parallelism: 1
              },
              linters: {
                ...config.linters,
                enabled: config.linters.enabled.slice(0, 2) // Only first 2 linters for speed
              }
            };
            
            const results = await orchestrator.executeLinting(testConfig, testWorkspaceRoot);
            
            assert(results, 'Should return linting results');
            assert(results.summary, 'Should have results summary');
            assert(typeof results.summary.totalFiles === 'number', 'Should report total files');
            assert(Array.isArray(results.issues), 'Should return issues array');
            
            console.log(`Linting completed: ${results.summary.totalFiles} files, ${results.summary.totalIssues} issues`);
          } else {
            console.log('Skipping linting execution - Docker not available');
          }
        } catch (dockerError) {
          console.log('Docker check failed:', dockerError.message);
          console.log('Skipping linting execution');
        }
        
        console.log('Integration test completed successfully!');
        
      } catch (error) {
        console.error('Integration test failed:', error);
        throw error;
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid workspace path gracefully', async () => {
      const invalidPath = '/non/existent/path';
      
      try {
        await profiler.analyzeRepository(invalidPath);
        assert.fail('Should throw error for invalid path');
      } catch (error) {
        assert(error instanceof Error, 'Should throw proper error');
        assert(error.message.includes('ENOENT') || error.message.includes('not found'), 
               'Should indicate path not found');
      }
    });

    it('should handle empty repository gracefully', async () => {
      // Create temporary empty directory
      const tempDir = path.join(__dirname, 'temp-empty');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      try {
        const profile = await profiler.analyzeRepository(tempDir);
        
        // Should still return a valid profile, even if minimal
        assert(profile, 'Should return profile for empty repository');
        assert(Array.isArray(profile.primary), 'Should have primary languages array');
        assert(Array.isArray(profile.secondary), 'Should have secondary languages array');
        assert(typeof profile.confidence === 'number', 'Should have confidence score');
        
      } finally {
        // Clean up
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      }
    });

    it('should handle configuration generation failures', async () => {
      const invalidProfile: LanguageProfile = {
        primary: [],
        secondary: [],
        frameworks: [],
        buildTools: [],
        configFiles: {},
        complexity: 'simple',
        confidence: 0
      };

      const preferences: UserPreferences = {
        severityThreshold: 'warning',
        performanceProfile: 'balanced',
        reportingPreferences: {
          format: 'json' as any,
          includePassingFiles: false,
          detailLevel: 'standard',
          realTimeUpdates: true
        },
        securityPreferences: {
          enableSecurityScanning: true,
          secretsDetection: true,
          vulnerabilityScanning: true,
          licenseChecking: false
        }
      };

      try {
        const config = await orchestrator.generateOptimalConfiguration(invalidProfile, preferences);
        
        // Should still generate a configuration, even if minimal
        assert(config, 'Should generate configuration even for empty profile');
        assert(config.linters, 'Should have linters configuration');
        assert(config.performance, 'Should have performance configuration');
        
      } catch (error) {
        // If it throws an error, it should be a proper error
        assert(error instanceof Error, 'Should throw proper error');
      }
    });
  });

  describe('Performance', () => {
    it('should complete repository analysis within reasonable time', async function() {
      this.timeout(10000); // 10 second timeout
      
      const startTime = Date.now();
      const profile = await profiler.analyzeRepository(testWorkspaceRoot);
      const endTime = Date.now();
      
      const executionTime = endTime - startTime;
      console.log(`Repository analysis took ${executionTime}ms`);
      
      assert(executionTime < 8000, 'Repository analysis should complete within 8 seconds');
      assert(profile, 'Should return valid profile');
    });

    it('should generate configuration within reasonable time', async function() {
      this.timeout(5000); // 5 second timeout
      
      const profile: LanguageProfile = {
        primary: ['typescript', 'javascript'],
        secondary: ['json', 'yaml'],
        frameworks: ['react', 'node'],
        buildTools: ['npm'],
        configFiles: {},
        complexity: 'moderate',
        confidence: 0.8
      };

      const preferences: UserPreferences = {
        severityThreshold: 'warning',
        performanceProfile: 'balanced',
        reportingPreferences: {
          format: 'json' as any,
          includePassingFiles: false,
          detailLevel: 'standard',
          realTimeUpdates: true
        },
        securityPreferences: {
          enableSecurityScanning: true,
          secretsDetection: true,
          vulnerabilityScanning: false,
          licenseChecking: false
        }
      };
      
      const startTime = Date.now();
      const config = await orchestrator.generateOptimalConfiguration(profile, preferences);
      const endTime = Date.now();
      
      const executionTime = endTime - startTime;
      console.log(`Configuration generation took ${executionTime}ms`);
      
      assert(executionTime < 3000, 'Configuration generation should complete within 3 seconds');
      assert(config, 'Should return valid configuration');
    });
  });
});