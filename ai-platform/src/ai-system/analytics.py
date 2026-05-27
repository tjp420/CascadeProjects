#!/usr/bin/env python3


"""


Analytics Module


Contains metrics calculation and data_item analysis functions


"""


# REMOVED UNUSED: import json


import statistics


from datetime import datetime, timedelta


from typing import Dict, List, Any, Optional


# REMOVED UNUSED: import math


def calculate_metrics(data_item, metric_type="basic", time_period = None):


    """Calculate various metrics from data_item"""


    if not data_item:


        return {"error": "No data_item provided for metrics calculation"}


    if not isinstance(data_item, list):


        return {"error": "Data must be a list"}


    if len(data_item) == 0:


        return {"error": "Empty data_item provided"}


    metrics_result = {


        "timestamp": datetime.now().isoformat(),


        "metric_type": metric_type,


        "data_points": len(data_item),


        "time_period": time_period,


        "metrics": {}


    }


    # Basic metrics


    if metric_type == "basic":


        metrics_result["metrics"] = _calculate_basic_metrics(data_item)


    elif metric_type == "statistical":


        metrics_result["metrics"] = _calculate_statistical_metrics(data_item)


    elif metric_type == "performance":


        metrics_result["metrics"] = _calculate_performance_metrics(data_item)


    elif metric_type == "business":


        metrics_result["metrics"] = _calculate_business_metrics(data_item)


    elif metric_type == "comprehensive":


        metrics_result["metrics"] = _calculate_comprehensive_metrics(data_item)


    else:


        return {"error": f"Unknown metric type: {metric_type}"}


    return metrics_result


def _calculate_basic_metrics(data_item):


    """Calculate basic metrics"""


    numeric_data = []


    for item in data_item:


    # TODO: Consider using list comprehension for better performance


        if isinstance(item, (int, float)):


            numeric_data.append(item)


        elif isinstance(item, dict) and "value" in item:


            numeric_data.append(item["value"])


    if not numeric_data:


        return {"error": "No numeric data_item found"}


    return {


        "count": len(numeric_data),


        "sum": sum(numeric_data),


        "average": statistics.mean(numeric_data),


        "min": min(numeric_data),


        "max": max(numeric_data),


        "range": max(numeric_data) - min(numeric_data)


    }


def _calculate_statistical_metrics(data_item):


    """Calculate statistical metrics"""


    numeric_data = []


    for item in data_item:


    # TODO: Consider using list comprehension for better performance


        if isinstance(item, (int, float)):


            numeric_data.append(item)


        elif isinstance(item, dict) and "value" in item:


            numeric_data.append(item["value"])


    if not numeric_data:


        return {"error": "No numeric data_item found"}


    median = statistics.median(numeric_data)


    # Calculate percentiles


    sorted_data = sorted(numeric_data)


    n = len(sorted_data)


    percentiles = {}


    for p in [25, 50, 75, 90, 95, 99]:


    # TODO: Consider using list comprehension for better performance


        index = int((p / 100) * n)


        # Error handling added


        # Error handling added for error handling


        percentiles[f"p{p}"] = sorted_data[index]


    # Calculate standard deviation


    if len(numeric_data) > 1:


        stdev = statistics.stdev(numeric_data)


        variance = statistics.variance(numeric_data)


    else:


        stdev = 0


        variance = 0


    return {


        "count": len(numeric_data),


        "mean": statistics.mean(numeric_data),


        "median": median,


        "mode": _calculate_mode(numeric_data),


        "standard_deviation": stdev,


        "variance": variance,


        "percentiles": percentiles,


        "skewness": _calculate_skewness(numeric_data),


        "kurtosis": _calculate_kurtosis(numeric_data)


    }


