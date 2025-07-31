import { LanguageProfile, MegaLinterConfiguration, LintingResults } from './megalinter/types';

// Enhanced HTTP client for GitHub API with improved error handling and retry logic
async function httpRequest(url: string, token: string, options: {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: any;
  retries?: number;
  timeout?: number;
} = {}): Promise<any> {
  const { method = 'GET', body, retries = 3, timeout = 30000 } = options;
  
  // Use dynamic import for node-fetch since it's ESM
  const fetch = (await eval('import("node-fetch")') as any).default;
  
  let lastError: Error;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'org-onboarding-vscode-extension',
          'X-GitHub-Api-Version': '2022-11-28',
          ...(body ? { 'Content-Type': 'application/json' } : {})
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorBody}`);
      }

      return await response.json();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < retries && !lastError.message.includes('404')) {
        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        continue;
      }
    }
  }
  
  throw lastError!;
}

export async function getLatestWorkflowStatus(
  owner: string,
  repo: string,
  token: string
): Promise<{status: string, conclusion: string | null, html_url: string, updated_at: string} | null> {
  try {
    const data = await httpRequest(
      `https://api.github.com/repos/${owner}/${repo}/actions/runs?per_page=1`,
      token
    );

    const runs = data.workflow_runs;
    
    if (runs && runs.length > 0) {
      const latestRun = runs[0];
      return {
        status: latestRun.status,
        conclusion: latestRun.conclusion,
        html_url: latestRun.html_url,
        updated_at: latestRun.updated_at
      };
    }
    
    return null;
  } catch (error) {
    throw error;
  }
}

export async function getRepoInfo(owner: string, repo: string, token: string) {
  try {
    return await httpRequest(
      `https://api.github.com/repos/${owner}/${repo}`,
      token
    );
  } catch (error) {
    throw error;
  }
}

export function getStatusIcon(status: string, conclusion: string | null): string {
  if (status === 'completed') {
    switch (conclusion) {
      case 'success': return '✅';
      case 'failure': return '❌';
      case 'cancelled': return '⏹️';
      case 'skipped': return '⏭️';
      default: return '⚠️';
    }
  } else if (status === 'in_progress') {
    return '🔄';
  } else if (status === 'queued') {
    return '⏳';
  }
  return '❓';
}

// GitHub Actions Workflow Management Types and Interfaces
export interface WorkflowTemplate {
  name: string;
  description: string;
  type: 'basic' | 'enterprise' | 'security' | 'performance' | 'multi-language' | 'organization';
  languages: string[];
  complexity: 'simple' | 'moderate' | 'complex';
  content: string;
  requiredSecrets?: string[];
  requiredPermissions?: string[];
  matrixStrategy?: MatrixStrategy;
}

export interface MatrixStrategy {
  profile: string[];
  'node-version'?: string[];
  'python-version'?: string[];
  'java-version'?: string[];
  os?: string[];
}

export interface WorkflowRun {
  id: number;
  name: string;
  head_branch: string;
  head_sha: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | null;
  workflow_id: number;
  check_suite_id: number;
  check_suite_node_id: string;
  url: string;
  html_url: string;
  pull_requests: any[];
  created_at: string;
  updated_at: string;
  actor: {
    login: string;
    id: number;
    avatar_url: string;
  };
  run_attempt: number;
  run_number: number;
  event: string;
  display_title: string;
}

export interface WorkflowJob {
  id: number;
  run_id: number;
  workflow_name: string;
  head_branch: string;
  run_url: string;
  run_attempt: number;
  node_id: string;
  head_sha: string;
  url: string;
  html_url: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | null;
  started_at: string;
  completed_at: string | null;
  name: string;
  steps: WorkflowStep[];
  check_run_url: string;
  labels: string[];
  runner_id: number | null;
  runner_name: string | null;
  runner_group_id: number | null;
  runner_group_name: string | null;
}

