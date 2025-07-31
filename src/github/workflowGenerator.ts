/**
 * GitHub Actions Workflow Generator for MegaLinter Integration
 * Generates optimized workflow templates based on repository profiles and user preferences
 */

import * as yaml from 'js-yaml';
import { LanguageProfile, EnhancedLanguageProfile, UserPreferences, MegaLinterConfiguration } from '../megalinter/types';
import { WorkflowTemplate, MatrixStrategy } from '../githubActionsApi';

export interface WorkflowGenerationOptions {
  profile: LanguageProfile | EnhancedLanguageProfile;
  preferences?: UserPreferences;
  megalinterConfig?: MegaLinterConfiguration;
  organizationSettings?: OrganizationWorkflowSettings;
  customizations?: WorkflowCustomizations;
}

export interface OrganizationWorkflowSettings {
  requiredChecks: string[];
  allowedRunners: string[];
  securityScanningRequired: boolean;
  complianceChecking: boolean;
  artifactRetentionDays: number;
  timeoutMinutes: number;
  concurrencyGroup?: string;
}

export interface WorkflowCustomizations {
  additionalSteps?: WorkflowStep[];
  environmentVariables?: Record<string, string>;
  secrets?: string[];
  permissions?: Record<string, string>;
  triggers?: WorkflowTrigger[];
  caching?: CachingStrategy;
}

export interface WorkflowStep {
  name: string;
  uses?: string;
  run?: string;
  with?: Record<string, any>;
  env?: Record<string, string>;
  if?: string;
  'continue-on-error'?: boolean;
  'timeout-minutes'?: number;
}

export interface WorkflowTrigger {
  event: string;
  branches?: string[];
  paths?: string[];
  types?: string[];
}

export interface CachingStrategy {
  enabled: boolean;
  paths: string[];
  key: string;
  restoreKeys?: string[];
}

export class WorkflowGenerator {
  private readonly defaultSettings: OrganizationWorkflowSettings = {
    requiredChecks: ['megalinter', 'security-scan'],
    allowedRunners: ['ubuntu-latest'],
    securityScanningRequired: true,
    complianceChecking: true,
    artifactRetentionDays: 30,
    timeoutMinutes: 30,
  };

  /**
   * Generates a complete MegaLinter workflow based on repository profile and preferences
   */
  async generateMegaLinterWorkflow(options: WorkflowGenerationOptions): Promise<string> {
    const {
      profile,
      preferences,
      megalinterConfig,
      organizationSettings = this.defaultSettings,
      customizations = {}
    } = options;

    // Determine workflow type based on complexity and requirements
    const workflowType = this.determineWorkflowType(profile, preferences);
    
    // Generate workflow structure
    const workflow = await this.buildWorkflowStructure(
      workflowType,
      profile,
      preferences,
      megalinterConfig,
      organizationSettings,
      customizations
    );

    // Convert to YAML
    return yaml.dump(workflow, {
      indent: 2,
      lineWidth: 120,
      quotingType: '"',
      forceQuotes: false
    });
  }

  /**
   * Generates multiple workflow variants for different scenarios
   */
  async generateWorkflowVariants(options: WorkflowGenerationOptions): Promise<Record<string, string>> {
    const variants: Record<string, string> = {};

    // Basic workflow - fast feedback
    variants.basic = await this.generateMegaLinterWorkflow({
      ...options,
      preferences: {
        ...options.preferences,
        performanceProfile: 'fast',
        severityThreshold: 'error'
      } as UserPreferences
    });

    // Comprehensive workflow - thorough analysis
    variants.comprehensive = await this.generateMegaLinterWorkflow({
      ...options,
      preferences: {
        ...options.preferences,
        performanceProfile: 'thorough',
        severityThreshold: 'info'
      } as UserPreferences
    });

    // Security-focused workflow
    variants.security = await this.generateSecurityFocusedWorkflow(options);

    // Performance-optimized workflow
    variants.performance = await this.generatePerformanceOptimizedWorkflow(options);

    return variants;
  }

  /**
   * Creates a matrix strategy for parallel execution
   */
  createMatrixStrategy(profile: LanguageProfile | EnhancedLanguageProfile, preferences?: UserPreferences): MatrixStrategy {
    const matrix: MatrixStrategy = {
      profile: this.getProfileMatrix(preferences?.performanceProfile || 'balanced')
    };

    // Add language-specific matrix dimensions
    if (profile.primary.includes('javascript') || profile.primary.includes('typescript')) {
      matrix['node-version'] = ['18', '20'];
    }

    if (profile.primary.includes('python')) {
      matrix['python-version'] = ['3.9', '3.10', '3.11'];
    }

    if (profile.primary.includes('java')) {
      matrix['java-version'] = ['11', '17', '21'];
    }

    // Add OS matrix for complex projects
    if (profile.complexity === 'complex') {
      matrix.os = ['ubuntu-latest', 'windows-latest', 'macos-latest'];
    }

    return matrix;
  }

