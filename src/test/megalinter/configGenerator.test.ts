/**
 * Unit tests for ConfigurationGenerator
 */

import * as assert from 'assert';
import { ConfigurationGenerator } from '../../megalinter/configGenerator';
import { 
  LanguageProfile, 
  UserPreferences, 
  LinterCategory,
  MegaLinterConfiguration 
} from '../../megalinter/types';

describe('ConfigurationGenerator', () => {
  let generator: ConfigurationGenerator;

  beforeEach(() => {
    generator = new ConfigurationGenerator();
  });

  describe('selectOptimalLinters', () => {
    it('should select JavaScript linters for JavaScript project', async () => {
      const profile: LanguageProfile = {
        primary: ['javascript'],
        secondary: ['html', 'css'],
        frameworks: ['react'],
        buildTools: ['npm'],
        configFiles: {},
        complexity: 'simple',
        confidence: 0.9
      };

      const linters = await generator.selectOptimalLinters(profile);
      
      const linterNames = linters.map(l => l.name);
      assert(linterNames.includes('eslint'), 'Should include ESLint for JavaScript');
      assert(linterNames.includes('prettier'), 'Should include Prettier for formatting');
      
      const jsLinters = linters.filter(l => l.language === 'javascript');
      assert(jsLinters.length > 0, 'Should have JavaScript-specific linters');
    });

    it('should select Python linters for Python project', async () => {
      const profile: LanguageProfile = {
        primary: ['python'],
        secondary: [],
        frameworks: ['django'],
        buildTools: ['pip'],
        configFiles: {},
        complexity: 'moderate',
        confidence: 0.8
      };

      const linters = await generator.selectOptimalLinters(profile);
      
      const linterNames = linters.map(l => l.name);
      assert(linterNames.includes('pylint'), 'Should include Pylint for Python');
      assert(linterNames.includes('black'), 'Should include Black for Python formatting');
      assert(linterNames.includes('bandit'), 'Should include Bandit for Python security');
    });

    it('should include security linters for all projects', async () => {
      const profile: LanguageProfile = {
        primary: ['typescript'],
        secondary: ['javascript'],
        frameworks: [],
        buildTools: ['npm'],
        configFiles: {},
        complexity: 'simple',
        confidence: 0.9
      };

      const linters = await generator.selectOptimalLinters(profile);
      
      const securityLinters = linters.filter(l => l.category === LinterCategory.SECURITY);
      assert(securityLinters.length > 0, 'Should include security linters');
      
      const linterNames = linters.map(l => l.name);
      assert(linterNames.includes('secretlint'), 'Should include secret detection');
    });
  });

  describe('generateConfiguration', () => {
    it('should generate complete MegaLinter configuration', async () => {
      const profile: LanguageProfile = {
        primary: ['typescript', 'javascript'],
        secondary: ['json', 'markdown'],
        frameworks: ['react'],
        buildTools: ['npm'],
        configFiles: {
          'package_json': {
            path: 'package.json',
            type: 'npm',
            importance: 'critical'
          }
        },
        complexity: 'moderate',
        confidence: 0.85
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

      const config = await generator.generateConfiguration(profile, preferences);
      
      // Verify configuration structure
      assert(config.version, 'Should have version');
      assert(config.linters, 'Should have linters configuration');
      assert(config.performance, 'Should have performance configuration');
      assert(config.reporting, 'Should have reporting configuration');
      assert(config.security, 'Should have security configuration');
      
      // Verify linters are configured
      assert(config.linters.enabled.length > 0, 'Should have enabled linters');
      assert(Array.isArray(config.linters.disabled), 'Should have disabled linters array');
      
      // Verify performance settings
      assert(typeof config.performance.maxExecutionTime === 'number', 'Should have execution time limit');
      assert(typeof config.performance.parallelism === 'number', 'Should have parallelism setting');
      
      // Verify security settings are applied
      assert(config.security.enableSecurityLinters === true, 'Should enable security linters');
      assert(config.security.allowSecrets === false, 'Should not allow secrets');
    });

    it('should adjust performance settings based on complexity', async () => {
      const simpleProfile: LanguageProfile = {
        primary: ['javascript'],
        secondary: [],
        frameworks: [],
        buildTools: [],
        configFiles: {},
        complexity: 'simple',
        confidence: 0.9
      };

      const complexProfile: LanguageProfile = {
        ...simpleProfile,
        complexity: 'complex'
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

      const simpleConfig = await generator.generateConfiguration(simpleProfile, preferences);
      const complexConfig = await generator.generateConfiguration(complexProfile, preferences);
      
      // Complex projects should have longer execution times and more resources
      assert(
        complexConfig.performance.maxExecutionTime > simpleConfig.performance.maxExecutionTime,
        'Complex projects should have longer execution time'
      );
      
      assert(
        complexConfig.performance.parallelism >= simpleConfig.performance.parallelism,
        'Complex projects should have equal or higher parallelism'
      );
    });
  });

  describe('validateConfiguration', () => {
    it('should validate valid configuration', async () => {
      const validConfig: MegaLinterConfiguration = {
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

      const validation = await generator.validateConfiguration(validConfig);
      assert(validation.valid, 'Valid configuration should pass validation');
      assert(validation.errors.length === 0, 'Should have no validation errors');
    });

    it('should detect configuration errors', async () => {
      const invalidConfig: MegaLinterConfiguration = {
        version: '7.0.0',
        linters: {
          enabled: [],
          disabled: [],
          customRules: []
        },
        performance: {
          maxExecutionTime: 30000, // Too low
          parallelism: 4,
          resourceLimits: {
            maxMemory: '256MB', // Too low
            maxCpuTime: 300,
            maxFileSize: 1048576,
            maxFilesPerLinter: 10000
          },
          cacheStrategy: 'conservative',
          incrementalScanning: true
        },
        reporting: {
          formats: [], // Empty formats array
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

      const validation = await generator.validateConfiguration(invalidConfig);
      assert(!validation.valid, 'Invalid configuration should fail validation');
      assert(validation.errors.length > 0, 'Should have validation errors');
      
      const errorCodes = validation.errors.map(e => e.code);
      assert(errorCodes.includes('INSUFFICIENT_MEMORY'), 'Should detect insufficient memory');
      assert(errorCodes.includes('NO_OUTPUT_FORMAT'), 'Should detect missing output format');
    });
  });

  describe('exportToYaml', () => {
    it('should export configuration to YAML format', async () => {
      const config: MegaLinterConfiguration = {
        version: '7.0.0',
        linters: {
          enabled: [{
            name: 'eslint',
            enabled: true,
            severity: 'error',
            rules: { 'no-console': 'warn' },
            filePatterns: ['**/*.js', '**/*.ts'],
            excludePatterns: ['node_modules/**'],
            language: 'javascript',
            category: LinterCategory.LANGUAGE
          }],
          disabled: ['jshint'],
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

      const yaml = await generator.exportToYaml(config);
      
      // Verify YAML structure
      assert(typeof yaml === 'string', 'Should return YAML string');
      assert(yaml.includes('MEGALINTER_CONFIG'), 'Should contain MegaLinter config');
      assert(yaml.includes('PARALLEL'), 'Should contain parallelism setting');
      assert(yaml.includes('ENABLE'), 'Should contain enabled linters');
      assert(yaml.includes('DISABLE'), 'Should contain disabled linters');
      assert(yaml.includes('TIMEOUT_SECONDS'), 'Should contain timeout setting');
    });
  });
});