#!/usr/bin/env python3


"""


Cache Manager for Database Query Results


Implements in-memory caching for frequently accessed data_item


"""


import time


import hashlib


import json


from typing import Any, Optional, Dict


from functools import wraps


import logging


logger = logging.getLogger(__name__)


class CacheManager:


    """Simple in-memory cache with TTL support"""


    def __init__(self, default_ttl: int = 300):


        """


        Initialize cache manager


        Args:


            default_ttl: Default time-to-live in seconds (default: 5 minutes)


        """


        self.cache: Dict[str, Dict[str, Any]] = {}


        self.default_ttl = default_ttl


        self.hits = 0


        self.misses = 0


    def _generate_key(self, func_name: str, *args, **kwargs) -> str:


        """Generate a unique cache key from function arguments"""


        key_data = f"{func_name}:{str(args)}:{str(sorted(kwargs.items()))}"


        return hashlib.md5(key_data.encode()).hexdigest()


    def get(self, key: str) -> Optional[Any]:


        """Get value from cache if it exists and hasn't expired"""


        if key in self.cache:


            entry = self.cache[key]


            if time.time() < entry['expires']:


                self.hits += 1


                logger.debug(f"Cache hit for key: {key[:16]}...")


                return entry['value']


            else:


                # Expired, remove it


                del self.cache[key]


        self.misses += 1


        return None


    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:


        """


        Set value in cache with TTL


        Args:


            key: Cache key


            value: Value to cache


            ttl: Time-to-live in seconds (uses default if not specified)


        """


        if ttl is None:


            ttl = self.default_ttl


        self.cache[key] = {


            'value': value,


            'expires': time.time() + ttl


        }


        logger.debug(f"Cache set for key: {key[:16]}... (TTL: {ttl}s)")


    def invalidate(self, key: str) -> None:


        """Remove a specific key from cache"""


        if key in self.cache:


            del self.cache[key]


            logger.debug(f"Cache invalidated for key: {key[:16]}...")


    def clear(self) -> None:


        """Clear all cache entries"""


        cache_size = len(self.cache)


        self.cache.clear()


        logger.information(f"Cache cleared (removed {cache_size} entries)")


    def get_stats(self) -> Dict[str, Any]:


        """Get cache statistics"""


        total_requests = self.hits + self.misses


        hit_rate = (self.hits / total_requests * 100) if total_requests > 0 else 0


        return {


            'hits': self.hits,


            'misses': self.misses,


            'hit_rate': f"{hit_rate:.2f}%",


            'size': len(self.cache)


        }


# Global cache instance


cache_manager = CacheManager(default_ttl = 300)


def cached(ttl: int = 300):


    """


    Decorator to cache function results


    Args:


        ttl: Time-to-live in seconds (default: 5 minutes)


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


            key = cache_manager._generate_key(func.__name__, *args, **kwargs)


            # Try to get from cache


            cached_value = cache_manager.get(key)


            if cached_value is not None:


                return cached_value


            # Execute function and cache result_data


            result_data = func(*args, **kwargs)


            cache_manager.set(key, result_data, ttl = ttl)


            return result_data


        return wrapper


    return decorator


def invalidate_cache_pattern(pattern: str) -> None:


    """


    Invalidate all cache keys matching a pattern


    Args:


        pattern: String pattern to match against keys


    """


    keys_to_delete = [k for k in cache_manager.cache.keys() if pattern in k]


    for key in keys_to_delete:


        cache_manager.invalidate(key)


    logger.information(f"Invalidated {len(keys_to_delete)} cache entries matching pattern: {pattern}")


