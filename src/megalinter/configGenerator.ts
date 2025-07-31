/**
 * Configuration Generator for creating optimal MegaLinter configurations
 * Based on repository analysis and user preferences
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import {
  ConfigurationGenerator as IConfigurationGenerator,
  EnhancedConfigurationGenerator,
  LanguageProfile,
  EnhancedLanguageProfile,
  MegaLinterConfiguration,
  LinterConfiguration,
  PerformanceConfiguration,
  ReportingConfiguration,
  UserPreferences,
  LinterCategory,
  OutputFormat,
  ReportDestination,
  DEFAULT_PERFORMANCE_CONFIG,
  ValidationResult,
  ValidationError,
  ValidationWarning
} from './types';

interface LinterTemplate {
  name: string;
  languages: string[];
  frameworks?: string[];
  category: LinterCategory;
  severity: 'error' | 'warning' | 'info';
  rules: Record<string, any>;
  filePatterns: string[];
  excludePatterns: string[];
  requiredVersion?: string;
  conflictsWith?: string[];
  dependencies?: string[];
}

export class ConfigurationGenerator implements IConfigurationGenerator, EnhancedConfigurationGenerator {
  private readonly linterTemplates: LinterTemplate[] = [];

  constructor() {
    this.initializeLinterTemplates();
  }

  /**
   * Generates a complete MegaLinter configuration based on repository profile and preferences
   */
  async generateConfiguration(
    profile: LanguageProfile,
    preferences: UserPreferences
  ): Promise<MegaLinterConfiguration> {
    return this.generateConfigurationAdvanced(profile as EnhancedLanguageProfile, preferences);
  }

  /**
   * Generates a complete MegaLinter configuration based on an enhanced repository profile
   */
  async generateConfigurationAdvanced(
    profile: EnhancedLanguageProfile,
    preferences: UserPreferences
  ): Promise<MegaLinterConfiguration> {
    try {
      // Select optimal linters based on profile
      const linters = await this.selectOptimalLintersAdvanced(profile);
      
      // Apply user preferences and organization standards
      const filteredLinters = this.applyUserPreferences(linters, preferences);
      
      // Generate performance configuration
      const performanceConfig = await this.generatePerformanceConfigAdvanced(profile);
      
      // Generate reporting configuration
      const reportingConfig = await this.generateReportingConfig(preferences);
      
      // Create the complete configuration
      const config: MegaLinterConfiguration = {
        version: '7.0.0',
        linters: {
          enabled: filteredLinters,
          disabled: this.getDisabledLinters(filteredLinters, preferences),
          customRules: this.generateCustomRules(preferences)
        },
        performance: performanceConfig,
        reporting: reportingConfig,
        security: {
          enableSecurityLinters: preferences.securityPreferences?.enableSecurityScanning ?? true,
          securitySeverityThreshold: preferences.securityPreferences?.enableSecurityScanning ? 'high' : 'critical',
          allowSecrets: false,
          trustedDirectories: ['tests/', 'test/', '__tests__/', 'spec/']
        }
      };

      // Validate and optimize the configuration
      return await this.validateAndOptimize(config);
    } catch (error) {
      console.error('Error generating MegaLinter configuration:', error);
      throw new Error(`Failed to generate configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Selects optimal linters based on repository profile
   */
  async selectOptimalLinters(profile: LanguageProfile): Promise<LinterConfiguration[]> {
    return this.selectOptimalLintersAdvanced(profile as EnhancedLanguageProfile);
  }

  /**
   * Selects optimal linters based on an enhanced repository profile
   */
  async selectOptimalLintersAdvanced(profile: EnhancedLanguageProfile): Promise<LinterConfiguration[]> {
    const selectedLinters: LinterConfiguration[] = [];
    const allLanguages = [...profile.primary, ...profile.secondary];
    
    // Core language linters
    for (const language of allLanguages) {
      const languageLinters = this.getLintersForLanguage(language);
      selectedLinters.push(...languageLinters);
    }

    // Framework-specific linters
    for (const framework of profile.frameworks) {
      const frameworkLinters = this.getLintersForFramework(framework);
      selectedLinters.push(...frameworkLinters);
    }

    // Security linters (always include basic security checks)
    const securityLinters = this.getSecurityLinters(allLanguages);
    selectedLinters.push(...securityLinters);

    // Quality and format linters
    const qualityLinters = this.getQualityLinters(allLanguages);
    selectedLinters.push(...qualityLinters);

    // Remove duplicates and resolve conflicts
    return this.deduplicateAndResolveConflicts(selectedLinters);
  }

  /**
   * Generates performance configuration based on repository complexity
   */
  async generatePerformanceConfig(profile: LanguageProfile): Promise<PerformanceConfiguration> {
    return this.generatePerformanceConfigAdvanced(profile as EnhancedLanguageProfile);
  }

  /**
   * Generates performance configuration based on an enhanced repository profile
   */
  async generatePerformanceConfigAdvanced(profile: EnhancedLanguageProfile): Promise<PerformanceConfiguration> {
    const baseConfig = { ...DEFAULT_PERFORMANCE_CONFIG };

    // Adjust based on complexity
    switch (profile.complexity) {
      case 'simple':
        baseConfig.maxExecutionTime = 120000; // 2 minutes
        baseConfig.parallelism = 2;
        baseConfig.resourceLimits.maxMemory = '1GB';
        baseConfig.cacheStrategy = 'aggressive';
        break;
      
      case 'moderate':
        baseConfig.maxExecutionTime = 300000; // 5 minutes
        baseConfig.parallelism = 4;
        baseConfig.resourceLimits.maxMemory = '2GB';
        baseConfig.cacheStrategy = 'conservative';
        break;
      
      case 'complex':
        baseConfig.maxExecutionTime = 600000; // 10 minutes
        baseConfig.parallelism = 6;
        baseConfig.resourceLimits.maxMemory = '4GB';
        baseConfig.cacheStrategy = 'conservative';
        baseConfig.incrementalScanning = true;
        break;
    }

    // Adjust based on language count
    const totalLanguages = profile.primary.length + profile.secondary.length;
    if (totalLanguages > 5) {
      baseConfig.maxExecutionTime *= 1.5;
      baseConfig.resourceLimits.maxMemory = this.increaseMemoryLimit(baseConfig.resourceLimits.maxMemory);
    }

    // Adjust based on technical debt
    if (profile.technicalDebtMetrics && profile.technicalDebtMetrics.overallDebtScore > 50) {
      baseConfig.maxExecutionTime *= 1.2;
      baseConfig.resourceLimits.maxMemory = this.increaseMemoryLimit(baseConfig.resourceLimits.maxMemory);
    }

    return baseConfig;
  }

  /**
   * Generates reporting configuration based on user preferences
   */
  async generateReportingConfig(preferences: UserPreferences): Promise<ReportingConfiguration> {
    const reportingPrefs = preferences.reportingPreferences;
    
    return {
      formats: [
        OutputFormat.JSON,
        reportingPrefs?.format || OutputFormat.CONSOLE,
        ...(reportingPrefs?.detailLevel === 'verbose' ? [OutputFormat.HTML] : [])
      ],
      destinations: [
        ReportDestination.CONSOLE,
        ReportDestination.FILE,
        ReportDestination.VSCODE_PROBLEMS
      ],
      realTimeUpdates: reportingPrefs?.realTimeUpdates ?? true,
      includePassing: reportingPrefs?.includePassingFiles ?? false
    };
  }

  /**
   * Validates and optimizes the configuration
   */
  async validateAndOptimize(config: MegaLinterConfiguration): Promise<MegaLinterConfiguration> {
    const validation = await this.validateConfiguration(config);
    
    if (!validation.valid) {
      console.warn('Configuration validation issues:', validation.errors);
      // Apply automatic fixes for common issues
      config = this.applyAutomaticFixes(config, validation.errors);
    }

    // Apply optimizations
    config = this.optimizeConfiguration(config);
    
    return config;
  }

  /**
   * Validates a MegaLinter configuration
   */
  async validateConfiguration(config: MegaLinterConfiguration): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: string[] = [];

    // Validate linter conflicts
    const conflicts = this.detectLinterConflicts(config.linters.enabled);
    for (const conflict of conflicts) {
      errors.push({
        code: 'LINTER_CONFLICT',
        message: `Conflicting linters detected: ${conflict.join(', ')}`,
        field: 'linters.enabled',
        severity: 'error'
      });
    }

    // Validate performance settings
    if (config.performance.maxExecutionTime < 60000) {
      warnings.push({
        code: 'LOW_EXECUTION_TIME',
        message: 'Execution time limit is very low and may cause timeouts',
        field: 'performance.maxExecutionTime',
        suggestion: 'Consider increasing to at least 2 minutes'
      });
    }

    // Validate memory limits
    const memoryMB = this.parseMemoryString(config.performance.resourceLimits.maxMemory);
    if (memoryMB < 512) {
      errors.push({
        code: 'INSUFFICIENT_MEMORY',
        message: 'Memory limit is too low for MegaLinter execution',
        field: 'performance.resourceLimits.maxMemory',
        severity: 'error'
      });
    }

    // Validate reporting configuration
    if (config.reporting.formats.length === 0) {
      errors.push({
        code: 'NO_OUTPUT_FORMAT',
        message: 'At least one output format must be specified',
        field: 'reporting.formats',
        severity: 'error'
      });
    }

    // Generate suggestions
    if (config.linters.enabled.length > 50) {
      suggestions.push('Consider reducing the number of enabled linters for better performance');
    }

    if (!config.performance.incrementalScanning && config.linters.enabled.length > 20) {
      suggestions.push('Enable incremental scanning for better performance with many linters');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  /**
   * Exports configuration to .mega-linter.yml format
   */
  async exportToYaml(config: MegaLinterConfiguration): Promise<string> {
    const yamlConfig = this.convertToMegaLinterYaml(config);
    return yaml.dump(yamlConfig, { 
      indent: 2,
      lineWidth: 120,
      quotingType: '"'
    });
  }

  /**
   * Predicts optimal configuration using ML
   */
  async predictOptimalConfiguration(profile: EnhancedLanguageProfile): Promise<any> {
    // This would call the ML predictor
    return {};
  }

  // Private helper methods

  private initializeLinterTemplates(): void {
    this.linterTemplates.push(
      // JavaScript/TypeScript linters
      {
        name: 'eslint',
        languages: ['javascript', 'typescript'],
        category: LinterCategory.LANGUAGE,
        severity: 'error',
        rules: {
          'no-unused-vars': 'error',
          'no-console': 'warn',
          'prefer-const': 'error'
        },
        filePatterns: ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx'],
        excludePatterns: ['node_modules/**', 'dist/**', 'build/**']
      },
      {
        name: 'prettier',
        languages: ['javascript', 'typescript', 'css', 'html', 'json', 'markdown'],
        category: LinterCategory.FORMAT,
        severity: 'warning',
        rules: {
          'printWidth': 100,
          'tabWidth': 2,
          'semi': true,
          'singleQuote': true
        },
        filePatterns: ['**/*.js', '**/*.ts', '**/*.css', '**/*.html', '**/*.json', '**/*.md'],
        excludePatterns: ['node_modules/**', 'dist/**']
      },

      // Python linters
      {
        name: 'pylint',
        languages: ['python'],
        category: LinterCategory.LANGUAGE,
        severity: 'error',
        rules: {
          'max-line-length': 88,
          'disable': ['C0114', 'C0115', 'C0116']
        },
        filePatterns: ['**/*.py'],
        excludePatterns: ['__pycache__/**', '*.pyc', 'venv/**', '.venv/**']
      },
      {
        name: 'black',
        languages: ['python'],
        category: LinterCategory.FORMAT,
        severity: 'warning',
        rules: {
          'line-length': 88,
          'target-version': ['py38']
        },
        filePatterns: ['**/*.py'],
        excludePatterns: ['__pycache__/**', 'venv/**']
      },
      {
        name: 'bandit',
        languages: ['python'],
        category: LinterCategory.SECURITY,
        severity: 'error',
        rules: {
          'skips': ['B101'],
          'severity': 'medium'
        },
        filePatterns: ['**/*.py'],
        excludePatterns: ['tests/**', 'test/**']
      },

      // Security linters
      {
        name: 'secretlint',
        languages: ['javascript', 'typescript', 'python', 'java', 'go', 'rust'],
        category: LinterCategory.SECURITY,
        severity: 'error',
        rules: {
          'preset': 'recommend',
          'disableRules': []
        },
        filePatterns: ['**/*'],
        excludePatterns: ['node_modules/**', 'dist/**', 'build/**', '.git/**']
      },
      {
        name: 'semgrep',
        languages: ['javascript', 'typescript', 'python', 'java', 'go'],
        category: LinterCategory.SECURITY,
        severity: 'error',
        rules: {
          'config': 'auto',
          'exclude': ['test/**', 'tests/**']
        },
        filePatterns: ['**/*.js', '**/*.ts', '**/*.py', '**/*.java', '**/*.go'],
        excludePatterns: ['node_modules/**', 'test/**', 'tests/**']
      },

      // Quality linters
      {
        name: 'cspell',
        languages: ['javascript', 'typescript', 'python', 'markdown', 'html'],
        category: LinterCategory.QUALITY,
        severity: 'warning',
        rules: {
          'language': 'en',
          'allowCompoundWords': true
        },
        filePatterns: ['**/*.js', '**/*.ts', '**/*.py', '**/*.md', '**/*.html'],
        excludePatterns: ['node_modules/**', 'dist/**']
      },

      // Additional language-specific linters
      {
        name: 'stylelint',
        languages: ['css', 'scss', 'less'],
        category: LinterCategory.LANGUAGE,
        severity: 'error',
        rules: {
          'extends': 'stylelint-config-standard',
          'rules': {
            'color-hex-case': 'lower',
            'color-hex-length': 'short'
          }
        },
        filePatterns: ['**/*.css', '**/*.scss', '**/*.less'],
        excludePatterns: ['node_modules/**', 'dist/**']
      },
      {
        name: 'markdownlint',
        languages: ['markdown'],
        category: LinterCategory.DOCUMENTATION,
        severity: 'warning',
        rules: {
          'MD013': false,
          'MD033': false
        },
        filePatterns: ['**/*.md'],
        excludePatterns: ['node_modules/**']
      }
    );
  }

  private getLintersForLanguage(language: string): LinterConfiguration[] {
    return this.linterTemplates
      .filter(template => template.languages.includes(language))
      .map(template => this.templateToConfiguration(template, language));
  }

  private getLintersForFramework(framework: string): LinterConfiguration[] {
    const frameworkLinters: LinterConfiguration[] = [];
    
    // React-specific linters
    if (framework === 'react') {
      frameworkLinters.push({
        name: 'eslint-plugin-react',
        version: 'latest',
        enabled: true,
        severity: 'error',
        rules: {
          'react/prop-types': 'error',
          'react/jsx-uses-react': 'error',
          'react/jsx-uses-vars': 'error'
        },
        filePatterns: ['**/*.jsx', '**/*.tsx'],
        excludePatterns: ['node_modules/**'],
        language: 'javascript',
        category: LinterCategory.LANGUAGE
      });
    }

    // Vue-specific linters
    if (framework === 'vue') {
      frameworkLinters.push({
        name: 'eslint-plugin-vue',
        version: 'latest',
        enabled: true,
        severity: 'error',
        rules: {
          'vue/no-unused-vars': 'error',
          'vue/require-default-prop': 'warn'
        },
        filePatterns: ['**/*.vue'],
        excludePatterns: ['node_modules/**'],
        language: 'javascript',
        category: LinterCategory.LANGUAGE
      });
    }

    return frameworkLinters;
  }

  private getSecurityLinters(languages: string[]): LinterConfiguration[] {
    return this.linterTemplates
      .filter(template => 
        template.category === LinterCategory.SECURITY &&
        template.languages.some(lang => languages.includes(lang))
      )
      .map(template => this.templateToConfiguration(template, languages[0]));
  }

  private getQualityLinters(languages: string[]): LinterConfiguration[] {
    return this.linterTemplates
      .filter(template => 
        [LinterCategory.QUALITY, LinterCategory.FORMAT, LinterCategory.DOCUMENTATION].includes(template.category) &&
        template.languages.some(lang => languages.includes(lang))
      )
      .map(template => this.templateToConfiguration(template, languages[0]));
  }

  private templateToConfiguration(template: LinterTemplate, language: string): LinterConfiguration {
    return {
      name: template.name,
      version: template.requiredVersion,
      enabled: true,
      severity: template.severity,
      rules: { ...template.rules },
      filePatterns: [...template.filePatterns],
      excludePatterns: [...template.excludePatterns],
      language,
      category: template.category
    };
  }

  private applyUserPreferences(linters: LinterConfiguration[], preferences: UserPreferences): LinterConfiguration[] {
    let filteredLinters = [...linters];

    // Apply preferred linters
    if (preferences.preferredLinters?.length) {
      filteredLinters = filteredLinters.filter(linter => 
        preferences.preferredLinters!.includes(linter.name)
      );
    }

    // Remove excluded linters
    if (preferences.excludedLinters?.length) {
      filteredLinters = filteredLinters.filter(linter => 
        !preferences.excludedLinters!.includes(linter.name)
      );
    }

    // Apply severity threshold
    filteredLinters = filteredLinters.map(linter => ({
      ...linter,
      enabled: this.shouldEnableLinter(linter, preferences.severityThreshold)
    }));

    // Apply organization standards
    if (preferences.organizationStandards?.requiredLinters) {
      for (const requiredLinter of preferences.organizationStandards.requiredLinters) {
        const existing = filteredLinters.find(l => l.name === requiredLinter);
        if (!existing) {
          // Add required linter if not present
          const template = this.linterTemplates.find(t => t.name === requiredLinter);
          if (template) {
            filteredLinters.push(this.templateToConfiguration(template, 'javascript'));
          }
        } else {
          existing.enabled = true; // Ensure required linters are enabled
        }
      }
    }

    return filteredLinters;
  }

  private shouldEnableLinter(linter: LinterConfiguration, threshold: 'error' | 'warning' | 'info'): boolean {
    const severityOrder = ['info', 'warning', 'error'];
    const linterSeverityIndex = severityOrder.indexOf(linter.severity);
    const thresholdIndex = severityOrder.indexOf(threshold);
    
    return linterSeverityIndex >= thresholdIndex;
  }

  private getDisabledLinters(enabledLinters: LinterConfiguration[], preferences: UserPreferences): string[] {
    const disabled: string[] = [];
    
    // Add explicitly excluded linters
    if (preferences.excludedLinters) {
      disabled.push(...preferences.excludedLinters);
    }

    // Add linters that conflict with enabled ones
    const enabledNames = enabledLinters.map(l => l.name);
    for (const template of this.linterTemplates) {
      if (template.conflictsWith) {
        const hasConflict = template.conflictsWith.some(conflictName => 
          enabledNames.includes(conflictName)
        );
        if (hasConflict && !enabledNames.includes(template.name)) {
          disabled.push(template.name);
        }
      }
    }

    return [...new Set(disabled)];
  }

  private generateCustomRules(preferences: UserPreferences): any[] {
    const customRules: any[] = [];
    
    if (preferences.organizationStandards?.enforcedRules) {
      customRules.push({
        name: 'organization-rules',
        path: '.megalinter/custom-rules.js',
        type: 'eslint',
        enabled: true
      });
    }

    return customRules;
  }

  private deduplicateAndResolveConflicts(linters: LinterConfiguration[]): LinterConfiguration[] {
    const uniqueLinters = new Map<string, LinterConfiguration>();
    
    // Remove duplicates, keeping the first occurrence
    for (const linter of linters) {
      if (!uniqueLinters.has(linter.name)) {
        uniqueLinters.set(linter.name, linter);
      }
    }

    // Resolve conflicts
    const resolvedLinters = Array.from(uniqueLinters.values());
    const conflicts = this.detectLinterConflicts(resolvedLinters);
    
    for (const conflictGroup of conflicts) {
      // Keep the first linter in each conflict group, disable others
      for (let i = 1; i < conflictGroup.length; i++) {
        const linter = resolvedLinters.find(l => l.name === conflictGroup[i]);
        if (linter) {
          linter.enabled = false;
        }
      }
    }

    return resolvedLinters.filter(l => l.enabled);
  }

  private detectLinterConflicts(linters: LinterConfiguration[]): string[][] {
    const conflicts: string[][] = [];
    
    // Define known conflicts
    const knownConflicts = [
      ['prettier', 'eslint-plugin-prettier'],
      ['black', 'autopep8'],
      ['pylint', 'flake8'] // Sometimes these can conflict
    ];

    for (const conflictGroup of knownConflicts) {
      const presentLinters = conflictGroup.filter(name => 
        linters.some(l => l.name === name)
      );
      
      if (presentLinters.length > 1) {
        conflicts.push(presentLinters);
      }
    }

    return conflicts;
  }

  private applyAutomaticFixes(config: MegaLinterConfiguration, errors: ValidationError[]): MegaLinterConfiguration {
    const fixedConfig = { ...config };

    for (const error of errors) {
      switch (error.code) {
        case 'LINTER_CONFLICT':
          // Disable conflicting linters
          this.resolveConflictsAutomatically(fixedConfig);
          break;
          
        case 'INSUFFICIENT_MEMORY':
          // Increase memory limit
          fixedConfig.performance.resourceLimits.maxMemory = '2GB';
          break;
          
        case 'NO_OUTPUT_FORMAT':
          // Add default output format
          if (fixedConfig.reporting.formats.length === 0) {
            fixedConfig.reporting.formats.push(OutputFormat.JSON);
          }
          break;
      }
    }

    return fixedConfig;
  }

  private resolveConflictsAutomatically(config: MegaLinterConfiguration): void {
    const conflicts = this.detectLinterConflicts(config.linters.enabled);
    
    for (const conflictGroup of conflicts) {
      // Keep the first linter, disable others
      for (let i = 1; i < conflictGroup.length; i++) {
        const linter = config.linters.enabled.find(l => l.name === conflictGroup[i]);
        if (linter) {
          linter.enabled = false;
        }
      }
    }
    
    // Remove disabled linters
    config.linters.enabled = config.linters.enabled.filter(l => l.enabled);
  }

  private optimizeConfiguration(config: MegaLinterConfiguration): MegaLinterConfiguration {
    const optimized = { ...config };

    // Optimize parallelism based on linter count
    const linterCount = optimized.linters.enabled.length;
    if (linterCount < 10) {
      optimized.performance.parallelism = Math.min(optimized.performance.parallelism, 2);
    } else if (linterCount < 20) {
      optimized.performance.parallelism = Math.min(optimized.performance.parallelism, 4);
    }

    // Enable incremental scanning for complex configurations
    if (linterCount > 15) {
      optimized.performance.incrementalScanning = true;
    }

    // Optimize caching strategy
    if (linterCount > 25) {
      optimized.performance.cacheStrategy = 'aggressive';
    }

    return optimized;
  }

  private parseMemoryString(memoryStr: string): number {
    const match = memoryStr.match(/^(\d+)(GB|MB)$/i);
    if (!match) return 0;
    
    const value = parseInt(match[1], 10);
    const unit = match[2].toUpperCase();
    
    return unit === 'GB' ? value * 1024 : value;
  }

  private increaseMemoryLimit(currentLimit: string): string {
    const currentMB = this.parseMemoryString(currentLimit);
    const newMB = Math.min(currentMB * 1.5, 8192); // Cap at 8GB
    
    return newMB >= 1024 ? `${Math.ceil(newMB / 1024)}GB` : `${Math.ceil(newMB)}MB`;
  }

  private convertToMegaLinterYaml(config: MegaLinterConfiguration): any {
    const yamlConfig: any = {
      MEGALINTER_CONFIG: config.version,
      PARALLEL: config.performance.parallelism,
      SHOW_ELAPSED_TIME: true,
      FILEIO_REPORTER: config.reporting.realTimeUpdates,
      
      // Linter configuration
      ENABLE: config.linters.enabled.map(l => l.name.toUpperCase()),
      DISABLE: config.linters.disabled.map(name => name.toUpperCase()),
      
      // Performance settings
      TIMEOUT_SECONDS: Math.floor(config.performance.maxExecutionTime / 1000),
      
      // Reporting
      REPORT_OUTPUT_FOLDER: 'megalinter-reports',
      OUTPUT_FORMAT: config.reporting.formats.join(','),
      OUTPUT_DETAIL: 'detailed'
    };

    // Add language-specific configurations
    for (const linter of config.linters.enabled) {
      const linterKey = linter.name.toUpperCase();
      
      if (Object.keys(linter.rules).length > 0) {
        yamlConfig[`${linterKey}_CONFIG_FILE`] = `.megalinter/${linter.name}.config.json`;
      }
      
      if (linter.filePatterns.length > 0) {
        yamlConfig[`${linterKey}_FILTER_REGEX_INCLUDE`] = linter.filePatterns.join('|');
      }
      
      if (linter.excludePatterns.length > 0) {
        yamlConfig[`${linterKey}_FILTER_REGEX_EXCLUDE`] = linter.excludePatterns.join('|');
      }
    }

    return yamlConfig;
  }
}