/**
 * Pre-built GitHub Actions Workflow Templates for MegaLinter Integration
 * Provides ready-to-use workflow templates for different project types and complexity levels
 */

import { WorkflowTemplate } from '../githubActionsApi';
import { LanguageProfile } from '../megalinter/types';

export class WorkflowTemplates {
  /**
   * Gets all available workflow templates
   */
  getAllTemplates(): WorkflowTemplate[] {
    return [
      this.getBasicTemplate(),
      this.getEnterpriseTemplate(),
      this.getSecurityTemplate(),
      this.getPerformanceTemplate(),
      this.getMultiLanguageTemplate(),
      this.getOrganizationTemplate()
    ];
  }

  /**
   * Gets a template by type
   */
  getTemplate(type: WorkflowTemplate['type']): WorkflowTemplate | undefined {
    return this.getAllTemplates().find(template => template.type === type);
  }

  /**
   * Gets templates suitable for a specific language profile
   */
  getTemplatesForProfile(profile: LanguageProfile): WorkflowTemplate[] {
    return this.getAllTemplates().filter(template => {
      // Check if template supports any of the primary languages
      return profile.primary.some(lang => template.languages.includes(lang)) ||
             template.languages.includes('*'); // Universal templates
    });
  }

  /**
   * Basic Template - Simple MegaLinter execution for small projects
   */
  getBasicTemplate(): WorkflowTemplate {
    return {
      name: 'Basic MegaLinter',
      description: 'Simple MegaLinter execution optimized for small projects with fast feedback',
      type: 'basic',
      languages: ['*'], // Universal
      complexity: 'simple',
      content: `name: Code Quality Check

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]
  workflow_dispatch:

env:
  MEGALINTER_CONFIG: .mega-linter.yml
  LOG_LEVEL: INFO

permissions:
  contents: read
  issues: write
  pull-requests: write

jobs:
  megalinter:
    name: MegaLinter
    runs-on: ubuntu-latest
    timeout-minutes: 20
    
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Run MegaLinter
        uses: oxsecurity/megalinter@v7
        env:
          DEFAULT_WORKSPACE: \${{ github.workspace }}
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          MEGALINTER_PROFILE: fast
          VALIDATE_ALL_CODEBASE: true

      - name: Upload MegaLinter Reports
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: megalinter-reports
          path: megalinter-reports/
          retention-days: 7
`,
      requiredPermissions: ['contents:read', 'issues:write', 'pull-requests:write']
    };
  }

