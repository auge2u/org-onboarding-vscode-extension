/**
 * Advanced Framework Analyzer
 * Provides sophisticated framework and library detection through dependency and pattern analysis
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { FrameworkAnalyzer, FrameworkDetectionResult, ArchitecturePatternResult, ProfilingOptions, ProfilingPerformanceMetrics } from './types';
import { walkDirectory } from './languageDetectorHelpers';
import {
  analyzePackageFile,
  analyzeCodePatterns,
  analyzeFileStructure,
  analyzeCodePatternsForArchitecture,
  analyzeConfigPatternsForArchitecture,
  enhanceWithArchitecturePatterns,
  extractVersion
} from './frameworkAnalyzerHelpers';

// Framework detection pattern
interface FrameworkPattern {
  name: string;
  languages: string[];
  packagePatterns?: Record<string, RegExp>;
  filePatterns?: string[];
  importPatterns?: RegExp[];
  codePatterns?: RegExp[];
  configFiles?: string[];
  weight: number;
}

// Architecture pattern detection
interface ArchitecturePattern {
  pattern: string;
  languages: string[];
  fileStructurePatterns?: string[];
  codePatterns?: RegExp[];
  importPatterns?: RegExp[];
  configPatterns?: Record<string, RegExp>;
  description: string;
  weight: number;
}

/**
 * Advanced framework analyzer implementation
 */
export class AdvancedFrameworkAnalyzer implements FrameworkAnalyzer {
  private readonly frameworkPatterns: FrameworkPattern[];
  private readonly architecturePatterns: ArchitecturePattern[];
  private readonly resultCache: Map<string, FrameworkDetectionResult[]> = new Map();
  private readonly maxCacheSize = 50;
  private readonly minConfidenceThreshold = 0.6;
  private performanceMetrics: ProfilingPerformanceMetrics;

  constructor() {
    this.frameworkPatterns = this.initializeFrameworkPatterns();
    this.architecturePatterns = this.initializeArchitecturePatterns();
    this.performanceMetrics = this.initializePerformanceMetrics();
  }

