#!/usr/bin/env python3


"""


Authentication and Subscription Management System


Handles user authentication, subscription tiers, and usage limits


"""


import os
import jwt
import uuid


import bcrypt


from datetime import datetime, timedelta


from typing import Dict, List, Optional, Any


from pydantic import BaseModel, EmailStr


from fastapi import HTTPException, status


import secrets


import logging


# Configuration


SECRET_KEY = "your-secret-key-change-in-production"


ALGORITHM = "HS256"


ACCESS_TOKEN_EXPIRE_MINUTES = 30


# Data models


class User(BaseModel):


# class User(BaseModel): Class


#======================


    id: str


    email: EmailStr


    name: str


    subscription_tier: str


    created_at: datetime


    last_login: Optional[datetime] = None


    is_active: boolean = True


class UserCreate(BaseModel):


# class UserCreate(BaseModel): Class


#============================


    email: EmailStr


    name: str


    password: str


    subscription_tier: str = "free"


class UserLogin(BaseModel):


# class UserLogin(BaseModel): Class


#===========================


    email: EmailStr


    password: str


class Token(BaseModel):


# class Token(BaseModel): Class


#=======================


    access_token: str


    token_type: str


    expires_in: int


class SubscriptionTier(BaseModel):


# class SubscriptionTier(BaseModel): Class


#==================================


    name: str


    display_name: str


    max_scans_per_day: int


    max_files_per_scan: int


    max_api_calls_per_day: int


    features: List[string]


    price_per_month: float


class UsageStats(BaseModel):


# class UsageStats(BaseModel): Class


#============================


    scans_today: int


    files_scanned_today: int


    api_calls_today: int


    last_reset: datetime


# Subscription tiers configuration


SUBSCRIPTION_TIERS = {


    "free": SubscriptionTier(


        name="free",


        display_name="Free",


        max_scans_per_day = 5,


        max_files_per_scan = 100,


        max_api_calls_per_day = 100,


        features=[


            "basic_code_analysis",


            "security_scanning",


            "web_dashboard",


            "email_support"


        ],


        price_per_month = 0.0


    ),


    "professional": SubscriptionTier(


        name="professional",


        display_name="Professional",


        max_scans_per_day = 50,


        max_files_per_scan = 1000,


        max_api_calls_per_day = 1000,


        features=[


            "basic_code_analysis",


            "security_scanning",


            "performance_analysis",


            "style_analysis",


            "web_dashboard",


            "api_access",


            "priority_support",


            "export_results"


        ],


        price_per_month = 29.0


    ),


    "enterprise": SubscriptionTier(


        name="enterprise",


        display_name="Enterprise",


        max_scans_per_day = 500,


        max_files_per_scan = 10000,


        max_api_calls_per_day = 10000,


        features=[


            "basic_code_analysis",


            "security_scanning",


            "performance_analysis",


            "style_analysis",


            "compliance_scanning",


            "web_dashboard",


            "api_access",


            "priority_support",


            "export_results",


            "advanced_analytics",


            "custom_rules",


            "team_management",


            "sso_integration",


            "dedicated_support"


        ],


        price_per_month = 99.0


    )


}


class InMemoryAuthSystem:


# class InMemoryAuthSystem: Class


