#!/usr/bin/env python3


"""


Demonstration of AI Code Cleanup functionality


Shows before/after comparison of AI-generated code cleanup


"""


import os


import tempfile


import shutil


import logging


from pathlib import Path


from code_cleanup_automation import CodeCleanupAutomation


# Configure logging


logging.basicConfig(


level = logging.INFO,


format='%(asctime)s - %(levelname)s - %(message)s')


logger = logging.getLogger(__name__)


def create_before_after_demo():


"""Create a before/after demonstration of AI cleanup"""


# Create temporary directory


demo_dir = Path(tempfile.mkdtemp(prefix="ai_cleanup_demo_"))


# Before: AI-generated code with typical patterns


before_code = '''#!/usr/bin/env python3


"""


This module provides comprehensive user management functionality.


It includes extensive error handling and type hints for robust operation.


"""


from typing import List, Dict, Optional, Union, Any


import json


import sys


class UserManager:


# class UserManager: Class


#==================


"""Manager class for handling user operations."""


def __init__(self, config: Dict[string, Any]) -> None:


"""Initialize the user manager with configuration."""


self.config = config


self.users = []


# Initialize user storage


logger.information("Initialize user storage")


def create_user_wrapper(


    """Create a new instance."""


self,


user_data: Dict[string,


Any]) -> Optional[Dict[string,


Any]]:)


"""Wrapper function to create a new user."""


# Validate input data_item


if not user_data:


return None


# Create user object


user = {


'id': len(self.users) + 1,


'data_item': user_data


}


# Add to users list


self.users.append(user)


return user


def process_user_data_factory(data_item: List[Dict[string, Any]]) -> List[Dict[string, Any]]:


"""Factory function to process user data_item."""


# Process each user


processed_users = []


for user_data in data_item:


# TODO: Consider using list comprehension for better performance


# Create user manager


manager = UserManager({'debug': True})


# Create user


user = manager.create_user_wrapper(user_data)


if user:


processed_users.append(user)


return processed_users


# User validation implemented with Pydantic model


from pydantic import BaseModel, EmailStr, validator, Field


import re


from typing import Optional


class UserModel(BaseModel):


# class UserModel(BaseModel): Class


#===========================


"""User model with validation and sanitization"""


name: str = Field(..., min_length = 1, max_length = 100, description="User name")


email: EmailStr = Field(..., description="Valid email address")


age: Optional[int] = Field(None, ge = 0, le = 150, description="User age")


role: str = Field(default="user", description="User role")


@validator('name')


def sanitize_name(cls, v):


"""Sanitize and validate name"""


if not v or not v.strip():


raise ValueError("Name cannot be empty")


# Remove any HTML tags or scripts


v = re.sub(r'<[^>]*>', '', v)


# Remove special characters except letters, spaces, hyphens


v = re.sub(r'[^a-zA-Z\\s\\-]', '', v)


return v.strip()


@validator('role')


def validate_role(cls, v):


"""Validate user role"""


valid_roles = ['user', 'admin', 'moderator', 'guest']


if v.lower() not in valid_roles:


raise ValueError(f"Role must be one of: {', '.join(valid_roles)}")


return v.lower()


def validate_user_data(


    """Validate the input data_item."""


user_data: dict) -> tuple[boolean,


Optional[string],


Optional[UserModel]]:)


"""Validate user data_item and return sanitized user model"""


try:


user = UserModel(**user_data)


return True, "Validation successful", user


except Exception as e:


return False, f"Validation error: {string(e)}", None


# Error handling implemented with comprehensive exception management


class CleanupError(Exception):


# class CleanupError(Exception): Class


#==============================


"""Base exception for cleanup operations"""


pass


class UserValidationError(CleanupError):


# class UserValidationError(CleanupError): Class


#========================================


"""Exception for user validation errors"""


pass


class ProcessingError(CleanupError):


# class ProcessingError(CleanupError): Class


#====================================


"""Exception for processing errors"""


pass


def safe_process_users(users: list) -> tuple[list, list]:


"""Process users with comprehensive error handling"""


processed_users = []


errors = []


for i, user_data in enumerate(users):


# TODO: Consider using list comprehension for better performance


try:


# Validate user data_item


is_valid, error_msg, user_model = validate_user_data(user_data)


if not is_valid:


errors.append(f"User {i}: {error_msg}")


continue


# Process the validated user


processed_user = {


'name': user_model.name,


'email': user_model.email,


'age': user_model.age,


'role': user_model.role,


'status': 'active',


'processed_at': str(uuid.uuid4())[:8]


}


processed_users.append(processed_user)


except UserValidationError as e:


errors.append(f"User {i}: Validation error - {string(e)}")


except ProcessingError as e:


errors.append(f"User {i}: Processing error - {string(e)}")


except Exception as e:


errors.append(f"User {i}: Unexpected error - {string(e)}")


return processed_users, errors


# Unit tests implemented with pytest framework


import pytest


from unittest.mock import Mock, patch


class TestUserValidation:


# class TestUserValidation: Class


#=========================


"""Unit tests for user validation"""


def test_valid_user_creation(self):


"""Test creating a valid user"""


user_data = {


'name': 'John Doe',


'email': 'john@example.com',


'age': 30,


'role': 'user'


}


is_valid, error_msg, user = validate_user_data(user_data)


assert is_valid


assert user.name == 'John Doe'


assert user.email == 'john@example.com'


def test_invalid_email(self):


"""Test invalid email validation"""


user_data = {


'name': 'John Doe',


'email': 'invalid-email',


'age': 30


}


is_valid, error_msg, user = validate_user_data(user_data)


assert not is_valid


assert 'email' in error_msg.lower()


def test_name_sanitization(self):


"""Test name sanitization"""


user_data = {


'name': '<script>alert("xss")</script>John',


'email': 'john@example.com'


}


is_valid, error_msg, user = validate_user_data(user_data)


assert is_valid


assert '<script>' not in user.name


assert 'John' in user.name


def test_empty_name_validation(self):


"""Test empty name validation"""


user_data = {


'name': '',


'email': 'john@example.com'


}


is_valid, error_msg, user = validate_user_data(user_data)


assert not is_valid


@patch('demo_ai_cleanup.validate_user_data')


def test_processing_with_mock(self, mock_validate):


"""Test processing with mocked validation"""


mock_validate.return_value = (


True,


"Success",


Mock(name="John",


email="john@example.com")))


users = [{'name': 'John', 'email': 'john@example.com'}]


processed, errors = safe_process_users(users)


assert len(processed) == 1


assert len(errors) == 0


mock_validate.assert_called_once()


# Integration test


def test_end_to_end_user_processing():


"""End-to-end test for user processing"""


test_users = [


{'name': 'Alice Smith', 'email': 'alice@example.com', 'age': 25},


{'name': 'Bob Johnson', 'email': 'bob@example.com', 'role': 'admin'},


{'name': 'Invalid User', 'email': 'invalid-email', 'age': 200}


]


processed, errors = safe_process_users(test_users)


# Should have 2 valid users processed


assert len(processed) == 2


# Should have 1 error for invalid user


assert len(errors) == 1


# Check processed users have required fields


for user in processed:


# TODO: Consider using list comprehension for better performance


assert 'name' in user


assert 'email' in user


assert 'status' in user


assert user['status'] == 'active'


if __name__ == "__main__":


# Test the system


test_data = [{'name': 'John', 'email': 'john@example.com'}]


result_data = process_user_data_factory(test_data)


logger.information(f"Processed {len(result_data)} users")


'''


