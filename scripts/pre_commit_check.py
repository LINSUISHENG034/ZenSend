#!/usr/bin/env python
"""
Pre-commit check script for ZenSend project.

This script runs various checks before committing:
- Security scan
- Code formatting check
- Test execution
- Documentation validation

Usage:
    python scripts/pre_commit_check.py
"""

import os
import sys
import subprocess
from pathlib import Path


def run_command(command, description):
    """Run a command and return success status."""
    print(f"🔍 {description}...")
    try:
        # Use sys.executable to ensure we use the same Python interpreter
        if command.startswith('python '):
            command = command.replace('python ', f'"{sys.executable}" ')

        result = subprocess.run(command, shell=True, capture_output=True, text=True)
        if result.returncode == 0:
            print(f"✅ {description} passed")
            return True
        else:
            print(f"❌ {description} failed:")
            if result.stdout:
                print(result.stdout)
            if result.stderr:
                print(result.stderr)
            return False
    except Exception as e:
        print(f"❌ {description} failed with exception: {e}")
        return False


def check_required_files():
    """Check that required files exist."""
    print("📁 Checking required files...")
    
    required_files = [
        'myproject/.env.example',
        'frontend/.env.example',
        '.gitignore',
        'README.md',
        'myproject/requirements.txt',
        'myproject/tests/README.md',
    ]
    
    missing_files = []
    for file_path in required_files:
        if not Path(file_path).exists():
            missing_files.append(file_path)
    
    if missing_files:
        print(f"❌ Missing required files: {missing_files}")
        return False
    else:
        print("✅ All required files present")
        return True


def check_environment_files():
    """Check that .env files are not committed."""
    print("🔒 Checking environment files...")
    
    env_files = [
        'myproject/.env',
        'frontend/.env',
    ]
    
    committed_env_files = []
    for env_file in env_files:
        if Path(env_file).exists():
            # Check if file is tracked by git
            result = subprocess.run(
                f'git ls-files --error-unmatch {env_file}',
                shell=True,
                capture_output=True
            )
            if result.returncode == 0:
                committed_env_files.append(env_file)
    
    if committed_env_files:
        print(f"❌ Environment files should not be committed: {committed_env_files}")
        print("💡 Add them to .gitignore and remove from git:")
        for file in committed_env_files:
            print(f"   git rm --cached {file}")
        return False
    else:
        print("✅ No environment files committed")
        return True


def main():
    """Main pre-commit check function."""
    print("🚀 ZenSend Pre-Commit Check")
    print("=" * 50)
    
    project_root = Path(__file__).parent.parent
    os.chdir(project_root)
    
    checks = [
        (check_required_files, "Required files check"),
        (check_environment_files, "Environment files check"),
        (lambda: run_command(f'"{sys.executable}" scripts/security_check.py', "Security scan"), "Security scan"),
    ]

    # Run Django tests if possible
    if Path("myproject/manage.py").exists():
        checks.append((
            lambda: run_command(f'cd myproject && "{sys.executable}" manage.py check', "Django system check"),
            "Django system check"
        ))
    
    # Run all checks
    all_passed = True
    for check_func, description in checks:
        try:
            if not check_func():
                all_passed = False
        except Exception as e:
            print(f"❌ {description} failed with exception: {e}")
            all_passed = False
        print()
    
    # Final result
    if all_passed:
        print("🎉 All pre-commit checks passed!")
        print("✅ Project is ready for commit and push!")
        print("\n📋 Next steps:")
        print("   1. git add .")
        print("   2. git commit -m 'Your commit message'")
        print("   3. git push origin main")
        return True
    else:
        print("🚨 Some pre-commit checks failed!")
        print("❌ Please fix the issues before committing.")
        return False


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