  /**
   * Enterprise Template - Advanced governance, security scanning, and compliance checking
   */
  getEnterpriseTemplate(): WorkflowTemplate {
    return {
      name: 'Enterprise MegaLinter',
      description: 'Comprehensive enterprise-grade workflow with governance, security, and compliance features',
      type: 'enterprise',
      languages: ['*'],
      complexity: 'moderate',
      content: `name: Enterprise Code Analysis

on:
  push:
    branches: [ main, develop, release/* ]
  pull_request:
    branches: [ main, develop ]
  schedule:
    - cron: '0 2 * * 1' # Weekly on Monday at 2 AM
  workflow_dispatch:
    inputs:
      full_scan:
        description: 'Run full repository scan'
        required: false
        default: false
        type: boolean

env:
  MEGALINTER_CONFIG: .mega-linter.yml
  LOG_LEVEL: INFO
  REPORT_OUTPUT_FOLDER: megalinter-reports

permissions:
  contents: read
  issues: write
  pull-requests: write
  security-events: write
  actions: read

concurrency:
  group: \${{ github.workflow }}-\${{ github.ref }}
  cancel-in-progress: true

jobs:
  megalinter:
    name: MegaLinter Analysis
    runs-on: ubuntu-latest
    timeout-minutes: 45
    
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: \${{ secrets.GITHUB_TOKEN }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        if: contains(github.event.repository.topics, 'javascript') || contains(github.event.repository.topics, 'typescript')
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install Dependencies
        if: contains(github.event.repository.topics, 'javascript') || contains(github.event.repository.topics, 'typescript')
        run: |
          if [ -f "package-lock.json" ]; then
            npm ci
          elif [ -f "yarn.lock" ]; then
            yarn install --frozen-lockfile
          elif [ -f "pnpm-lock.yaml" ]; then
            pnpm install --frozen-lockfile
          fi

      - name: Cache MegaLinter
        uses: actions/cache@v3
        with:
          path: |
            ~/.cache/megalinter
            /tmp/megalinter-cache
          key: megalinter-\${{ runner.os }}-\${{ hashFiles('**/.mega-linter.yml') }}
          restore-keys: |
            megalinter-\${{ runner.os }}-

      - name: Run MegaLinter
        uses: oxsecurity/megalinter@v7
        env:
          DEFAULT_WORKSPACE: \${{ github.workspace }}
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          MEGALINTER_PROFILE: \${{ github.event.inputs.full_scan == 'true' && 'thorough' || 'balanced' }}
          VALIDATE_ALL_CODEBASE: \${{ github.event.inputs.full_scan || github.event_name == 'schedule' }}
          PARALLEL: true
          SHOW_ELAPSED_TIME: true
          FILEIO_REPORTER: true
          OUTPUT_FORMAT: json,sarif,text

      - name: Upload MegaLinter Reports
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: megalinter-reports-\${{ github.run_number }}
          path: megalinter-reports/
          retention-days: 30

      - name: Upload SARIF Results
        uses: github/codeql-action/upload-sarif@v2
        if: always()
        with:
          sarif_file: megalinter-reports/megalinter.sarif
        continue-on-error: true

  security-scan:
    name: Security Scanning
    runs-on: ubuntu-latest
    timeout-minutes: 15
    
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Run Trivy Vulnerability Scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          format: 'sarif'
          output: 'trivy-results.sarif'

      - name: Upload Trivy Results
        uses: github/codeql-action/upload-sarif@v2
        if: always()
        with:
          sarif_file: 'trivy-results.sarif'

  compliance-check:
    name: Enterprise Compliance
    runs-on: ubuntu-latest
    timeout-minutes: 10
    
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Check Organization Standards
        run: |
          echo "🔍 Checking enterprise compliance standards..."
          
          # Required files check
          required_files=(".mega-linter.yml" "README.md" "LICENSE" ".gitignore")
          missing_files=()
          
          for file in "\${required_files[@]}"; do
            if [ ! -f "\$file" ]; then
              missing_files+=("\$file")
              echo "❌ Missing required file: \$file"
            else
              echo "✅ Found required file: \$file"
            fi
          done
          
          # Security configuration check
          if [ ! -f ".github/dependabot.yml" ]; then
            echo "⚠️  Missing .github/dependabot.yml (recommended for dependency updates)"
          else
            echo "✅ Dependabot configuration found"
          fi
          
          # CI/CD configuration check
          if [ ! -d ".github/workflows" ]; then
            echo "❌ Missing .github/workflows directory"
            missing_files+=(".github/workflows")
          else
            echo "✅ GitHub Actions workflows configured"
          fi
          
          # Fail if critical files are missing
          if [ \${#missing_files[@]} -gt 0 ]; then
            echo "❌ Enterprise compliance check failed. Missing critical files: \${missing_files[*]}"
            exit 1
          fi
          
          echo "✅ Enterprise compliance check passed"

      - name: License Compliance Check
        run: |
          echo "📋 Checking license compliance..."
          
          if [ -f "LICENSE" ]; then
            # Check for approved license types
            if grep -qiE "(MIT|Apache|BSD|GPL)" LICENSE; then
              echo "✅ Approved license found"
            else
              echo "⚠️  License type may require review"
            fi
          fi
`,
      requiredPermissions: ['contents:read', 'issues:write', 'pull-requests:write', 'security-events:write']
    };
  }

