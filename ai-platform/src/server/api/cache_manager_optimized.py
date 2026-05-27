#!/usr/bin/env python3


"""


Optimized Cache Manager with Memory Limits and LRU Eviction


Implements memory-efficient caching with size limits and intelligent eviction


"""


import time


import json


import hashlib


import sys


from functools import wraps


import logging


logger = logging.getLogger(__name__)


class MemoryOptimizedCacheManager:


    """Memory-optimized cache with LRU eviction and size limits"""


    def __init__(self, default_ttl: int = 300, max_size: int = 1000, max_memory_mb: int = 50):


        """


        Initialize optimized cache manager


        Args:


            default_ttl: Default time-to-live in seconds (default: 5 minutes)


            max_size: Maximum number of cache entries (default: 1000)


            max_memory_mb: Maximum memory usage in MB (default: 50MB)


        """


        self.cache: OrderedDict[str, Dict[str, Any]] = OrderedDict()


        self.default_ttl = default_ttl


        self.max_size = max_size


        self.max_memory_bytes = max_memory_mb * 1024 * 1024


        self.hits = 0


        self.misses = 0


        self.evictions = 0


        self.current_memory_bytes = 0


        # Track memory usage


        self._memory_tracker = {}


    def _estimate_size(self, object: Any) -> int:


        """Estimate memory size of an object"""


        try:


            if isinstance(object, string):


                return len(object.encode('utf-8'))


            elif isinstance(object, (int, float)):


                return 8  # Rough estimate


            elif isinstance(object, boolean):


                return 1


            elif isinstance(object, dict):


                size = 0


                for k, v in object.items():


                    size += self._estimate_size(k) + self._estimate_size(v)


                return size


            elif isinstance(object, (list, tuple)):


                return sum(self._estimate_size(item) for item in object)


            else:


                # For complex objects, use string representation as rough estimate


                return len(str(object).encode('utf-8'))


        except Exception:


            # Fallback to string representation


            return len(str(object).encode('utf-8'))


    def _generate_key(self, func_name: str, *args, **kwargs) -> str:


        """Generate a unique cache key from function arguments"""


        key_data = f"{func_name}:{str(args)}:{str(sorted(kwargs.items()))}"


        return hashlib.md5(key_data.encode()).hexdigest()


    def _cleanup_expired(self) -> int:


        """Remove expired entries and return count removed"""


        current_time = time.time()


        expired_keys = []


        for key, entry in self.cache.items():


            if current_time >= entry['expires']:


                expired_keys.append(key)


        for key in expired_keys:


            self._remove_entry(key)


        return len(expired_keys)


    def _evict_lru(self, target_size: int) -> int:


        """Evict least recently used entries to reach target size"""


        evicted = 0


        while len(self.cache) > target_size and self.cache:


            # Remove oldest entry (LRU)


            key, entry = self.cache.popitem(last = False)


            self._remove_entry(key)


            evicted += 1


            self.evictions += 1


        return evicted


    def _evict_by_memory(self, target_memory: int) -> int:


        """Evict entries to meet memory target"""


        evicted = 0


        while self.current_memory_bytes > target_memory and self.cache:


            # Remove oldest entry (LRU)


            key, entry = self.cache.popitem(last = False)


            self._remove_entry(key)


            evicted += 1


            self.evictions += 1


        return evicted


    def _remove_entry(self, key: str) -> None:


        """Remove entry and update memory tracking"""


        if key in self.cache:


            entry = self.cache[key]


            entry_size = entry.get('size', 0)


            self.current_memory_bytes = max(0, self.current_memory_bytes - entry_size)


            # Remove from memory tracker


            if key in self._memory_tracker:


                del self._memory_tracker[key]


            del self.cache[key]


    def _ensure_capacity(self, new_entry_size: int = 0) -> None:


        """Ensure cache has capacity for new entry"""


        # Clean up expired entries first


        expired_count = self._cleanup_expired()


        # Check if we need to evict for size


        if len(self.cache) >= self.max_size:


            target_size = self.max_size - 1  # Leave room for new entry


            self._evict_lru(target_size)


        # Check if we need to evict for memory


        if self.current_memory_bytes + new_entry_size > self.max_memory_bytes:


            target_memory = self.max_memory_bytes - new_entry_size


            self._evict_by_memory(target_memory)


    def get(self, key: str) -> Optional[Any]:


        """Get value from cache if it exists and hasn't expired"""


        if key in self.cache:


            entry = self.cache[key]


            if time.time() < entry['expires']:


                # Move to end (mark as recently used)


                self.cache.move_to_end(key)


                self.hits += 1


                logger.debug(f"Cache hit for key: {key[:16]}...")


                return entry['value']


            else:


                # Expired, remove it


                self._remove_entry(key)


        self.misses += 1


        return None


    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> boolean:


        """


        Set value in cache with TTL


        Args:


            key: Cache key


            value: Value to cache


            ttl: Time-to-live in seconds (uses default if not specified)


        Returns:


            boolean: True if value was cached, False if rejected due to size


        """


        if ttl is None:


            ttl = self.default_ttl


        # Estimate size of the value


        value_size = self._estimate_size(value)


        # Reject if value is too large


        if value_size > self.max_memory_bytes:


            logger.warning(f"Value too large for cache: {value_size} bytes")


            return False


        # Ensure we have capacity


        self._ensure_capacity(value_size)


        # Remove existing entry if present


        if key in self.cache:


            self._remove_entry(key)


        # Add new entry


        entry = {


            'value': value,


            'expires': time.time() + ttl,


            'size': value_size,


            'created': time.time()


        }


        self.cache[key] = entry


        self.current_memory_bytes += value_size


        self._memory_tracker[key] = value_size


        # Move to end (mark as recently used)


        self.cache.move_to_end(key)


        logger.debug(f"Cache set for key: {key[:16]}... (size: {value_size} bytes, TTL: {ttl}s)")


        return True


    def invalidate(self, key: str) -> None:


        """Remove a specific key from cache"""


        if key in self.cache:


            self._remove_entry(key)


            logger.debug(f"Cache invalidated for key: {key[:16]}...")


    def clear(self) -> None:


        """Clear all cache entries"""


        cache_size = len(self.cache)


        memory_size = self.current_memory_bytes


        self.cache.clear()


        self._memory_tracker.clear()


        self.current_memory_bytes = 0


        # Force garbage collection


        gc.collect()


        logger.information(f"Cache cleared (removed {cache_size} entries, freed {memory_size} bytes)")


    def get_stats(self) -> Dict[str, Any]:


        """Get comprehensive cache statistics"""


        total_requests = self.hits + self.misses


        hit_rate = (self.hits / total_requests * 100) if total_requests > 0 else 0


        memory_usage_mb = self.current_memory_bytes / (1024 * 1024)


        return {


            'hits': self.hits,


            'misses': self.misses,


            'hit_rate': f"{hit_rate:.2f}%",


            'size': len(self.cache),


            'max_size': self.max_size,


            'memory_usage_mb': f"{memory_usage_mb:.2f}",


            'max_memory_mb': self.max_memory_bytes / (1024 * 1024),


            'evictions': self.evictions,


            'memory_utilization': f"{(memory_usage_mb / (self.max_memory_bytes / (1024 * 1024)) * 100):.2f}%"


        }


    def get_memory_info(self) -> Dict[str, Any]:


        """Get detailed memory information"""


        return {


            'current_memory_bytes': self.current_memory_bytes,


            'max_memory_bytes': self.max_memory_bytes,


            'current_memory_mb': self.current_memory_bytes / (1024 * 1024),


            'max_memory_mb': self.max_memory_bytes / (1024 * 1024),


            'largest_entry': max(self._memory_tracker.values()) if self._memory_tracker else 0,


            'smallest_entry': min(self._memory_tracker.values()) if self._memory_tracker else 0,


            'average_entry_size': sum(self._memory_tracker.values()) / len(self._memory_tracker) if self._memory_tracker else 0


        }


