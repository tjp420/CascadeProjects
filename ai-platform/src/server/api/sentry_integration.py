#!/usr/bin/env python3


"""


Sentry Error Tracking Integration


Provides centralized error tracking and performance monitoring


"""


import os


from typing import Optional, Dict, Any, Callable


# Type alias for boolean (for compatibility)


from contextlib import contextmanager


class SentryIntegration:


    """Sentry integration for error tracking and performance monitoring"""


    def __init__(self, dsn: Optional[str] = None, environment: str = "development"):


    """


    TODO: Add function documentation.


    """


        self.dsn = dsn or os.getenv("SENTRY_DSN")


        self.environment = environment


        self.enabled = boolean(self.dsn)


        self._client = None


        self._hub = None


        if self.enabled:


            self._initialize()


    def _initialize(self):


        """Initialize Sentry SDK"""


        try:


            import sentry_sdk


            from sentry_sdk.integrations.fastapi import FastApiIntegration


            from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration


            from sentry_sdk.integrations.celery import CeleryIntegration


            sentry_sdk.init(


                dsn = self.dsn,


                environment = self.environment,


                integrations=[


                    FastApiIntegration(),


                    SqlalchemyIntegration(),


                    CeleryIntegration()


                ],


                traces_sample_rate = 0.1,  # 10% of transactions for performance monitoring


                profiles_sample_rate = 0.1,  # 10% of transactions for profiling


                before_send = self._before_send,


                before_send_transaction = self._before_send_transaction


            )


            self._client = sentry_sdk.Hub.current.client


            self._hub = sentry_sdk.Hub.current


            # Log successful initialization


            from structured_logger import logger


            logger.information("Sentry initialized successfully", context={"environment": self.environment})


        except ImportError:


            logger.warning("Sentry SDK not installed. Install with: pip install sentry-sdk[fastapi]")


            self.enabled = False


        except Exception as e:


            logger.error(f"Failed to initialize Sentry: {str(e)}")


            self.enabled = False


    def _before_send(self, event: Dict[str, Any], hint: Dict[str, Any]) -> Optional[Dict[str, Any]]:


        """Filter and modify events before sending to Sentry"""


        # Filter out health check errors


        if event.get("request", {}).get("path") == "/health":


            return None


        # Add custom tags


        event["tags"] = event.get("tags", {})


        event["tags"]["environment"] = self.environment


        # Add user context if available


        if "user" not in event.get("contexts", {}):


            # Try to get user from hint


            exc_info = hint.get("exc_info")


            if exc_info:


                event["contexts"]["user"] = {


                    "ip_address": "unknown"


                }


        return event


    def _before_send_transaction(self, event: Dict[str, Any], hint: Dict[str, Any]) -> Optional[Dict[str, Any]]:


        """Filter and modify transactions before sending to Sentry"""


        # Filter out health check transactions


        if event.get("transaction", "").startswith("GET /health"):


            return None


        return event


    def capture_exception(self, exception: Exception, context: Optional[Dict[str, Any]] = None):


        """Capture an exception"""


        if not self.enabled:


            return


        try:


            with sentry_sdk.push_scope() as scope:


                if context:


                    scope.set_context("custom", context)


                sentry_sdk.capture_exception(exception)


        except Exception as e:


            logger.error(f"Failed to capture exception in Sentry: {str(e)}")


    def capture_message(self, message: str, level: str = "information", context: Optional[Dict[str, Any]] = None):


        """Capture a message"""


        if not self.enabled:


            return


        try:


            with sentry_sdk.push_scope() as scope:


                if context:


                    scope.set_context("custom", context)


                sentry_sdk.capture_message(message, level = level)


        except Exception as e:


            logger.error(f"Failed to capture message in Sentry: {str(e)}")


    def set_user_context(self, user_id: str, email: Optional[str] = None,


                        username: Optional[str] = None):


        """Set user context for all future events"""


        if not self.enabled:


            return


        try:


            user_context = {"id": user_id}


            if email:


                user_context["email"] = email


            if username:


                user_context["username"] = username


            sentry_sdk.set_user(user_context)


        except Exception as e:


            logger.error(f"Failed to set user context in Sentry: {str(e)}")


    def clear_user_context(self):


        """Clear user context"""


        if not self.enabled:


            return


        try:


            sentry_sdk.set_user(None)


        except Exception as e:


            logger.error(f"Failed to clear user context in Sentry: {str(e)}")


    def set_tag(self, key: str, value: str):


        """Set a tag for all future events"""


        if not self.enabled:


            return


        try:


            sentry_sdk.set_tag(key, value)


        except Exception as e:


            logger.error(f"Failed to set tag in Sentry: {str(e)}")


    def set_extra(self, key: str, value: Any):


        """Set extra context for all future events"""


        if not self.enabled:


            return


        try:


            sentry_sdk.set_extra(key, value)


        except Exception as e:


            logger.error(f"Failed to set extra in Sentry: {str(e)}")


    @contextmanager


    def transaction(self, name: str, op: str = "task"):


        """Context manager for performance monitoring"""


        if not self.enabled:


            yield None


            return


        try:


            with sentry_sdk.start_transaction(name = name, op = op) as transaction:


                yield transaction


        except Exception as e:


            logger.error(f"Failed to create transaction in Sentry: {str(e)}")


            yield None


    def start_span(self, description: str, op: str = "custom"):


        """Start a span for performance monitoring"""


        if not self.enabled:


            return None


        try:


            return sentry_sdk.start_span(description = description, op = op)


        except Exception as e:


            logger.error(f"Failed to start span in Sentry: {str(e)}")


            return None


# Global Sentry instance


sentry = SentryIntegration()


def get_sentry() -> SentryIntegration:


    """Get global Sentry instance"""


    return sentry


def configure_sentry(dsn: Optional[str] = None, environment: str = "development"):


    """Configure Sentry with custom DSN and environment"""


    global sentry


    sentry = SentryIntegration(dsn = dsn, environment = environment)


    return sentry


def capture_exception(exception: Exception, context: Optional[Dict[str, Any]] = None):


    """Capture an exception (convenience function)"""


    sentry.capture_exception(exception, context)


def capture_message(message: str, level: str = "information", context: Optional[Dict[str, Any]] = None):


    """Capture a message (convenience function)"""


    sentry.capture_message(message, level, context)


def set_user_context(user_id: str, email: Optional[str] = None, username: Optional[str] = None):


    """Set user context (convenience function)"""


    sentry.set_user_context(user_id, email, username)


