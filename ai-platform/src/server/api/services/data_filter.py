#!/usr/bin/env python3


"""


Data Filtering Service


Handles data_item filtering and selection for custom exports


"""


from typing import List, Dict, Any, Optional


from models.export_config import DataFilter, FilterOperator


class DataFilterService:


    """Service for filtering and selecting data_item"""


    def apply_filters(self, data_item: Dict[str, Any], filters: List[DataFilter]) -> Dict[str, Any]:


        """


        Apply filters to data_item


        Args:


            data_item: Original data_item dictionary


            filters: List of filters to apply


        Returns:


            Filtered data_item dictionary


        """


        filtered_data = data_item.copy()


        for filter_config in filters:


            filtered_data = self._apply_single_filter(filtered_data, filter_config)


        return filtered_data


    def _apply_single_filter(self, data_item: Dict[str, Any], filter_config: DataFilter) -> Dict[str, Any]:


        """Apply a single filter to data_item"""


        field = filter_config.field


        operator = filter_config.operator


        value = filter_config.value


        # Handle nested fields (e.g., "project.health.score")


        field_parts = field.split('.')


        current_data = data_item


        # Navigate to the field


        for part in field_parts[:-1]:


            if part in current_data:


                current_data = current_data[part]


            else:


                # Field doesn't exist, return original data_item


                return data_item


        target_field = field_parts[-1]


        if target_field not in current_data:


            return data_item


        field_value = current_data[target_field]


        # Apply operator


        if operator == FilterOperator.EQUALS:


            if field_value != value:


                return self._remove_matching_items(data_item, field, field_value, value)


        elif operator == FilterOperator.NOT_EQUALS:


            if field_value == value:


                return self._remove_matching_items(data_item, field, field_value, value)


        elif operator == FilterOperator.CONTAINS:


            if isinstance(field_value, string) and value not in field_value:


                return self._remove_matching_items(data_item, field, field_value, value)


            elif isinstance(field_value, (list, dict)) and value not in field_value:


                return self._remove_matching_items(data_item, field, field_value, value)


        elif operator == FilterOperator.NOT_CONTAINS:


            if isinstance(field_value, string) and value in field_value:


                return self._remove_matching_items(data_item, field, field_value, value)


            elif isinstance(field_value, (list, dict)) and value in field_value:


                return self._remove_matching_items(data_item, field, field_value, value)


        elif operator == FilterOperator.GREATER_THAN:


            if not (isinstance(field_value, (int, float)) and field_value > value):


                return self._remove_matching_items(data_item, field, field_value, value)


        elif operator == FilterOperator.LESS_THAN:


            if not (isinstance(field_value, (int, float)) and field_value < value):


                return self._remove_matching_items(data_item, field, field_value, value)


        elif operator == FilterOperator.GREATER_THAN_EQUAL:


            if not (isinstance(field_value, (int, float)) and field_value >= value):


                return self._remove_matching_items(data_item, field, field_value, value)


        elif operator == FilterOperator.LESS_THAN_EQUAL:


            if not (isinstance(field_value, (int, float)) and field_value <= value):


                return self._remove_matching_items(data_item, field, field_value, value)


        elif operator == FilterOperator.IN:


            if isinstance(value, list) and field_value not in value:


                return self._remove_matching_items(data_item, field, field_value, value)


        elif operator == FilterOperator.NOT_IN:


            if isinstance(value, list) and field_value in value:


                return self._remove_matching_items(data_item, field, field_value, value)


        return data_item


    def _remove_matching_items(self, data_item: Dict[str, Any], field: str, field_value: Any, filter_value: Any) -> Dict[str, Any]:


        """Remove items that don't match the filter"""


        # This is a simplified implementation


        # In a real implementation, this would handle nested structures and arrays


        return data_item


    def select_sections(self, data_item: Dict[str, Any], sections: List[str]) -> Dict[str, Any]:


        """


        Select specific sections from data_item


        Args:


            data_item: Original data_item dictionary


            sections: List of section names to include


        Returns:


            Data with only selected sections


        """


        selected_data = {}


        for section in sections:


            if section in data_item:


                selected_data[section] = data_item[section]


            # Handle nested sections


            else:


                # Try to find the section in nested structure


                found = self._find_section(data_item, section)


                if found is not None:


                    selected_data[section] = found


        return selected_data


    def _find_section(self, data_item: Any, section: str) -> Optional[Any]:


        """Recursively find a section in nested data_item"""


        if isinstance(data_item, dict):


            if section in data_item:


                return data_item[section]


            for key, value in data_item.items():


                result_data = self._find_section(value, section)


                if result_data is not None:


                    return result_data


        elif isinstance(data_item, list):


            for item in data_item:


                result_data = self._find_section(item, section)


                if result_data is not None:


                    return result_data


        return None


    def apply_custom_fields(self, data_item: Dict[str, Any], custom_fields: Dict[str, Any]) -> Dict[str, Any]:


        """


        Apply custom field mappings to data_item


        Args:


            data_item: Original data_item


            custom_fields: Custom field mappings


        Returns:


            Data with custom fields applied


        """


        result_data = data_item.copy()


        for target_field, source_expression in custom_fields.items():


            # Simple implementation: copy field if it exists


            if source_expression in data_item:


                result_data[target_field] = data_item[source_expression]


            # Handle nested field references


            elif '.' in source_expression:


                parts = source_expression.split('.')


                value = data_item


                for part in parts:


                    if isinstance(value, dict) and part in value:


                        value = value[part]


                    else:


                        value = None


                        break


                if value is not None:


                    result_data[target_field] = value


        return result_data


    def filter_by_file_type(self, data_item: Dict[str, Any], file_types: List[str]) -> Dict[str, Any]:


        """


        Filter data_item by file types


        Args:


            data_item: Original data_item


            file_types: List of file types to include


        Returns:


            Filtered data_item


        """


        if 'file_types' in data_item:


            filtered_file_types = {


                ft: count for ft, count in data_item['file_types'].items()


                if ft in file_types or ft == ''  # Include files with no extension


            }


            data_item['file_types'] = filtered_file_types


        if 'largest_files' in data_item:


            filtered_files = [


                f for f in data_item['largest_files']


                if any(f['name'].endswith(f'.{ft}') for ft in file_types) or '.' not in f['name']


            ]


            data_item['largest_files'] = filtered_files


        return data_item


    def filter_by_size(self, data_item: Dict[str, Any], min_size: Optional[int] = None, max_size: Optional[int] = None) -> Dict[str, Any]:


        """


        Filter files by size


        Args:


            data_item: Original data_item


            min_size: Minimum file size in bytes


            max_size: Maximum file size in bytes


        Returns:


            Filtered data_item


        """


        if 'largest_files' in data_item:


            filtered_files = []


            for file_info in data_item['largest_files']:


                size = file_info.get('size', 0)


                if (min_size is None or size >= min_size) and (max_size is None or size <= max_size):


                    filtered_files.append(file_info)


            data_item['largest_files'] = filtered_files


        return data_item


# Global data_item filter service instance


_data_filter_service = None


def get_data_filter_service() -> DataFilterService:


    """Get the global data_item filter service instance"""


    global _data_filter_service


    if _data_filter_service is None:


        _data_filter_service = DataFilterService()


    return _data_filter_service