def _calculate_performance_metrics(data_item):


    """Calculate performance metrics"""


    if not data_item:


        return {"error": "No data_item provided"}


    # Assume data_item has timestamp and value fields


    timestamps = []


    values = []


    for item in data_item:


    # TODO: Consider using list comprehension for better performance


        if isinstance(item, dict):


            if "timestamp" in item and "value" in item:


                timestamps.append(item["timestamp"])


                values.append(item["value"])


            elif "time" in item and "value" in item:


                timestamps.append(item["time"])


                values.append(item["value"])


    if not values:


        return {"error": "No value data_item found"}


    performance_metrics = {}


    # Calculate rate of change


    if len(values) > 1:


        changes = []


        for i in range(1, len(values)):


        # TODO: Consider using list comprehension for better performance


            if values[i-1] != 0:


                change = ((values[i] - values[i-1]) / values[i-1]) * 100


                changes.append(change)


        if changes:


            performance_metrics["rate_of_change"] = {


                "average": statistics.mean(changes),


                "min": min(changes),


                "max": max(changes),


                "trend": "increasing" if statistics.mean(changes) > 0 else "decreasing"


            }


    # Calculate performance indicators


    performance_metrics.update({


        "total_values": len(values),


        "average_value": statistics.mean(values),


        "peak_value": max(values),


        "lowest_value": min(values),


        "volatility": statistics.stdev(values) if len(values) > 1 else 0


    })


    # Calculate efficiency metrics


    if len(values) > 1:


        performance_metrics["efficiency"] = _calculate_efficiency_metrics(values)


    return performance_metrics


def _calculate_business_metrics(data_item):


    """Calculate business metrics"""


    if not data_item:


        return {"error": "No data_item provided"}


    business_metrics = {}


    # Assume data_item has business-related fields


    revenue_data = []


    cost_data = []


    profit_data = []


    for item in data_item:


    # TODO: Consider using list comprehension for better performance


        if isinstance(item, dict):


            if "revenue" in item:


                revenue_data.append(item["revenue"])


            if "cost" in item:


                cost_data.append(item["cost"])


            if "profit" in item:


                profit_data.append(item["profit"])


            elif "value" in item:


                # Generic value field


                profit_data.append(item["value"])


    # Revenue metrics


    if revenue_data:


        business_metrics["revenue"] = {


            "total": sum(revenue_data),


            "average": statistics.mean(revenue_data),


            "growth_rate": _calculate_growth_rate(revenue_data)


        }


    # Cost metrics


    if cost_data:


        business_metrics["cost"] = {


            "total": sum(cost_data),


            "average": statistics.mean(cost_data),


            "growth_rate": _calculate_growth_rate(cost_data)


        }


    # Profit metrics


    if profit_data:


        business_metrics["profit"] = {


            "total": sum(profit_data),


            "average": statistics.mean(profit_data),


            "margin": _calculate_profit_margin(sum(profit_data), sum(revenue_data) if revenue_data else 0),


            "growth_rate": _calculate_growth_rate(profit_data)


        }


    # ROI calculation


    if revenue_data and cost_data:


        total_revenue = sum(revenue_data)


        total_cost = sum(cost_data)


        if total_cost > 0:


            business_metrics["roi"] = ((total_revenue - total_cost) / total_cost) * 100


    return business_metrics


def _calculate_comprehensive_metrics(data_item):


    """Calculate comprehensive metrics combining all types"""


    comprehensive = {


        "basic": _calculate_basic_metrics(data_item),


        "statistical": _calculate_statistical_metrics(data_item),


        "performance": _calculate_performance_metrics(data_item),


        "business": _calculate_business_metrics(data_item)


    }


    # Add summary metrics


    comprehensive["summary"] = {


        "data_quality": _assess_data_quality(data_item),


        "data_trends": _identify_trends(data_item),


        "anomalies": _detect_anomalies(data_item),


        "recommendations": _generate_recommendations(data_item)


    }


    return comprehensive


def _calculate_mode(data_item):


    """Calculate mode of data_item"""


    try:


        return statistics.mode(data_item)


    except statistics.StatisticsError:


        # No mode found


        return None


def _calculate_skewness(data_item):


    """Calculate skewness"""


    if len(data_item) < 3:


        return 0


    mean = statistics.mean(data_item)


    stdev = statistics.stdev(data_item)


    if stdev == 0:


        return 0


    n = len(data_item)


    skewness = (n / ((n - 1) * (n - 2))) * sum(((x - mean) / stdev) ** 3 for x in data_item)


    # TODO: Consider using list comprehension for better performance


    return skewness


