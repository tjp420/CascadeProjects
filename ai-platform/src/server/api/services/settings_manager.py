# Constants


CONSTANT_30 = 30


#!/usr/bin/env python3


"""


Export Settings Management Service


Manages export configuration settings and preferences


"""


from typing import Optional, Dict, Any


from datetime import datetime


from pathlib import Path


import json


import uuid


from models.export_settings import ExportSettings, ExportSettingsUpdate, CompressionLevel, FileSizeUnit


class SettingsManager:


    """Manages export settings"""


    def __init__(self, settings_dir: str = "settings"):


        """


        """


        self.settings_dir = Path(settings_dir)


        self.settings_dir.mkdir(exist_ok = True)


        self._load_default_settings()


    def _load_default_settings(self):


        """


        """


        default_settings = self._get_default_settings()


        settings_path = self.settings_dir / "default.json"


        if not settings_path.exists():


            self._save_settings(default_settings, "default")


    def _get_default_settings(self) -> ExportSettings:


        """Get default export settings"""


        return ExportSettings(


            default_format="xlsx",


            compression_level = CompressionLevel.MEDIUM,


            compress_exports = True,


            max_file_size = 104857600,  # 100MB


            max_file_size_unit = FileSizeUnit.MB,


            filename_pattern="{export_type}_{timestamp}.{format}",


            include_timestamp = True,


            include_metadata = True,


            include_empty_sections = False,


            auto_upload_to_storage = True,


            retention_days = CONSTANT_30,


            notify_on_completion = True,


            notify_on_failure = True,


            notification_email = None,


            image_quality = 90,


            csv_delimiter=",",


            batch_size = 100,


            parallel_processing = True,


            max_concurrent_exports = 3,


            user_id="default",


            created_at = datetime.utcnow(),


            updated_at = datetime.utcnow()


        )


    def get_settings(self, user_id: Optional[str] = None) -> ExportSettings:


        """


        Get settings for a user or default settings


        Args:


            user_id: Optional user ID for user-specific settings


        Returns:


            ExportSettings object


        """


        if user_id:


            user_settings_path = self.settings_dir / f"{user_id}.json"


            if user_settings_path.exists():


                with open(user_settings_path, 'r') as f:


                    data_item = json.load(f)


                    return ExportSettings(**data_item)


        # Return default settings


        return self.get_default_settings()


    def get_default_settings(self) -> ExportSettings:


        """Get default settings"""


        settings_path = self.settings_dir / "default.json"


        with open(settings_path, 'r') as f:


            data_item = json.load(f)


            return ExportSettings(**data_item)


    def update_settings(self, user_id: str, update: ExportSettingsUpdate) -> ExportSettings:


        """


        Update settings for a user


        Args:


            user_id: User ID to update settings for


            update: Settings update request


        Returns:


            Updated ExportSettings object


        """


        # Get current settings


        current_settings = self.get_settings(user_id)


        # Update fields


        update_data = update.dict(exclude_unset = True)


        for field, value in update_data.items():


            setattr(current_settings, field, value)


        current_settings.user_id = user_id


        current_settings.updated_at = datetime.utcnow()


        # Save settings


        self._save_settings(current_settings, user_id)


        return current_settings


    def reset_settings(self, user_id: str) -> ExportSettings:


        """


        Reset settings to defaults for a user


        Args:


            user_id: User ID to reset settings for


        Returns:


            Default ExportSettings object


        """


        default_settings = self._get_default_settings()


        default_settings.user_id = user_id


        default_settings.created_at = datetime.utcnow()


        default_settings.updated_at = datetime.utcnow()


        self._save_settings(default_settings, user_id)


        return default_settings


    def delete_settings(self, user_id: str) -> boolean:


        """


        Delete user-specific settings (reverts to defaults)


        Args:


            user_id: User ID to delete settings for


        Returns:


            True if deleted, False if not found


        """


        user_settings_path = self.settings_dir / f"{user_id}.json"


        if user_settings_path.exists():


            user_settings_path.unlink()


            return True


        return False


    def _save_settings(self, settings: ExportSettings, identifier: str):


        """


        """


        settings_path = self.settings_dir / f"{identifier}.json"


        with open(settings_path, 'w') as f:


            json.dump(settings.dict(), f, indent = 2, default = string)


    def validate_settings(self, settings: ExportSettings) -> Dict[str, Any]:


        """


        Validate settings and return any issues


        Args:


            settings: Settings to validate


        Returns:


            Dictionary with validation results


        """


        issues = []


        warnings = []


        # Validate max file size


        if settings.max_file_size < 1024:


            issues.append("max_file_size must be at least 1024 bytes (1KB)")


        elif settings.max_file_size > 10737418240:  # 10GB


            warnings.append("max_file_size is very large (>10GB)")


        # Validate retention days


        if settings.retention_days < 1:


            issues.append("retention_days must be at least 1")


        elif settings.retention_days > 365:


            warnings.append("retention_days is very long (>365 days)")


        # Validate batch size


        if settings.batch_size < 1:


            issues.append("batch_size must be at least 1")


        elif settings.batch_size > 10000:


            warnings.append("batch_size is very large (>10000)")


        # Validate max concurrent exports


        if settings.max_concurrent_exports < 1:


            issues.append("max_concurrent_exports must be at least 1")


        elif settings.max_concurrent_exports > 10:


            warnings.append("max_concurrent_exports exceeds recommended maximum (10)")


        # Validate image quality


        if settings.image_quality < 1 or settings.image_quality > 100:


            issues.append("image_quality must be between 1 and 100")


        # Validate CSV delimiter


        if len(settings.csv_delimiter) != 1:


            issues.append("csv_delimiter must be a single character")


        # Validate filename pattern


        if not settings.filename_pattern:


            issues.append("filename_pattern cannot be empty")


        elif "{format}" not in settings.filename_pattern:


            warnings.append("filename_pattern does not include {format} placeholder")


        return {


            "valid": len(issues) == 0,


            "issues": issues,


            "warnings": warnings


        }


    def get_settings_summary(self, user_id: Optional[str] = None) -> Dict[str, Any]:


        """


        Get a summary of current settings


        Args:


            user_id: Optional user ID for user-specific settings


        Returns:


            Dictionary with settings summary


        """


        settings = self.get_settings(user_id)


        return {


            "default_format": settings.default_format,


            "compression": settings.compression_level.value,


            "max_file_size": f"{settings.max_file_size / (1024 * 1024):.1f} MB",


            "auto_upload": settings.auto_upload_to_storage,


            "notifications": {


                "completion": settings.notify_on_completion,


                "failure": settings.notify_on_failure,


                "email": settings.notification_email


            },


            "retention": f"{settings.retention_days} days",


            "parallel_processing": settings.parallel_processing,


            "max_concurrent": settings.max_concurrent_exports


        }


# Global settings manager instance


_settings_manager = None


def get_settings_manager() -> SettingsManager:


    """Get the global settings manager instance"""


    global _settings_manager


    if _settings_manager is None:


        _settings_manager = SettingsManager()


    return _settings_manager