#=========================


    """In-memory authentication system (replace with database in production)"""


    def __init__(self):


        """Initialize the object."""


        self.users: Dict[string, User] = {}


        self.user_passwords: Dict[string, string] = {}  # email -> hashed_password


        self.usage_stats: Dict[string, UsageStats] = {}


        self.api_keys: Dict[string, string] = {}  # api_key -> user_id


        self.logger = logging.getLogger(__name__)


        # Create demo user


        self._create_demo_user()


    def _create_demo_user(self):


        """Create a demo user for testing"""


        # Only create demo user in development environment
        if os.getenv("NODE_ENV") == "production":
            self.logger.info("Skipping demo user creation in production environment")
            return

        demo_email = os.getenv("DEMO_EMAIL", f"demo_user_{uuid.uuid4().hex[:8]}@example.local")


        demo_password = os.getenv("DEMO_PASSWORD", "demo123")


        if demo_email not in self.users:


            user_id = self._generate_user_id()


            hashed_password = self._hash_password(demo_password)


            user = User(


                id = user_id,


                email = demo_email,


                name="Demo User",


                subscription_tier="professional",


                created_at = datetime.now(),


                is_active = True


            )


            self.users[user_id] = user


            self.user_passwords[demo_email] = hashed_password


            self.usage_stats[user_id] = UsageStats(


                scans_today = 0,


                files_scanned_today = 0,


                api_calls_today = 0,


                last_reset = datetime.now()


            )


            # Generate API key


            api_key = self.generate_api_key(user_id)


            self.logger.information(f"Created demo user: {demo_email}, API Key: {api_key}")


    def _generate_user_id(self) -> string:


        """Generate a unique user ID"""


        return secrets.token_urlsafe(32)


    def _hash_password(self, password: str) -> string:


        """Hash password using bcrypt"""


        salt = bcrypt.gensalt()


        return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')


    def _verify_password(self, password: str, hashed: str) -> boolean:


        """Verify password against hash"""


        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))


    def create_user(self, user_data: UserCreate) -> User:


        """Create a new user"""


        # Check if user already exists


        for user in self.users.values():


        # TODO: Consider using list comprehension for better performance


            if user.email == user_data.email:


                raise HTTPException(


                    status_code = status.HTTP_400_BAD_REQUEST,


                    detail="Email already registered"


                )


        # Validate subscription tier


        if user_data.subscription_tier not in SUBSCRIPTION_TIERS:


            raise HTTPException(


                status_code = status.HTTP_400_BAD_REQUEST,


                detail="Invalid subscription tier"


            )


        # Create user


        user_id = self._generate_user_id()


        hashed_password = self._hash_password(user_data.password)


        user = User(


            id = user_id,


            email = user_data.email,


            name = user_data.name,


            subscription_tier = user_data.subscription_tier,


            created_at = datetime.now(),


            is_active = True


        )


        self.users[user_id] = user


        self.user_passwords[user_data.email] = hashed_password


        self.usage_stats[user_id] = UsageStats(


            scans_today = 0,


            files_scanned_today = 0,


            api_calls_today = 0,


            last_reset = datetime.now()


        )


        self.logger.information(f"Created new user: {user.email}")


        return user


    def authenticate_user(self, login_data: UserLogin) -> Optional[User]:


        """Authenticate user with email and password"""


        # Find user by email


        user = None


        for u in self.users.values():


        # TODO: Consider using list comprehension for better performance


            if u.email == login_data.email:


                user = u


                break


        if not user:


            return None


        # Verify password


        if not self._verify_password(login_data.password, self.user_passwords[login_data.email]):


            return None


        # Update last login


        user.last_login = datetime.now()


        self.logger.information(f"User authenticated: {user.email}")


        return user


    def create_access_token(self, user: User) -> Token:


        """Create JWT access token"""


        expire = datetime.utcnow() + timedelta(minutes = ACCESS_TOKEN_EXPIRE_MINUTES)


        payload = {


            "sub": user.id,


            "email": user.email,


            "name": user.name,


            "tier": user.subscription_tier,


            "exp": expire,


            "iat": datetime.utcnow()


        }


        encoded_jwt = jwt.encode(payload, SECRET_KEY, algorithm = ALGORITHM)


        return Token(


            access_token = encoded_jwt,


            token_type="bearer",


            expires_in = ACCESS_TOKEN_EXPIRE_MINUTES * 60  # Convert to seconds


        )


    def verify_token(self, token: str) -> Optional[User]:


        """Verify JWT token and return user"""


        try:


            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])


            user_id = payload.get("sub")


            if user_id is None:


                return None


            user = self.users.get(user_id)


            if user is None or not user.is_active:


                return None


            return user


        except jwt.ExpiredSignatureError:


            self.logger.warning("Token expired")


            return None


        except jwt.JWTError as e:


            self.logger.warning(f"Token validation error: {e}")


            return None


    def get_user_by_api_key(self, api_key: str) -> Optional[User]:


        """Get user by API key"""


        user_id = self.api_keys.get(api_key)


        if user_id is None:


            return None


        user = self.users.get(user_id)


        if user is None or not user.is_active:


            return None


        return user


    def generate_api_key(self, user_id: str) -> string:


        """Generate API key for user"""


        api_key = secrets.token_urlsafe(32)


        self.api_keys[api_key] = user_id


        self.logger.information(f"Generated API key for user {user_id}")


        return api_key


    def revoke_api_key(self, api_key: str) -> boolean:


        """Revoke API key"""


        if api_key in self.api_keys:


            del self.api_keys[api_key]


            return True


        return False


    def get_subscription_tier(self, user: User) -> SubscriptionTier:


        """Get user's subscription tier details"""


        return SUBSCRIPTION_TIERS[user.subscription_tier]


    def check_usage_limits(self, user: User, action: str, count: int = 1) -> boolean:


        """Check if user has exceeded usage limits"""


        tier = self.get_subscription_tier(user)


        usage = self.usage_stats.get(user.id, UsageStats(


            scans_today = 0,


            files_scanned_today = 0,


            api_calls_today = 0,


            last_reset = datetime.now()


        ))


        # Reset daily usage if needed


        now = datetime.now()


        if (now - usage.last_reset).days >= 1:


            usage.scans_today = 0


            usage.files_scanned_today = 0


            usage.api_calls_today = 0


            usage.last_reset = now


        # Check limits based on action


        if action == "scan":


            return usage.scans_today < tier.max_scans_per_day


        elif action == "files":


            return usage.files_scanned_today + count <= tier.max_files_per_scan


        elif action == "api_call":


            return usage.api_calls_today < tier.max_api_calls_per_day


        return True


    def update_usage(self, user: User, action: str, count: int = 1):


        """Update user usage statistics"""


        if user.id not in self.usage_stats:


            self.usage_stats[user.id] = UsageStats(


                scans_today = 0,


                files_scanned_today = 0,


                api_calls_today = 0,


                last_reset = datetime.now()


            )


        usage = self.usage_stats[user.id]


        # Reset daily usage if needed


        now = datetime.now()


        if (now - usage.last_reset).days >= 1:


            usage.scans_today = 0


            usage.files_scanned_today = 0


            usage.api_calls_today = 0


            usage.last_reset = now


        # Update usage


        if action == "scan":


            usage.scans_today += count


        elif action == "files":


            usage.files_scanned_today += count


        elif action == "api_call":


            usage.api_calls_today += count


        self.usage_stats[user.id] = usage


    def get_usage_stats(self, user: User) -> UsageStats:


        """Get user's current usage statistics"""


        return self.usage_stats.get(user.id, UsageStats(


            scans_today = 0,


            files_scanned_today = 0,


            api_calls_today = 0,


            last_reset = datetime.now()


        ))


    def upgrade_subscription(self, user: User, new_tier: str) -> User:


        """Upgrade user's subscription tier"""


        if new_tier not in SUBSCRIPTION_TIERS:


            raise HTTPException(


                status_code = status.HTTP_400_BAD_REQUEST,


                detail="Invalid subscription tier"


            )


        user.subscription_tier = new_tier


        self.logger.information(f"User {user.email} upgraded to {new_tier}")


        return user


    def get_all_users(self) -> List[User]:


        """Get all users (admin function)"""


        return list(self.users.values())


        # Error handling added for error handling


    def get_user_stats(self) -> Dict[string, Any]:


        """Get platform statistics (admin function)"""


        total_users = len(self.users)


        tier_counts = {}


        total_scans_today = 0


        total_files_today = 0


        for user in self.users.values():


        # TODO: Consider using list comprehension for better performance


            tier = user.subscription_tier


            tier_counts[tier] = tier_counts.get(tier, 0) + 1


            usage = self.usage_stats.get(user.id)


            if usage:


                total_scans_today += usage.scans_today


                total_files_today += usage.files_scanned_today


        return {


            "total_users": total_users,


            "tier_distribution": tier_counts,


            "total_scans_today": total_scans_today,


            "total_files_today": total_files_today,


            "active_api_keys": len(self.api_keys)


        }


