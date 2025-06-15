#!/usr/bin/env python
"""
Security check script for ZenSend project.

This script checks for potential security issues before committing:
- Sensitive data in files
- Hardcoded credentials
- Debug settings in production
- Exposed secret keys

Usage:
    python scripts/security_check.py
"""

import os
import re
import sys
from pathlib import Path

# Patterns that might indicate sensitive data
SENSITIVE_PATTERNS = [
    (r'SECRET_KEY\s*=\s*["\'][^"\']*["\']', 'Django Secret Key'),
    (r'AWS_ACCESS_KEY_ID\s*=\s*["\'][^"\']*["\']', 'AWS Access Key'),
    (r'AWS_SECRET_ACCESS_KEY\s*=\s*["\'][^"\']*["\']', 'AWS Secret Key'),
    (r'OPENAI_API_KEY\s*=\s*["\'][^"\']*["\']', 'OpenAI API Key'),
    (r'password\s*=\s*["\'][^"\']*["\']', 'Password'),
    (r'api_key\s*=\s*["\'][^"\']*["\']', 'API Key'),
    (r'token\s*=\s*["\'][^"\']*["\']', 'Token'),
]

# Files to exclude from checks
EXCLUDE_PATTERNS = [
    r'\.git/',
    r'__pycache__/',
    r'node_modules/',
    r'\.env\.example',
    r'security_check\.py',
    r'\.pyc$',
    r'\.log$',
    r'db\.sqlite3',
    r'/tests\.py$',  # Exclude test files
    r'\\tests\.py$',  # Windows path separator
    r'/test_.*\.py$',  # Exclude test files
    r'\\test_.*\.py$',  # Windows path separator
]

# Safe values that are okay to have in code
SAFE_VALUES = [
    'django-insecure-',  # Django default insecure key prefix
    'your-secret-key-here',
    'your-aws-access-key-id',
    'your-aws-secret-access-key',
    'your-openai-api-key',
    'test_access_key',
    'test_secret_key',
    'test_dummy_key',
    'testpassword123',
    'password123',
    'demo123',
    'admin123',
]


def is_excluded(file_path):
    """Check if file should be excluded from security scan."""
    for pattern in EXCLUDE_PATTERNS:
        if re.search(pattern, str(file_path)):
            return True
    return False


def is_safe_value(match_text):
    """Check if the matched text contains safe placeholder values."""
    for safe_value in SAFE_VALUES:
        if safe_value in match_text:
            return True
    return False


def scan_file(file_path):
    """Scan a single file for sensitive patterns."""
    issues = []
    
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
            
        for pattern, description in SENSITIVE_PATTERNS:
            matches = re.finditer(pattern, content, re.IGNORECASE)
            for match in matches:
                if not is_safe_value(match.group()):
                    line_num = content[:match.start()].count('\n') + 1
                    issues.append({
                        'file': file_path,
                        'line': line_num,
                        'description': description,
                        'match': match.group()[:50] + '...' if len(match.group()) > 50 else match.group()
                    })
    
    except Exception as e:
        print(f"Warning: Could not scan {file_path}: {e}")
    
    return issues


def scan_directory(directory):
    """Scan all files in directory recursively."""
    all_issues = []
    
    for root, dirs, files in os.walk(directory):
        # Skip hidden directories
        dirs[:] = [d for d in dirs if not d.startswith('.')]
        
        for file in files:
            file_path = Path(root) / file
            
            if is_excluded(file_path):
                continue
                
            if file_path.suffix in ['.py', '.js', '.jsx', '.ts', '.tsx', '.json', '.yml', '.yaml', '.env']:
                issues = scan_file(file_path)
                all_issues.extend(issues)
    
    return all_issues


def check_django_settings():
    """Check Django settings for production readiness."""
    settings_file = Path('myproject/myproject/settings.py')
    issues = []
    
    if settings_file.exists():
        with open(settings_file, 'r') as f:
            content = f.read()
            
        # Check for DEBUG = True
        if re.search(r'DEBUG\s*=\s*True', content):
            issues.append({
                'file': settings_file,
                'description': 'DEBUG is set to True',
                'severity': 'warning'
            })
            
        # Check for insecure secret key
        secret_key_match = re.search(r'SECRET_KEY\s*=\s*["\']([^"\']*)["\']', content)
        if secret_key_match and 'django-insecure-' in secret_key_match.group(1):
            issues.append({
                'file': settings_file,
                'description': 'Using Django insecure secret key',
                'severity': 'warning'
            })
    
    return issues


def main():
    """Main security check function."""
    print("ZenSend Security Check")
    print("=" * 50)
    
    project_root = Path(__file__).parent.parent
    os.chdir(project_root)
    
    # Scan for sensitive data
    print("Scanning for sensitive data...")
    issues = scan_directory('.')

    # Check Django settings
    print("Checking Django settings...")
    settings_issues = check_django_settings()
    
    # Report results
    total_issues = len(issues) + len(settings_issues)
    
    if issues:
        print(f"\nFound {len(issues)} potential security issues:")
        for issue in issues:
            print(f"  {issue['file']}:{issue['line']}")
            print(f"     {issue['description']}: {issue['match']}")
            print()

    if settings_issues:
        print(f"\nFound {len(settings_issues)} configuration warnings:")
        for issue in settings_issues:
            print(f"  {issue['file']}")
            print(f"     {issue['description']}")
            print()

    if total_issues == 0:
        print("No security issues found!")
        print("Project is ready for commit!")
        return True
    else:
        print(f"Found {total_issues} issues that should be reviewed before committing.")
        print("\nRecommendations:")
        print("   - Move sensitive data to .env files")
        print("   - Use environment variables for secrets")
        print("   - Set DEBUG=False for production")
        print("   - Generate a new SECRET_KEY for production")
        return False


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
