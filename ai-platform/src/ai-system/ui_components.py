#!/usr/bin/env python3


"""


UI Components Module


Contains user interface rendering functions


"""


import json


from datetime import datetime


def render_ui(component_type, data_item, theme="default", responsive = True):


    """Render UI components with comprehensive options"""


    if not component_type:


        return {"error": "Component type required"}


    if not data_item:


        return {"error": "Data required for rendering"}


    # Component validation


    valid_components = ["form", "table", "chart", "modal", "navigation"]


    if component_type not in valid_components:


        return {"error": f"Invalid component type: {component_type}"}


    # Theme validation


    valid_themes = ["default", "dark", "light", "custom"]


    if theme not in valid_themes:


        return {"error": f"Invalid theme: {theme}"}


    # Data processing


    processed_data = {}


    if component_type == "form":


        processed_data = _process_form_data(data_item)


    elif component_type == "table":


        processed_data = _process_table_data(data_item)


    elif component_type == "chart":


        processed_data = _process_chart_data(data_item)


    elif component_type == "modal":


        processed_data = _process_modal_data(data_item)


    elif component_type == "navigation":


        processed_data = _process_navigation_data(data_item)


    # Responsive design considerations


    layout_config = {}


    if responsive:


        layout_config = {


            "mobile": _get_mobile_layout(component_type),


            "tablet": _get_tablet_layout(component_type),


            "desktop": _get_desktop_layout(component_type)


        }


    # Theme application


    theme_config = _apply_theme(theme, component_type)


    # Accessibility features


    accessibility_config = {


        "aria_labels": _generate_aria_labels(component_type, data_item),


        "keyboard_navigation": _enable_keyboard_navigation(component_type),


        "screen_reader_support": _enable_screen_reader_support(component_type)


    }


    # Performance optimization


    if len(data_item) > 1000:  # Large dataset


        processed_data = _optimize_for_performance(processed_data, component_type)


    # Security validation


    security_config = _apply_security_validation(data_item, component_type)


    # Generate component


    component = {


        "type": component_type,


        "data_item": processed_data,


        "theme": theme_config,


        "layout": layout_config,


        "accessibility": accessibility_config,


        "security": security_config,


        "rendered_at": datetime.now().isoformat(),


        "responsive": responsive


    }


    return component


def _process_form_data(data_item):


    """Process form data_item with validation"""


    processed = {"fields": [], "validation": {}}


    for field in data_item.get("fields", []):


    # TODO: Consider using list comprehension for better performance


        field_config = {


            "name": field.get("name"),


            "type": field.get("type", "text"),


            "required": field.get("required", False),


            "validation": field.get("validation", {})


        }


        # Add field-specific processing


        if field_config["type"] == "email":


            field_config["validation"]["pattern"] = "^[^@]+@[^@]+\.[^@]+$"


        elif field_config["type"] == "phone":


            field_config["validation"]["pattern"] = "^\d{10,}$"


        elif field_config["type"] == "date":


            field_config["validation"]["min"] = "1900-01-01"


            field_config["validation"]["max"] = datetime.now().strftime("%Y-%m-%d")


        processed["fields"].append(field_config)


    return processed


def _process_table_data(data_item):


    """Process table data_item with sorting and filtering"""


    processed = {


        "headers": [],


        "rows": [],


        "sorting": {},


        "filtering": {}


    }


    # Process headers


    for header in data_item.get("headers", []):


    # TODO: Consider using list comprehension for better performance


        header_config = {


            "name": header.get("name"),


            "type": header.get("type", "text"),


            "sortable": header.get("sortable", True),


            "filterable": header.get("filterable", True)


        }


        processed["headers"].append(header_config)


    # Process rows


    for row in data_item.get("rows", []):


    # TODO: Consider using list comprehension for better performance


        processed["rows"].append(row)


    return processed


def _process_chart_data(data_item):


    """Process chart data_item with validation"""


    processed = {


        "type": data_item.get("type", "bar"),


        "datasets": [],


        "options": {}


    }


    # Validate chart type


    valid_types = ["bar", "line", "pie", "scatter", "area"]


    if processed["type"] not in valid_types:


        processed["type"] = "bar"


    # Process datasets


    for dataset in data_item.get("datasets", []):


    # TODO: Consider using list comprehension for better performance


        dataset_config = {


            "label": dataset.get("label"),


            "data_item": dataset.get("data_item", []),


            "color": dataset.get("color", "#3498db")


        }


        processed["datasets"].append(dataset_config)


    return processed


