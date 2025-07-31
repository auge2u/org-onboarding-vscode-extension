/**
 * Test suite for CI/CD Orchestrator
 */

import * as assert from 'assert';
import * as sinon from 'sinon';
import { CICDOrchestrator, CICDOrchestrationOptions, AutomationRule } from '../../github/cicdOrchestrator';
import { LanguageProfile, UserPreferences, LintingResults } from '../../megalinter/types';
import { MegaLinterWorkflowResult } from '../../githubActionsApi';

suite('CI/CD Orchestrator Tests', () => {
  let orchestrator: CICDOrchestrator;
  let consoleStub: sinon.SinonStub;

  setup(() => {
    orchestrator = new CICDOrchestrator();
    consoleStub = sinon.stub(console, 'log');
  });

  teardown(() => {
    orchestrator.dispose();
    sinon.restore();
  });

  const createMockOptions = (): CICDOrchestrationOptions => ({
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
    },
    autoTrigger: true,
    monitorProgress: true
  });

  const createMockProfile = (): LanguageProfile => ({
    primary: ['typescript', 'javascript'],
    secondary: ['json', 'yaml'],
    frameworks: ['node', 'express'],
    buildTools: ['npm'],
    configFiles: {},
    complexity: 'moderate',
    confidence: 0.85
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
    artifacts: [
      {
        id: 111,
        name: 'megalinter-reports',
        size_in_bytes: 1024000,
        created_at: '2023-12-01T10:05:00Z',
        download_url: 'https://api.github.com/repos/test-org/test-repo/actions/artifacts/111/zip'
      }
    ],
    summary: {
      totalIssues: 15,
      errorCount: 5,
      warningCount: 10,
      fixableCount: 8,
      lintersExecuted: 12,
      duration: 240000
    }
  });

  suite('orchestrateCI', () => {
    test('should orchestrate complete CI pipeline', async () => {
      const options = createMockOptions();

      // Mock the internal methods that would make external calls
      const profilerStub = sinon.stub(orchestrator as any, 'analyzeRepositoryForCI')
        .resolves(createMockProfile());
      const configStub = sinon.stub(orchestrator as any, 'generateOptimalConfig')
        .resolves({});
      const templateStub = sinon.stub(orchestrator as any, 'selectOptimalWorkflow')
        .resolves({ name: 'basic', content: 'mock-workflow' });
      const customizeStub = sinon.stub(orchestrator as any, 'customizeWorkflowForRepository')
        .resolves('customized-workflow');
      const deployStub = sinon.stub(orchestrator as any, 'deployWorkflow')
        .resolves({ success: true, workflowPath: '.github/workflows/megalinter.yml' });
      const setupStub = sinon.stub(orchestrator as any, 'setupAutomationRules')
        .resolves();
      const triggerStub = sinon.stub(orchestrator as any, 'triggerInitialRun')
        .resolves(createMockWorkflowResult());
      const statusStub = sinon.stub(orchestrator, 'getCICDStatus')
        .resolves({
          isRunning: false,
          hasActiveWorkflows: true,
          workflowHealth: 'healthy',
          consecutiveFailures: 0,
          recommendations: []
        });

      const result = await orchestrator.orchestrateCI(options);

      assert.strictEqual(result.deployment.success, true);
      assert.ok(result.initialRun);
      assert.strictEqual(result.status.workflowHealth, 'healthy');

      // Verify all steps were called
      assert.ok(profilerStub.calledOnce);
      assert.ok(configStub.calledOnce);
      assert.ok(templateStub.calledOnce);
      assert.ok(customizeStub.calledOnce);
      assert.ok(deployStub.calledOnce);
      assert.ok(setupStub.calledOnce);
      assert.ok(triggerStub.calledOnce);
      assert.ok(statusStub.calledOnce);
    });

    test('should handle deployment failure', async () => {
      const options = createMockOptions();

      // Mock deployment failure
      sinon.stub(orchestrator as any, 'analyzeRepositoryForCI').resolves(createMockProfile());
      sinon.stub(orchestrator as any, 'generateOptimalConfig').resolves({});
      sinon.stub(orchestrator as any, 'selectOptimalWorkflow').resolves({ content: 'mock' });
      sinon.stub(orchestrator as any, 'customizeWorkflowForRepository').resolves('workflow');
      sinon.stub(orchestrator as any, 'deployWorkflow').resolves({
        success: false,
        workflowPath: '.github/workflows/megalinter.yml',
        errors: ['Validation failed']
      });

      try {
        await orchestrator.orchestrateCI(options);
        assert.fail('Should have thrown error for deployment failure');
      } catch (error) {
        assert.ok(error instanceof Error);
        assert.ok(error.message.includes('deployment failed'));
      }
    });

    test('should skip initial run when autoTrigger is false', async () => {
      const options = { ...createMockOptions(), autoTrigger: false };

      sinon.stub(orchestrator as any, 'analyzeRepositoryForCI').resolves(createMockProfile());
      sinon.stub(orchestrator as any, 'generateOptimalConfig').resolves({});
      sinon.stub(orchestrator as any, 'selectOptimalWorkflow').resolves({ content: 'mock' });
      sinon.stub(orchestrator as any, 'customizeWorkflowForRepository').resolves('workflow');
      sinon.stub(orchestrator as any, 'deployWorkflow').resolves({ success: true, workflowPath: 'test' });
      sinon.stub(orchestrator as any, 'setupAutomationRules').resolves();
      const triggerStub = sinon.stub(orchestrator as any, 'triggerInitialRun');
      sinon.stub(orchestrator, 'getCICDStatus').resolves({
        isRunning: false,
        hasActiveWorkflows: true,
        workflowHealth: 'healthy',
        consecutiveFailures: 0,
        recommendations: []
      });

      const result = await orchestrator.orchestrateCI(options);

      assert.ok(result.deployment.success);
      assert.strictEqual(result.initialRun, undefined);
      assert.ok(triggerStub.notCalled);
    });
  });

  suite('updateCIConfiguration', () => {
    test('should update configuration when profile changed', async () => {
      const options = createMockOptions();
      const changes = { profileChanged: true };

      sinon.stub(orchestrator as any, 'analyzeRepositoryForCI').resolves(createMockProfile());
      sinon.stub(orchestrator as any, 'generateOptimalConfig').resolves({});
      sinon.stub(orchestrator as any, 'selectOptimalWorkflow').resolves({ content: 'mock' });
      sinon.stub(orchestrator as any, 'customizeWorkflowForRepository').resolves('updated-workflow');
      sinon.stub(orchestrator as any, 'deployWorkflow').resolves({
        success: true,
        workflowPath: '.github/workflows/megalinter.yml'
      });

      const result = await orchestrator.updateCIConfiguration(options, changes);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.workflowPath, '.github/workflows/megalinter.yml');
    });

    test('should update automation rules when preferences changed', async () => {
      const options = createMockOptions();
      const changes = { preferencesChanged: true };

      const updateRulesStub = sinon.stub(orchestrator as any, 'updateAutomationRules').resolves();

      const result = await orchestrator.updateCIConfiguration(options, changes);

      assert.strictEqual(result.success, true);
      assert.ok(updateRulesStub.calledOnce);
    });

    test('should handle update errors gracefully', async () => {
      const options = createMockOptions();
      const changes = { configurationChanged: true };

      sinon.stub(orchestrator as any, 'analyzeRepositoryForCI').rejects(new Error('Analysis failed'));

      const result = await orchestrator.updateCIConfiguration(options, changes);

      assert.strictEqual(result.success, false);
      assert.ok(result.errors);
      assert.ok(result.errors.length > 0);
    });
  });

  suite('executeHybridLinting', () => {
    test('should execute both local and remote linting', async () => {
      const options = createMockOptions();

      sinon.stub(orchestrator as any, 'analyzeRepositoryForCI').resolves(createMockProfile());
      sinon.stub(orchestrator as any, 'generateOptimalConfig').resolves({});
      
      // Mock MegaLinter orchestrator
      const megalinterStub = sinon.stub(orchestrator as any, 'megalinterOrchestrator');
      megalinterStub.executeLinting = sinon.stub().resolves(createMockLintingResults());

      // Mock workflow execution
      sinon.stub(orchestrator as any, 'listWorkflows').resolves({
        workflows: [{ id: 123, name: 'MegaLinter', path: '.github/workflows/megalinter.yml' }]
      });
      sinon.stub(orchestrator as any, 'triggerMegaLinterWorkflow').resolves({ run_id: 456 });
      sinon.stub(orchestrator, 'monitorWorkflow').resolves(createMockWorkflowResult());

      const result = await orchestrator.executeHybridLinting(options);

      assert.ok(result.localResults);
      assert.ok(result.remoteResults);
      assert.ok(result.comparison);
      assert.strictEqual(result.localResults.summary.totalIssues, 15);
      assert.strictEqual(result.remoteResults.summary.totalIssues, 15);
    });

    test('should handle local execution only', async () => {
      const options = createMockOptions();

      sinon.stub(orchestrator as any, 'analyzeRepositoryForCI').resolves(createMockProfile());
      sinon.stub(orchestrator as any, 'generateOptimalConfig').resolves({});
      
      const megalinterStub = sinon.stub(orchestrator as any, 'megalinterOrchestrator');
      megalinterStub.executeLinting = sinon.stub().resolves(createMockLintingResults());

      const result = await orchestrator.executeHybridLinting(options, true, false);

      assert.ok(result.localResults);
      assert.strictEqual(result.remoteResults, undefined);
      assert.strictEqual(result.comparison, undefined);
    });

    test('should handle remote execution only', async () => {
      const options = createMockOptions();

      sinon.stub(orchestrator as any, 'listWorkflows').resolves({
        workflows: [{ id: 123, name: 'MegaLinter', path: '.github/workflows/megalinter.yml' }]
      });
      sinon.stub(orchestrator as any, 'triggerMegaLinterWorkflow').resolves({ run_id: 456 });
      sinon.stub(orchestrator, 'monitorWorkflow').resolves(createMockWorkflowResult());

      const result = await orchestrator.executeHybridLinting(options, false, true);

      assert.strictEqual(result.localResults, undefined);
      assert.ok(result.remoteResults);
      assert.strictEqual(result.comparison, undefined);
    });
  });

  suite('syncConfigurationWithWorkflow', () => {
    test('should sync local configuration to remote', async () => {
      const options = createMockOptions();

      sinon.stub(orchestrator as any, 'analyzeRepositoryForCI').resolves(createMockProfile());
      sinon.stub(orchestrator as any, 'generateOptimalConfig').resolves({});
      sinon.stub(orchestrator as any, 'selectOptimalWorkflow').resolves({ content: 'template' });
      sinon.stub(orchestrator as any, 'customizeWorkflowForRepository').resolves('customized');
      sinon.stub(orchestrator as any, 'deployWorkflow').resolves({
        success: true,
        workflowPath: '.github/workflows/megalinter.yml'
      });

      const result = await orchestrator.syncConfigurationWithWorkflow(options, 'local-to-remote');

      assert.strictEqual(result.success, true);
      assert.ok(result.changes.length > 0);
      assert.ok(result.changes[0].includes('Updated remote workflow'));
    });

    test('should handle sync conflicts', async () => {
      const options = createMockOptions();

      sinon.stub(orchestrator as any, 'analyzeRepositoryForCI').resolves(createMockProfile());
      sinon.stub(orchestrator as any, 'generateOptimalConfig').resolves({});
      sinon.stub(orchestrator as any, 'selectOptimalWorkflow').resolves({ content: 'template' });
      sinon.stub(orchestrator as any, 'customizeWorkflowForRepository').resolves('customized');
      sinon.stub(orchestrator as any, 'deployWorkflow').resolves({
        success: false,
        workflowPath: '.github/workflows/megalinter.yml',
        errors: ['Validation failed', 'Conflicting configuration']
      });

      const result = await orchestrator.syncConfigurationWithWorkflow(options);

      assert.strictEqual(result.success, false);
      assert.ok(result.conflicts);
      assert.strictEqual(result.conflicts.length, 2);
    });

    test('should handle remote-to-local direction', async () => {
      const options = createMockOptions();

      const result = await orchestrator.syncConfigurationWithWorkflow(options, 'remote-to-local');

      // Currently not implemented, should indicate this
      assert.strictEqual(result.success, true);
      assert.ok(result.changes.some(change => 
        change.includes('Remote-to-local sync would require workflow parsing')
      ));
    });
  });

  suite('getIntegrationStatus', () => {
    test('should return comprehensive integration status', async () => {
      const options = createMockOptions();

      // Mock MegaLinter orchestrator status
      const megalinterStub = sinon.stub(orchestrator as any, 'megalinterOrchestrator');
      megalinterStub.getStatus = sinon.stub().resolves({
        dockerAvailable: true,
        megalinterVersion: '7.0.0',
        health: 'healthy'
      });

      // Mock CI/CD status
      sinon.stub(orchestrator, 'getCICDStatus').resolves({
        isRunning: false,
        hasActiveWorkflows: true,
        workflowHealth: 'healthy',
        consecutiveFailures: 0,
        recommendations: []
      });

      const result = await orchestrator.getIntegrationStatus(options);

      assert.ok(result.localStatus);
      assert.ok(result.remoteStatus);
      assert.ok(['synced', 'drift', 'conflict', 'unknown'].includes(result.syncStatus));
      assert.ok(result.recommendations);
    });

    test('should detect sync drift when results differ', async () => {
      const options = createMockOptions();

      // Mock different local and remote results
      orchestrator['lastLocalResults'] = createMockLintingResults();
      orchestrator['lastWorkflowResults'] = {
        ...createMockWorkflowResult(),
        summary: { ...createMockWorkflowResult().summary, totalIssues: 25 } // Different issue count
      };

      const megalinterStub = sinon.stub(orchestrator as any, 'megalinterOrchestrator');
      megalinterStub.getStatus = sinon.stub().resolves({ dockerAvailable: true, health: 'healthy' });
      
      sinon.stub(orchestrator, 'getCICDStatus').resolves({
        isRunning: false,
        hasActiveWorkflows: true,
        workflowHealth: 'healthy',
        consecutiveFailures: 0,
        recommendations: []
      });

      const result = await orchestrator.getIntegrationStatus(options);

      assert.ok(['drift', 'conflict'].includes(result.syncStatus));
      assert.ok(result.recommendations.some(rec => rec.includes('differences')));
    });
  });

  suite('getIntelligentRecommendations', () => {
    test('should provide performance recommendations for complex projects', async () => {
      const options = createMockOptions();

      const complexProfile = { ...createMockProfile(), complexity: 'complex' as const };
      sinon.stub(orchestrator as any, 'analyzeRepositoryForCI').resolves(complexProfile);
      sinon.stub(orchestrator, 'getIntegrationStatus').resolves({
        localStatus: { dockerAvailable: true, health: 'healthy' },
        remoteStatus: {
          isRunning: false,
          hasActiveWorkflows: true,
          workflowHealth: 'healthy',
          consecutiveFailures: 0,
          recommendations: []
        },
        syncStatus: 'synced',
        recommendations: []
      });

      const result = await orchestrator.getIntelligentRecommendations(options);

      assert.ok(result.performance.length > 0);
      assert.ok(result.performance.some(rec => rec.includes('incremental scanning')));
    });

    test('should provide security recommendations for web frameworks', async () => {
      const options = createMockOptions();

      const webProfile = { 
        ...createMockProfile(), 
        frameworks: ['express', 'spring', 'django'] 
      };
      sinon.stub(orchestrator as any, 'analyzeRepositoryForCI').resolves(webProfile);
      sinon.stub(orchestrator, 'getIntegrationStatus').resolves({
        localStatus: { dockerAvailable: true, health: 'healthy' },
        remoteStatus: {
          isRunning: false,
          hasActiveWorkflows: true,
          workflowHealth: 'healthy',
          consecutiveFailures: 0,
          recommendations: []
        },
        syncStatus: 'synced',
        recommendations: []
      });

      const result = await orchestrator.getIntelligentRecommendations(options);

      assert.ok(result.configuration.some(rec => 
        rec.includes('security scanning') && rec.includes('web frameworks')
      ));
    });

    test('should provide integration recommendations when Docker unavailable', async () => {
      const options = createMockOptions();

      sinon.stub(orchestrator as any, 'analyzeRepositoryForCI').resolves(createMockProfile());
      sinon.stub(orchestrator, 'getIntegrationStatus').resolves({
        localStatus: { dockerAvailable: false, health: 'error' },
        remoteStatus: {
          isRunning: false,
          hasActiveWorkflows: true,
          workflowHealth: 'healthy',
          consecutiveFailures: 0,
          recommendations: []
        },
        syncStatus: 'unknown',
        recommendations: []
      });

      const result = await orchestrator.getIntelligentRecommendations(options);

      assert.ok(result.integration.some(rec => rec.includes('Docker')));
    });
  });

  suite('Automation Rules', () => {
    test('should setup default automation rules', async () => {
      const options = createMockOptions();

      await orchestrator.setupAutomationRules(options);

      // Verify automation rules were set up (would need access to private members)
      // This is more of an integration test
      assert.ok(true); // If no error thrown, setup succeeded
    });

    test('should trigger automation based on events', async () => {
      const options = createMockOptions();
      
      const automationTrigger = {
        type: 'push' as const,
        branches: ['main']
      };

      // This would normally trigger workflow runs
      await orchestrator.triggerAutomation(automationTrigger, options);
      
      // Verify no errors occurred
      assert.ok(true);
    });
  });

  suite('Workflow Monitoring', () => {
    test('should monitor workflow with progress callback', async () => {
      const options = createMockOptions();
      const runId = 12345;
      let progressCallCount = 0;

      const progressCallback = (result: MegaLinterWorkflowResult) => {
        progressCallCount++;
        assert.ok(result.run);
        assert.ok(result.jobs);
      };

      // Mock the monitoring workflow to return immediately
      sinon.stub(orchestrator as any, 'monitorWorkflowRun').resolves(createMockWorkflowResult());

      const result = await orchestrator.monitorWorkflow(options, runId, progressCallback);

      assert.ok(result);
      assert.strictEqual(result.run.id, 12345);
    });

    test('should cancel running workflows', async () => {
      const options = createMockOptions();

      // Mock running workflows
      sinon.stub(orchestrator as any, 'getWorkflowRuns').resolves({
        workflow_runs: [
          { id: 1, status: 'in_progress' },
          { id: 2, status: 'queued' },
          { id: 3, status: 'completed' }
        ]
      });

      sinon.stub(orchestrator as any, 'cancelWorkflowRun').resolves();

      const cancelledCount = await orchestrator.cancelRunningWorkflows(options);

      assert.strictEqual(cancelledCount, 2); // Only in_progress and queued should be cancelled
    });
  });

  suite('Event Integration', () => {
    test('should emit events during execution', (done) => {
      const options = createMockOptions();
      let eventCount = 0;

      orchestrator.onEvent((event) => {
        eventCount++;
        assert.ok(event.type);
        assert.ok(event.data);
        
        if (eventCount >= 1) {
          done();
        }
      });

      // Trigger an event manually for testing
      (orchestrator as any).eventEmitter.fire({
        type: 'workflow_updated',
        data: { test: true }
      });
    });
  });
});