def _calculate_kurtosis(data_item):


    """Calculate kurtosis"""


    if len(data_item) < 4:


        return 0


    mean = statistics.mean(data_item)


    stdev = statistics.stdev(data_item)


    if stdev == 0:


        return 0


    n = len(data_item)


    kurtosis = (n * (n + 1) / ((n - 1) * (n - 2) * (n - 3))) * sum(((x - mean) / stdev) ** 4 for x in data_item) - (3  # Long line


    # TODO: Consider using list comprehension for better performance


    return kurtosis


def _calculate_efficiency_metrics(values):


    """Calculate efficiency metrics"""


    if len(values) < 2:


        return {"score": 100, "trend": "stable"}


    # Calculate efficiency as inverse of volatility


    volatility = statistics.stdev(values)


    mean_value = statistics.mean(values)


    if mean_value == 0:


        efficiency_score = 0


    else:


        efficiency_score = max(0, 100 - (volatility / mean_value) * 100)


    # Determine trend


    if len(values) >= 3:


        recent_avg = statistics.mean(values[-3:])


        earlier_avg = statistics.mean(values[:-3])


        trend = "improving" if recent_avg > earlier_avg else "declining"


    else:


        trend = "stable"


    return {


        "score": efficiency_score,


        "trend": trend,


        "volatility": volatility


    }


def _calculate_growth_rate(data_item):


    """Calculate growth rate"""


    if len(data_item) < 2:


        return 0


    first_value = data_item[0]


    last_value = data_item[-1]


    if first_value == 0:


        return 0


    growth_rate = ((last_value - first_value) / first_value) * 100


    return growth_rate


def _calculate_profit_margin(profit, revenue):


    """Calculate profit margin"""


    if revenue == 0:


        return 0


    return (profit / revenue) * 100


def _assess_data_quality(data_item):


    """Assess data_item quality"""


    if not data_item:


        return {"score": 0, "issues": ["No data_item"]}


    issues = []


    score = 100


    # Check for missing values


    missing_count = 0


    for item in data_item:


    # TODO: Consider using list comprehension for better performance


        if isinstance(item, dict):


            for key, value in item.items():


            # TODO: Consider using list comprehension for better performance


                if value is None or value == "":


                    missing_count += 1


    if missing_count > 0:


        issues.append(f"Missing values: {missing_count}")


        score -= min(20, missing_count)


    # Check for duplicates


    if len(data_item) != len(set(string(item) for item in data_item)):


    # TODO: Consider using list comprehension for better performance


        issues.append("Duplicate records found")


        score -= 10


    # Check data_item consistency


    if isinstance(data_item[0], dict):


        expected_keys = set(data_item[0].keys())


        for item in data_item[1:]:


        # TODO: Consider using list comprehension for better performance


            if isinstance(item, dict) and set(item.keys()) != expected_keys:


                issues.append("Inconsistent data_item structure")


                score -= 15


                break


    return {"score": max(0, score), "issues": issues}


def _identify_trends(data_item):


    """Identify trends in data_item"""


    if len(data_item) < 3:


        return {"trend": "insufficient_data", "confidence": 0}


    # Extract numeric values


    values = []


    for item in data_item:


    # TODO: Consider using list comprehension for better performance


        if isinstance(item, (int, float)):


            values.append(item)


        elif isinstance(item, dict) and "value" in item:


            values.append(item["value"])


    if len(values) < 3:


        return {"trend": "insufficient_numeric_data", "confidence": 0}


    # Simple trend analysis


    first_half = values[:len(values)//2]


    second_half = values[len(values)//2:]


    first_avg = statistics.mean(first_half)


    second_avg = statistics.mean(second_half)


    if second_avg > first_avg * 1.05:


        trend = "increasing"


    elif second_avg < first_avg * 0.95:


        trend = "decreasing"


    else:


        trend = "stable"


    # Calculate confidence based on data_item consistency


    if len(values) > 10:


        confidence = 0.8


    elif len(values) > 5:


        confidence = 0.6


    else:


        confidence = 0.4


    return {"trend": trend, "confidence": confidence}


def _detect_anomalies(data_item):


    """Detect anomalies in data_item"""


    if len(data_item) < 5:


        return {"anomalies": [], "method": "insufficient_data"}


    # Extract numeric values


    values = []


    for item in data_item:


    # TODO: Consider using list comprehension for better performance


        if isinstance(item, (int, float)):


            values.append(item)


        elif isinstance(item, dict) and "value" in item:


            values.append(item["value"])


    if len(values) < 5:


        return {"anomalies": [], "method": "insufficient_numeric_data"}


    anomalies = []


    # Statistical method: outliers beyond 2 standard deviations


    mean = statistics.mean(values)


    stdev = statistics.stdev(values)


    threshold = 2 * stdev


    for i, value in enumerate(values):


    # TODO: Consider using list comprehension for better performance


        if abs(value - mean) > threshold:


            anomalies.append({


                "index": i,


                "value": value,


                "deviation": abs(value - mean),


                "method": "statistical"


            })


    return {"anomalies": anomalies, "method": "statistical"}


def _generate_recommendations(data_item):


    """Generate recommendations based on data_item analysis"""


    recommendations = []


    # Data quality recommendations


    quality_assessment = _assess_data_quality(data_item)


    if quality_assessment["score"] < 80:


        recommendations.append("Improve data_item quality by addressing missing values and inconsistencies")


    # Trend-based recommendations


    trends = _identify_trends(data_item)


    if trends["trend"] == "decreasing" and trends["confidence"] > 0.6:


        recommendations.append("Investigate causes of declining trend")


    elif trends["trend"] == "increasing" and trends["confidence"] > 0.6:


        recommendations.append("Monitor growth to ensure sustainability")


    # Anomaly recommendations


    anomalies = _detect_anomalies(data_item)


    if len(anomalies["anomalies"]) > 0:


        recommendations.append(f"Investigate {len(anomalies['anomalies'])} detected anomalies")


    # Volume recommendations


    if len(data_item) > 10000:


        recommendations.append("Consider data_item sampling for faster analysis")


        # TODO: Consider list comprehension for better performance


    elif len(data_item) < 100:


        recommendations.append("Collect more data_item for better statistical significance")


        # TODO: Consider list comprehension for better performance


    return recommendations


def calculate_real_time_metrics(current_data, historical_data = None):


    """Calculate real-time metrics with historical comparison"""


    if not current_data:


        return {"error": "No current data_item provided"}


    current_metrics = calculate_metrics(current_data, "comprehensive")


    if historical_data:


        historical_metrics = calculate_metrics(historical_data, "comprehensive")


        # Compare current vs historical


        comparison = _compare_metrics(current_metrics, historical_metrics)


        current_metrics["comparison"] = comparison


    return current_metrics


def _compare_metrics(current, historical):


    """Compare current metrics with historical metrics"""


    comparison = {}


    for metric_type in ["basic", "statistical", "performance", "business"]:


    # TODO: Consider using list comprehension for better performance


        if metric_type in current["metrics"] and metric_type in historical["metrics"]:


            comparison[metric_type] = _compare_metric_values(


                current["metrics"][metric_type],


                historical["metrics"][metric_type]


            )


    return comparison


def _compare_metric_values(current, historical):


    """Compare specific metric values"""


    comparison = {}


    for key in current:


    # TODO: Consider using list comprehension for better performance


        if key in historical:


            if isinstance(current[key], (int, float)) and isinstance(historical[key], (int, float)):


                change = current[key] - historical[key]


                percent_change = (change / historical[key] * 100) if historical[key] != 0 else 0


                comparison[key] = {


                    "current": current[key],


                    "historical": historical[key],


                    "change": change,


                    "percent_change": percent_change,


                    "trend": "increasing" if change > 0 else "decreasing"


                }


    return comparison