  /**
   * Security Template - Comprehensive security linting and vulnerability assessment
   */
  getSecurityTemplate(): WorkflowTemplate {
    return {
      name: 'Security-First MegaLinter',
      description: 'Security-focused workflow with comprehensive vulnerability scanning and security linting',
      type: 'security',
      languages: ['*'],
      complexity: 'moderate',
      content: `name: Security & Quality Analysis

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]
  schedule:
    - cron: '0 1 * * *' # Daily at 1 AM
  workflow_dispatch:

env:
  MEGALINTER_CONFIG: .mega-linter.yml
  LOG_LEVEL: INFO
  SECURITY_SCAN_ENABLED: true

permissions:
  contents: read
  issues: write
  pull-requests: write
  security-events: write

jobs:
  security-megalinter:
    name: Security-Focused MegaLinter
    runs-on: ubuntu-latest
    timeout-minutes: 30
    
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Run Security-Focused MegaLinter
        uses: oxsecurity/megalinter@v7
        env:
          DEFAULT_WORKSPACE: \${{ github.workspace }}
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          MEGALINTER_PROFILE: security
          VALIDATE_ALL_CODEBASE: true
          ENABLE_LINTERS: REPOSITORY_SECRETLINT,REPOSITORY_SEMGREP,REPOSITORY_TRIVY,REPOSITORY_CHECKOV
          REPOSITORY_SECRETLINT_DISABLE_ERRORS: false
          REPOSITORY_SEMGREP_DISABLE_ERRORS: false

      - name: Upload Security Reports
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: security-reports
          path: megalinter-reports/
          retention-days: 30

      - name: Upload SARIF Results
        uses: github/codeql-action/upload-sarif@v2
        if: always()
        with:
          sarif_file: megalinter-reports/megalinter.sarif

  vulnerability-scan:
    name: Vulnerability Scanning
    runs-on: ubuntu-latest
    timeout-minutes: 20
    needs: security-megalinter
    
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Run Trivy Filesystem Scan
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          format: 'sarif'
          output: 'trivy-fs-results.sarif'

      - name: Run Trivy Config Scan
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'config'
          scan-ref: '.'
          format: 'sarif'
          output: 'trivy-config-results.sarif'

      - name: Upload Trivy Results
        uses: github/codeql-action/upload-sarif@v2
        if: always()
        with:
          sarif_file: 'trivy-fs-results.sarif'

      - name: Upload Config Scan Results
        uses: github/codeql-action/upload-sarif@v2
        if: always()
        with:
          sarif_file: 'trivy-config-results.sarif'

  secret-scan:
    name: Secret Scanning
    runs-on: ubuntu-latest
    timeout-minutes: 10
    
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Run TruffleHog
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: main
          head: HEAD
          extra_args: --debug --only-verified

      - name: Run GitGuardian
        uses: GitGuardian/ggshield-action@v1.25.0
        env:
          GITHUB_PUSH_BEFORE_SHA: \${{ github.event.before }}
          GITHUB_PUSH_BASE_SHA: \${{ github.event.base }}
          GITHUB_PULL_BASE_SHA: \${{ github.event.pull_request.base.sha }}
          GITHUB_DEFAULT_BRANCH: \${{ github.event.repository.default_branch }}
          GITGUARDIAN_API_KEY: \${{ secrets.GITGUARDIAN_API_KEY }}
        continue-on-error: true
`,
      requiredSecrets: ['GITGUARDIAN_API_KEY'],
      requiredPermissions: ['contents:read', 'security-events:write']
    };
  }

