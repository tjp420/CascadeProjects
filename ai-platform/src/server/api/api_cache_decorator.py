#!/usr/bin/env python3

"""
API Cache Decorator for FastAPI Endpoints

Provides intelligent caching for frequently accessed API endpoints with:
- Automatic cache key generation based on request parameters
- TTL-based cache expiration
- Cache invalidation on data changes
- Performance monitoring
- Selective caching based on endpoint patterns
"""

import time
import hashlib
import json
import logging
from typing import Any, Optional, Dict, Callable, Union
from functools import wraps
from fastapi import Request
from datetime import datetime

logger = logging.getLogger(__name__)


class APICache:
    """Enhanced cache manager specifically for API endpoints"""
    
    def __init__(self, default_ttl: int = 300, max_size: int = 1000):
        """
        Initialize API cache
        
        Args:
            default_ttl: Default time-to-live in seconds (default: 5 minutes)
            max_size: Maximum number of entries in cache
        """
        self.cache: Dict[str, Dict[str, Any]] = {}
        self.default_ttl = default_ttl
        self.max_size = max_size
        self.hits = 0
        self.misses = 0
        self.evictions = 0
        
    def _generate_key(self, endpoint: str, params: Dict[str, Any]) -> str:
        """Generate cache key from endpoint and parameters"""
        # Sort parameters to ensure consistent key generation
        sorted_params = json.dumps(params, sort_keys=True)
        key_data = f"{endpoint}:{sorted_params}"
        return hashlib.sha256(key_data.encode()).hexdigest()
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache if it exists and hasn't expired"""
        if key in self.cache:
            entry = self.cache[key]
            if time.time() < entry['expires']:
                self.hits += 1
                logger.debug(f"API cache hit for key: {key[:16]}...")
                return entry['value']
            else:
                # Expired, remove it
                del self.cache[key]
                logger.debug(f"API cache entry expired: {key[:16]}...")
        
        self.misses += 1
        return None
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Set value in cache with TTL"""
        if ttl is None:
            ttl = self.default_ttl
        
        # Evict oldest entries if cache is full
        if len(self.cache) >= self.max_size:
            self._evict_oldest()
        
        self.cache[key] = {
            'value': value,
            'expires': time.time() + ttl,
            'created': time.time(),
            'access_count': 0
        }
        logger.debug(f"API cache set for key: {key[:16]}... (TTL: {ttl}s)")
    
    def _evict_oldest(self) -> None:
        """Evict the oldest entry from cache"""
        if not self.cache:
            return
        
        oldest_key = min(self.cache.keys(), 
                        key=lambda k: self.cache[k]['created'])
        del self.cache[oldest_key]
        self.evictions += 1
        logger.debug(f"API cache evicted oldest entry: {oldest_key[:16]}...")
    
    def invalidate_pattern(self, pattern: str) -> int:
        """Invalidate all cache keys matching a pattern"""
        keys_to_delete = [k for k in self.cache.keys() if pattern in k]
        for key in keys_to_delete:
            del self.cache[key]
        logger.info(f"API cache invalidated {len(keys_to_delete)} entries matching: {pattern}")
        return len(keys_to_delete)
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        total_requests = self.hits + self.misses
        hit_rate = (self.hits / total_requests * 100) if total_requests > 0 else 0
        
        return {
            'hits': self.hits,
            'misses': self.misses,
            'hit_rate': f"{hit_rate:.2f}%",
            'size': len(self.cache),
            'max_size': self.max_size,
            'evictions': self.evictions,
            'memory_usage_mb': self._estimate_memory_usage()
        }
    
    def _estimate_memory_usage(self) -> float:
        """Estimate memory usage in MB"""
        import sys
        total_size = sys.getsizeof(self.cache)
        for key, value in self.cache.items():
            total_size += sys.getsizeof(key) + sys.getsizeof(value)
        return total_size / (1024 * 1024)


# Global API cache instance
api_cache = APICache(default_ttl=300, max_size=1000)


def cache_api_response(ttl: int = 300, key_prefix: str = ""):
    """
    Decorator to cache API endpoint responses
    
    Args:
        ttl: Time-to-live in seconds (default: 5 minutes)
        key_prefix: Prefix for cache keys to aid in invalidation
    
    Usage:
        @cache_api_response(ttl=600, key_prefix="projects")
        async def get_projects(project_id: int):
            ...
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract endpoint name from function
            endpoint_name = f"{key_prefix}:{func.__name}" if key_prefix else func.__name
            
            # Generate cache key from parameters
            params = {k: v for k, v in kwargs.items() if k != 'request'}
            cache_key = api_cache._generate_key(endpoint_name, params)
            
            # Try to get from cache
            cached_result = api_cache.get(cache_key)
            if cached_result is not None:
                logger.info(f"API cache HIT for {endpoint_name}")
                return cached_result
            
            # Execute function
            logger.info(f"API cache MISS for {endpoint_name}")
            result = await func(*args, **kwargs)
            
            # Cache result
            api_cache.set(cache_key, result, ttl=ttl)
            
            return result
        
        return wrapper
    return decorator