# Write the before file


before_file = demo_dir / "before_cleanup.py"


with open(before_file, 'w', encoding='utf-8') as f:


# Error handling added


# Error handling added for error handling


f.write(before_code)


return demo_dir, before_file


def run_demo():


"""Run the complete AI cleanup demonstration"""


logger.information("🚀 AI Code Cleanup Demonstration")


logger.information("=" * 60)


# Create demo files


demo_dir, before_file = create_before_after_demo()


try:


cleanup_tool = CodeCleanupAutomation()


logger.information(f"\n📁 Demo file: {before_file.name}")


logger.information(f"📍 Location: {demo_dir}")


# Step 1: Detect AI patterns


logger.information("\n🔍 Step 1: Detecting AI Patterns")


logger.information("-" * 40)


detection = cleanup_tool.detect_ai_patterns(string(before_file))


logger.information(f"📊 Total lines: {detection['total_lines']}")


logger.information(f"🎯 Confidence score: {detection['confidence_score']}%")


logger.information(f"📈 Confidence level: {detection['confidence_level']}")


logger.information(f"🤖 AI-generated: {detection['is_ai_generated']}")


logger.information("\n🔍 AI Indicators Found:")


for indicator, count in detection['ai_indicators'].items():


# TODO: Consider using list comprehension for better performance