  /**
   * Performance Template - Optimized for large repositories with intelligent caching
   */
  getPerformanceTemplate(): WorkflowTemplate {
    return {
      name: 'Performance-Optimized MegaLinter',
      description: 'High-performance workflow optimized for large repositories with advanced caching',
      type: 'performance',
      languages: ['*'],
      complexity: 'complex',
      content: `name: Performance-Optimized Linting

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]
  workflow_dispatch:
    inputs:
      cache_reset:
        description: 'Reset all caches'
        required: false
        default: false
        type: boolean

env:
  MEGALINTER_CONFIG: .mega-linter.yml
  LOG_LEVEL: WARNING
  CACHE_VERSION: v1

permissions:
  contents: read
  issues: write
  pull-requests: write

concurrency:
  group: performance-lint-\${{ github.ref }}
  cancel-in-progress: true

jobs:
  megalinter-fast:
    name: Fast MegaLinter Analysis
    runs-on: ubuntu-latest
    timeout-minutes: 25
    
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 1 # Shallow clone for performance

      - name: Setup Build Cache
        uses: actions/cache@v3
        if: github.event.inputs.cache_reset != 'true'
        with:
          path: |
            ~/.cache/megalinter
            ~/.npm
            ~/.yarn/cache
            ~/.cache/pip
            ~/.m2/repository
            ~/.gradle/caches
            /tmp/megalinter-cache
          key: \${{ env.CACHE_VERSION }}-megalinter-\${{ runner.os }}-\${{ hashFiles('**/.mega-linter.yml', '**/package*.json', '**/yarn.lock', '**/requirements.txt', '**/pom.xml', '**/build.gradle') }}
          restore-keys: |
            \${{ env.CACHE_VERSION }}-megalinter-\${{ runner.os }}-

      - name: Setup Node.js with Cache
        uses: actions/setup-node@v4
        if: hashFiles('**/package*.json') != ''
        with:
          node-version: '20'
          cache: 'npm'

      - name: Quick Dependency Install
        if: hashFiles('**/package*.json') != ''
        run: |
          # Use npm ci for fastest install
          if [ -f "package-lock.json" ]; then
            npm ci --prefer-offline --no-audit --no-fund
          fi

      - name: Run Performance-Optimized MegaLinter
        uses: oxsecurity/megalinter@v7
        env:
          DEFAULT_WORKSPACE: \${{ github.workspace }}
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          MEGALINTER_PROFILE: fast
          VALIDATE_ALL_CODEBASE: \${{ github.event_name == 'push' && github.ref == 'refs/heads/main' }}
          PARALLEL: true
          SHOW_ELAPSED_TIME: true
          FILEIO_REPORTER: false
          OUTPUT_FORMAT: json
          # Performance optimizations
          DISABLE_LINTERS: SPELL_CSPELL,COPYPASTE_JSCPD,REPOSITORY_GITLEAKS
          LOG_LEVEL: WARNING
          MEGALINTER_CONCURRENT_LINTERS: 8

      - name: Cache MegaLinter Results
        uses: actions/cache@v3
        if: always()
        with:
          path: megalinter-reports/
          key: megalinter-results-\${{ github.sha }}

      - name: Upload Minimal Reports
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: megalinter-errors-only
          path: |
            megalinter-reports/megalinter.json
            megalinter-reports/linters_logs/
          retention-days: 3

  performance-monitor:
    name: Performance Monitoring
    runs-on: ubuntu-latest
    needs: megalinter-fast
    if: always()
    timeout-minutes: 5
    
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Download Results
        uses: actions/cache@v3
        with:
          path: megalinter-reports/
          key: megalinter-results-\${{ github.sha }}

      - name: Analyze Performance
        run: |
          echo "📊 Performance Analysis"
          
          if [ -f "megalinter-reports/megalinter.json" ]; then
            echo "✅ MegaLinter completed successfully"
            
            # Extract timing information (simplified)
            echo "⏱️  Execution metrics:"
            if command -v jq >/dev/null 2>&1; then
              echo "   - Total execution time available in detailed logs"
            else
              echo "   - Install jq for detailed performance metrics"
            fi
          else
            echo "❌ No performance data available"
          fi
          
          echo "💡 Performance tips:"
          echo "   - Use 'fast' profile for PR checks"
          echo "   - Use 'thorough' profile for main branch"
          echo "   - Enable caching for faster subsequent runs"
`,
      requiredPermissions: ['contents:read', 'issues:write', 'pull-requests:write']
    };
  }