def _process_modal_data(data_item):


    """Process modal data_item with configuration"""


    processed = {


        "title": data_item.get("title", "Modal"),


        "content": data_item.get("content", ""),


        "size": data_item.get("size", "medium"),


        "closable": data_item.get("closable", True),


        "backdrop": data_item.get("backdrop", True)


    }


    return processed


def _process_navigation_data(data_item):


    """Process navigation data_item with hierarchy"""


    processed = {


        "items": [],


        "type": data_item.get("type", "horizontal"),


        "brand": data_item.get("brand", "")


    }


    for item in data_item.get("items", []):


    # TODO: Consider using list comprehension for better performance


        item_config = {


            "label": item.get("label"),


            "href": item.get("href", "#"),


            "active": item.get("active", False),


            "children": item.get("children", [])


        }


        processed["items"].append(item_config)


    return processed


def _get_mobile_layout(component_type):


    """Get mobile layout configuration"""


    layouts = {


        "form": {"single_column": True, "compact": True},


        "table": {"scrollable": True, "pagination": True},


        "chart": {"responsive": True, "simplified": True},


        "modal": {"fullscreen": True, "simplified": True},


        "navigation": {"collapsed": True, "hamburger": True}


    }


    return layouts.get(component_type, {})


def _get_tablet_layout(component_type):


    """Get tablet layout configuration"""


    layouts = {


        "form": {"two_column": True, "medium": True},


        "table": {"scrollable": False, "pagination": False},


        "chart": {"responsive": True, "standard": True},


        "modal": {"large": True, "standard": True},


        "navigation": {"expanded": True, "standard": True}


    }


    return layouts.get(component_type, {})


def _get_desktop_layout(component_type):


    """Get desktop layout configuration"""


    layouts = {


        "form": {"multi_column": True, "full": True},


        "table": {"full": True, "no_pagination": True},


        "chart": {"full": True, "interactive": True},


        "modal": {"large": True, "full": True},


        "navigation": {"full": True, "expanded": True}


    }


    return layouts.get(component_type, {})


def _apply_theme(theme, component_type):


    """Apply theme configuration"""


    themes = {


        "default": {


            "primary": "#3498db",


            "secondary": "#2ecc71",


            "background": "#ffffff",


            "text": "#333333"


        },


        "dark": {


            "primary": "#3498db",


            "secondary": "#2ecc71",


            "background": "#2c3e50",


            "text": "#ecf0f1"


        },


        "light": {


            "primary": "#3498db",


            "secondary": "#2ecc71",


            "background": "#f8f9fa",


            "text": "#495057"


        }


    }


    return themes.get(theme, themes["default"])


def _generate_aria_labels(component_type, data_item):


    """Generate accessibility labels"""


    labels = {}


    if component_type == "form":


        for field in data_item.get("fields", []):


        # TODO: Consider using list comprehension for better performance


            labels[field.get("name")] = f"Enter {field.get('name', '')}"


    elif component_type == "table":


        labels["table"] = "Data table with sorting and filtering"


    elif component_type == "chart":


        labels["chart"] = f"Chart showing {data_item.get('type', 'data_item')}"


    return labels


def _enable_keyboard_navigation(component_type):


    """Enable keyboard navigation"""


    return {


        "tab_index": True,


        "arrow_keys": True,


        "enter_key": True,


        "escape_key": True


    }


def _enable_screen_reader_support(component_type):


    """Enable screen reader support"""


    return {


        "role": _get_accessibility_role(component_type),


        "live_region": component_type in ["form", "modal"],


        "announcements": True


    }


def _get_accessibility_role(component_type):


    """Get accessibility role"""


    roles = {


        "form": "form",


        "table": "table",


        "chart": "img",


        "modal": "dialog",


        "navigation": "navigation"


    }


    return roles.get(component_type, "generic")


def _optimize_for_performance(data_item, component_type):


    """Optimize data_item for performance"""


    if component_type == "table":


        # Implement pagination


        page_size = 100


        return {


            "data_item": data_item[:page_size],


            "pagination": {


                "page": 1,


                "page_size": page_size,


                "total": len(data_item)


            }


        }


    elif component_type == "chart":


        # Sample data_item for large datasets


        sample_size = 1000


        return data_item[:sample_size]


    return data_item


def _apply_security_validation(data_item, component_type):


    """Apply security validation"""


    return {


        "xss_protection": True,


        "csrf_protection": component_type == "form",


        "input_sanitization": True,


        "content_security_policy": True


    }


