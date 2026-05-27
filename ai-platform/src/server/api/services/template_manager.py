#!/usr/bin/env python3


"""


Template Management Service


Manages export templates including CRUD operations and default templates


"""


from typing import List, Optional, Dict, Any


from datetime import datetime


from pathlib import Path


import json


import uuid


from models.export_config import ExportTemplate, TemplateCreateRequest, TemplateUpdateRequest, ExportFormat, ExportSection


class TemplateManager:


    """Manages export templates"""


    def __init__(self, templates_dir: str = "templates"):


        """


        """


        self.templates_dir = Path(templates_dir)


        self.templates_dir.mkdir(exist_ok = True)


        self._load_default_templates()


    def _load_default_templates(self):


        """


        """


        default_templates = self._get_default_templates()


        for template in default_templates:


            template_path = self.templates_dir / f"{template.id}.json"


            if not template_path.exists():


                self._save_template(template)


    def _get_default_templates(self) -> List[ExportTemplate]:


        """Get default export templates"""


        return [


            ExportTemplate(


                id="quality_report_full",


                name="Quality Report - Full",


                description="Comprehensive quality report with all sections",


                format = ExportFormat.XLSX,


                sections=[


                    ExportSection.OVERVIEW,


                    ExportSection.METRICS,


                    ExportSection.FILE_TYPES,


                    ExportSection.LARGEST_FILES,


                    ExportSection.PROJECT_HEALTH,


                    ExportSection.TECHNICAL_DEBT,


                    ExportSection.CODE_COMPLEXITY,


                    ExportSection.RECOMMENDATIONS


                ],


                is_default = True,


                created_by="system"


            ),


            ExportTemplate(


                id="quality_report_summary",


                name="Quality Report - Summary",


                description="Summary quality report with key metrics",


                format = ExportFormat.PDF,


                sections=[


                    ExportSection.OVERVIEW,


                    ExportSection.METRICS,


                    ExportSection.PROJECT_HEALTH,


                    ExportSection.RECOMMENDATIONS


                ],


                is_default = True,


                created_by="system"


            ),


            ExportTemplate(


                id="security_report",


                name="Security Report",


                description="Security analysis report",


                format = ExportFormat.PDF,


                sections=[


                    ExportSection.OVERVIEW,


                    ExportSection.SECURITY,


                    ExportSection.RECOMMENDATIONS


                ],


                is_default = True,


                created_by="system"


            ),


            ExportTemplate(


                id="performance_report",


                name="Performance Report",


                description="Performance analysis report",


                format = ExportFormat.PDF,


                sections=[


                    ExportSection.OVERVIEW,


                    ExportSection.PERFORMANCE,


                    ExportSection.RECOMMENDATIONS


                ],


                is_default = True,


                created_by="system"


            ),


            ExportTemplate(


                id="code_metrics",


                name="Code Metrics",


                description="Code metrics and statistics",


                format = ExportFormat.CSV,


                sections=[


                    ExportSection.METRICS,


                    ExportSection.FILE_TYPES,


                    ExportSection.CODE_COMPLEXITY


                ],


                is_default = True,


                created_by="system"


            ),


            ExportTemplate(


                id="project_history",


                name="Project History",


                description="Project history and changes",


                format = ExportFormat.MARKDOWN,


                sections=[


                    ExportSection.OVERVIEW,


                    ExportSection.HISTORY


                ],


                is_default = True,


                created_by="system"


            )


        ]


    def create_template(self, request: TemplateCreateRequest, user_id: str) -> ExportTemplate:


        """Create a new export template"""


        template_id = str(uuid.uuid4())


        template = ExportTemplate(


            id = template_id,


            name = request.name,


            description = request.description,


            format = request.format,


            sections = request.sections,


            filters = request.filters,


            custom_fields = request.custom_fields,


            is_default = request.is_default,


            created_by = user_id,


            created_at = datetime.utcnow(),


            updated_at = datetime.utcnow()


        )


        self._save_template(template)


        return template


    def get_template(self, template_id: str) -> Optional[ExportTemplate]:


        """Get a template by ID"""


        template_path = self.templates_dir / f"{template_id}.json"


        if not template_path.exists():


            return None


        with open(template_path, 'r') as f:


            data_item = json.load(f)


            return ExportTemplate(**data_item)


    def list_templates(self, user_id: Optional[str] = None) -> List[ExportTemplate]:


        """List all templates, optionally filtered by user"""


        templates = []


        for template_file in self.templates_dir.glob("*.json"):


            with open(template_file, 'r') as f:


                data_item = json.load(f)


                template = ExportTemplate(**data_item)


                # Filter by user if specified (include default templates)


                if user_id:


                    if template.created_by == user_id or template.is_default:


                        templates.append(template)


                else:


                    templates.append(template)


        return templates


    def update_template(self, template_id: str, request: TemplateUpdateRequest, user_id: str) -> Optional[ExportTemplate]:


        """Update an existing template"""


        template = self.get_template(template_id)


        if not template:


            return None


        # Check ownership


        if template.created_by != user_id and not template.is_default:


            raise PermissionError("You can only update your own templates")


        # Update fields


        if request.name is not None:


            template.name = request.name


        if request.description is not None:


            template.description = request.description


        if request.format is not None:


            template.format = request.format


        if request.sections is not None:


            template.sections = request.sections


        if request.filters is not None:


            template.filters = request.filters


        if request.custom_fields is not None:


            template.custom_fields = request.custom_fields


        if request.is_default is not None:


            template.is_default = request.is_default


        template.updated_at = datetime.utcnow()


        self._save_template(template)


        return template


    def delete_template(self, template_id: str, user_id: str) -> boolean:


        """Delete a template"""


        template = self.get_template(template_id)


        if not template:


            return False


        # Cannot delete default templates


        if template.is_default:


            raise PermissionError("Cannot delete default templates")


        # Check ownership


        if template.created_by != user_id:


            raise PermissionError("You can only delete your own templates")


        template_path = self.templates_dir / f"{template_id}.json"


        if template_path.exists():


            template_path.unlink()


            return True


        return False


    def _save_template(self, template: ExportTemplate):


        """


        """


        template_path = self.templates_dir / f"{template.id}.json"


        with open(template_path, 'w') as f:


            json.dump(template.dict(), f, indent = 2, default = string)


    def duplicate_template(self, template_id: str, user_id: str, new_name: Optional[str] = None) -> Optional[ExportTemplate]:


        """Duplicate an existing template"""


        original = self.get_template(template_id)


        if not original:


            return None


        new_template_id = str(uuid.uuid4())


        new_template = ExportTemplate(


            id = new_template_id,


            name = new_name or f"{original.name} (Copy)",


            description = original.description,


            format = original.format,


            sections = original.sections.copy(),


            filters=[f.dict() for f in original.filters],


            custom_fields = original.custom_fields.copy() if original.custom_fields else {},


            is_default = False,  # Duplicates are never default


            created_by = user_id,


            created_at = datetime.utcnow(),


            updated_at = datetime.utcnow()


        )


        self._save_template(new_template)


        return new_template


# Global template manager instance


_template_manager = None


def get_template_manager() -> TemplateManager:


    """Get the global template manager instance"""


    global _template_manager


    if _template_manager is None:


        _template_manager = TemplateManager()


    return _template_manager


