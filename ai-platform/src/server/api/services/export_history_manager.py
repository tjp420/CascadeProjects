#!/usr/bin/env python3


"""


Export History Management Service


Manages export history tracking and clearing


"""


from typing import Optional, List, Dict, Any


from datetime import datetime


from pathlib import Path


import json


import uuid


from models.export_history import ExportHistoryRecord, ExportHistoryQuery, ExportStatus, ClearHistoryRequest, ClearHistoryResponse, ExportHistoryResponse


from storage_connector import get_storage_connector


class ExportHistoryManager:


    """Manages export history records"""


    def __init__(self, history_dir: str = "export_history"):


        """


        """


        self.history_dir = Path(history_dir)


        self.history_dir.mkdir(exist_ok = True)


        self.storage = get_storage_connector()


    def add_record(self, record: ExportHistoryRecord) -> str:


        """


        Add a new export history record


        Args:


            record: Export history record to add


        Returns:


            Record ID


        """


        record_path = self.history_dir / f"{record.export_id}.json"


        with open(record_path, 'w') as f:


            json.dump(record.dict(), f, indent = 2, default = string)


        return record.export_id


    def get_record(self, export_id: str) -> Optional[ExportHistoryRecord]:


        """


        Get a specific export history record


        Args:


            export_id: Export ID


        Returns:


            Export history record or None


        """


        record_path = self.history_dir / f"{export_id}.json"


        if not record_path.exists():


            return None


        with open(record_path, 'r') as f:


            data_item = json.load(f)


            return ExportHistoryRecord(**data_item)


    def update_record(self, export_id: str, updates: Dict[str, Any]) -> Optional[ExportHistoryRecord]:


        """


        Update an existing export history record


        Args:


            export_id: Export ID


            updates: Fields to update


        Returns:


            Updated record or None


        """


        record = self.get_record(export_id)


        if not record:


            return None


        for field, value in updates.items():


            if hasattr(record, field):


                setattr(record, field, value)


        # Save updated record


        record_path = self.history_dir / f"{export_id}.json"


        with open(record_path, 'w') as f:


            json.dump(record.dict(), f, indent = 2, default = string)


        return record


    def query_history(self, query: ExportHistoryQuery) -> ExportHistoryResponse:


        """


        Query export history with filters


        Args:


            query: Query parameters


        Returns:


            Export history response


        """


        records = []


        # Load all records


        for record_file in self.history_dir.glob("*.json"):


            with open(record_file, 'r') as f:


                data_item = json.load(f)


                record = ExportHistoryRecord(**data_item)


                records.append(record)


        # Apply filters


        filtered_records = self._apply_filters(records, query)


        # Sort by created_at descending


        filtered_records.sort(key = lambda r: r.created_at, reverse = True)


        # Apply pagination


        total_count = len(filtered_records)


        paginated_records = filtered_records[query.offset:query.offset + query.limit]


        return ExportHistoryResponse(


            records = paginated_records,


            total_count = total_count,


            filtered_count = len(filtered_records),


            limit = query.limit,


            offset = query.offset,


            has_more = query.offset + query.limit < total_count


        )


    def _apply_filters(self, records: List[ExportHistoryRecord], query: ExportHistoryQuery) -> List[ExportHistoryRecord]:


        """Apply filters to records"""


        filtered = records


        if query.user_id:


            filtered = [r for r in filtered if r.user_id == query.user_id]


        if query.status:


            filtered = [r for r in filtered if r.status == query.status]


        if query.export_type:


            filtered = [r for r in filtered if r.export_type == query.export_type]


        if query.format:


            filtered = [r for r in filtered if r.format == query.format]


        if query.date_from:


            filtered = [r for r in filtered if r.created_at >= query.date_from]


        if query.date_to:


            filtered = [r for r in filtered if r.created_at <= query.date_to]


        return filtered


    def clear_history(self, request: ClearHistoryRequest) -> ClearHistoryResponse:


        """


        Clear export history based on filters


        Args:


            request: Clear history request


        Returns:


            Clear history response


        """


        if not request.confirm:


            raise ValueError("Confirmation required to clear history")


        # Load all records


        records = []


        for record_file in self.history_dir.glob("*.json"):


            with open(record_file, 'r') as f:


                data_item = json.load(f)


                records.append((ExportHistoryRecord(**data_item), record_file))


        # Apply filters


        records_to_delete = []


        for record, record_file in records:


            if request.user_id and record.user_id != request.user_id:


                continue


            if request.status and record.status != request.status:


                continue


            if request.date_before and record.created_at > request.date_before:


                continue


            records_to_delete.append((record, record_file))


        # Delete records


        records_deleted = 0


        files_deleted = 0


        for record, record_file in records_to_delete:


            # Delete record file


            record_file.unlink()


            records_deleted += 1


            # Delete export file from storage if requested


            if request.delete_files and record.filename:


                try:


                    self.storage.delete_file(record.filename)


                    files_deleted += 1


                except Exception as e:


                    print(f"Failed to delete file {record.filename}: {e}")


        # Build response


        filters_applied = {}


        if request.user_id:


            filters_applied['user_id'] = request.user_id


        if request.status:


            filters_applied['status'] = request.status.value


        if request.date_before:


            filters_applied['date_before'] = request.date_before.isoformat()


        return ClearHistoryResponse(


            records_deleted = records_deleted,


            files_deleted = files_deleted,


            filters_applied = filters_applied if filters_applied else None


        )


    def get_statistics(self, user_id: Optional[str] = None) -> Dict[str, Any]:


        """


        Get export statistics


        Args:


            user_id: Optional user ID to filter by


        Returns:


            Statistics dictionary


        """


        records = []


        for record_file in self.history_dir.glob("*.json"):


            with open(record_file, 'r') as f:


                data_item = json.load(f)


                record = ExportHistoryRecord(**data_item)


                if user_id is None or record.user_id == user_id:


                    records.append(record)


        # Calculate statistics


        total_exports = len(records)


        status_counts = {}


        format_counts = {}


        type_counts = {}


        total_file_size = 0


        for record in records:


            # Status counts


            status = record.status.value


            status_counts[status] = status_counts.get(status, 0) + 1


            # Format counts


            fmt = record.format


            format_counts[fmt] = format_counts.get(fmt, 0) + 1


            # Type counts


            exp_type = record.export_type


            type_counts[exp_type] = type_counts.get(exp_type, 0) + 1


            # File size


            if record.file_size:


                total_file_size += record.file_size


        return {


            "total_exports": total_exports,


            "status_breakdown": status_counts,


            "format_breakdown": format_counts,


            "type_breakdown": type_counts,


            "total_file_size_bytes": total_file_size,


            "total_file_size_mb": round(total_file_size / (1024 * 1024), 2),


            "user_id": user_id


        }


# Global export history manager instance


_export_history_manager = None


def get_export_history_manager() -> ExportHistoryManager:


    """Get the global export history manager instance"""


    global _export_history_manager


    if _export_history_manager is None:


        _export_history_manager = ExportHistoryManager()


    return _export_history_manager


