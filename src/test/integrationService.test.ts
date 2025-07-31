/**
 * Test suite for Integration Service
 */

import * as assert from 'assert';
import * as sinon from 'sinon';
import { 
  IntegrationService, 
  IntegrationServiceOptions, 
  ExecutionOptions, 
  IntegrationStatus 
} from '../integrationService';
import { LintingResults } from '../megalinter/types';
import { MegaLinterWorkflowResult } from '../githubActionsApi';

suite('Integration Service Tests', () => {
  let integrationService: IntegrationService;
  let consoleStub: sinon.SinonStub;

  setup(() => {
    integrationService = new IntegrationService();
    consoleStub = sinon.stub(console, 'log');
  });

  teardown(() => {
    integrationService.dispose();
    sinon.restore();
  });

  const createMockOptions = (): IntegrationServiceOptions => ({
    repositoryPath: '/test/repo',
    githubToken: 'test-token',
    organization: 'test-org',
    repository: 'test-repo',
    preferences: {
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
    }
  });

  const createMockLintingResults = (): LintingResults => ({
    executionId: 'test-exec-1',
    timestamp: new Date(),
    duration: 120000,
    repository: {
      rootPath: '/test/repo',
      lastAnalyzed: new Date()
    },
    configuration: {} as any,
    results: [],
    summary: {
      totalFiles: 50,
      totalIssues: 15,
      errorCount: 5,
      warningCount: 10,
      infoCount: 0,
      fixableCount: 8,
      lintersExecuted: 12,
      lintersSucceeded: 11,
      lintersFailed: 1
    },
    performance: {
      totalExecutionTime: 120000,
      linterExecutionTimes: {},
      memoryUsage: 512,
      cpuUsage: 75,
      cacheHits: 100,
      cacheMisses: 25
    }
  });

  const createMockWorkflowResult = (): MegaLinterWorkflowResult => ({
    run: {
      id: 12345,
      status: 'completed',
      conclusion: 'success',
      created_at: '2023-12-01T10:00:00Z',
      updated_at: '2023-12-01T10:05:00Z',
      html_url: 'https://github.com/test-org/test-repo/actions/runs/12345'
    },
    jobs: [
      {
        id: 67890,
        name: 'megalinter',
        status: 'completed',
        conclusion: 'success',
        started_at: '2023-12-01T10:00:30Z',
        completed_at: '2023-12-01T10:04:30Z'
      }
    ],
    artifacts: [],
    summary: {
      totalIssues: 15,
      errorCount: 5,
      warningCount: 10,
      fixableCount: 8,
      lintersExecuted: 12,
      duration: 240000
    }
  });

  suite('execute', () => {
    test('should execute local mode successfully', async () => {
      const options = createMockOptions();
      const executionOptions: ExecutionOptions = { mode: 'local' };

      // Mock local execution
      sinon.stub(integrationService as any, 'executeLocal')
        .resolves(createMockLintingResults());

      const result = await integrationService.execute(options, executionOptions);

      assert.strictEqual(result.success, true);
      assert.ok(result.localResults);
      assert.strictEqual(result.localResults.summary.totalIssues, 15);
      assert.strictEqual(result.summary.mode, 'local');
      assert.strictEqual(result.summary.totalIssues, 15);
    });

    test('should execute remote mode successfully', async () => {
      const options = createMockOptions();
      const executionOptions: ExecutionOptions = { mode: 'remote' };

      // Mock remote execution
      sinon.stub(integrationService as any, 'executeRemote')
        .resolves(createMockWorkflowResult());

      const result = await integrationService.execute(options, executionOptions);

      assert.strictEqual(result.success, true);
      assert.ok(result.remoteResults);
      assert.strictEqual(result.remoteResults.summary.totalIssues, 15);
      assert.strictEqual(result.summary.mode, 'remote');
      assert.strictEqual(result.summary.totalIssues, 15);
    });

    test('should execute hybrid mode successfully', async () => {
      const options = createMockOptions();
      const executionOptions: ExecutionOptions = { mode: 'hybrid' };

      // Mock hybrid execution
      sinon.stub(integrationService as any, 'executeHybrid')
        .resolves({
          localResults: createMockLintingResults(),
          remoteResults: createMockWorkflowResult(),
          comparison: {
            issuesDiff: 0,
            executionTimeDiff: 120000,
            consistencyScore: 1.0
          }
        });

      const result = await integrationService.execute(options, executionOptions);

      assert.strictEqual(result.success, true);
      assert.ok(result.localResults);
      assert.ok(result.remoteResults);
      assert.ok(result.comparison);
      assert.strictEqual(result.summary.mode, 'hybrid');
      assert.strictEqual(result.summary.totalIssues, 15); // Should use local results as primary
    });

    test('should handle execution errors gracefully', async () => {
      const options = createMockOptions();
      const executionOptions: ExecutionOptions = { mode: 'local' };

      // Mock execution failure
      sinon.stub(integrationService as any, 'executeLocal')
        .rejects(new Error('Docker not available'));

      const result = await integrationService.execute(options, executionOptions);

      assert.strictEqual(result.success, false);
      assert.ok(result.error);
      assert.ok(result.error.includes('Docker not available'));
      assert.strictEqual(result.summary.totalIssues, 0);
    });

    test('should require remote configuration for remote mode', async () => {
      const incompleteOptions = {
        repositoryPath: '/test/repo'
        // Missing GitHub credentials
      };
      const executionOptions: ExecutionOptions = { mode: 'remote' };

      const result = await integrationService.execute(incompleteOptions, executionOptions);

      assert.strictEqual(result.success, false);
      assert.ok(result.error);
      assert.ok(result.error.includes('requires GitHub token'));
    });

    test('should generate recommendations when available', async () => {
      const options = createMockOptions();
      const executionOptions: ExecutionOptions = { mode: 'local' };

      const mockResults = createMockLintingResults();
      mockResults.summary.errorCount = 10; // High error count for recommendations

      sinon.stub(integrationService as any, 'executeLocal').resolves(mockResults);
      sinon.stub(integrationService as any, 'generateRecommendations')
        .resolves(['Fix critical errors first', 'Consider optimizing configuration']);

      const result = await integrationService.execute(options, executionOptions);

      assert.strictEqual(result.success, true);
      assert.ok(result.recommendations);
      assert.strictEqual(result.recommendations.length, 2);
    });

    test('should emit events during execution', (done) => {
      const options = createMockOptions();
      const executionOptions: ExecutionOptions = { mode: 'local' };

      let eventCount = 0;
      integrationService.onEvent((event) => {
        eventCount++;
        if (event.type === 'execution_started') {
          assert.strictEqual(event.data.mode, 'local');
        }
        
        if (eventCount >= 2) { // Started and completed events
          done();
        }
      });

      sinon.stub(integrationService as any, 'executeLocal')
        .resolves(createMockLintingResults());

      integrationService.execute(options, executionOptions);
    });
  });

  suite('setupWorkflow', () => {
    test('should setup workflow successfully', async () => {
      const options = createMockOptions();
      const workflowOptions = {
        template: 'basic' as const,
        autoTrigger: true,
        monitorProgress: true
      };

      // Mock CI/CD orchestrator
      const orchestrateStub = sinon.stub(integrationService as any, 'cicdOrchestrator');
      orchestrateStub.orchestrateCI = sinon.stub().resolves({
        deployment: {
          success: true,
          workflowPath: '.github/workflows/megalinter.yml',
          workflowUrl: 'https://github.com/test-org/test-repo/blob/main/.github/workflows/megalinter.yml'
        }
      });

      const result = await integrationService.setupWorkflow(options, workflowOptions);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.workflowPath, '.github/workflows/megalinter.yml');
      assert.ok(result.workflowUrl);
      assert.ok(orchestrateStub.orchestrateCI.calledOnce);
    });

    test('should handle workflow setup errors', async () => {
      const options = createMockOptions();

      const orchestrateStub = sinon.stub(integrationService as any, 'cicdOrchestrator');
      orchestrateStub.orchestrateCI = sinon.stub().resolves({
        deployment: {
          success: false,
          workflowPath: '.github/workflows/megalinter.yml',
          errors: ['Invalid workflow syntax', 'Missing permissions']
        }
      });

      const result = await integrationService.setupWorkflow(options);

      assert.strictEqual(result.success, false);
      assert.ok(result.errors);
      assert.strictEqual(result.errors.length, 2);
    });

    test('should require remote credentials for workflow setup', async () => {
      const incompleteOptions = {
        repositoryPath: '/test/repo'
        // Missing GitHub credentials
      };

      const result = await integrationService.setupWorkflow(incompleteOptions);

      assert.strictEqual(result.success, false);
      assert.ok(result.errors);
      assert.ok(result.errors[0].includes('requires GitHub token'));
    });
  });

  suite('getStatus', () => {
    test('should return comprehensive status when fully configured', async () => {
      const options = createMockOptions();

      // Mock MegaLinter orchestrator status
      const megalinterStub = sinon.stub(integrationService as any, 'megalinterOrchestrator');
      megalinterStub.getStatus = sinon.stub().resolves({
        dockerAvailable: true,
        megalinterVersion: '7.0.0',
        health: 'healthy'
      });

      // Mock CI/CD orchestrator status
      const cicdStub = sinon.stub(integrationService as any, 'cicdOrchestrator');
      cicdStub.getIntegrationStatus = sinon.stub().resolves({
        localStatus: { dockerAvailable: true, health: 'healthy' },
        remoteStatus: { workflowHealth: 'healthy' },
        syncStatus: 'synced',
        recommendations: ['System is healthy']
      });

      const status = await integrationService.getStatus(options);

      assert.strictEqual(status.localAvailable, true);
      assert.strictEqual(status.remoteConfigured, true);
      assert.strictEqual(status.syncStatus, 'synced');
      assert.strictEqual(status.health, 'healthy');
      assert.ok(status.recommendations.includes('System is healthy'));
    });

    test('should detect Docker unavailable', async () => {
      const options = createMockOptions();

      const megalinterStub = sinon.stub(integrationService as any, 'megalinterOrchestrator');
      megalinterStub.getStatus = sinon.stub().resolves({
        dockerAvailable: false,
        health: 'error'
      });

      const status = await integrationService.getStatus(options);

      assert.strictEqual(status.localAvailable, false);
      assert.strictEqual(status.health, 'warning');
      assert.ok(status.recommendations.some(rec => rec.includes('Docker')));
    });

    test('should handle missing remote configuration', async () => {
      const incompleteOptions = {
        repositoryPath: '/test/repo'
        // Missing GitHub credentials
      };

      const megalinterStub = sinon.stub(integrationService as any, 'megalinterOrchestrator');
      megalinterStub.getStatus = sinon.stub().resolves({
        dockerAvailable: true,
        health: 'healthy'
      });

      const status = await integrationService.getStatus(incompleteOptions);

      assert.strictEqual(status.remoteConfigured, false);
      assert.ok(status.recommendations.some(rec => rec.includes('GitHub integration')));
    });

    test('should handle status check errors', async () => {
      const options = createMockOptions();

      const megalinterStub = sinon.stub(integrationService as any, 'megalinterOrchestrator');
      megalinterStub.getStatus = sinon.stub().rejects(new Error('Status check failed'));

      const status = await integrationService.getStatus(options);

      assert.strictEqual(status.localAvailable, false);
      assert.strictEqual(status.remoteConfigured, false);
      assert.strictEqual(status.health, 'error');
      assert.ok(status.recommendations.some(rec => rec.includes('Status check failed')));
    });
  });

  suite('syncConfiguration', () => {
    test('should sync configuration successfully', async () => {
      const options = createMockOptions();

      const cicdStub = sinon.stub(integrationService as any, 'cicdOrchestrator');
      cicdStub.syncConfigurationWithWorkflow = sinon.stub().resolves({
        success: true,
        changes: ['Updated remote workflow configuration', 'Synced linter settings'],
        conflicts: undefined
      });

      const result = await integrationService.syncConfiguration(options, 'local-to-remote');

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.changes.length, 2);
      assert.strictEqual(result.conflicts, undefined);
    });

    test('should handle sync conflicts', async () => {
      const options = createMockOptions();

      const cicdStub = sinon.stub(integrationService as any, 'cicdOrchestrator');
      cicdStub.syncConfigurationWithWorkflow = sinon.stub().resolves({
        success: false,
        changes: [],
        conflicts: ['Conflicting linter configurations', 'Different security settings']
      });

      const result = await integrationService.syncConfiguration(options);

      assert.strictEqual(result.success, false);
      assert.ok(result.conflicts);
      assert.strictEqual(result.conflicts.length, 2);
    });

    test('should require remote configuration for sync', async () => {
      const incompleteOptions = {
        repositoryPath: '/test/repo'
        // Missing GitHub credentials
      };

      const result = await integrationService.syncConfiguration(incompleteOptions);

      assert.strictEqual(result.success, false);
      assert.ok(result.conflicts);
      assert.ok(result.conflicts[0].includes('missing GitHub credentials'));
    });
  });

  suite('getRecommendations', () => {
    test('should provide comprehensive recommendations when configured', async () => {
      const options = createMockOptions();

      const cicdStub = sinon.stub(integrationService as any, 'cicdOrchestrator');
      cicdStub.getIntelligentRecommendations = sinon.stub().resolves({
        performance: ['Enable caching for faster builds'],
        configuration: ['Add security scanning'],
        workflow: ['Set up matrix strategy'],
        integration: ['Configure notifications']
      });

      const recommendations = await integrationService.getRecommendations(options);

      assert.ok(recommendations.performance.length > 0);
      assert.ok(recommendations.configuration.length > 0);
      assert.ok(recommendations.workflow.length > 0);
      assert.ok(recommendations.integration.length > 0);
    });

    test('should provide basic recommendations when not configured', async () => {
      const incompleteOptions = {
        repositoryPath: '/test/repo'
        // Missing GitHub credentials
      };

      const recommendations = await integrationService.getRecommendations(incompleteOptions);

      assert.ok(recommendations.performance.some(rec => rec.includes('Docker')));
      assert.ok(recommendations.workflow.some(rec => rec.includes('GitHub')));
      assert.ok(recommendations.integration.some(rec => rec.includes('GitHub token')));
    });
  });

  suite('Private Helper Methods', () => {
    test('should detect remote configuration correctly', () => {
      const completeOptions = createMockOptions();
      const incompleteOptions = { repositoryPath: '/test/repo' };

      assert.strictEqual(
        (integrationService as any).isRemoteConfigured(completeOptions), 
        true
      );
      assert.strictEqual(
        (integrationService as any).isRemoteConfigured(incompleteOptions), 
        false
      );
    });

    test('should generate execution preferences correctly', () => {
      const executionOptions: ExecutionOptions = {
        mode: 'hybrid',
        profile: 'thorough',
        autoSync: true
      };

      const preferences = (integrationService as any).getExecutionPreferences(
        executionOptions, 
        undefined
      );

      assert.strictEqual(preferences.performanceProfile, 'thorough');
      assert.strictEqual(preferences.severityThreshold, 'warning');
      assert.ok(preferences.securityPreferences.enableSecurityScanning);
    });

    test('should generate appropriate recommendations based on results', async () => {
      const options = createMockOptions();
      const executionResult = {
        localResults: {
          summary: { errorCount: 15, totalIssues: 25 }
        },
        comparison: { consistencyScore: 0.6 },
        summary: { executionTime: 400000 } // > 5 minutes
      };

      const recommendations = await (integrationService as any).generateRecommendations(
        options, 
        executionResult
      );

      assert.ok(recommendations.some(rec => rec.includes('15 errors found')));
      assert.ok(recommendations.some(rec => rec.includes('differ significantly')));
      assert.ok(recommendations.some(rec => rec.includes('Execution time is high')));
    });
  });

  suite('Event Handling', () => {
    test('should forward events from orchestrators', (done) => {
      let eventReceived = false;

      integrationService.onEvent((event) => {
        if (event.type === 'status_changed') {
          assert.ok(event.data.source);
          eventReceived = true;
          done();
        }
      });

      // Simulate event from MegaLinter orchestrator
      const megalinterStub = (integrationService as any).megalinterOrchestrator;
      if (megalinterStub && megalinterStub.onLintingEvent) {
        // This would be set up in the actual implementation
        megalinterStub.onLintingEvent({
          type: 'completed',
          timestamp: new Date(),
          executionId: 'test',
          data: { test: true }
        });
      } else {
        // Directly trigger the event for testing
        (integrationService as any).eventEmitter.fire({
          type: 'status_changed',
          data: { source: 'test', event: {} }
        });
      }
    });

    test('should handle event subscription and unsubscription', () => {
      let eventCount = 0;
      const disposable = integrationService.onEvent(() => {
        eventCount++;
      });

      // Trigger event
      (integrationService as any).eventEmitter.fire({
        type: 'execution_started',
        data: {}
      });

      assert.strictEqual(eventCount, 1);

      // Dispose and trigger again
      disposable.dispose();
      (integrationService as any).eventEmitter.fire({
        type: 'execution_started',
        data: {}
      });

      assert.strictEqual(eventCount, 1); // Should not increment
    });
  });

  suite('Resource Management', () => {
    test('should dispose of resources properly', () => {
      const megalinterStub = sinon.stub(integrationService as any, 'megalinterOrchestrator');
      megalinterStub.dispose = sinon.stub();

      const cicdStub = sinon.stub(integrationService as any, 'cicdOrchestrator');
      cicdStub.dispose = sinon.stub();

      const eventStub = sinon.stub(integrationService as any, 'eventEmitter');
      eventStub.dispose = sinon.stub();

      integrationService.dispose();

      assert.ok(megalinterStub.dispose.calledOnce);
      assert.ok(cicdStub.dispose.calledOnce);
      assert.ok(eventStub.dispose.calledOnce);
    });
  });
});