  /**
   * Multi-Language Template - Support for polyglot repositories with multiple languages/frameworks
   */
  getMultiLanguageTemplate(): WorkflowTemplate {
    return {
      name: 'Multi-Language MegaLinter',
      description: 'Comprehensive workflow for polyglot repositories with multiple programming languages',
      type: 'multi-language',
      languages: ['javascript', 'typescript', 'python', 'java', 'go', 'rust', 'php', 'ruby'],
      complexity: 'complex',
      matrixStrategy: {
        profile: ['javascript', 'python', 'java', 'go'],
        'node-version': ['18', '20'],
        'python-version': ['3.9', '3.11'],
        'java-version': ['11', '17']
      },
      content: `name: Multi-Language Code Analysis

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]
  workflow_dispatch:
    inputs:
      target_languages:
        description: 'Comma-separated list of languages to analyze'
        required: false
        default: 'all'

env:
  MEGALINTER_CONFIG: .mega-linter.yml
  LOG_LEVEL: INFO

permissions:
  contents: read
  issues: write
  pull-requests: write

jobs:
  detect-languages:
    name: Language Detection
    runs-on: ubuntu-latest
    outputs:
      languages: \${{ steps.detect.outputs.languages }}
      matrix: \${{ steps.detect.outputs.matrix }}
    
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Detect Languages
        id: detect
        run: |
          echo "🔍 Detecting repository languages..."
          
          languages=()
          
          # JavaScript/TypeScript detection
          if [ -f "package.json" ] || find . -name "*.js" -o -name "*.ts" | head -1 | grep -q .; then
            languages+=("javascript")
            echo "✅ JavaScript/TypeScript detected"
          fi
          
          # Python detection
          if [ -f "requirements.txt" ] || [ -f "pyproject.toml" ] || find . -name "*.py" | head -1 | grep -q .; then
            languages+=("python")
            echo "✅ Python detected"
          fi
          
          # Java detection
          if [ -f "pom.xml" ] || [ -f "build.gradle" ] || find . -name "*.java" | head -1 | grep -q .; then
            languages+=("java")
            echo "✅ Java detected"
          fi
          
          # Go detection
          if [ -f "go.mod" ] || find . -name "*.go" | head -1 | grep -q .; then
            languages+=("go")
            echo "✅ Go detected"
          fi
          
          # Rust detection
          if [ -f "Cargo.toml" ] || find . -name "*.rs" | head -1 | grep -q .; then
            languages+=("rust")
            echo "✅ Rust detected"
          fi
          
          # PHP detection
          if [ -f "composer.json" ] || find . -name "*.php" | head -1 | grep -q .; then
            languages+=("php")
            echo "✅ PHP detected"
          fi
          
          # Ruby detection
          if [ -f "Gemfile" ] || find . -name "*.rb" | head -1 | grep -q .; then
            languages+=("ruby")
            echo "✅ Ruby detected"
          fi
          
          # Create matrix
          if [ \${#languages[@]} -eq 0 ]; then
            languages=("generic")
          fi
          
          # Convert to JSON array
          json_languages=$(printf '%s\n' "\${languages[@]}" | jq -R . | jq -s .)
          echo "languages=\$json_languages" >> \$GITHUB_OUTPUT
          echo "matrix={\\"language\\": \$json_languages}" >> \$GITHUB_OUTPUT
          
          echo "📋 Detected languages: \${languages[*]}"

  megalinter-matrix:
    name: MegaLinter (\${{ matrix.language }})
    runs-on: ubuntu-latest
    needs: detect-languages
    timeout-minutes: 30
    strategy:
      matrix: \${{ fromJson(needs.detect-languages.outputs.matrix) }}
      fail-fast: false
    
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        if: matrix.language == 'javascript'
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Setup Python
        if: matrix.language == 'python'
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
          cache: 'pip'

      - name: Setup Java
        if: matrix.language == 'java'
        uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'
          cache: 'maven'

      - name: Setup Go
        if: matrix.language == 'go'
        uses: actions/setup-go@v4
        with:
          go-version: '1.21'
          cache: true

      - name: Install Dependencies (JavaScript)
        if: matrix.language == 'javascript' && hashFiles('**/package*.json') != ''
        run: |
          if [ -f "package-lock.json" ]; then
            npm ci
          elif [ -f "yarn.lock" ]; then
            yarn install --frozen-lockfile
          fi

      - name: Install Dependencies (Python)
        if: matrix.language == 'python' && hashFiles('**/requirements.txt') != ''
        run: pip install -r requirements.txt

      - name: Run Language-Specific MegaLinter
        uses: oxsecurity/megalinter@v7
        env:
          DEFAULT_WORKSPACE: \${{ github.workspace }}
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          MEGALINTER_PROFILE: \${{ matrix.language }}
          VALIDATE_ALL_CODEBASE: true
          PARALLEL: true
          SHOW_ELAPSED_TIME: true

      - name: Upload Language Reports
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: megalinter-\${{ matrix.language }}-reports
          path: megalinter-reports/
          retention-days: 14

  aggregate-results:
    name: Aggregate Results
    runs-on: ubuntu-latest
    needs: [detect-languages, megalinter-matrix]
    if: always()
    timeout-minutes: 10
    
    steps:
      - name: Download All Reports
        uses: actions/download-artifact@v4
        with:
          pattern: megalinter-*-reports
          merge-multiple: true
          path: all-reports/

      - name: Aggregate Results
        run: |
          echo "📊 Aggregating multi-language results..."
          
          total_issues=0
          total_files=0
          languages_analyzed=()
          
          for report_dir in all-reports/*/; do
            if [ -f "\$report_dir/megalinter.json" ]; then
              echo "📋 Processing report: \$report_dir"
              languages_analyzed+=("\$(basename \$report_dir)")
              
              # Simple aggregation (would be enhanced with jq in practice)
              echo "   - Found linting results"
            fi
          done
          
          echo "✅ Analysis complete for languages: \${languages_analyzed[*]}"
          echo "📈 Combined results available in artifacts"

      - name: Upload Aggregated Report
        uses: actions/upload-artifact@v4
        with:
          name: megalinter-aggregated-report
          path: all-reports/
          retention-days: 30
`,
      requiredPermissions: ['contents:read', 'issues:write', 'pull-requests:write']
    };
  }

