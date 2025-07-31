/**
 * Test suite for Workflow Generator
 */

import * as assert from 'assert';
import * as sinon from 'sinon';
import * as yaml from 'js-yaml';
import { WorkflowGenerator, WorkflowGenerationOptions } from '../../github/workflowGenerator';
import { LanguageProfile, UserPreferences, MegaLinterConfiguration } from '../../megalinter/types';

suite('Workflow Generator Tests', () => {
  let workflowGenerator: WorkflowGenerator;
  let consoleStub: sinon.SinonStub;

  setup(() => {
    workflowGenerator = new WorkflowGenerator();
    consoleStub = sinon.stub(console, 'log');
  });

  teardown(() => {
    sinon.restore();
  });

  const createMockProfile = (): LanguageProfile => ({
    primary: ['typescript', 'javascript'],
    secondary: ['json', 'yaml'],
    frameworks: ['node', 'express'],
    buildTools: ['npm', 'webpack'],
    configFiles: {
      'package_json': {
        path: 'package.json',
        type: 'npm',
        importance: 'critical'
      },
      'tsconfig_json': {
        path: 'tsconfig.json',
        type: 'typescript',
        importance: 'high'
      }
    },
    complexity: 'moderate',
    confidence: 0.85
  });

  const createMockPreferences = (): UserPreferences => ({
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
  });

  const createMockMegaLinterConfig = (): MegaLinterConfiguration => ({
    version: '7.0.0',
    linters: {
      enabled: [
        {
          name: 'eslint',
          version: 'latest',
          enabled: true,
          severity: 'error',
          rules: {},
          filePatterns: ['**/*.js', '**/*.ts'],
          excludePatterns: ['node_modules/**'],
          language: 'javascript',
          category: 'language' as any
        }
      ],
      disabled: ['spell-checker'],
      customRules: []
    },
    performance: {
      parallelism: 4,
      maxExecutionTime: 300000,
      cacheStrategy: 'conservative',
      incrementalScanning: false,
      resourceLimits: {
        maxMemory: '2GB',
        maxCpuCores: 2
      }
    },
    reporting: {
      formats: ['json', 'console'],
      destinations: ['console', 'file'],
      realTimeUpdates: true,
      includePassing: false
    },
    security: {
      enableSecurityLinters: true,
      securitySeverityThreshold: 'high',
      allowSecrets: false,
      trustedDirectories: []
    }
  });

  suite('generateMegaLinterWorkflow', () => {
    test('should generate basic workflow', async () => {
      const options: WorkflowGenerationOptions = {
        profile: createMockProfile(),
        preferences: createMockPreferences(),
        megalinterConfig: createMockMegaLinterConfig()
      };

      const workflow = await workflowGenerator.generateMegaLinterWorkflow(options);

      assert.ok(workflow.includes('name:'));
      assert.ok(workflow.includes('on:'));
      assert.ok(workflow.includes('jobs:'));
      assert.ok(workflow.includes('megalinter'));
      assert.ok(workflow.includes('oxsecurity/megalinter'));

      // Verify it's valid YAML
      const parsed = yaml.load(workflow);
      assert.ok(parsed);
      assert.ok(typeof parsed === 'object');
    });

    test('should include security features when enabled', async () => {
      const options: WorkflowGenerationOptions = {
        profile: createMockProfile(),
        preferences: {
          ...createMockPreferences(),
          securityPreferences: {
            enableSecurityScanning: true,
            secretsDetection: true,
            vulnerabilityScanning: true,
            licenseChecking: true
          }
        },
        megalinterConfig: createMockMegaLinterConfig()
      };

      const workflow = await workflowGenerator.generateMegaLinterWorkflow(options);

      assert.ok(workflow.includes('security-events: write'));
      assert.ok(workflow.includes('SARIF'));
      assert.ok(workflow.includes('security'));
    });

    test('should include matrix strategy for complex projects', async () => {
      const complexProfile = {
        ...createMockProfile(),
        complexity: 'complex' as const,
        primary: ['typescript', 'python', 'java']
      };

      const options: WorkflowGenerationOptions = {
        profile: complexProfile,
        preferences: createMockPreferences(),
        megalinterConfig: createMockMegaLinterConfig(),
        matrixStrategy: {
          languages: ['typescript', 'python', 'java'],
          profiles: ['fast', 'balanced'],
          parallel: true
        }
      };

      const workflow = await workflowGenerator.generateMegaLinterWorkflow(options);

      assert.ok(workflow.includes('strategy:'));
      assert.ok(workflow.includes('matrix:'));
    });

    test('should handle organization settings', async () => {
      const options: WorkflowGenerationOptions = {
        profile: createMockProfile(),
        preferences: createMockPreferences(),
        megalinterConfig: createMockMegaLinterConfig(),
        organizationSettings: {
          requiredChecks: ['megalinter'],
          allowedRunners: ['ubuntu-latest', 'self-hosted'],
          securityScanningRequired: true,
          complianceChecking: true,
          artifactRetentionDays: 90,
          timeoutMinutes: 45
        }
      };

      const workflow = await workflowGenerator.generateMegaLinterWorkflow(options);

      assert.ok(workflow.includes('timeout-minutes: 45'));
      assert.ok(workflow.includes('retention-days: 90'));
      assert.ok(workflow.includes('compliance'));
    });
  });

  suite('generateProjectSpecificWorkflow', () => {
    test('should generate Node.js specific workflow', async () => {
      const nodeProfile = {
        ...createMockProfile(),
        frameworks: ['node', 'express', 'react']
      };

      const options: WorkflowGenerationOptions = {
        profile: nodeProfile,
        preferences: createMockPreferences(),
        megalinterConfig: createMockMegaLinterConfig()
      };

      const workflow = await workflowGenerator.generateProjectSpecificWorkflow('nodejs', options);

      assert.ok(workflow.includes('setup-node'));
      assert.ok(workflow.includes('npm ci'));
      assert.ok(workflow.includes('cache: npm'));
    });

    test('should generate Python specific workflow', async () => {
      const pythonProfile = {
        ...createMockProfile(),
        primary: ['python'],
        frameworks: ['django', 'flask']
      };

      const options: WorkflowGenerationOptions = {
        profile: pythonProfile,
        preferences: createMockPreferences(),
        megalinterConfig: createMockMegaLinterConfig()
      };

      const workflow = await workflowGenerator.generateProjectSpecificWorkflow('python', options);

      assert.ok(workflow.includes('setup-python'));
      assert.ok(workflow.includes('pip install'));
    });

    test('should throw error for unsupported project type', async () => {
      const options: WorkflowGenerationOptions = {
        profile: createMockProfile(),
        preferences: createMockPreferences(),
        megalinterConfig: createMockMegaLinterConfig()
      };

      try {
        await workflowGenerator.generateProjectSpecificWorkflow('unsupported-language', options);
        assert.fail('Should have thrown error for unsupported project type');
      } catch (error) {
        assert.ok(error instanceof Error);
        assert.ok(error.message.includes('Unsupported project type'));
      }
    });
  });

  suite('validateWorkflow', () => {
    test('should validate correct workflow', async () => {
      const validWorkflow = `
name: MegaLinter
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
jobs:
  megalinter:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oxsecurity/megalinter@v7
`;

      const result = await workflowGenerator.validateWorkflow(validWorkflow);

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    test('should detect invalid YAML', async () => {
      const invalidWorkflow = `
name: MegaLinter
on:
  push:
    branches: [main
  # Missing closing bracket
jobs:
  megalinter:
    runs-on: ubuntu-latest
`;

      const result = await workflowGenerator.validateWorkflow(invalidWorkflow);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(result.errors[0].includes('YAML'));
    });

    test('should detect missing required fields', async () => {
      const incompleteWorkflow = `
name: MegaLinter
# Missing 'on' trigger
jobs:
  megalinter:
    runs-on: ubuntu-latest
`;

      const result = await workflowGenerator.validateWorkflow(incompleteWorkflow);

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(error => error.includes('trigger') || error.includes('on')));
    });

    test('should provide warnings for potential issues', async () => {
      const workflowWithIssues = `
name: MegaLinter
on: [push]
jobs:
  megalinter:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@main  # Unpinned version
      - uses: oxsecurity/megalinter@latest  # Latest tag instead of specific version
`;

      const result = await workflowGenerator.validateWorkflow(workflowWithIssues);

      // May be valid but should have warnings
      assert.ok(result.warnings.length > 0);
      assert.ok(result.warnings.some(warning => 
        warning.includes('pinned') || warning.includes('version')
      ));
    });
  });

  suite('optimizeWorkflow', () => {
    test('should optimize workflow for performance', async () => {
      const baseWorkflow = `
name: MegaLinter
on: [push, pull_request]
jobs:
  megalinter:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oxsecurity/megalinter@v7
`;

      const options: WorkflowGenerationOptions = {
        profile: createMockProfile(),
        preferences: {
          ...createMockPreferences(),
          performanceProfile: 'fast'
        },
        megalinterConfig: createMockMegaLinterConfig()
      };

      const optimized = await workflowGenerator.optimizeWorkflow(baseWorkflow, options);

      // Should include caching and other optimizations
      assert.ok(optimized.includes('cache') || optimized.includes('ENABLE_CACHE'));
      assert.ok(optimized.length >= baseWorkflow.length); // Should have added content
    });

    test('should add security optimizations when required', async () => {
      const baseWorkflow = `
name: MegaLinter
on: [push]
jobs:
  megalinter:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oxsecurity/megalinter@v7
`;

      const options: WorkflowGenerationOptions = {
        profile: createMockProfile(),
        preferences: {
          ...createMockPreferences(),
          securityPreferences: {
            enableSecurityScanning: true,
            secretsDetection: true,
            vulnerabilityScanning: true,
            licenseChecking: true
          }
        },
        megalinterConfig: createMockMegaLinterConfig()
      };

      const optimized = await workflowGenerator.optimizeWorkflow(baseWorkflow, options);

      assert.ok(optimized.includes('security-events'));
      assert.ok(optimized.includes('SARIF') || optimized.includes('sarif'));
    });
  });

  suite('generateWorkflowFromTemplate', () => {
    test('should generate workflow from template with substitutions', async () => {
      const template = `
name: {{workflow_name}}
on:
  push:
    branches: {{branches}}
jobs:
  {{job_name}}:
    runs-on: {{runner}}
    steps:
      - uses: actions/checkout@v4
      - name: Run {{linter_name}}
        uses: {{linter_action}}
`;

      const substitutions = {
        workflow_name: 'Custom MegaLinter',
        branches: "['main', 'develop']",
        job_name: 'custom-megalinter',
        runner: 'ubuntu-latest',
        linter_name: 'MegaLinter',
        linter_action: 'oxsecurity/megalinter@v7'
      };

      const result = await workflowGenerator.generateWorkflowFromTemplate(template, substitutions);

      assert.ok(result.includes('name: Custom MegaLinter'));
      assert.ok(result.includes("branches: ['main', 'develop']"));
      assert.ok(result.includes('custom-megalinter:'));
      assert.ok(result.includes('Run MegaLinter'));

      // Should not contain template placeholders
      assert.ok(!result.includes('{{'));
      assert.ok(!result.includes('}}'));
    });

    test('should handle missing substitutions gracefully', async () => {
      const template = `
name: {{workflow_name}}
on: [push]
jobs:
  test:
    runs-on: {{runner}}
`;

      const partialSubstitutions = {
        workflow_name: 'Test Workflow'
        // Missing 'runner' substitution
      };

      try {
        const result = await workflowGenerator.generateWorkflowFromTemplate(template, partialSubstitutions);
        // Should either throw error or handle gracefully
        assert.ok(!result.includes('{{runner}}') || result.includes('ubuntu-latest'));
      } catch (error) {
        assert.ok(error instanceof Error);
      }
    });
  });

  suite('Integration with MegaLinter Configuration', () => {
    test('should incorporate linter settings into workflow', async () => {
      const configWithSpecificLinters = {
        ...createMockMegaLinterConfig(),
        linters: {
          enabled: [
            {
              name: 'eslint',
              version: 'latest',
              enabled: true,
              severity: 'error',
              rules: { 'no-console': 'warn' },
              filePatterns: ['**/*.js'],
              excludePatterns: ['node_modules/**'],
              language: 'javascript',
              category: 'language' as any
            },
            {
              name: 'prettier',
              version: 'latest',
              enabled: true,
              severity: 'warning',
              rules: { 'printWidth': 100 },
              filePatterns: ['**/*.js', '**/*.ts'],
              excludePatterns: ['dist/**'],
              language: 'javascript',
              category: 'format' as any
            }
          ],
          disabled: ['spell-checker', 'copypaste'],
          customRules: []
        }
      };

      const options: WorkflowGenerationOptions = {
        profile: createMockProfile(),
        preferences: createMockPreferences(),
        megalinterConfig: configWithSpecificLinters
      };

      const workflow = await workflowGenerator.generateMegaLinterWorkflow(options);

      // Should include environment variables for linter configuration
      assert.ok(workflow.includes('ENABLE_LINTERS') || workflow.includes('LINTERS_ENABLED'));
      assert.ok(workflow.includes('DISABLE_LINTERS') || workflow.includes('LINTERS_DISABLED'));
    });

    test('should respect performance configuration', async () => {
      const performanceConfig = {
        ...createMockMegaLinterConfig(),
        performance: {
          parallelism: 8,
          maxExecutionTime: 600000,
          cacheStrategy: 'aggressive',
          incrementalScanning: true,
          resourceLimits: {
            maxMemory: '4GB',
            maxCpuCores: 4
          }
        }
      };

      const options: WorkflowGenerationOptions = {
        profile: createMockProfile(),
        preferences: createMockPreferences(),
        megalinterConfig: performanceConfig
      };

      const workflow = await workflowGenerator.generateMegaLinterWorkflow(options);

      assert.ok(workflow.includes('timeout-minutes: 10')); // 600000ms = 10min
      assert.ok(workflow.includes('PARALLEL') || workflow.includes('parallel'));
    });
  });
});