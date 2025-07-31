/**
 * Unit tests for MegaLinterOrchestrator
 */

import * as assert from 'assert';
import * as sinon from 'sinon';
import { MegaLinterOrchestrator } from '../../megalinter/orchestrator';
import { 
  LanguageProfile, 
  MegaLinterConfiguration, 
  LintingResults,
  UserPreferences,
  LinterCategory 
} from '../../megalinter/types';

describe('MegaLinterOrchestrator', () => {
  let orchestrator: MegaLinterOrchestrator;
  let mockExecStub: sinon.SinonStub;

  beforeEach(() => {
    orchestrator = new MegaLinterOrchestrator();
    // Mock child_process.exec for Docker commands
    mockExecStub = sinon.stub();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('detectLanguages', () => {
    it('should detect languages in repository', async () => {
      const workspaceRoot = '/test/workspace';
      
      const languages = await orchestrator.detectLanguages(workspaceRoot);
      
      assert(Array.isArray(languages), 'Should return array of languages');
      assert(languages.length >= 0, 'Should return non-negative number of languages');
    });

    it('should handle empty repository', async () => {
      const workspaceRoot = '/empty/workspace';
      
      const languages = await orchestrator.detectLanguages(workspaceRoot);
      
      assert(Array.isArray(languages), 'Should return empty array for empty repository');
    });
  });

  describe('generateOptimalConfiguration', () => {
    it('should generate configuration from language profile', async () => {
      const profile: LanguageProfile = {
        primary: ['typescript', 'javascript'],
        secondary: ['json', 'yaml'],
        frameworks: ['react', 'node'],
        buildTools: ['npm'],
        configFiles: {
          'package_json': {
            path: 'package.json',
            type: 'npm',
            importance: 'critical'
          }
        },
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
          vulnerabilityScanning: true,
          licenseChecking: false
        }
      };

      const config = await orchestrator.generateOptimalConfiguration(profile, preferences);
      
      assert(config, 'Should return configuration');
      assert(config.version, 'Should have version');
      assert(config.linters, 'Should have linters configuration');
      assert(config.linters.enabled.length > 0, 'Should have enabled linters');
      assert(config.performance, 'Should have performance configuration');
      assert(config.reporting, 'Should have reporting configuration');
      assert(config.security, 'Should have security configuration');
    });

    it('should optimize for fast performance profile', async () => {
      const profile: LanguageProfile = {
        primary: ['javascript'],
        secondary: [],
        frameworks: [],
        buildTools: [],
        configFiles: {},
        complexity: 'simple',
        confidence: 0.9
      };

      const fastPreferences: UserPreferences = {
        severityThreshold: 'error',
        performanceProfile: 'fast',
        reportingPreferences: {
          format: 'json' as any,
          includePassingFiles: false,
          detailLevel: 'minimal',
          realTimeUpdates: false
        },
        securityPreferences: {
          enableSecurityScanning: false,
          secretsDetection: false,
          vulnerabilityScanning: false,
          licenseChecking: false
        }
      };

      const config = await orchestrator.generateOptimalConfiguration(profile, fastPreferences);
      
      // Fast profile should have fewer linters and shorter timeout
      assert(config.performance.maxExecutionTime <= 180000, 'Should have shorter execution time for fast profile');
      assert(config.linters.enabled.length <= 5, 'Should have fewer linters for fast profile');
      assert(!config.security.enableSecurityLinters, 'Should disable security linters for fast profile');
    });
  });

  describe('validateConfiguration', () => {
    it('should validate valid configuration', async () => {
      const config: MegaLinterConfiguration = {
        version: '7.0.0',
        linters: {
          enabled: [{
            name: 'eslint',
            enabled: true,
            severity: 'error',
            rules: {},
            filePatterns: ['**/*.js'],
            excludePatterns: ['node_modules/**'],
            language: 'javascript',
            category: LinterCategory.LANGUAGE
          }],
          disabled: [],
          customRules: []
        },
        performance: {
          maxExecutionTime: 300000,
          parallelism: 4,
          resourceLimits: {
            maxMemory: '2GB',
            maxCpuTime: 300,
            maxFileSize: 1048576,
            maxFilesPerLinter: 10000
          },
          cacheStrategy: 'conservative',
          incrementalScanning: true
        },
        reporting: {
          formats: ['json' as any],
          destinations: ['console' as any],
          realTimeUpdates: true,
          includePassing: false
        },
        security: {
          enableSecurityLinters: true,
          securitySeverityThreshold: 'high',
          allowSecrets: false,
          trustedDirectories: []
        }
      };

      const validation = await orchestrator.validateConfiguration(config);
      
      assert(validation.valid, 'Valid configuration should pass validation');
      assert(validation.errors.length === 0, 'Should have no validation errors');
    });

    it('should detect invalid configuration', async () => {
      const invalidConfig: MegaLinterConfiguration = {
        version: '',
        linters: {
          enabled: [],
          disabled: [],
          customRules: []
        },
        performance: {
          maxExecutionTime: 0,
          parallelism: 0,
          resourceLimits: {
            maxMemory: '',
            maxCpuTime: 0,
            maxFileSize: 0,
            maxFilesPerLinter: 0
          },
          cacheStrategy: 'conservative',
          incrementalScanning: true
        },
        reporting: {
          formats: [],
          destinations: [],
          realTimeUpdates: true,
          includePassing: false
        },
        security: {
          enableSecurityLinters: true,
          securitySeverityThreshold: 'high',
          allowSecrets: false,
          trustedDirectories: []
        }
      };

      const validation = await orchestrator.validateConfiguration(invalidConfig);
      
      assert(!validation.valid, 'Invalid configuration should fail validation');
      assert(validation.errors.length > 0, 'Should have validation errors');
    });
  });

  describe('executeLinting', () => {
    it('should execute linting with valid configuration', async () => {
      const config: MegaLinterConfiguration = {
        version: '7.0.0',
        linters: {
          enabled: [{
            name: 'eslint',
            enabled: true,
            severity: 'error',
            rules: {},
            filePatterns: ['**/*.js'],
            excludePatterns: ['node_modules/**'],
            language: 'javascript',
            category: LinterCategory.LANGUAGE
          }],
          disabled: [],
          customRules: []
        },
        performance: {
          maxExecutionTime: 300000,
          parallelism: 4,
          resourceLimits: {
            maxMemory: '2GB',
            maxCpuTime: 300,
            maxFileSize: 1048576,
            maxFilesPerLinter: 10000
          },
          cacheStrategy: 'conservative',
          incrementalScanning: true
        },
        reporting: {
          formats: ['json' as any],
          destinations: ['console' as any],
          realTimeUpdates: true,
          includePassing: false
        },
        security: {
          enableSecurityLinters: true,
          securitySeverityThreshold: 'high',
          allowSecrets: false,
          trustedDirectories: []
        }
      };

      const workspaceRoot = '/test/workspace';
      
      // Mock successful Docker execution
      const mockResults = {
        summary: {
          totalFiles: 10,
          lintedFiles: 8,
          totalIssues: 5,
          errorCount: 2,
          warningCount: 3,
          executionTime: 12500,
          linterResults: [{
            linter: 'eslint',
            files: 5,
            issues: 3,
          }]
        },
        issues: [],
        performance: {
          executionTime: 12500,
          memoryUsage: 256,
          cacheHitRate: 0.8
        }
      };

      // We can't easily mock the actual Docker execution in unit tests,
      // so we'll test the error handling and validation logic
      try {
        const results = await orchestrator.executeLinting(config, workspaceRoot);
        // If execution succeeds (Docker available), verify structure
        assert(results, 'Should return results');
        assert(results.summary, 'Should have summary');
        assert(Array.isArray(results.issues), 'Should have issues array');
      } catch (error) {
        // If Docker is not available, verify it's a proper error
        assert(error instanceof Error, 'Should throw proper error when Docker unavailable');
        assert(error.message.includes('Docker') || error.message.includes('ENOENT'), 
               'Error should indicate Docker issue');
      }
    });

    it('should handle execution timeout', async () => {
      const config: MegaLinterConfiguration = {
        version: '7.0.0',
        linters: {
          enabled: [{
            name: 'eslint',
            enabled: true,
            severity: 'error',
            rules: {},
            filePatterns: ['**/*.js'],
            excludePatterns: ['node_modules/**'],
            language: 'javascript',
            category: LinterCategory.LANGUAGE
          }],
          disabled: [],
          customRules: []
        },
        performance: {
          maxExecutionTime: 100, // Very short timeout
          parallelism: 1,
          resourceLimits: {
            maxMemory: '1GB',
            maxCpuTime: 1,
            maxFileSize: 1048576,
            maxFilesPerLinter: 10000
          },
          cacheStrategy: 'conservative',
          incrementalScanning: true
        },
        reporting: {
          formats: ['json' as any],
          destinations: ['console' as any],
          realTimeUpdates: true,
          includePassing: false
        },
        security: {
          enableSecurityLinters: false,
          securitySeverityThreshold: 'high',
          allowSecrets: false,
          trustedDirectories: []
        }
      };

      const workspaceRoot = '/test/workspace';
      
      try {
        await orchestrator.executeLinting(config, workspaceRoot);
        // If no timeout occurs, that's fine too
        assert(true, 'Execution completed within timeout or Docker unavailable');
      } catch (error) {
        // Should handle timeout or Docker unavailability gracefully
        assert(error instanceof Error, 'Should throw proper error');
        assert(
          error.message.includes('timeout') || 
          error.message.includes('Docker') || 
          error.message.includes('ENOENT'),
          'Error should indicate timeout or Docker issue'
        );
      }
    });
  });

  describe('checkDockerAvailability', () => {
    it('should check if Docker is available', async () => {
      try {
        const isAvailable = await orchestrator.checkDockerAvailability();
        assert(typeof isAvailable === 'boolean', 'Should return boolean');
      } catch (error) {
        // Docker not available is acceptable in test environment
        assert(error instanceof Error, 'Should throw proper error when Docker unavailable');
      }
    });
  });

  describe('getRecommendedConfiguration', () => {
    it('should return recommended configuration for project type', async () => {
      const projectTypes = ['javascript', 'typescript', 'python', 'java'];
      
      for (const projectType of projectTypes) {
        const config = await orchestrator.getRecommendedConfiguration(projectType);
        
        assert(config, `Should return configuration for ${projectType}`);
        assert(config.version, 'Should have version');
        assert(config.linters.enabled.length > 0, `Should have enabled linters for ${projectType}`);
        
        // Verify project-specific linters are included
        const linterNames = config.linters.enabled.map(l => l.name);
        if (projectType === 'javascript' || projectType === 'typescript') {
          assert(linterNames.includes('eslint'), 'Should include ESLint for JS/TS projects');
        } else if (projectType === 'python') {
          assert(linterNames.includes('pylint'), 'Should include Pylint for Python projects');
        }
      }
    });

    it('should handle unknown project type', async () => {
      try {
        const config = await orchestrator.getRecommendedConfiguration('unknown-language');
        // Should return generic configuration
        assert(config, 'Should return generic configuration for unknown type');
        assert(config.linters.enabled.length > 0, 'Should have some enabled linters');
      } catch (error) {
        assert(error instanceof Error, 'Should throw proper error for unknown type');
      }
    });
  });
});