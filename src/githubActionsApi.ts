// Simple HTTP client for GitHub API
async function httpRequest(url: string, token: string): Promise<any> {
  // Use dynamic import for node-fetch since it's ESM
  const fetch = (await eval('import("node-fetch")') as any).default;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'org-onboarding-vscode'
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  return await response.json();
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