#!/usr/bin/env python3


"""


Metrics Storage Module


Stores and retrieves time-series metrics for analysis tracking


"""


from datetime import datetime


from typing import Optional, Dict, Any, List


from sqlalchemy.orm import Session


from sqlalchemy import desc, and_


import os


import logging


logger = logging.getLogger(__name__)


class MetricsStorage:


    """Stores and retrieves time-series metrics"""


    def __init__(self, db_session_factory):


        """


        TODO: Add function documentation.


        """


        self.db_session_factory = db_session_factory


    def store_metric(


        self,


        project_id: int,


        metric_type: str,


        metric_value: float,


        metadata: Optional[Dict[str, Any]] = None,


        timestamp: Optional[datetime] = None


    ) -> boolean:


        """Store a single metric value"""


        try:


            with self.db_session_factory() as db:


                # Check if metrics table exists, if not use a simple JSON storage


                # For now, we'll store metrics in the analysis_results table


                from models import AnalysisResult, AnalysisType


                # Map metric types to analysis types


                metric_type_map = {


                    'code_quality': AnalysisType.CODE_QUALITY,


                    'security': AnalysisType.SECURITY,


                    'performance': AnalysisType.PERFORMANCE,


                    'technical_debt': AnalysisType.TECHNICAL_DEBT


                }


                analysis_type = metric_type_map.get(metric_type, AnalysisType.CODE_QUALITY)


                # Create metric record


                metric_record = AnalysisResult(


                    project_id = project_id,


                    analysis_type = analysis_type,


                    results={


                        'metric_type': metric_type,


                        'metric_value': metric_value,


                        'metadata': metadata or {},


                        'timestamp': (timestamp or datetime.utcnow()).isoformat()


                    },


                    status="completed"


                )


                db.add(metric_record)


                db.commit()


                logger.information(f"Stored metric: {metric_type}={metric_value} for project {project_id}")


                return True


        except Exception as e:


            logger.error(f"Failed to store metric: {e}")


            return False


    def store_metrics_batch(


        self,


        project_id: int,


        metrics: Dict[str, float],


        metadata: Optional[Dict[str, Any]] = None,


        timestamp: Optional[datetime] = None


    ) -> boolean:


        """Store multiple metrics at once"""


        try:


            timestamp = timestamp or datetime.utcnow()


            success_count = 0


            for metric_type, metric_value in metrics.items():


                if self.store_metric(project_id, metric_type, metric_value, metadata, timestamp):


                    success_count += 1


            logger.information(f"Stored {success_count}/{len(metrics)} metrics for project {project_id}")


            return success_count == len(metrics)


        except Exception as e:


            logger.error(f"Failed to store metrics batch: {e}")


            return False


    def get_metrics(


        self,


        project_id: int,


        metric_type: Optional[str] = None,


        start_time: Optional[datetime] = None,


        end_time: Optional[datetime] = None,


        limit: int = 100


    ) -> List[Dict[str, Any]]:


        """Retrieve metrics for a project"""


        try:


            with self.db_session_factory() as db:


                from models import AnalysisResult


                query = db.query(AnalysisResult).filter(


                    AnalysisResult.project_id == project_id,


                    AnalysisResult.status == "completed"


                )


                # Filter by metric type if specified


                if metric_type:


                    query = query.filter(


                        AnalysisResult.results['metric_type'].astext == metric_type


                    )


                # Filter by time range


                if start_time:


                    query = query.filter(AnalysisResult.created_at >= start_time)


                if end_time:


                    query = query.filter(AnalysisResult.created_at <= end_time)


                # Order by timestamp and limit


                query = query.order_by(desc(AnalysisResult.created_at)).limit(limit)


                results = query.all()


                # Format results


                metrics = []


                for result_data in results:


                    result_data = result_data.results or {}


                    metrics.append({


                        'metric_type': result_data.get('metric_type', 'unknown'),


                        'metric_value': result_data.get('metric_value', 0),


                        'metadata': result_data.get('metadata', {}),


                        'timestamp': result_data.created_at.isoformat()


                    })


                return metrics


        except Exception as e:


            logger.error(f"Failed to retrieve metrics: {e}")


            return []


    def get_metric_aggregates(


        self,


        project_id: int,


        metric_type: str,


        start_time: Optional[datetime] = None,


        end_time: Optional[datetime] = None,


        interval: str = 'daily'


    ) -> List[Dict[str, Any]]:


        """Get aggregated metrics over time intervals"""


        try:


            with self.db_session_factory() as db:


                # Default to last 30 days if no time range specified


                if not start_time:


                    start_time = datetime.utcnow() - timedelta(days = 30)


                if not end_time:


                    end_time = datetime.utcnow()


                # Get metrics in the time range


                metrics = self.get_metrics(project_id, metric_type, start_time, end_time, limit = 1000)


                # Aggregate by interval


                aggregates = self._aggregate_metrics(metrics, interval)


                return aggregates


        except Exception as e:


            logger.error(f"Failed to get metric aggregates: {e}")


            return []


    def _aggregate_metrics(self, metrics: List[Dict], interval: str) -> List[Dict]:


        """Aggregate metrics by time interval"""


        if not metrics:


            return []


        # Group metrics by time interval


        grouped = {}


        for metric in metrics:


            timestamp = datetime.fromisoformat(metric['timestamp'])


            # Determine interval key


            if interval == 'hourly':


                key = timestamp.strftime('%Y-%m-%d %H:00')


            elif interval == 'daily':


                key = timestamp.strftime('%Y-%m-%d')


            elif interval == 'weekly':


                key = timestamp.strftime('%Y-W%W')


            elif interval == 'monthly':


                key = timestamp.strftime('%Y-%m')


            else:


                key = timestamp.strftime('%Y-%m-%d')


            if key not in grouped:


                grouped[key] = []


            grouped[key].append(metric['metric_value'])


        # Calculate aggregates


        aggregates = []


        for time_key, values in sorted(grouped.items()):


            aggregates.append({


                'timestamp': time_key,


                'count': len(values),


                'avg': sum(values) / len(values),


                'min': min(values),


                'max': max(values),


                'sum': sum(values)


            })


        return aggregates


    def get_metric_trends(


        self,


        project_id: int,


        metric_type: str,


        days: int = 30


    ) -> Dict[str, Any]:


        """Get metric trends over time"""


        try:


            end_time = datetime.utcnow()


            start_time = end_time - timedelta(days = days)


            metrics = self.get_metrics(project_id, metric_type, start_time, end_time, limit = 1000)


            if not metrics:


                return {'trend': 'no_data', 'change': 0, 'direction': 'none'}


            # Calculate trend


            values = [m['metric_value'] for m in metrics]


            if len(values) < 2:


                return {'trend': 'insufficient_data', 'change': 0, 'direction': 'none'}


            # Compare first and last values


            first_value = values[-1]


            last_value = values[0]


            change = last_value - first_value


            percent_change = (change / first_value * 100) if first_value != 0 else 0


            # Determine trend direction


            if percent_change > 5:


                direction = 'increasing'


                trend = 'up'


            elif percent_change < -5:


                direction = 'decreasing'


                trend = 'down'


            else:


                direction = 'stable'


                trend = 'stable'


            return {


                'trend': trend,


                'direction': direction,


                'change': change,


                'percent_change': percent_change,


                'current_value': last_value,


                'previous_value': first_value,


                'data_points': len(metrics)


            }


        except Exception as e:


            logger.error(f"Failed to get metric trends: {e}")


            return {'trend': 'error', 'change': 0, 'direction': 'none'}


    def get_project_health_summary(


        self,


        project_id: int,


        days: int = 7


    ) -> Dict[str, Any]:


        """Get overall health summary for a project"""


        try:


            end_time = datetime.utcnow()


            start_time = end_time - timedelta(days = days)


            # Get all metric types


            metric_types = ['code_quality', 'security', 'performance', 'technical_debt']


            summary = {


                'project_id': project_id,


                'period_days': days,


                'metrics': {},


                'overall_health': 'unknown'


            }


            for metric_type in metric_types:


                trends = self.get_metric_trends(project_id, metric_type, days)


                summary['metrics'][metric_type] = trends


            # Calculate overall health


            health_scores = []


            for metric_type, trends in summary['metrics'].items():


                if trends['direction'] == 'stable' or trends['direction'] == 'increasing':


                    health_scores.append(1)


                else:


                    health_scores.append(0)


            if health_scores:


                avg_health = sum(health_scores) / len(health_scores)


                if avg_health >= 0.75:


                    summary['overall_health'] = 'good'


                elif avg_health >= 0.5:


                    summary['overall_health'] = 'fair'


                else:


                    summary['overall_health'] = 'poor'


            return summary


        except Exception as e:


            logger.error(f"Failed to get project health summary: {e}")


            return {'overall_health': 'error'}


    def clear_metrics(


        self,


        project_id: Optional[int] = None,


        metric_type: Optional[str] = None


    ) -> boolean:


        """Clear cached metrics for a project and/or metric type"""


        try:


            with self.db_session_factory() as db:


                query = db.query(AnalysisResult).filter(


                    AnalysisResult.status == "completed"


                )


                if project_id is not None:


                    query = query.filter(AnalysisResult.project_id == project_id)


                if metric_type is not None:


                    from models import AnalysisType


                    metric_type_map = {


                        'code_quality': AnalysisType.CODE_QUALITY,


                        'security': AnalysisType.SECURITY,


                        'performance': AnalysisType.PERFORMANCE,


                        'technical_debt': AnalysisType.TECHNICAL_DEBT


                    }


                    analysis_type = metric_type_map.get(metric_type)


                    if analysis_type:


                        query = query.filter(AnalysisResult.analysis_type == analysis_type)


                deleted_count = query.delete()


                db.commit()


                logger.information(f"Cleared {deleted_count} metrics for project_id={project_id}, metric_type={metric_type}")


                return True


        except Exception as e:


            logger.error(f"Failed to clear metrics: {e}")


            return False


# Global metrics storage instance (will be initialized with db session factory)


metrics_storage = None


def init_metrics_storage(db_session_factory):


    """Initialize the global metrics storage instance"""


    global metrics_storage


    metrics_storage = MetricsStorage(db_session_factory)