  /**
   * Analyze repository to detect frameworks with confidence scores
   */
  async analyze(repositoryPath: string, options?: ProfilingOptions): Promise<FrameworkDetectionResult[]> {
    const startTime = Date.now();
    const maxDepth = options?.maxDepth || 5;
    const cacheResults = options?.cacheResults !== false;
    const timeoutMs = options?.timeoutMs || 30000;

    // Reset performance metrics
    this.performanceMetrics = this.initializePerformanceMetrics();
    this.performanceMetrics.operationName = 'framework-detection';

    try {
      // Check cache first
      const cacheKey = `${repositoryPath}:${maxDepth}`;
      if (cacheResults && this.resultCache.has(cacheKey)) {
        this.performanceMetrics.cacheHits++;
        return this.resultCache.get(cacheKey)!;
      }
      this.performanceMetrics.cacheMisses++;

      // Find package files
      const packageFiles = await this.findPackageFiles(repositoryPath, maxDepth);
      
      // Detect languages in the repository
      const languages = await this.detectLanguages(repositoryPath, maxDepth);
      
      // Detect frameworks
      const frameworks = await this.detectFrameworks(languages, packageFiles);
      
      // Detect architecture patterns
      const architecturePatterns = await this.detectArchitecturePatterns(repositoryPath);
      
      // Enhance framework results with architecture patterns
      const enhancedResults = enhanceWithArchitecturePatterns(frameworks, architecturePatterns);
      
      // Cache results
      if (cacheResults) {
        if (this.resultCache.size >= this.maxCacheSize) {
          const oldestKey = this.resultCache.keys().next().value;
          if (oldestKey) {
            this.resultCache.delete(oldestKey);
          }
        }
        this.resultCache.set(cacheKey, enhancedResults);
      }

      // Update performance metrics
      this.performanceMetrics.executionTime = Date.now() - startTime;
      
      return enhancedResults;
    } catch (error) {
      console.error('Error in framework detection:', error);
      throw new Error(`Framework detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Detect frameworks based on languages and package files
   */
  async detectFrameworks(languages: string[], packageFiles: string[]): Promise<FrameworkDetectionResult[]> {
    const frameworkMatches: Map<string, FrameworkDetectionResult> = new Map();
    
    // Analyze package files
    for (const filePath of packageFiles) {
      const packageMatches = await analyzePackageFile(filePath, languages, this.frameworkPatterns);
      
      // Merge results
      for (const match of packageMatches) {
        if (frameworkMatches.has(match.name)) {
          const existing = frameworkMatches.get(match.name)!;
          existing.confidence = Math.max(existing.confidence, match.confidence);
          existing.files = [...new Set([...existing.files, ...match.files])];
          existing.dependencies = [...new Set([...existing.dependencies, ...match.dependencies])];
        } else {
          frameworkMatches.set(match.name, match);
        }
      }
    }
    
    // Analyze code patterns
    const codeMatches = await analyzeCodePatterns(languages, packageFiles, this.frameworkPatterns, '');
    
    // Merge code pattern results
    for (const match of codeMatches) {
      if (frameworkMatches.has(match.name)) {
        const existing = frameworkMatches.get(match.name)!;
        existing.confidence = Math.max(existing.confidence, match.confidence);
        existing.files = [...new Set([...existing.files, ...match.files])];
      } else {
        frameworkMatches.set(match.name, match);
      }
    }
    
    // Convert to array and sort by confidence
    const results = Array.from(frameworkMatches.values())
      .filter(result => result.confidence >= this.minConfidenceThreshold)
      .sort((a, b) => b.confidence - a.confidence);
    
    // Determine usage level based on confidence and file count
    for (const result of results) {
      if (result.confidence > 0.8 && result.files.length > 5) {
        result.usage = 'primary';
      } else if (result.confidence > 0.6 || result.files.length > 2) {
        result.usage = 'secondary';
      } else {
        result.usage = 'minimal';
      }
    }
    
    return results;
  }

  /**
   * Detect version for a framework
   */
  async detectVersion(framework: string, packageFiles: string[]): Promise<string | null> {
    for (const filePath of packageFiles) {
      const ext = path.extname(filePath).toLowerCase();
      const fileName = path.basename(filePath).toLowerCase();
      
      try {
        // Check package.json for JavaScript/TypeScript frameworks
        if (fileName === 'package.json') {
          const content = fs.readFileSync(filePath, 'utf8');
          const packageJson = JSON.parse(content);
          
          // Check dependencies
          const allDeps = {
            ...packageJson.dependencies,
            ...packageJson.devDependencies
          };
          
          // Framework-specific version detection
          if (framework === 'react' && allDeps.react) {
            return extractVersion(allDeps.react);
          } else if (framework === 'angular' && allDeps['@angular/core']) {
            return extractVersion(allDeps['@angular/core']);
          } else if (framework === 'vue' && allDeps.vue) {
            return extractVersion(allDeps.vue);
          } else if (framework === 'next' && allDeps.next) {
            return extractVersion(allDeps.next);
          } else if (framework === 'express' && allDeps.express) {
            return extractVersion(allDeps.express);
          }
        }
        
        // Check requirements.txt for Python frameworks
        if (fileName === 'requirements.txt') {
          const content = fs.readFileSync(filePath, 'utf8');
          const lines = content.split('\n');
          
          for (const line of lines) {
            if (framework === 'django' && line.toLowerCase().includes('django')) {
              const match = line.match(/django[=~<>]+([0-9.]+)/i);
              if (match) return match[1];
            } else if (framework === 'flask' && line.toLowerCase().includes('flask')) {
              const match = line.match(/flask[=~<>]+([0-9.]+)/i);
              if (match) return match[1];
            }
          }
        }
        
        // Check pom.xml for Java frameworks
        if (fileName === 'pom.xml') {
          const content = fs.readFileSync(filePath, 'utf8');
          
          if (framework === 'spring' || framework === 'spring-boot') {
            const match = content.match(/<spring[.-]boot\.version>([0-9.]+)<\/spring[.-]boot\.version>/i) ||
                          content.match(/<spring\.version>([0-9.]+)<\/spring\.version>/i);
            if (match) return match[1];
          }
        }
        
        // Check build.gradle for Java frameworks
        if (fileName === 'build.gradle') {
          const content = fs.readFileSync(filePath, 'utf8');
          
          if (framework === 'spring' || framework === 'spring-boot') {
            const match = content.match(/spring[.-]boot[.-]version\s*=\s*['"]([0-9.]+)['"]/i) ||
                          content.match(/spring[.-]version\s*=\s*['"]([0-9.]+)['"]/i);
            if (match) return match[1];
          }
        }
        
        // Check go.mod for Go frameworks
        if (fileName === 'go.mod') {
          const content = fs.readFileSync(filePath, 'utf8');
          
          if (framework === 'gin' && content.includes('gin-gonic/gin')) {
            const match = content.match(/gin-gonic\/gin\s+v([0-9.]+)/);
            if (match) return match[1];
          } else if (framework === 'echo' && content.includes('labstack/echo')) {
            const match = content.match(/labstack\/echo\/v\d+\s+v([0-9.]+)/);
            if (match) return match[1];
          }
        }
        
        // Check Cargo.toml for Rust frameworks
        if (fileName === 'cargo.toml' || fileName === 'Cargo.toml') {
          const content = fs.readFileSync(filePath, 'utf8');
          
          if (framework === 'actix-web' && content.includes('actix-web')) {
            const match = content.match(/actix-web\s*=\s*["']([0-9.]+)["']/);
            if (match) return match[1];
          } else if (framework === 'rocket' && content.includes('rocket')) {
            const match = content.match(/rocket\s*=\s*["']([0-9.]+)["']/);
            if (match) return match[1];
          }
        }
      } catch (error) {
        console.warn(`Error detecting version for ${framework} in ${filePath}:`, error);
      }
    }
    
    return null;
  }

  /**
   * Detect architecture patterns in the repository
   */
  async detectArchitecturePatterns(repositoryPath: string): Promise<ArchitecturePatternResult[]> {
    const results: ArchitecturePatternResult[] = [];
    const fileStructure = await analyzeFileStructure(repositoryPath);
    
    for (const pattern of this.architecturePatterns) {
      let matches = 0;
      let totalPatterns = 0;
      const locations: string[] = [];
      
      // Check file structure patterns
      if (pattern.fileStructurePatterns) {
        for (const structurePattern of pattern.fileStructurePatterns) {
          totalPatterns++;
          
          // Check if any file path matches this pattern
          const regex = new RegExp(structurePattern);
          for (const filePath of fileStructure) {
            if (regex.test(filePath)) {
              matches++;
              locations.push(filePath);
              break;
            }
          }
        }
      }
      
      // Check code patterns
      if (pattern.codePatterns) {
        const codeMatches = await analyzeCodePatternsForArchitecture(
          repositoryPath, pattern.codePatterns
        );
        
        totalPatterns += pattern.codePatterns.length;
        matches += codeMatches.matchCount;
        locations.push(...codeMatches.locations);
      }
      
      // Check config patterns
      if (pattern.configPatterns) {
        const configMatches = await analyzeConfigPatternsForArchitecture(
          repositoryPath, pattern.configPatterns
        );
        
        totalPatterns += Object.keys(pattern.configPatterns).length;
        matches += configMatches.matchCount;
        locations.push(...configMatches.locations);
      }
      
      // Calculate confidence
      if (matches > 0 && totalPatterns > 0) {
        const confidence = (matches / totalPatterns) * pattern.weight;
        
        if (confidence >= this.minConfidenceThreshold) {
          results.push({
            pattern: pattern.pattern,
            confidence,
            locations: [...new Set(locations)],
            description: pattern.description
          });
        }
      }
    }
    
    // Sort by confidence (descending)
    return results.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Get capabilities of this analyzer
   */
  getCapabilities(): string[] {
    return [
      'framework-detection',
      'version-detection',
      'architecture-pattern-detection',
      'dependency-analysis',
      'confidence-scoring'
    ];
  }

  /**
   * Check if this analyzer is available
   */
  async isAvailable(): Promise<boolean> {
    return true;
  }

  /**
   * Get performance metrics for the last operation
   */
  getPerformanceMetrics(): ProfilingPerformanceMetrics {
    return this.performanceMetrics;
  }

  // Private helper methods

  /**
   * Initialize framework detection patterns
   */
  private initializeFrameworkPatterns(): FrameworkPattern[] {
    return [
      // JavaScript/TypeScript frameworks
      {
        name: 'react',
        languages: ['javascript', 'typescript'],
        packagePatterns: {
          'dependencies.react': /^/,
          'devDependencies.react': /^/
        },
        filePatterns: [
          '**/*.jsx',
          '**/*.tsx',
          '**/react.config.js'
        ],
        importPatterns: [
          /\bimport\s+React\b/,
          /\bimport\s+\{\s*[^}]*\bComponent\b[^}]*\}\s+from\s+['"]react['"]/,
          /\bimport\s+\{\s*[^}]*\buseState\b[^}]*\}\s+from\s+['"]react['"]/
        ],
        codePatterns: [
          /\bextends\s+React\.Component\b/,
          /\buseState\s*\(/,
          /\buseEffect\s*\(/,
          /\brender\s*\(\s*\)\s*\{/
        ],
        weight: 1.0
      },
      {
        name: 'angular',
        languages: ['javascript', 'typescript'],
        packagePatterns: {
          'dependencies.@angular/core': /^/,
          'devDependencies.@angular/core': /^/
        },
        filePatterns: [
          '**/angular.json',
          '**/*.component.ts',
          '**/*.module.ts',
          '**/*.service.ts'
        ],
        importPatterns: [
          /\bimport\s+\{\s*[^}]*\bComponent\b[^}]*\}\s+from\s+['"]@angular\/core['"]/,
          /\bimport\s+\{\s*[^}]*\bNgModule\b[^}]*\}\s+from\s+['"]@angular\/core['"]/
        ],
        codePatterns: [
          /\@Component\s*\(\s*\{/,
          /\@Injectable\s*\(\s*\{/,
          /\@NgModule\s*\(\s*\{/
        ],
        weight: 1.0
      },
      {
        name: 'vue',
        languages: ['javascript', 'typescript'],
        packagePatterns: {
          'dependencies.vue': /^/,
          'devDependencies.vue': /^/
        },
        filePatterns: [
          '**/*.vue',
          '**/vue.config.js'
        ],
        importPatterns: [
          /\bimport\s+Vue\b/,
          /\bimport\s+\{\s*[^}]*\bdefineComponent\b[^}]*\}\s+from\s+['"]vue['"]/
        ],
        codePatterns: [
          /\bnew\s+Vue\s*\(/,
          /\bVue\.component\s*\(/,
          /<template>/,
          /<script>/
        ],
        weight: 1.0
      },
      {
        name: 'next',
        languages: ['javascript', 'typescript'],
        packagePatterns: {
          'dependencies.next': /^/,
          'devDependencies.next': /^/
        },
        filePatterns: [
          '**/next.config.js',
          '**/pages/**/*.js',
          '**/pages/**/*.tsx',
          '**/pages/api/**/*.js'
        ],
        importPatterns: [
          /\bimport\s+\{\s*[^}]*\buseRouter\b[^}]*\}\s+from\s+['"]next\/router['"]/,
          /\bimport\s+\{\s*[^}]*\bHead\b[^}]*\}\s+from\s+['"]next\/head['"]/
        ],
        codePatterns: [
          /\bexport\s+default\s+function\s+\w+\s*\(\s*\{\s*[^}]*\}\s*\)/,
          /\bgetStaticProps\b/,
          /\bgetServerSideProps\b/
        ],
        weight: 1.0
      },
      {
        name: 'express',
        languages: ['javascript', 'typescript'],
        packagePatterns: {
          'dependencies.express': /^/,
          'devDependencies.express': /^/
        },
        filePatterns: [
          '**/server.js',
          '**/app.js',
          '**/index.js'
        ],
        importPatterns: [
          /\brequire\s*\(\s*['"]express['"]\s*\)/,
          /\bimport\s+express\b/
        ],
        codePatterns: [
          /\bexpress\s*\(\s*\)/,
          /\bapp\.get\s*\(/,
          /\bapp\.post\s*\(/,
          /\bapp\.use\s*\(/,
          /\brouter\.get\s*\(/
        ],
        weight: 1.0
      },
      
      // Python frameworks
      {
        name: 'django',
        languages: ['python'],
        filePatterns: [
          '**/manage.py',
          '**/settings.py',
          '**/urls.py',
          '**/wsgi.py',
          '**/asgi.py'
        ],
        importPatterns: [
          /\bfrom\s+django\b/,
          /\bimport\s+django\b/
        ],
        codePatterns: [
          /\bfrom\s+django\.db\s+import\s+models\b/,
          /\bclass\s+\w+\s*\(\s*models\.Model\s*\)/,
          /\burlpatterns\s*=/,
          /\bDJANGO_SETTINGS_MODULE\b/
        ],
        weight: 1.0
      },
      {
        name: 'flask',
        languages: ['python'],
        filePatterns: [
          '**/app.py',
          '**/wsgi.py',
          '**/flask_app.py'
        ],
        importPatterns: [
          /\bfrom\s+flask\s+import\b/,
          /\bimport\s+flask\b/
        ],
        codePatterns: [
          /\bFlask\s*\(/,
          /\bapp\s*=\s*Flask\s*\(/,
          /\@app\.route\s*\(/,
          /\brender_template\s*\(/
        ],
        weight: 1.0
      },
      
      // Java frameworks
      {
        name: 'spring',
        languages: ['java', 'kotlin'],
        filePatterns: [
          '**/application.properties',
          '**/application.yml',
          '**/pom.xml',
          '**/build.gradle'
        ],
        importPatterns: [
          /\bimport\s+org\.springframework\b/,
          /\bimport\s+org\.springframework\.boot\b/
        ],
        codePatterns: [
          /\@SpringBootApplication\b/,
          /\@RestController\b/,
          /\@Service\b/,
          /\@Repository\b/,
          /\@Autowired\b/
        ],
        weight: 1.0
      },
      
      // Go frameworks
      {
        name: 'gin',
        languages: ['go'],
        filePatterns: [
          '**/go.mod',
          '**/main.go'
        ],
        importPatterns: [
          /\bimport\s+[^)]*github\.com\/gin-gonic\/gin[^)]*\)/
        ],
        codePatterns: [
          /\bgin\.Default\s*\(/,
          /\bgin\.New\s*\(/,
          /\brouter\s*:=\s*gin\.Default\s*\(/,
          /\br\.GET\s*\(/,
          /\br\.POST\s*\(/
        ],
        weight: 1.0
      },
      
      // Rust frameworks
      {
        name: 'actix-web',
        languages: ['rust'],
        filePatterns: [
          '**/Cargo.toml',
          '**/main.rs',
          '**/lib.rs'
        ],
        importPatterns: [
          /\buse\s+actix_web::/
        ],
        codePatterns: [
          /\bHttpServer::new\s*\(/,
          /\bApp::new\s*\(\)/,
          /\b#\[get\]\b/,
          /\b#\[post\]\b/,
          /\basync\s+fn\s+index\b/
        ],
        weight: 1.0
      }
    ];
  }

  /**
   * Initialize architecture pattern detection
   */
  private initializeArchitecturePatterns(): ArchitecturePattern[] {
    return [
      // MVC pattern
      {
        pattern: 'MVC',
        languages: ['javascript', 'typescript', 'python', 'java', 'ruby', 'php'],
        fileStructurePatterns: [
          '(controllers?|models?|views?)/.+\\.(js|ts|py|java|rb|php)$',
          'app/(controllers?|models?|views?)/.+\\.(js|ts|py|java|rb|php)$',
          'src/(controllers?|models?|views?)/.+\\.(js|ts|py|java|rb|php)$'
        ],
        codePatterns: [
          /class\s+\w+Controller\b/,
          /class\s+\w+Model\b/,
          /\brender\s*\(\s*['"][^'"]+['"]\s*,/
        ],
        description: 'Model-View-Controller architecture pattern',
        weight: 1.0
      },
      
      // MVVM pattern
      {
        pattern: 'MVVM',
        languages: ['javascript', 'typescript', 'c#', 'java', 'kotlin'],
        fileStructurePatterns: [
          '(viewmodels?|models?)/.+\\.(js|ts|cs|java|kt)$',
          'app/(viewmodels?|models?)/.+\\.(js|ts|cs|java|kt)$',
          'src/(viewmodels?|models?)/.+\\.(js|ts|cs|java|kt)$'
        ],
        codePatterns: [
          /class\s+\w+ViewModel\b/,
          /\bobservable\b/,
          /\bbinding\b/,
          /\bnotifyPropertyChanged\b/i
        ],
        description: 'Model-View-ViewModel architecture pattern',
        weight: 1.0
      },
      
      // Microservices
      {
        pattern: 'Microservices',
        languages: ['javascript', 'typescript', 'java', 'go', 'python'],
        fileStructurePatterns: [
          'services?/.+/Dockerfile',
          'services?/.+/package\\.json',
          'services?/.+/pom\\.xml',
          'services?/.+/go\\.mod'
        ],
        configPatterns: {
          'docker-compose.yml': /services:/,
          'kubernetes': /apiVersion:/
        },
        description: 'Microservices architecture with multiple independent services',
        weight: 1.0
      },
      
      // Hexagonal/Clean Architecture
      {
        pattern: 'Hexagonal',
        languages: ['javascript', 'typescript', 'java', 'go', 'python'],
        fileStructurePatterns: [
          '(core|domain|entities)/.+\\.(js|ts|java|go|py)$',
          '(adapters|ports|interfaces|infrastructure)/.+\\.(js|ts|java|go|py)$',
          'src/(core|domain|entities)/.+\\.(js|ts|java|go|py)$'
        ],
        codePatterns: [
          /interface\s+\w+Repository\b/,
          /interface\s+\w+Service\b/,
          /class\s+\w+UseCase\b/
        ],
        description: 'Hexagonal/Clean Architecture with domain-driven design',
        weight: 1.0
      },
      
      // JAMstack
      {
        pattern: 'JAMstack',
        languages: ['javascript', 'typescript'],
        fileStructurePatterns: [
          'static/.+\\.(html|js|css)$',
          'content/.+\\.(md|mdx|json)$',
          'public/.+\\.(html|js|css)$'
        ],
        configPatterns: {
          'gatsby-config.js': /module\.exports/,
          'next.config.js': /module\.exports/,
          'nuxt.config.js': /export default/,
          'netlify.toml': /\[build\]/
        },
        description: 'JavaScript, APIs, and Markup stack for static sites',
        weight: 1.0
      },
      
      // Event-driven architecture
      {
        pattern: 'Event-driven',
        languages: ['javascript', 'typescript', 'java', 'python', 'go'],
        fileStructurePatterns: [
          '(events?|listeners?|subscribers?)/.+\\.(js|ts|java|py|go)$',
          'src/(events?|listeners?|subscribers?)/.+\\.(js|ts|java|py|go)$'
        ],
        codePatterns: [
          /\bemit\s*\(/,
          /\bon\s*\(\s*['"][^'"]+['"]/,
          /\baddEventListener\s*\(/,
          /\bpublish\s*\(/,
          /\bsubscribe\s*\(/
        ],
        description: 'Event-driven architecture with publishers and subscribers',
        weight: 1.0
      }
    ];
  }

  /**
   * Initialize performance metrics
   */
  private initializePerformanceMetrics(): ProfilingPerformanceMetrics {
    return {
      operationName: 'framework-detection',
      executionTime: 0,
      memoryUsage: 0,
      cacheHits: 0,
      cacheMisses: 0,
      incrementalUpdates: 0
    };
  }

  /**
   * Find package files in the repository
   */
  private async findPackageFiles(repositoryPath: string, maxDepth: number): Promise<string[]> {
    const packageFiles: string[] = [];
    
    const packageFilePatterns = [
      'package.json',
      'requirements.txt',
      'pyproject.toml',
      'Pipfile',
      'pom.xml',
      'build.gradle',
      'Cargo.toml',
      'go.mod',
      'composer.json',
      'Gemfile'
    ];
    
    await walkDirectory(
      repositoryPath,
      (filePath) => {
        const fileName = path.basename(filePath);
        if (packageFilePatterns.includes(fileName)) {
          packageFiles.push(filePath);
        }
      },
      maxDepth
    );
    
    return packageFiles;
  }

  /**
   * Detect languages in the repository
   */
  private async detectLanguages(repositoryPath: string, maxDepth: number): Promise<string[]> {
    // This is a simplified language detection
    // In a real implementation, we would use the LanguageDetector
    const languageExtensions: Record<string, string> = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.go': 'go',
      '.rs': 'rust',
      '.rb': 'ruby',
      '.php': 'php',
      '.cs': 'csharp'
    };
    
    const languageCounts: Record<string, number> = {};
    
    await walkDirectory(
      repositoryPath,
      (filePath) => {
        const ext = path.extname(filePath).toLowerCase();
        const language = languageExtensions[ext];
        
        if (language) {
          languageCounts[language] = (languageCounts[language] || 0) + 1;
        }
      },
      maxDepth
    );
    
    // Sort by frequency and return languages with significant presence
    return Object.entries(languageCounts)
      .sort(([, a], [, b]) => b - a)
      .filter(([, count]) => count >= 3) // At least 3 files
      .map(([lang]) => lang);
  }

  /**
   * Analyze a package file for framework detection
   */
  private async analyzePackageFile(filePath: string, languages: string[]): Promise<FrameworkDetectionResult[]> {
    const results: FrameworkDetectionResult[] = [];
    // TODO: Implement package file analysis
    return results;
  }
}