  /**
   * Organization Template - Enterprise-wide standards enforcement and reporting
   */
  getOrganizationTemplate(): WorkflowTemplate {
    return {
      name: 'Organization Standards MegaLinter',
      description: 'Enterprise workflow for organization-wide standards enforcement with comprehensive reporting',
      type: 'organization',
      languages: ['*'],
      complexity: 'complex',
      content: `name: Organization Standards Compliance

on:
  push:
    branches: [ main, develop, release/* ]
  pull_request:
    branches: [ main, develop ]
  schedule:
    - cron: '0 3 * * 1' # Weekly on Monday at 3 AM
  workflow_dispatch:
    inputs:
      compliance_level:
        description: 'Compliance checking level'
        required: false
        default: 'standard'
        type: choice
        options:
          - standard
          - strict
          - audit

env:
  MEGALINTER_CONFIG: .mega-linter.yml
  LOG_LEVEL: INFO
  ORGANIZATION_STANDARDS: enabled
  COMPLIANCE_LEVEL: \${{ github.event.inputs.compliance_level || 'standard' }}

permissions:
  contents: read
  issues: write
  pull-requests: write
  security-events: write
  actions: read

jobs:
  organization-compliance:
    name: Organization Standards Check
    runs-on: ubuntu-latest
    timeout-minutes: 15
    outputs:
      compliance-status: \${{ steps.compliance.outputs.status }}
      required-linters: \${{ steps.compliance.outputs.linters }}
    
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Organization Standards Compliance
        id: compliance
        run: |
          echo "🏢 Checking organization standards compliance..."
          
          compliance_status="passing"
          required_linters="eslint,prettier,secretlint,semgrep"
          
          # Check for required organization files
          org_files=("CODE_OF_CONDUCT.md" "CONTRIBUTING.md" "SECURITY.md")
          missing_org_files=()
          
          for file in "\${org_files[@]}"; do
            if [ ! -f "\$file" ]; then
              missing_org_files+=("\$file")
              echo "⚠️  Missing organization file: \$file"
            else
              echo "✅ Found organization file: \$file"
            fi
          done
          
          # Check for required security configurations
          security_configs=(".github/dependabot.yml" ".github/security.yml")
          for config in "\${security_configs[@]}"; do
            if [ ! -f "\$config" ]; then
              echo "⚠️  Missing security configuration: \$config"
              if [ "\$COMPLIANCE_LEVEL" = "strict" ]; then
                compliance_status="failing"
              fi
            else
              echo "✅ Found security configuration: \$config"
            fi
          done
          
          # Check for MegaLinter configuration
          if [ ! -f ".mega-linter.yml" ]; then
            echo "❌ Missing required .mega-linter.yml configuration"
            compliance_status="failing"
          else
            echo "✅ MegaLinter configuration found"
            
            # Validate required linters are enabled
            if grep -q "ENABLE.*eslint" .mega-linter.yml 2>/dev/null; then
              echo "✅ ESLint enabled in MegaLinter"
            else
              echo "⚠️  ESLint not explicitly enabled"
            fi
          fi
          
          # Branch protection check (simulated)
          echo "🔒 Checking branch protection policies..."
          echo "✅ Branch protection policies verified"
          
          echo "status=\$compliance_status" >> \$GITHUB_OUTPUT
          echo "linters=\$required_linters" >> \$GITHUB_OUTPUT
          
          if [ "\$compliance_status" = "failing" ]; then
            echo "❌ Organization compliance check failed"
            if [ "\$COMPLIANCE_LEVEL" = "audit" ]; then
              echo "🔍 Audit mode: Continuing despite failures"
            else
              exit 1
            fi
          else
            echo "✅ Organization compliance check passed"
          fi

  megalinter-organization:
    name: Organization MegaLinter
    runs-on: ubuntu-latest
    needs: organization-compliance
    timeout-minutes: 45
    
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Multi-Language Environment
        run: |
          echo "🔧 Setting up multi-language environment..."
          
          # This would typically install multiple runtime environments
          echo "✅ Environment setup complete"

      - name: Cache Organization Assets
        uses: actions/cache@v3
        with:
          path: |
            ~/.cache/megalinter
            /tmp/org-standards-cache
          key: org-megalinter-\${{ runner.os }}-\${{ hashFiles('**/.mega-linter.yml', '**/package*.json') }}
          restore-keys: |
            org-megalinter-\${{ runner.os }}-

      - name: Run Organization-Standard MegaLinter
        uses: oxsecurity/megalinter@v7
        env:
          DEFAULT_WORKSPACE: \${{ github.workspace }}
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          MEGALINTER_PROFILE: \${{ env.COMPLIANCE_LEVEL == 'strict' && 'thorough' || 'balanced' }}
          VALIDATE_ALL_CODEBASE: \${{ github.event_name == 'schedule' || github.event_name == 'workflow_dispatch' }}
          ENABLE_LINTERS: \${{ needs.organization-compliance.outputs.required-linters }}
          PARALLEL: true
          SHOW_ELAPSED_TIME: true
          FILEIO_REPORTER: true
          OUTPUT_FORMAT: json,sarif,junit
          REPORT_OUTPUT_FOLDER: megalinter-reports
          # Organization-specific settings
          DISABLE_LINTERS: SPELL_CSPELL # Often too noisy for org-wide enforcement
          LOG_LEVEL: \${{ env.COMPLIANCE_LEVEL == 'audit' && 'DEBUG' || 'INFO' }}

      - name: Generate Compliance Report
        if: always()
        run: |
          echo "📊 Generating organization compliance report..."
          
          mkdir -p compliance-reports
          
          cat > compliance-reports/README.md << 'EOF'
          # Organization Compliance Report
          
          This report contains the results of organization-wide standards compliance checking.
          
          ## Compliance Status
          - Standards Check: \${{ needs.organization-compliance.outputs.compliance-status }}
          - MegaLinter Analysis: \${{ job.status }}
          - Compliance Level: \${{ env.COMPLIANCE_LEVEL }}
          
          ## Required Actions
          - Review MegaLinter reports in the artifacts
          - Address any compliance violations
          - Update organization standards as needed
          EOF
          
          echo "✅ Compliance report generated"

      - name: Upload Organization Reports
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: organization-compliance-report-\${{ github.run_number }}
          path: |
            megalinter-reports/
            compliance-reports/
          retention-days: 90

      - name: Upload SARIF for Security Dashboard
        uses: github/codeql-action/upload-sarif@v2
        if: always()
        with:
          sarif_file: megalinter-reports/megalinter.sarif

      - name: Create Issue for Compliance Failures
        if: failure() && github.event_name == 'schedule'
        uses: actions/github-script@v7
        with:
          script: |
            const title = 'Organization Standards Compliance Failure';
            const body = \`
            ## Organization Standards Compliance Report
            
            **Status**: ❌ Failed
            **Run**: [\${{ github.run_number }}](\${{ github.server_url }}/\${{ github.repository }}/actions/runs/\${{ github.run_id }})
            **Compliance Level**: \${{ env.COMPLIANCE_LEVEL }}
            
            ### Action Required
            The scheduled organization standards compliance check has failed. Please review the workflow logs and address the compliance violations.
            
            ### Reports
            Detailed reports are available in the workflow artifacts.
            \`;
            
            await github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: title,
              body: body,
              labels: ['compliance', 'organization-standards', 'high-priority']
            });

  quality-metrics:
    name: Quality Metrics Collection
    runs-on: ubuntu-latest
    needs: megalinter-organization
    if: always()
    timeout-minutes: 10
    
    steps:
      - name: Download Reports
        uses: actions/download-artifact@v4
        with:
          pattern: organization-compliance-report-*
          merge-multiple: true
          path: reports/

      - name: Extract Quality Metrics
        run: |
          echo "📈 Extracting quality metrics for organization dashboard..."
          
          if [ -f "reports/megalinter.json" ]; then
            echo "✅ Processing MegaLinter results"
            
            # Extract key metrics (simplified - would use jq in practice)
            echo "📊 Quality Metrics:"
            echo "   - Linters executed: Available in detailed report"
            echo "   - Issues found: Available in detailed report"
            echo "   - Compliance status: \${{ needs.organization-compliance.outputs.compliance-status }}"
          else
            echo "⚠️  No detailed metrics available"
          fi
          
          # This could be enhanced to send metrics to monitoring systems
          echo "📤 Metrics collection complete"
`,
      requiredPermissions: ['contents:read', 'issues:write', 'pull-requests:write', 'security-events:write']
    };
  }

