/**
 * Repository Profiler for intelligent language and framework detection
 * Analyzes repository structure to determine optimal MegaLinter configuration
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  RepositoryProfiler as IRepositoryProfiler,
  LanguageProfile,
  ConfigFileMap,
  RepositoryContext,
  SUPPORTED_LANGUAGES,
  FRAMEWORK_PATTERNS
} from './types';

export class RepositoryProfiler implements IRepositoryProfiler {
  private readonly maxDepth = 3; // Maximum directory depth to scan
  private readonly maxFiles = 1000; // Maximum files to analyze
  private readonly binaryExtensions = new Set([
    '.exe', '.dll', '.so', '.dylib', '.bin', '.zip', '.tar', '.gz',
    '.jpg', '.jpeg', '.png', '.gif', '.pdf', '.mp4', '.avi', '.mov'
  ]);

  /**
   * Analyzes a repository to create a comprehensive language profile
   */
  async analyzeRepository(repositoryPath: string): Promise<LanguageProfile> {
    try {
      const languages = await this.detectLanguages(repositoryPath);
      const frameworks = await this.detectFrameworks(repositoryPath, languages);
      const buildTools = await this.detectBuildTools(repositoryPath);
      const configFiles = await this.findConfigFiles(repositoryPath);
      const complexity = await this.analyzeComplexity(repositoryPath);

      // Calculate confidence based on detection results
      const confidence = this.calculateConfidence(languages, frameworks, buildTools, configFiles);

      // Categorize languages by prevalence
      const languageStats = await this.analyzeLanguagePrevalence(repositoryPath, languages);
      const primary = languageStats.primary;
      const secondary = languageStats.secondary;

      return {
        primary,
        secondary,
        frameworks,
        buildTools,
        configFiles,
        complexity,
        confidence
      };
    } catch (error) {
      console.error('Error analyzing repository:', error);
      throw new Error(`Failed to analyze repository: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Detects programming languages used in the repository
   */
  async detectLanguages(repositoryPath: string): Promise<string[]> {
    const languageFrequency = new Map<string, number>();
    const extensionMap = this.getExtensionLanguageMap();

    await this.walkDirectory(repositoryPath, (filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      const language = extensionMap.get(ext);
      
      if (language) {
        languageFrequency.set(language, (languageFrequency.get(language) || 0) + 1);
      }
    });

    // Additional detection for languages that might not have clear extensions
    await this.detectSpecialLanguages(repositoryPath, languageFrequency);

    // Sort by frequency and return languages with significant presence
    const sortedLanguages = Array.from(languageFrequency.entries())
      .sort(([, a], [, b]) => b - a)
      .filter(([, count]) => count >= 1) // At least 1 file
      .map(([lang]) => lang);

    return sortedLanguages;
  }

  /**
   * Detects frameworks used in the repository
   */
  async detectFrameworks(repositoryPath: string, languages: string[]): Promise<string[]> {
    const frameworks: string[] = [];

    // Check package.json for JavaScript/TypeScript frameworks
    if (languages.includes('javascript') || languages.includes('typescript')) {
      const jsFrameworks = await this.detectJavaScriptFrameworks(repositoryPath);
      frameworks.push(...jsFrameworks);
    }

    // Check Python frameworks
    if (languages.includes('python')) {
      const pyFrameworks = await this.detectPythonFrameworks(repositoryPath);
      frameworks.push(...pyFrameworks);
    }

    // Check Java frameworks
    if (languages.includes('java')) {
      const javaFrameworks = await this.detectJavaFrameworks(repositoryPath);
      frameworks.push(...javaFrameworks);
    }

    // Check Go frameworks
    if (languages.includes('go')) {
      const goFrameworks = await this.detectGoFrameworks(repositoryPath);
      frameworks.push(...goFrameworks);
    }

    // Check Rust frameworks
    if (languages.includes('rust')) {
      const rustFrameworks = await this.detectRustFrameworks(repositoryPath);
      frameworks.push(...rustFrameworks);
    }

    return [...new Set(frameworks)]; // Remove duplicates
  }

  /**
   * Detects build tools used in the repository
   */
  async detectBuildTools(repositoryPath: string): Promise<string[]> {
    const buildTools: string[] = [];
    const buildFileChecks = [
      { file: 'package.json', tool: 'npm' },
      { file: 'yarn.lock', tool: 'yarn' },
      { file: 'pnpm-lock.yaml', tool: 'pnpm' },
      { file: 'pom.xml', tool: 'maven' },
      { file: 'build.gradle', tool: 'gradle' },
      { file: 'Cargo.toml', tool: 'cargo' },
      { file: 'go.mod', tool: 'go' },
      { file: 'requirements.txt', tool: 'pip' },
      { file: 'Pipfile', tool: 'pipenv' },
      { file: 'pyproject.toml', tool: 'poetry' },
      { file: 'Makefile', tool: 'make' },
      { file: 'CMakeLists.txt', tool: 'cmake' },
      { file: 'webpack.config.js', tool: 'webpack' },
      { file: 'rollup.config.js', tool: 'rollup' },
      { file: 'vite.config.js', tool: 'vite' },
      { file: 'gulpfile.js', tool: 'gulp' },
      { file: 'Gruntfile.js', tool: 'grunt' }
    ];

    for (const { file, tool } of buildFileChecks) {
      if (fs.existsSync(path.join(repositoryPath, file))) {
        buildTools.push(tool);
      }
    }

    return buildTools;
  }

  /**
   * Analyzes repository complexity
   */
  async analyzeComplexity(repositoryPath: string): Promise<'simple' | 'moderate' | 'complex'> {
    let fileCount = 0;
    let directoryCount = 0;
    let maxDepth = 0;
    let languageCount = 0;

    const languages = await this.detectLanguages(repositoryPath);
    languageCount = languages.length;

    await this.walkDirectory(repositoryPath, (filePath, depth) => {
      fileCount++;
      maxDepth = Math.max(maxDepth, depth);
    }, (dirPath, depth) => {
      directoryCount++;
    });

    // Complexity scoring
    let complexityScore = 0;
    
    if (fileCount > 100) complexityScore += 1;
    if (fileCount > 500) complexityScore += 1;
    if (fileCount > 1000) complexityScore += 1;
    
    if (directoryCount > 10) complexityScore += 1;
    if (directoryCount > 50) complexityScore += 1;
    
    if (maxDepth > 5) complexityScore += 1;
    if (maxDepth > 10) complexityScore += 1;
    
    if (languageCount > 3) complexityScore += 1;
    if (languageCount > 6) complexityScore += 1;

    if (complexityScore <= 2) return 'simple';
    if (complexityScore <= 5) return 'moderate';
    return 'complex';
  }

  /**
   * Finds configuration files in the repository
   */
  async findConfigFiles(repositoryPath: string): Promise<ConfigFileMap> {
    const configFiles: ConfigFileMap = {};
    
    const configPatterns = [
      // Linting and formatting
      { pattern: '.eslintrc.*', type: 'eslint', importance: 'high' as const },
      { pattern: 'eslint.config.js', type: 'eslint', importance: 'high' as const },
      { pattern: '.prettierrc.*', type: 'prettier', importance: 'medium' as const },
      { pattern: '.stylelintrc.*', type: 'stylelint', importance: 'medium' as const },
      
      // MegaLinter and Trunk
      { pattern: '.mega-linter.yml', type: 'megalinter', importance: 'critical' as const },
      { pattern: '.trunk/trunk.yaml', type: 'trunk', importance: 'high' as const },
      
      // TypeScript
      { pattern: 'tsconfig.json', type: 'typescript', importance: 'high' as const },
      { pattern: 'tsconfig.*.json', type: 'typescript', importance: 'medium' as const },
      
      // Build tools
      { pattern: 'package.json', type: 'npm', importance: 'critical' as const },
      { pattern: 'webpack.config.*', type: 'webpack', importance: 'medium' as const },
      { pattern: 'vite.config.*', type: 'vite', importance: 'medium' as const },
      
      // Testing
      { pattern: 'jest.config.*', type: 'jest', importance: 'medium' as const },
      { pattern: 'vitest.config.*', type: 'vitest', importance: 'medium' as const },
      { pattern: 'cypress.config.*', type: 'cypress', importance: 'low' as const },
      
      // Git and CI/CD
      { pattern: '.gitignore', type: 'git', importance: 'high' as const },
      { pattern: '.github/workflows/*', type: 'github-actions', importance: 'medium' as const },
      
      // Security
      { pattern: '.github/dependabot.yml', type: 'dependabot', importance: 'medium' as const },
      { pattern: '.snyk', type: 'snyk', importance: 'medium' as const }
    ];

    await this.walkDirectory(repositoryPath, (filePath) => {
      const relativePath = path.relative(repositoryPath, filePath);
      
      for (const { pattern, type, importance } of configPatterns) {
        if (this.matchesPattern(relativePath, pattern)) {
          const key = `${type}_${Object.keys(configFiles).length}`;
          configFiles[key] = {
            path: relativePath,
            type,
            importance
          };
        }
      }
    });

    return configFiles;
  }

  // Private helper methods

  private async walkDirectory(
    dirPath: string,
    fileCallback?: (filePath: string, depth: number) => void,
    dirCallback?: (dirPath: string, depth: number) => void,
    depth = 0
  ): Promise<void> {
    if (depth > this.maxDepth) return;

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        // Skip hidden directories and common ignore patterns
        if (this.shouldSkipPath(entry.name, entry.isDirectory())) {
          continue;
        }

        if (entry.isDirectory()) {
          dirCallback?.(fullPath, depth);
          await this.walkDirectory(fullPath, fileCallback, dirCallback, depth + 1);
        } else if (entry.isFile()) {
          fileCallback?.(fullPath, depth);
        }
      }
    } catch (error) {
      // Skip directories we can't read
      console.warn(`Warning: Could not read directory ${dirPath}:`, error);
    }
  }

  private shouldSkipPath(name: string, isDirectory: boolean): boolean {
    const skipPatterns = [
      'node_modules', '.git', '.svn', '.hg', 'vendor', 'target',
      'build', 'dist', '.next', '.nuxt', 'coverage', '.nyc_output',
      '__pycache__', '.pytest_cache', '.mypy_cache', '.venv', 'venv',
      '.idea', '.vscode', '.vs', '*.log', 'logs', 'tmp', 'temp'
    ];

    if (name.startsWith('.') && isDirectory && !name.match(/^\.(github|vscode|trunk)$/)) {
      return true;
    }

    return skipPatterns.some(pattern => {
      if (pattern.includes('*')) {
        return new RegExp(pattern.replace(/\*/g, '.*')).test(name);
      }
      return name === pattern;
    });
  }

  private getExtensionLanguageMap(): Map<string, string> {
    return new Map([
      // JavaScript/TypeScript
      ['.js', 'javascript'],
      ['.jsx', 'javascript'],
      ['.mjs', 'javascript'],
      ['.cjs', 'javascript'],
      ['.ts', 'typescript'],
      ['.tsx', 'typescript'],
      ['.vue', 'vue'],
      ['.svelte', 'svelte'],
      
      // Python
      ['.py', 'python'],
      ['.pyw', 'python'],
      ['.pyx', 'python'],
      
      // Java/JVM
      ['.java', 'java'],
      ['.kt', 'kotlin'],
      ['.kts', 'kotlin'],
      ['.scala', 'scala'],
      ['.groovy', 'groovy'],
      
      // C/C++
      ['.c', 'c'],
      ['.h', 'c'],
      ['.cpp', 'cpp'],
      ['.cxx', 'cpp'],
      ['.cc', 'cpp'],
      ['.hpp', 'cpp'],
      ['.hxx', 'cpp'],
      
      // C#
      ['.cs', 'csharp'],
      ['.vb', 'vb'],
      
      // Web
      ['.html', 'html'],
      ['.htm', 'html'],
      ['.css', 'css'],
      ['.scss', 'scss'],
      ['.sass', 'sass'],
      ['.less', 'less'],
      
      // Go
      ['.go', 'go'],
      
      // Rust
      ['.rs', 'rust'],
      
      // Ruby
      ['.rb', 'ruby'],
      ['.rbw', 'ruby'],
      
      // PHP
      ['.php', 'php'],
      ['.phtml', 'php'],
      
      // Swift
      ['.swift', 'swift'],
      
      // Config/Data
      ['.json', 'json'],
      ['.yaml', 'yaml'],
      ['.yml', 'yaml'],
      ['.xml', 'xml'],
      ['.toml', 'toml'],
      ['.ini', 'ini'],
      
      // Scripts
      ['.sh', 'shell'],
      ['.bash', 'shell'],
      ['.zsh', 'shell'],
      ['.fish', 'shell'],
      ['.ps1', 'powershell'],
      
      // Documentation
      ['.md', 'markdown'],
      ['.rst', 'rst'],
      
      // Docker
      ['dockerfile', 'dockerfile']
    ]);
  }

  private async detectSpecialLanguages(repositoryPath: string, languageFrequency: Map<string, number>): Promise<void> {
    // Check for Dockerfile
    const dockerfiles = ['Dockerfile', 'dockerfile', 'Dockerfile.dev', 'Dockerfile.prod'];
    for (const dockerfile of dockerfiles) {
      if (fs.existsSync(path.join(repositoryPath, dockerfile))) {
        languageFrequency.set('dockerfile', (languageFrequency.get('dockerfile') || 0) + 1);
      }
    }

    // Check for shell scripts without extensions
    const shellFiles = ['Makefile', 'makefile', 'configure', 'install'];
    for (const shellFile of shellFiles) {
      if (fs.existsSync(path.join(repositoryPath, shellFile))) {
        languageFrequency.set('shell', (languageFrequency.get('shell') || 0) + 1);
      }
    }
  }

  private async detectJavaScriptFrameworks(repositoryPath: string): Promise<string[]> {
    const frameworks: string[] = [];
    const packageJsonPath = path.join(repositoryPath, 'package.json');
    
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
        
        const frameworkChecks = [
          { key: 'react', frameworks: ['react'] },
          { key: '@angular/core', frameworks: ['angular'] },
          { key: 'vue', frameworks: ['vue'] },
          { key: 'svelte', frameworks: ['svelte'] },
          { key: 'next', frameworks: ['next', 'react'] },
          { key: 'nuxt', frameworks: ['nuxt', 'vue'] },
          { key: 'gatsby', frameworks: ['gatsby', 'react'] },
          { key: 'express', frameworks: ['express'] },
          { key: 'fastify', frameworks: ['fastify'] },
          { key: 'koa', frameworks: ['koa'] },
          { key: 'nestjs', frameworks: ['nestjs'] }
        ];

        for (const { key, frameworks: fwList } of frameworkChecks) {
          if (deps[key]) {
            frameworks.push(...fwList);
          }
        }
      } catch (error) {
        console.warn('Error parsing package.json:', error);
      }
    }

    return frameworks;
  }

  private async detectPythonFrameworks(repositoryPath: string): Promise<string[]> {
    const frameworks: string[] = [];
    const reqFiles = ['requirements.txt', 'pyproject.toml', 'Pipfile'];
    
    for (const reqFile of reqFiles) {
      const filePath = path.join(repositoryPath, reqFile);
      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath, 'utf8').toLowerCase();
          
          if (content.includes('django')) frameworks.push('django');
          if (content.includes('flask')) frameworks.push('flask');
          if (content.includes('fastapi')) frameworks.push('fastapi');
          if (content.includes('tornado')) frameworks.push('tornado');
          if (content.includes('pyramid')) frameworks.push('pyramid');
        } catch (error) {
          console.warn(`Error reading ${reqFile}:`, error);
        }
      }
    }

    return frameworks;
  }

  private async detectJavaFrameworks(repositoryPath: string): Promise<string[]> {
    const frameworks: string[] = [];
    const buildFiles = ['pom.xml', 'build.gradle'];
    
    for (const buildFile of buildFiles) {
      const filePath = path.join(repositoryPath, buildFile);
      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath, 'utf8').toLowerCase();
          
          if (content.includes('spring')) frameworks.push('spring');
          if (content.includes('springboot')) frameworks.push('springboot');
          if (content.includes('quarkus')) frameworks.push('quarkus');
          if (content.includes('micronaut')) frameworks.push('micronaut');
        } catch (error) {
          console.warn(`Error reading ${buildFile}:`, error);
        }
      }
    }

    return frameworks;
  }

  private async detectGoFrameworks(repositoryPath: string): Promise<string[]> {
    const frameworks: string[] = [];
    const goModPath = path.join(repositoryPath, 'go.mod');
    
    if (fs.existsSync(goModPath)) {
      try {
        const content = fs.readFileSync(goModPath, 'utf8').toLowerCase();
        
        if (content.includes('gin-gonic/gin')) frameworks.push('gin');
        if (content.includes('echo')) frameworks.push('echo');
        if (content.includes('fiber')) frameworks.push('fiber');
        if (content.includes('gorilla/mux')) frameworks.push('gorilla');
      } catch (error) {
        console.warn('Error reading go.mod:', error);
      }
    }

    return frameworks;
  }

  private async detectRustFrameworks(repositoryPath: string): Promise<string[]> {
    const frameworks: string[] = [];
    const cargoTomlPath = path.join(repositoryPath, 'Cargo.toml');
    
    if (fs.existsSync(cargoTomlPath)) {
      try {
        const content = fs.readFileSync(cargoTomlPath, 'utf8').toLowerCase();
        
        if (content.includes('actix-web')) frameworks.push('actix-web');
        if (content.includes('rocket')) frameworks.push('rocket');
        if (content.includes('warp')) frameworks.push('warp');
        if (content.includes('axum')) frameworks.push('axum');
      } catch (error) {
        console.warn('Error reading Cargo.toml:', error);
      }
    }

    return frameworks;
  }

  private async analyzeLanguagePrevalence(repositoryPath: string, languages: string[]): Promise<{primary: string[], secondary: string[]}> {
    const languageFiles = new Map<string, number>();
    const languageLines = new Map<string, number>();
    const extensionMap = this.getExtensionLanguageMap();

    await this.walkDirectory(repositoryPath, (filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      const language = extensionMap.get(ext);
      
      if (language) {
        languageFiles.set(language, (languageFiles.get(language) || 0) + 1);
        
        // Count lines for better prevalence analysis
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const lineCount = content.split('\n').length;
          languageLines.set(language, (languageLines.get(language) || 0) + lineCount);
        } catch (error) {
          // Skip files we can't read
        }
      }
    });

    const totalFiles = Array.from(languageFiles.values()).reduce((sum, count) => sum + count, 0);
    const sortedByPrevalence = languages
      .map(lang => ({
        language: lang,
        files: languageFiles.get(lang) || 0,
        lines: languageLines.get(lang) || 0,
        filePercentage: ((languageFiles.get(lang) || 0) / totalFiles) * 100
      }))
      .sort((a, b) => b.lines - a.lines);

    const primary = sortedByPrevalence
      .filter(item => item.filePercentage >= 10 || item.files >= 5)
      .slice(0, 3)
      .map(item => item.language);

    const secondary = sortedByPrevalence
      .filter(item => !primary.includes(item.language) && (item.filePercentage >= 2 || item.files >= 1))
      .slice(0, 5)
      .map(item => item.language);

    return { primary, secondary };
  }

  private calculateConfidence(
    languages: string[],
    frameworks: string[],
    buildTools: string[],
    configFiles: ConfigFileMap
  ): number {
    let confidence = 0.3; // Base confidence

    // Language detection confidence
    if (languages.length > 0) confidence += 0.3;
    if (languages.length > 2) confidence += 0.1;

    // Framework detection confidence
    if (frameworks.length > 0) confidence += 0.2;

    // Build tools confidence
    if (buildTools.length > 0) confidence += 0.1;

    // Config files confidence
    const configFileCount = Object.keys(configFiles).length;
    if (configFileCount > 0) confidence += 0.1;
    if (configFileCount > 5) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }

  private matchesPattern(filePath: string, pattern: string): boolean {
    if (pattern.includes('*')) {
      const regexPattern = pattern.replace(/\*/g, '.*');
      return new RegExp(regexPattern).test(filePath);
    }
    return filePath === pattern || filePath.endsWith(`/${pattern}`);
  }
}