  /**
   * Validates workflow configuration against GitHub Actions constraints
   */
  async validateWorkflow(workflowContent: string): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    suggestions: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    try {
      const workflow = yaml.load(workflowContent) as any;

      // Validate required fields
      if (!workflow.name) {
        errors.push('Workflow name is required');
      }

      if (!workflow.on) {
        errors.push('Workflow triggers (on) are required');
      }

      if (!workflow.jobs) {
        errors.push('At least one job is required');
      }

      // Validate job structure
      for (const [jobName, job] of Object.entries(workflow.jobs || {})) {
        const jobConfig = job as any;
        
        if (!jobConfig['runs-on']) {
          errors.push(`Job '${jobName}' must specify runs-on`);
        }

        if (!jobConfig.steps || !Array.isArray(jobConfig.steps)) {
          errors.push(`Job '${jobName}' must have steps array`);
        }

        // Check for potential security issues
        if (jobConfig.permissions && jobConfig.permissions.contents === 'write') {
          warnings.push(`Job '${jobName}' has write permissions to contents`);
        }

        // Check timeout
        if (!jobConfig['timeout-minutes']) {
          suggestions.push(`Consider adding timeout-minutes to job '${jobName}'`);
        }
      }

      // Validate triggers
      if (workflow.on.push && !workflow.on.push.branches) {
        suggestions.push('Consider specifying branches for push trigger');
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        suggestions
      };
    } catch (error) {
      return {
        valid: false,
        errors: [`Invalid YAML: ${error instanceof Error ? error.message : error}`],
        warnings: [],
        suggestions: []
      };
    }
  }

  // Private helper methods

  private determineWorkflowType(profile: LanguageProfile | EnhancedLanguageProfile, preferences?: UserPreferences): WorkflowTemplate['type'] {
    if (preferences?.organizationStandards?.requiredLinters?.length) {
      return 'organization';
    }

    if (preferences?.securityPreferences?.enableSecurityScanning) {
      return 'security';
    }

    if (profile.complexity === 'complex' || profile.primary.length > 3) {
      return 'multi-language';
    }

    if (preferences?.performanceProfile === 'fast') {
      return 'performance';
    }

    return profile.complexity === 'simple' ? 'basic' : 'enterprise';
  }

  private async buildWorkflowStructure(
    type: WorkflowTemplate['type'],
    profile: LanguageProfile | EnhancedLanguageProfile,
    preferences?: UserPreferences,
    megalinterConfig?: MegaLinterConfiguration,
    organizationSettings?: OrganizationWorkflowSettings,
    customizations?: WorkflowCustomizations
  ): Promise<any> {
    const workflow: any = {
      name: this.generateWorkflowName(type, profile),
      on: this.generateTriggers(customizations?.triggers),
      env: this.generateEnvironmentVariables(megalinterConfig, customizations),
      permissions: this.generatePermissions(type, customizations),
      concurrency: organizationSettings?.concurrencyGroup ? {
        group: organizationSettings.concurrencyGroup,
        'cancel-in-progress': true
      } : undefined,
      jobs: {}
    };

    // Add main MegaLinter job
    workflow.jobs['megalinter'] = await this.buildMegaLinterJob(
      type,
      profile,
      preferences,
      megalinterConfig,
      organizationSettings,
      customizations
    );

    // Add security scanning job if required
    if (organizationSettings?.securityScanningRequired || type === 'security') {
      workflow.jobs['security-scan'] = this.buildSecurityScanJob(profile, organizationSettings);
    }

    // Add compliance checking job if required
    if (organizationSettings?.complianceChecking || type === 'organization') {
      workflow.jobs['compliance-check'] = this.buildComplianceJob(profile, organizationSettings);
    }

    // Add performance monitoring job for complex projects
    if (profile.complexity === 'complex' || type === 'performance') {
      workflow.jobs['performance-monitor'] = this.buildPerformanceMonitorJob(profile);
    }

    return workflow;
  }

  private async buildMegaLinterJob(
    type: WorkflowTemplate['type'],
    profile: LanguageProfile | EnhancedLanguageProfile,
    preferences?: UserPreferences,
    megalinterConfig?: MegaLinterConfiguration,
    organizationSettings?: OrganizationWorkflowSettings,
    customizations?: WorkflowCustomizations
  ): Promise<any> {
    const job: any = {
      name: 'MegaLinter Analysis',
      'runs-on': organizationSettings?.allowedRunners?.[0] || 'ubuntu-latest',
      'timeout-minutes': organizationSettings?.timeoutMinutes || 30,
      steps: []
    };

    // Add matrix strategy for complex projects
    if (type === 'multi-language' || profile.complexity === 'complex') {
      job.strategy = {
        matrix: this.createMatrixStrategy(profile, preferences),
        'fail-fast': false
      };
    }

    // Checkout step
    job.steps.push({
      name: 'Checkout Repository',
      uses: 'actions/checkout@v4',
      with: {
        'fetch-depth': 0
      }
    });

    // Add language-specific setup steps
    job.steps.push(...this.generateLanguageSetupSteps(profile));

    // Add caching if enabled
    if (customizations?.caching?.enabled) {
      job.steps.push(this.generateCacheStep(customizations.caching));
    }

    // Pre-MegaLinter setup steps
    job.steps.push(...this.generatePreMegaLinterSteps(profile, megalinterConfig));

    // Main MegaLinter step
    job.steps.push(this.generateMegaLinterStep(type, profile, preferences, megalinterConfig));

    // Post-MegaLinter steps
    job.steps.push(...this.generatePostMegaLinterSteps(profile, organizationSettings));

    // Add custom steps
    if (customizations?.additionalSteps?.length) {
      job.steps.push(...customizations.additionalSteps);
    }

    return job;
  }

  private generateWorkflowName(type: WorkflowTemplate['type'], profile: LanguageProfile | EnhancedLanguageProfile): string {
    const typeNames = {
      basic: 'Code Quality Check',
      enterprise: 'Enterprise Code Analysis',
      security: 'Security & Quality Analysis',
      performance: 'Performance-Optimized Linting',
      'multi-language': 'Multi-Language Code Analysis',
      organization: 'Organization Standards Compliance'
    };

    return typeNames[type] || 'MegaLinter Analysis';
  }

  private generateTriggers(customTriggers?: WorkflowTrigger[]): any {
    const defaultTriggers = {
      push: {
        branches: ['main', 'develop', 'master'],
        paths: ['**/*.js', '**/*.ts', '**/*.py', '**/*.java', '**/*.go', '**/*.rs']
      },
      pull_request: {
        branches: ['main', 'develop', 'master']
      },
      workflow_dispatch: {
        inputs: {
          megalinter_profile: {
            description: 'MegaLinter profile to use',
            required: false,
            default: 'balanced',
            type: 'choice',
            options: ['fast', 'balanced', 'thorough']
          }
        }
      }
    };

    if (customTriggers?.length) {
      const customTriggersObj: any = {};
      for (const trigger of customTriggers) {
        customTriggersObj[trigger.event] = {
          ...(trigger.branches ? { branches: trigger.branches } : {}),
          ...(trigger.paths ? { paths: trigger.paths } : {}),
          ...(trigger.types ? { types: trigger.types } : {})
        };
      }
      return { ...defaultTriggers, ...customTriggersObj };
    }

    return defaultTriggers;
  }

  private generateEnvironmentVariables(
    megalinterConfig?: MegaLinterConfiguration,
    customizations?: WorkflowCustomizations
  ): Record<string, string> {
    const env: Record<string, string> = {
      MEGALINTER_CONFIG: '.mega-linter.yml',
      LOG_LEVEL: 'INFO',
      VALIDATE_ALL_CODEBASE: 'true',
      DEFAULT_BRANCH: 'main'
    };

    // Add MegaLinter-specific environment variables
    if (megalinterConfig) {
      env.PARALLEL = megalinterConfig.performance.parallelism.toString();
      env.SHOW_ELAPSED_TIME = 'true';
      env.FILEIO_REPORTER = megalinterConfig.reporting.realTimeUpdates.toString();
    }

    // Add custom environment variables
    if (customizations?.environmentVariables) {
      Object.assign(env, customizations.environmentVariables);
    }

    return env;
  }

  private generatePermissions(type: WorkflowTemplate['type'], customizations?: WorkflowCustomizations): any {
    const basePermissions = {
      contents: 'read',
      issues: 'write',
      'pull-requests': 'write'
    };

    if (type === 'security') {
      basePermissions['security-events'] = 'write';
    }

    if (customizations?.permissions) {
      Object.assign(basePermissions, customizations.permissions);
    }

    return basePermissions;
  }

  private generateLanguageSetupSteps(profile: LanguageProfile | EnhancedLanguageProfile): WorkflowStep[] {
    const steps: WorkflowStep[] = [];

    // Node.js setup
    if (profile.primary.includes('javascript') || profile.primary.includes('typescript')) {
      steps.push({
        name: 'Setup Node.js',
        uses: 'actions/setup-node@v4',
        with: {
          'node-version': '20',
          cache: this.detectPackageManager(profile)
        }
      });

      steps.push({
        name: 'Install Dependencies',
        run: this.generateInstallCommand(profile)
      });
    }

    // Python setup
    if (profile.primary.includes('python')) {
      steps.push({
        name: 'Setup Python',
        uses: 'actions/setup-python@v4',
        with: {
          'python-version': '3.11',
          cache: 'pip'
        }
      });

      steps.push({
        name: 'Install Python Dependencies',
        run: 'pip install -r requirements.txt || echo "No requirements.txt found"'
      });
    }

    // Java setup
    if (profile.primary.includes('java')) {
      steps.push({
        name: 'Setup Java',
        uses: 'actions/setup-java@v4',
        with: {
          'java-version': '17',
          distribution: 'temurin',
          cache: profile.buildTools.includes('maven') ? 'maven' : 'gradle'
        }
      });
    }

    // Go setup
    if (profile.primary.includes('go')) {
      steps.push({
        name: 'Setup Go',
        uses: 'actions/setup-go@v4',
        with: {
          'go-version': '1.21',
          cache: true
        }
      });
    }

    return steps;
  }

  private generateMegaLinterStep(
    type: WorkflowTemplate['type'],
    profile: LanguageProfile | EnhancedLanguageProfile,
    preferences?: UserPreferences,
    megalinterConfig?: MegaLinterConfiguration
  ): WorkflowStep {
    const step: WorkflowStep = {
      name: 'Run MegaLinter',
      uses: 'oxsecurity/megalinter@v7',
      env: {
        DEFAULT_WORKSPACE: '${{ github.workspace }}',
        GITHUB_TOKEN: '${{ secrets.GITHUB_TOKEN }}'
      }
    };

    // Add performance profile from workflow input
    if (preferences?.performanceProfile) {
      step.env!.MEGALINTER_PROFILE = preferences.performanceProfile;
    }

    // Add matrix profile if using matrix strategy
    if (type === 'multi-language' || profile.complexity === 'complex') {
      step.env!.MEGALINTER_PROFILE = '${{ matrix.profile }}';
    }

    // Configure reporting
    if (megalinterConfig) {
      step.env!.REPORT_OUTPUT_FOLDER = 'megalinter-reports';
      step.env!.OUTPUT_FORMAT = megalinterConfig.reporting.formats.join(',');
    }

    return step;
  }

  private generatePostMegaLinterSteps(
    profile: LanguageProfile | EnhancedLanguageProfile,
    organizationSettings?: OrganizationWorkflowSettings
  ): WorkflowStep[] {
    const steps: WorkflowStep[] = [];

    // Upload MegaLinter reports
    steps.push({
      name: 'Upload MegaLinter Reports',
      uses: 'actions/upload-artifact@v4',
      if: 'always()',
      with: {
        name: 'megalinter-reports',
        path: 'megalinter-reports/',
        'retention-days': organizationSettings?.artifactRetentionDays || 30
      }
    });

    // Archive SARIF results for security analysis
    steps.push({
      name: 'Upload SARIF Results',
      uses: 'github/codeql-action/upload-sarif@v2',
      if: 'always()',
      with: {
        'sarif_file': 'megalinter-reports/megalinter.sarif'
      },
      'continue-on-error': true
    });

    return steps;
  }

  private buildSecurityScanJob(profile: LanguageProfile | EnhancedLanguageProfile, organizationSettings?: OrganizationWorkflowSettings): any {
    return {
      name: 'Security Scanning',
      'runs-on': 'ubuntu-latest',
      'timeout-minutes': 15,
      steps: [
        {
          name: 'Checkout Repository',
          uses: 'actions/checkout@v4'
        },
        {
          name: 'Run Trivy Vulnerability Scanner',
          uses: 'aquasecurity/trivy-action@master',
          with: {
            'scan-type': 'fs',
            'scan-ref': '.',
            format: 'sarif',
            output: 'trivy-results.sarif'
          }
        },
        {
          name: 'Upload Trivy Results',
          uses: 'github/codeql-action/upload-sarif@v2',
          if: 'always()',
          with: {
            'sarif_file': 'trivy-results.sarif'
          }
        }
      ]
    };
  }

  private buildComplianceJob(profile: LanguageProfile | EnhancedLanguageProfile, organizationSettings?: OrganizationWorkflowSettings): any {
    return {
      name: 'Compliance Check',
      'runs-on': 'ubuntu-latest',
      'timeout-minutes': 10,
      steps: [
        {
          name: 'Checkout Repository',
          uses: 'actions/checkout@v4'
        },
        {
          name: 'Check Organization Standards',
          run: `
            echo "Checking organization compliance..."
            
            # Check for required files
            required_files=(".mega-linter.yml" "README.md" "LICENSE")
            for file in "\${required_files[@]}"; do
              if [ ! -f "\$file" ]; then
                echo "❌ Missing required file: \$file"
                exit 1
              else
                echo "✅ Found required file: \$file"
              fi
            done
            
            # Check for security configuration
            if [ ! -f ".github/dependabot.yml" ]; then
              echo "⚠️ Missing .github/dependabot.yml (recommended)"
            fi
            
            echo "✅ Organization compliance check passed"
          `
        }
      ]
    };
  }

  private buildPerformanceMonitorJob(profile: LanguageProfile | EnhancedLanguageProfile): any {
    return {
      name: 'Performance Monitoring',
      'runs-on': 'ubuntu-latest',
      'timeout-minutes': 10,
      needs: ['megalinter'],
      if: 'always()',
      steps: [
        {
          name: 'Download MegaLinter Reports',
          uses: 'actions/download-artifact@v4',
          with: {
            name: 'megalinter-reports',
            path: 'reports/'
          }
        },
        {
          name: 'Analyze Performance Metrics',
          run: `
            echo "Analyzing MegaLinter performance..."
            
            if [ -f "reports/megalinter.json" ]; then
              echo "Processing performance metrics from megalinter.json"
              # Extract performance data and generate trends
              # This could be enhanced with actual JSON parsing
            else
              echo "No performance data available"
            fi
          `
        }
      ]
    };
  }

  private generateCacheStep(caching: CachingStrategy): WorkflowStep {
    return {
      name: 'Cache Dependencies',
      uses: 'actions/cache@v3',
      with: {
        path: caching.paths.join('\n'),
        key: caching.key,
        'restore-keys': caching.restoreKeys?.join('\n') || ''
      }
    };
  }

  private generatePreMegaLinterSteps(profile: LanguageProfile | EnhancedLanguageProfile, megalinterConfig?: MegaLinterConfiguration): WorkflowStep[] {
    const steps: WorkflowStep[] = [];

    // Create MegaLinter configuration if provided
    if (megalinterConfig) {
      steps.push({
        name: 'Create MegaLinter Configuration',
        run: `
          cat > .mega-linter.yml << 'EOF'
${yaml.dump(megalinterConfig, { indent: 2 })}
EOF
        `
      });
    }

    return steps;
  }

  private generateSecurityFocusedWorkflow(options: WorkflowGenerationOptions): Promise<string> {
    return this.generateMegaLinterWorkflow({
      ...options,
      organizationSettings: {
        ...this.defaultSettings,
        securityScanningRequired: true,
        requiredChecks: ['megalinter', 'security-scan', 'dependency-scan']
      }
    });
  }

  private generatePerformanceOptimizedWorkflow(options: WorkflowGenerationOptions): Promise<string> {
    return this.generateMegaLinterWorkflow({
      ...options,
      preferences: {
        ...options.preferences,
        performanceProfile: 'fast',
        severityThreshold: 'error'
      } as UserPreferences,
      customizations: {
        ...options.customizations,
        caching: {
          enabled: true,
          paths: ['~/.cache/megalinter', 'node_modules', '.venv'],
          key: 'megalinter-${{ runner.os }}-${{ hashFiles(\'**/*.lock\', \'**/requirements.txt\') }}'
        }
      }
    });
  }

  private getProfileMatrix(performanceProfile: string): string[] {
    switch (performanceProfile) {
      case 'fast':
        return ['fast'];
      case 'thorough':
        return ['thorough'];
      default:
        return ['balanced'];
    }
  }

  private detectPackageManager(profile: LanguageProfile | EnhancedLanguageProfile): string {
    if (profile.buildTools.includes('yarn')) return 'yarn';
    if (profile.buildTools.includes('pnpm')) return 'pnpm';
    return 'npm';
  }

  private generateInstallCommand(profile: LanguageProfile | EnhancedLanguageProfile): string {
    const packageManager = this.detectPackageManager(profile);
    switch (packageManager) {
      case 'yarn':
        return 'yarn install --frozen-lockfile';
      case 'pnpm':
        return 'pnpm install --frozen-lockfile';
      default:
        return 'npm ci';
    }
  }
}

// Export default instance
export const workflowGenerator = new WorkflowGenerator();