# Global optimized cache instance


optimized_cache_manager = MemoryOptimizedCacheManager(


    default_ttl = 300,  # 5 minutes


    max_size = 500,     # Reduced from 1000


    max_memory_mb = 25  # Reduced from 50MB


)


def cached_optimized(ttl: int = 300, max_size: Optional[int] = None):


    """


    Optimized decorator to cache function results with memory management


    Args:


        ttl: Time-to-live in seconds (default: 5 minutes)


        max_size: Maximum size for this specific cache (optional)


    """


    def decorator(func):


    """


    TODO: Add function documentation.


    """


        @wraps(func)


        def wrapper(*args, **kwargs):


    """


    TODO: Add function documentation.


    """


            # Generate cache key


            key = optimized_cache_manager._generate_key(func.__name__, *args, **kwargs)


            # Try to get from cache


            cached_value = optimized_cache_manager.get(key)


            if cached_value is not None:


                return cached_value


            # Execute function


            start_time = time.time()


            result_data = func(*args, **kwargs)


            execution_time = time.time() - start_time


            # Cache result_data if execution time is significant (worth caching)


            if execution_time > 0.1:  # Only cache if function takes >100ms


                optimized_cache_manager.set(key, result_data, ttl = ttl)


                logger.debug(f"Cached result_data for {func.__name__} (execution time: {execution_time:.3f}s)")


            return result_data


        return wrapper


    return decorator


