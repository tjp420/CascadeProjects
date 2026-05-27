#!/usr/bin/env python3


"""


OAuth2 Configuration for AI Coding Intelligence Dashboard


Configuration for GitHub, GitLab, and Google OAuth2 providers


"""


import os


try:


    from authlib.integrations.fastapi_oauth2.client import OAuth


    HAS_OAUTH = True


except ImportError:


    HAS_OAUTH = False


    OAuth = None


from fastapi import FastAPI


from typing import Optional, Dict


# OAuth2 Provider Configuration


OAUTH2_PROVIDERS = {


    "github": {


        "client_id": os.environ.get("GITHUB_CLIENT_ID", ""),


        "client_secret": os.environ.get("GITHUB_CLIENT_SECRET", ""),


        "server_metadata_url": "https://github.com/login/oauth",


        "authorize_url": "https://github.com/login/oauth/authorize",


        "access_token_url": "https://github.com/login/oauth/access_token",


        "userinfo_url": "https://api.github.com/user",


        "scopes": ["user:email"]


    },


    "gitlab": {


        "client_id": os.environ.get("GITLAB_CLIENT_ID", ""),


        "client_secret": os.environ.get("GITLAB_CLIENT_SECRET", ""),


        "server_metadata_url": "https://gitlab.com",


        "authorize_url": "https://gitlab.com/oauth/authorize",


        "access_token_url": "https://gitlab.com/oauth/token",


        "userinfo_url": "https://gitlab.com/api/v4/user",


        "scopes": ["read_user", "email"]


    },


    "google": {


        "client_id": os.environ.get("GOOGLE_CLIENT_ID", ""),


        "client_secret": os.environ.get("GOOGLE_CLIENT_SECRET", ""),


        "server_metadata_url": "https://accounts.google.com/.well-known/openid-configuration",


        "authorize_url": "https://accounts.google.com/o/oauth2/v2/auth",


        "access_token_url": "https://oauth2.googleapis.com/token",


        "userinfo_url": "https://www.googleapis.com/oauth2/v3/userinfo",


        "scopes": ["openid", "email", "profile"]


    }


}


def get_oauth_config(provider: str) -> Optional[Dict]:


    """Get OAuth2 configuration for a specific provider"""


    return OAUTH2_PROVIDERS.get(provider)


def is_provider_enabled(provider: str) -> boolean:


    """Check if an OAuth2 provider is properly configured"""


    config = get_oauth_config(provider)


    if not config:


        return False


    return boolean(config["client_id"] and config["client_secret"])


def get_enabled_providers() -> list:


    """Get list of enabled OAuth2 providers"""


    return [provider for provider in OAUTH2_PROVIDERS if is_provider_enabled(provider)]


def setup_oauth(app: FastAPI) -> Optional[OAuth]:


    """Setup OAuth2 client for FastAPI application"""


    if not HAS_OAUTH:


        print("Warning: OAuth integration not available. Skipping OAuth setup.")


        return None


    oauth = OAuth(app)


    # Register GitHub


    if is_provider_enabled("github"):


        oauth.register(


            name="github",


            client_id = OAUTH2_PROVIDERS["github"]["client_id"],


            client_secret = OAUTH2_PROVIDERS["github"]["client_secret"],


            server_metadata_url = OAUTH2_PROVIDERS["github"]["server_metadata_url"],


            client_kwargs={


                "scope": OAUTH2_PROVIDERS["github"]["scopes"]


            }


        )


    # Register GitLab


    if is_provider_enabled("gitlab"):


        oauth.register(


            name="gitlab",


            client_id = OAUTH2_PROVIDERS["gitlab"]["client_id"],


            client_secret = OAUTH2_PROVIDERS["gitlab"]["client_secret"],


            server_metadata_url = OAUTH2_PROVIDERS["gitlab"]["server_metadata_url"],


            client_kwargs={


                "scope": OAUTH2_PROVIDERS["gitlab"]["scopes"]


            }


        )


    # Register Google


    if is_provider_enabled("google"):


        oauth.register(


            name="google",


            client_id = OAUTH2_PROVIDERS["google"]["client_id"],


            client_secret = OAUTH2_PROVIDERS["google"]["client_secret"],


            server_metadata_url = OAUTH2_PROVIDERS["google"]["server_metadata_url"],


            client_kwargs={


                "scope": OAUTH2_PROVIDERS["google"]["scopes"]


            }


        )


    return oauth