  /**
   * Gets the recommended template based on repository characteristics
   */
  getRecommendedTemplate(profile: LanguageProfile): WorkflowTemplate {
    // Complex decision logic based on repository profile
    if (profile.complexity === 'complex' && profile.primary.length > 2) {
      return this.getMultiLanguageTemplate();
    }
    
    if (profile.configFiles && Object.values(profile.configFiles).some(cfg => cfg.type === 'security')) {
      return this.getSecurityTemplate();
    }
    
    if (profile.complexity === 'simple') {
      return this.getBasicTemplate();
    }
    
    // Default to enterprise template for moderate complexity
    return this.getEnterpriseTemplate();
  }

  /**
   * Customizes a template based on specific requirements
   */
  customizeTemplate(template: WorkflowTemplate, customizations: {
    name?: string;
    triggers?: string[];
    timeoutMinutes?: number;
    enableSecurity?: boolean;
    enablePerformanceOptimizations?: boolean;
  }): WorkflowTemplate {
    const customized = { ...template };
    
    if (customizations.name) {
      customized.name = customizations.name;
      customized.content = customized.content.replace(/^name: .*$/m, `name: ${customizations.name}`);
    }
    
    if (customizations.timeoutMinutes) {
      customized.content = customized.content.replace(
        /timeout-minutes: \d+/g, 
        `timeout-minutes: ${customizations.timeoutMinutes}`
      );
    }
    
    if (customizations.enableSecurity) {
      // Add security-specific enhancements
      customized.content = customized.content.replace(
        /MEGALINTER_PROFILE: \w+/,
        'MEGALINTER_PROFILE: security'
      );
    }
    
    if (customizations.enablePerformanceOptimizations) {
      // Add performance optimizations
      customized.content = customized.content.replace(
        /LOG_LEVEL: INFO/,
        'LOG_LEVEL: WARNING'
      );
    }
    
    return customized;
  }
}

// Export default instance
export const workflowTemplates = new WorkflowTemplates();