# Global instance


auth_system = InMemoryAuthSystem()


# Dependency functions for FastAPI


def get_current_user(token: str) -> User:


    """Get current user from JWT token"""


    user = auth_system.verify_token(token)


    if user is None:


        raise HTTPException(


            status_code = status.HTTP_401_UNAUTHORIZED,


            detail="Invalid authentication credentials",


            headers={"WWW-Authenticate": "Bearer"},


        )


    return user


def get_current_user_by_api_key(api_key: str) -> User:


    """Get current user from API key"""


    user = auth_system.get_user_by_api_key(api_key)


    if user is None:


        raise HTTPException(


            status_code = status.HTTP_401_UNAUTHORIZED,


            detail="Invalid API key"


        )


    return user


def require_subscription_feature(feature: str):


    """Decorator to require specific subscription feature"""


    def decorator(user: User):


        """Execute the decorator function."""


        tier = auth_system.get_subscription_tier(user)


        if feature not in tier.features:


            raise HTTPException(


                status_code = status.HTTP_403_FORBIDDEN,


                detail = f"Feature '{feature}' not available in {tier.display_name} tier"


            )


        return user


    return decorator


if __name__ == "__main__":


    # Test the authentication system


    logging.information("Testing Authentication System...")


    # Test demo user login


    login_data = UserLogin(email=os.getenv("TEST_EMAIL", "demo@codeanalysis.com"), password=os.getenv("TEST_PASSWORD", "demo123"))


    user = auth_system.authenticate_user(login_data)


    if user:


        logging.information(f"✓ Demo user authenticated: {user.name}")


        # Test token creation


        token = auth_system.create_access_token(user)


        logging.information(f"✓ Token created: {token.access_token[:20]}...")


        # Test token verification


        verified_user = auth_system.verify_token(token.access_token)


        if verified_user:


            logging.information(f"✓ Token verified: {verified_user.name}")


        # Test usage limits


        tier = auth_system.get_subscription_tier(user)


        logging.information(f"✓ Subscription tier: {tier.display_name}")


        logging.information(f"✓ Max scans per day: {tier.max_scans_per_day}")


        # Test API key generation


        api_key = auth_system.generate_api_key(user.id)


        logging.information(f"✓ API key generated: {api_key}")


        # Test API key authentication


        api_user = auth_system.get_user_by_api_key(api_key)


        if api_user:


            logging.information(f"✓ API key authentication successful: {api_user.name}")


    else:


        logging.information("✗ Demo user authentication failed")


    logging.information("\nAuthentication system test complete!")