def cache_get_response(ttl: int = 300, key_prefix: str = ""):
    """
    Decorator to cache GET endpoint responses (synchronous version)
    
    Args:
        ttl: Time-to-live in seconds (default: 5 minutes)
        key_prefix: Prefix for cache keys to aid in invalidation
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Extract endpoint name from function
            endpoint_name = f"{key_prefix}:{func.__name}" if key_prefix else func.__name
            
            # Generate cache key from parameters
            params = {k: v for k, v in kwargs.items() if k != 'request'}
            cache_key = api_cache._generate_key(endpoint_name, params)
            
            # Try to get from cache
            cached_result = api_cache.get(cache_key)
            if cached_result is not None:
                logger.info(f"GET cache HIT for {endpoint_name}")
                return cached_result
            
            # Execute function
            logger.info(f"GET cache MISS for {endpoint_name}")
            result = func(*args, **kwargs)
            
            # Cache result
            api_cache.set(cache_key, result, ttl=ttl)
            
            return result
        
        return wrapper
    return decorator


def invalidate_cache(key_prefix: str) -> int:
    """
    Invalidate all cache entries for a specific key prefix
    Useful when data changes and cache needs to be cleared
    
    Args:
        key_prefix: Prefix to match for cache invalidation
    
    Returns:
        Number of cache entries invalidated
    """
    return api_cache.invalidate_pattern(key_prefix)


def get_cache_stats() -> Dict[str, Any]:
    """Get current API cache statistics"""
    return api_cache.get_stats()


def clear_api_cache() -> None:
    """Clear all API cache entries"""
    size = len(api_cache.cache)
    api_cache.cache.clear()
    api_cache.hits = 0
    api_cache.misses = 0
    api_cache.evictions = 0
    logger.info(f"API cache cleared (removed {size} entries)")


# Predefined cache configurations for common endpoint types
CACHE_CONFIGS = {
    'static_data': {'ttl': 3600, 'key_prefix': 'static'},      # 1 hour for rarely changing data
    'user_data': {'ttl': 600, 'key_prefix': 'user'},            # 10 minutes for user data
    'project_data': {'ttl': 300, 'key_prefix': 'project'},      # 5 minutes for project data
    'analysis_data': {'ttl': 180, 'key_prefix': 'analysis'},    # 3 minutes for analysis results
    'metrics_data': {'ttl': 60, 'key_prefix': 'metrics'},       # 1 minute for real-time metrics
}


def cache_with_config(config_name: str):
    """
    Decorator to cache using predefined configuration
    
    Args:
        config_name: Name of the cache configuration from CACHE_CONFIGS
    
    Usage:
        @cache_with_config('project_data')
        async def get_project(project_id: int):
            ...
    """
    if config_name not in CACHE_CONFIGS:
        raise ValueError(f"Unknown cache config: {config_name}")
    
    config = CACHE_CONFIGS[config_name]
    return cache_api_response(ttl=config['ttl'], key_prefix=config['key_prefix'])