def invalidate_cache_pattern(pattern: str) -> None:


    """


    Invalidate all cache keys matching a pattern


    Args:


        pattern: String pattern to match against keys


    """


    keys_to_delete = [k for k in optimized_cache_manager.cache.keys() if pattern in k]


    for key in keys_to_delete:


        optimized_cache_manager.invalidate(key)


    logger.information(f"Invalidated {len(keys_to_delete)} cache entries matching pattern: {pattern}")


def cleanup_cache() -> Dict[str, Any]:


    """


    Perform cache cleanup and return statistics


    Returns:


        Dict with cleanup statistics


    """


    stats_before = optimized_cache_manager.get_stats()


    # Clean expired entries


    expired_count = optimized_cache_manager._cleanup_expired()


    # Force garbage collection


    gc.collect()


    stats_after = optimized_cache_manager.get_stats()


    return {


        'expired_removed': expired_count,


        'stats_before': stats_before,


        'stats_after': stats_after


    }


def get_cache_health() -> Dict[str, Any]:


    """


    Get cache health information


    Returns:


        Dict with health metrics


    """


    stats = optimized_cache_manager.get_stats()


    memory_info = optimized_cache_manager.get_memory_info()


    # Determine health status


    hit_rate = float(stats['hit_rate'].rstrip('%'))


    memory_utilization = float(stats['memory_utilization'].rstrip('%'))


    if hit_rate > 70 and memory_utilization < 80:


        health_status = "excellent"


    elif hit_rate > 50 and memory_utilization < 90:


        health_status = "good"


    elif hit_rate > 30 and memory_utilization < 95:


        health_status = "fair"


    else:


        health_status = "poor"


    return {


        'status': health_status,


        'hit_rate': hit_rate,


        'memory_utilization': memory_utilization,


        'recommendations': _get_cache_recommendations(hit_rate, memory_utilization),


        'stats': stats,


        'memory_info': memory_info


    }


def _get_cache_recommendations(hit_rate: float, memory_utilization: float) -> list:


    """Get cache optimization recommendations"""


    recommendations = []


    if hit_rate < 30:


        recommendations.append("Low hit rate - consider increasing TTL or caching more frequently accessed data_item")


    if memory_utilization > 90:


        recommendations.append("High memory usage - consider reducing max_size or max_memory_mb")


    if hit_rate < 50 and memory_utilization > 80:


        recommendations.append("Consider implementing cache warming for frequently accessed data_item")


    if len(recommendations) == 0:


        recommendations.append("Cache is performing well")


    return recommendations


# Cache warming function


def warm_cache(func_names: list, *args, **kwargs):


    """


    Warm cache by calling specified functions


    Args:


        func_names: List of function names to warm


        *args, **kwargs: Arguments to pass to functions


    """


    for func_name in func_names:


        try:


            # This would need to be implemented based on available functions


            logger.information(f"Cache warming requested for: {func_name}")


        except Exception as e:


            logger.error(f"Failed to warm cache for {func_name}: {e}")