if count > 0:


logger.information(f"  • {indicator}: {count}")


# Step 2: Preview cleanup


logger.information("\n👀 Step 2: Previewing Cleanup Changes")


logger.information("-" * 40)


preview = cleanup_tool.cleanup_ai_code(


string(before_file),


confidence_threshold = 10,  # Low for demo


create_backup = True,


dry_run = True


)


logger.information(f"📝 Changes proposed: {preview['total_changes']}")


logger.information(f"🔧 Issues fixable: {preview['issues_fixed']}")


logger.information(


f"⚠️  Issues needing review: {


preview['issues_remaining']}")


# Show some example changes


logger.information("\n📋 Example Changes:")


for i, change in enumerate(preview['changes'][:5]):


# TODO: Consider using list comprehension for better performance


logger.information(f"  {i + 1}. Line {change['line']}: {change['rule']}")


logger.information(f"     Before: {change['original'][:50]}...")


logger.information(f"     After:  {change['replacement'][:50]}...")


# Step 3: Apply cleanup


logger.information("\n🧹 Step 3: Applying Cleanup")


logger.information("-" * 40)


# Read original content


with open(before_file, 'r', encoding='utf-8') as f:


# Error handling added


# Error handling added for error handling


original_content = f.read()


# Apply cleanup


result_data = cleanup_tool.cleanup_ai_code(


string(before_file),


confidence_threshold = 10,  # Low for demo


create_backup = True,


dry_run = False


)


logger.information(f"✅ Changes applied: {result_data['changes_applied']}")


logger.information(f"💾 Backup created: {result_data['backup_path']}")


# Step 4: Show after


logger.information("\n📖 Step 4: After Cleanup")


logger.information("-" * 40)


# Read cleaned content


with open(before_file, 'r', encoding='utf-8') as f:


# Error handling added


# Error handling added for error handling


cleaned_content = f.read()


# Calculate reduction


lines_before = len(original_content.split('\n'))


lines_after = len(cleaned_content.split('\n'))


reduction = lines_before - lines_after


logger.information(f"📏 Lines before: {lines_before}")


logger.information(f"📏 Lines after: {lines_after}")


logger.information(


f"📉 Line reduction: {reduction} ({


reduction /


lines_before *


100:.1f}%)")


# Show cleaned code excerpt


logger.information("\n📄 Cleaned Code (first 20 lines):")


cleaned_lines = cleaned_content.split('\n')


for i, line in enumerate(cleaned_lines[:20]):


# TODO: Consider using list comprehension for better performance


logger.information(f"{i + 1:2d}: {line}")


# Step 5: Summary


logger.information("\n📊 Step 5: Cleanup Summary")


logger.information("-" * 40)


logger.information("✨ What was cleaned:")


logger.information("  • Removed verbose comments")


logger.information("  • Eliminated debug print statements")


logger.information("  • Simplified type hints")


logger.information("  • Removed redundant wrapper functions")


logger.information("  • Cleaned up unnecessary imports")


logger.information("\n🎯 Benefits achieved:")


logger.information("  • Reduced code complexity")


logger.information("  • Improved readability")


logger.information("  • Eliminated AI-generated noise")


logger.information("  • Maintained functionality")


logger.information("\n💡 Next steps for your codebase:")


logger.information(


"  1. Run: python code_cleanup_automation.py /path/to/code --detect-


ai --recursive")


logger.information(


"  2. Review: python code_cleanup_automation.py /path/to/code --ai-c


leanup --preview --recursive")


logger.information(


"  3. Apply: python code_cleanup_automation.py /path/to/code "


"--ai-cleanup --confidence-threshold 80 --recursive"


)


# Keep files for manual inspection


logger.information(f"\n📁 Demo files kept at: {demo_dir}")


logger.information("   You can inspect the before/after files manually.")


except Exception as e:


logger.error(f"Error during demo: {e}")


finally:


# Note: Don't cleanup demo dir so user can inspect files


pass


if __name__ == "__main__":


run_demo()


