# Security Policy

## Reporting Security Issues

**Please do not report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability in this VSCode extension, please report it responsibly:

### How to Report

**Email**: security@habitus.net

**Subject**: `[SECURITY] Org Onboarding VSCode Extension - [Brief Description]`

### What to Include

Please include the following information in your report:

- **Description**: Clear description of the vulnerability
- **Steps to Reproduce**: Detailed steps to reproduce the issue
- **Impact**: Potential impact and affected components
- **Proof of Concept**: If applicable, provide a minimal reproduction
- **Suggested Fix**: If you have ideas for remediation

### What to Expect

- **Acknowledgment**: We will acknowledge receipt within 24 hours
- **Initial Assessment**: We will provide an initial assessment within 72 hours
- **Updates**: We will keep you informed of our progress
- **Resolution**: We aim to resolve critical issues within 7 days
- **Credit**: We will credit you in our security advisories (if desired)

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Security Features

This extension implements several security measures:

- **No Remote Code Execution**: Extension code runs locally in VSCode sandbox
- **Secure Token Handling**: GitHub tokens stored in VSCode's secure credential storage
- **Input Validation**: All user inputs are validated and sanitized
- **Dependency Scanning**: Automated vulnerability scanning via OSV Scanner
- **Code Quality**: Comprehensive linting with security-focused rules

## Security Best Practices

When using this extension:

- **Keep Extension Updated**: Always use the latest version
- **Secure Token Storage**: Use VSCode's built-in credential storage
- **Review Permissions**: Only grant necessary GitHub token permissions
- **Verify Sources**: Only install from official marketplace or trusted sources

## Threat Model

### In Scope
- Extension code vulnerabilities
- Dependency vulnerabilities  
- Configuration security issues
- GitHub API interaction security

### Out of Scope
- VSCode platform vulnerabilities
- GitHub.com security issues
- Operating system vulnerabilities
- Network infrastructure security

---

**Responsible Disclosure**: We practice responsible disclosure and will work with security researchers to address issues promptly and transparently.