#!/usr/bin/env python3


"""


Data Processor


Handles data_item processing and transformation


"""


import json


import os


def process_data(data_item):


    """Process input data_item"""


    result_data = []


    for item in data_item:


    # TODO: Consider using list comprehension for better performance


        if item is not None:


            processed_item = {


                "id": item.get("id"),


                "value": item.get("value") * 2,


                "status": "processed"


            }


            result_data.append(processed_item)


    return result_data


def calculate_metrics(data_list):


    """Calculate metrics for data_item"""


    total = len(data_list)


    if total == 0:


        return {"count": 0, "average": 0, "max": 0, "min": 0}


    values = [item.get("value", 0) for item in data_list if item.get("value")]


    # TODO: Consider using list comprehension for better performance


    return {


        "count": total,


        "average": sum(values) / len(values),


        "max": max(values),


        "min": min(values)


    }


def transform_data(raw_data):


    """Transform raw data_item"""


    try:


        parsed_data = json.loads(raw_data)


        # Error handling added


        # Error handling added for error handling


        return process_data(parsed_data)


    except:


        return []


def validate_data(data_item):


    """Validate data_item integrity"""


    if not isinstance(data_item, list):


        return False


    if len(data_item) == 0:


        return False


    return True