export interface WorkflowStep {
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | null;
  number: number;
  started_at: string | null;
  completed_at: string | null;
}

export interface MegaLinterWorkflowResult {
  run: WorkflowRun;
  jobs: WorkflowJob[];
  artifacts: WorkflowArtifact[];
  lintingResults?: LintingResults;
  summary: {
    totalIssues: number;
    errorCount: number;
    warningCount: number;
    fixableCount: number;
    lintersExecuted: number;
    duration: number;
  };
}

export interface WorkflowArtifact {
  id: number;
  node_id: string;
  name: string;
  size_in_bytes: number;
  url: string;
  archive_download_url: string;
  expired: boolean;
  created_at: string;
  updated_at: string;
  expires_at: string;
  workflow_run: {
    id: number;
    repository_id: number;
    head_repository_id: number;
    head_branch: string;
    head_sha: string;
  };
}

// Enhanced GitHub Actions API Functions for MegaLinter Integration

/**
 * Creates or updates a MegaLinter workflow in the repository
 */
export async function createMegaLinterWorkflow(
  owner: string,
  repo: string,
  token: string,
  workflowContent: string,
  workflowPath: string = '.github/workflows/megalinter.yml',
  commitMessage: string = 'Add MegaLinter workflow'
): Promise<void> {
  try {
    // Check if file exists
    let sha: string | undefined;
    try {
      const existingFile = await httpRequest(
        `https://api.github.com/repos/${owner}/${repo}/contents/${workflowPath}`,
        token
      );
      sha = existingFile.sha;
    } catch (error) {
      // File doesn't exist, which is fine for creation
    }

    // Create or update the workflow file
    await httpRequest(
      `https://api.github.com/repos/${owner}/${repo}/contents/${workflowPath}`,
      token,
      {
        method: 'PUT',
        body: {
          message: commitMessage,
          content: Buffer.from(workflowContent, 'utf8').toString('base64'),
          ...(sha ? { sha } : {})
        }
      }
    );
  } catch (error) {
    throw new Error(`Failed to create MegaLinter workflow: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Triggers a MegaLinter workflow run
 */
export async function triggerMegaLinterWorkflow(
  owner: string,
  repo: string,
  token: string,
  workflowId: string | number,
  ref: string = 'main',
  inputs?: Record<string, any>
): Promise<{ run_id: number }> {
  try {
    const response = await httpRequest(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`,
      token,
      {
        method: 'POST',
        body: {
          ref,
          inputs: inputs || {}
        }
      }
    );
    
    // GitHub API doesn't return the run ID directly, so we need to fetch the latest run
    const runs = await getWorkflowRuns(owner, repo, token, workflowId, 1);
    return { run_id: runs.workflow_runs[0]?.id || 0 };
  } catch (error) {
    throw new Error(`Failed to trigger MegaLinter workflow: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Gets detailed workflow run information including MegaLinter results
 */
export async function getMegaLinterWorkflowResult(
  owner: string,
  repo: string,
  token: string,
  runId: number
): Promise<MegaLinterWorkflowResult> {
  try {
    // Get workflow run details
    const run: WorkflowRun = await httpRequest(
      `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}`,
      token
    );

    // Get workflow jobs
    const jobsResponse = await httpRequest(
      `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/jobs`,
      token
    );
    const jobs: WorkflowJob[] = jobsResponse.jobs;

    // Get workflow artifacts
    const artifactsResponse = await httpRequest(
      `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/artifacts`,
      token
    );
    const artifacts: WorkflowArtifact[] = artifactsResponse.artifacts;

    // Parse MegaLinter results from artifacts if available
    const lintingResults = await parseMegaLinterArtifacts(owner, repo, token, artifacts);

    // Generate summary
    const summary = generateWorkflowSummary(run, jobs, lintingResults);

    return {
      run,
      jobs,
      artifacts,
      lintingResults,
      summary
    };
  } catch (error) {
    throw new Error(`Failed to get MegaLinter workflow result: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Gets workflow runs with filtering options
 */
export async function getWorkflowRuns(
  owner: string,
  repo: string,
  token: string,
  workflowId?: string | number,
  perPage: number = 30,
  page: number = 1,
  status?: 'completed' | 'action_required' | 'cancelled' | 'failure' | 'neutral' | 'skipped' | 'stale' | 'success' | 'timed_out' | 'in_progress' | 'queued' | 'requested' | 'waiting'
): Promise<{ total_count: number; workflow_runs: WorkflowRun[] }> {
  try {
    const params = new URLSearchParams({
      per_page: perPage.toString(),
      page: page.toString(),
      ...(status ? { status } : {})
    });

    const url = workflowId
      ? `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/runs?${params}`
      : `https://api.github.com/repos/${owner}/${repo}/actions/runs?${params}`;

    return await httpRequest(url, token);
  } catch (error) {
    throw new Error(`Failed to get workflow runs: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Cancels a running workflow
 */
export async function cancelWorkflowRun(
  owner: string,
  repo: string,
  token: string,
  runId: number
): Promise<void> {
  try {
    await httpRequest(
      `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/cancel`,
      token,
      { method: 'POST' }
    );
  } catch (error) {
    throw new Error(`Failed to cancel workflow run: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Downloads and parses MegaLinter artifacts
 */
export async function downloadMegaLinterArtifacts(
  owner: string,
  repo: string,
  token: string,
  artifactId: number
): Promise<Buffer> {
  try {
    const response = await httpRequest(
      `https://api.github.com/repos/${owner}/${repo}/actions/artifacts/${artifactId}/zip`,
      token
    );
    
    // Note: This returns a redirect URL, we need to fetch the actual content
    const fetch = (await eval('import("node-fetch")') as any).default;
    const downloadResponse = await fetch(response.url || response);
    
    if (!downloadResponse.ok) {
      throw new Error(`Failed to download artifact: ${downloadResponse.status}`);
    }
    
    return Buffer.from(await downloadResponse.arrayBuffer());
  } catch (error) {
    throw new Error(`Failed to download MegaLinter artifacts: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Gets workflow job logs
 */
export async function getWorkflowJobLogs(
  owner: string,
  repo: string,
  token: string,
  jobId: number
): Promise<string> {
  try {
    const response = await httpRequest(
      `https://api.github.com/repos/${owner}/${repo}/actions/jobs/${jobId}/logs`,
      token
    );
    
    return response;
  } catch (error) {
    throw new Error(`Failed to get workflow job logs: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Lists all workflows in a repository
 */
export async function listWorkflows(
  owner: string,
  repo: string,
  token: string
): Promise<{ total_count: number; workflows: any[] }> {
  try {
    return await httpRequest(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows`,
      token
    );
  } catch (error) {
    throw new Error(`Failed to list workflows: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Monitors workflow run progress with real-time updates
 */
export async function monitorWorkflowRun(
  owner: string,
  repo: string,
  token: string,
  runId: number,
  onProgress?: (run: WorkflowRun, jobs: WorkflowJob[]) => void,
  pollInterval: number = 30000
): Promise<MegaLinterWorkflowResult> {
  return new Promise((resolve, reject) => {
    let intervalId: NodeJS.Timeout;
    
    const checkProgress = async () => {
      try {
        const result = await getMegaLinterWorkflowResult(owner, repo, token, runId);
        
        if (onProgress) {
          onProgress(result.run, result.jobs);
        }
        
        if (result.run.status === 'completed') {
          clearInterval(intervalId);
          resolve(result);
        }
      } catch (error) {
        clearInterval(intervalId);
        reject(error);
      }
    };
    
    // Start monitoring
    checkProgress();
    intervalId = setInterval(checkProgress, pollInterval);
    
    // Set a maximum timeout (30 minutes)
    setTimeout(() => {
      clearInterval(intervalId);
      reject(new Error('Workflow monitoring timeout'));
    }, 30 * 60 * 1000);
  });
}

// Helper Functions

/**
 * Parses MegaLinter results from workflow artifacts
 */
async function parseMegaLinterArtifacts(
  owner: string,
  repo: string,
  token: string,
  artifacts: WorkflowArtifact[]
): Promise<LintingResults | undefined> {
  try {
    // Look for MegaLinter report artifacts
    const megalinterArtifact = artifacts.find(artifact =>
      artifact.name.toLowerCase().includes('megalinter') ||
      artifact.name.toLowerCase().includes('linting-results')
    );
    
    if (!megalinterArtifact) {
      return undefined;
    }
    
    // Download and parse the artifact
    const artifactData = await downloadMegaLinterArtifacts(owner, repo, token, megalinterArtifact.id);
    
    // Extract and parse JSON report from the zip
    // This is a simplified implementation - in practice, you'd need to unzip and parse
    // the actual MegaLinter JSON reports
    
    return undefined; // Placeholder - implement actual parsing logic
  } catch (error) {
    console.warn('Failed to parse MegaLinter artifacts:', error);
    return undefined;
  }
}

/**
 * Generates a summary of workflow execution and results
 */
function generateWorkflowSummary(
  run: WorkflowRun,
  jobs: WorkflowJob[],
  lintingResults?: LintingResults
): MegaLinterWorkflowResult['summary'] {
  const startTime = new Date(run.created_at).getTime();
  const endTime = run.updated_at ? new Date(run.updated_at).getTime() : Date.now();
  const duration = endTime - startTime;
  
  if (lintingResults) {
    return {
      totalIssues: lintingResults.summary.totalIssues,
      errorCount: lintingResults.summary.errorCount,
      warningCount: lintingResults.summary.warningCount,
      fixableCount: lintingResults.summary.fixableCount,
      lintersExecuted: lintingResults.summary.lintersExecuted,
      duration
    };
  }
  
  // Fallback summary based on workflow status
  return {
    totalIssues: run.conclusion === 'failure' ? 1 : 0,
    errorCount: run.conclusion === 'failure' ? 1 : 0,
    warningCount: 0,
    fixableCount: 0,
    lintersExecuted: jobs.length,
    duration
  };
}

/**
 * Enhanced workflow status with MegaLinter-specific information
 */
export async function getMegaLinterWorkflowStatus(
  owner: string,
  repo: string,
  token: string
): Promise<{
  status: string;
  conclusion: string | null;
  html_url: string;
  updated_at: string;
  megalinter_summary?: MegaLinterWorkflowResult['summary'];
  run_id: number;
} | null> {
  try {
    // Look for MegaLinter-specific workflows first
    const workflows = await listWorkflows(owner, repo, token);
    const megalinterWorkflow = workflows.workflows.find(w =>
      w.name.toLowerCase().includes('megalinter') ||
      w.path.includes('megalinter')
    );
    
    let workflowId: string | number | undefined = megalinterWorkflow?.id;
    
    // If no specific MegaLinter workflow, use the latest workflow run
    const runs = await getWorkflowRuns(owner, repo, token, workflowId, 1);
    
    if (runs.workflow_runs && runs.workflow_runs.length > 0) {
      const latestRun = runs.workflow_runs[0];
      
      // Get detailed results if available
      let megalinter_summary: MegaLinterWorkflowResult['summary'] | undefined;
      if (latestRun.status === 'completed') {
        try {
          const result = await getMegaLinterWorkflowResult(owner, repo, token, latestRun.id);
          megalinter_summary = result.summary;
        } catch (error) {
          // Ignore errors when getting detailed results
        }
      }
      
      return {
        status: latestRun.status,
        conclusion: latestRun.conclusion,
        html_url: latestRun.html_url,
        updated_at: latestRun.updated_at,
        megalinter_summary,
        run_id: latestRun.id
      };
    }
    
    return null;
  } catch (error) {
    throw error;
  }
}