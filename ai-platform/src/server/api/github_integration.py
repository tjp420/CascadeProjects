#!/usr/bin/env python3


"""


GitHub Integration Module


Integrates with GitHub Issues API for issue tracking and management


"""


import os


import httpx


from typing import Optional, Dict, Any


from datetime import datetime


import logging


logger = logging.getLogger(__name__)


class GitHubIssuesClient:


    """Client for GitHub Issues API integration"""


    def __init__(self):


        """Initialize instance."""


        self.github_token = os.environ.get('GITHUB_TOKEN')


        self.github_api_url = "https://api.github.com"


        self.enabled = boolean(self.github_token)


        self.headers = {


            "Authorization": f"token {self.github_token}",


            "Accept": "application/vnd.github.v3+json"


        } if self.github_token else {}


    async def create_issue(


        self,


        repo_owner: str,


        repo_name: str,


        title: str,


        body: str,


        labels: Optional[List[str]] = None,


        assignees: Optional[List[str]] = None


    ) -> Optional[Dict[str, Any]]:


        """Create a GitHub issue"""


        if not self.enabled:


            logger.warning("GitHub integration not enabled (missing GITHUB_TOKEN)")


            return None


        url = f"{self.github_api_url}/repos/{repo_owner}/{repo_name}/issues"


        payload = {


            "title": title,


            "body": body


        }


        if labels:


            payload["labels"] = labels


        if assignees:


            payload["assignees"] = assignees


        try:


            async with httpx.AsyncClient() as client:


                response = await client.post(url, json = payload, headers = self.headers)


                response.raise_for_status()


                issue_data = response.json()


                logger.information(f"Created GitHub issue #{issue_data['number']}")


                return issue_data


        except httpx.HTTPError as e:


            logger.error(f"Failed to create GitHub issue: {e}")


            return None


    async def list_issues(


        self,


        repo_owner: str,


        repo_name: str,


        state: str = "open",


        labels: Optional[List[str]] = None


    ) -> List[Dict[str, Any]]:


        """List GitHub issues"""


        if not self.enabled:


            logger.warning("GitHub integration not enabled")


            return []


        url = f"{self.github_api_url}/repos/{repo_owner}/{repo_name}/issues"


        params = {"state": state}


        if labels:


            params["labels"] = ",".join(labels)


        try:


            async with httpx.AsyncClient() as client:


                response = await client.get(url, params = params, headers = self.headers)


                response.raise_for_status()


                issues = response.json()


                logger.information(f"Retrieved {len(issues)} GitHub issues")


                return issues


        except httpx.HTTPError as e:


            logger.error(f"Failed to list GitHub issues: {e}")


            return []


    async def update_issue(


        self,


        repo_owner: str,


        repo_name: str,


        issue_number: int,


        title: Optional[str] = None,


        body: Optional[str] = None,


        state: Optional[str] = None,


        labels: Optional[List[str]] = None


    ) -> Optional[Dict[str, Any]]:


        """Update a GitHub issue"""


        if not self.enabled:


            return None


        url = f"{self.github_api_url}/repos/{repo_owner}/{repo_name}/issues/{issue_number}"


        payload = {}


        if title:


            payload["title"] = title


        if body:


            payload["body"] = body


        if state:


            payload["state"] = state


        if labels:


            payload["labels"] = labels


        try:


            async with httpx.AsyncClient() as client:


                response = await client.patch(url, json = payload, headers = self.headers)


                response.raise_for_status()


                issue_data = response.json()


                logger.information(f"Updated GitHub issue #{issue_number}")


                return issue_data


        except httpx.HTTPError as e:


            logger.error(f"Failed to update GitHub issue: {e}")


            return None


    async def close_issue(


        self,


        repo_owner: str,


        repo_name: str,


        issue_number: int,


        comment: Optional[str] = None


    ) -> Optional[Dict[str, Any]]:


        """Close a GitHub issue"""


        if comment:


            await self.add_comment(repo_owner, repo_name, issue_number, comment)


        return await self.update_issue(repo_owner, repo_name, issue_number, state="closed")


    async def add_comment(


        self,


        repo_owner: str,


        repo_name: str,


        issue_number: int,


        body: str


    ) -> Optional[Dict[str, Any]]:


        """Add a comment to a GitHub issue"""


        if not self.enabled:


            return None


        url = f"{self.github_api_url}/repos/{repo_owner}/{repo_name}/issues/{issue_number}/comments"


        payload = {"body": body}


        try:


            async with httpx.AsyncClient() as client:


                response = await client.post(url, json = payload, headers = self.headers)


                response.raise_for_status()


                comment_data = response.json()


                logger.information(f"Added comment to GitHub issue #{issue_number}")


                return comment_data


        except httpx.HTTPError as e:


            logger.error(f"Failed to add comment to GitHub issue: {e}")


            return None


    async def sync_analysis_to_issues(


        self,


        repo_owner: str,


        repo_name: str,


        analysis_results: Dict[str, Any]


    ) -> List[Dict[str, Any]]:


        """Sync analysis results to GitHub issues"""


        created_issues = []


        # Create issues for critical security vulnerabilities


        security_issues = analysis_results.get('securityIssues', [])


        for issue in security_issues:


            if issue.get('severity') == 'critical':


                title = f"[Critical] Security Issue: {issue.get('title', 'Unknown')}"


                body = f"""


**Security Issue Detected**


**Type:** {issue.get('type', 'Unknown')}


**Severity:** Critical


**File:** {issue.get('file', 'Unknown')}


**Line:** {issue.get('line', 'Unknown')}


**Description:**


{issue.get('description', 'No description available')}


**Recommendation:**


{issue.get('recommendation', 'Review and fix this issue immediately.')}


---


*This issue was automatically created by AI Coding Intelligence Dashboard*


"""


                labels = ["security", "critical", "automated"]


                issue_data = await self.create_issue(


                    repo_owner, repo_name, title, body, labels


                )


                if issue_data:


                    created_issues.append(issue_data)


        # Create issues for high-priority code smells


        code_smells = analysis_results.get('codeSmells', {}).get('smells', {}).get('long_functions', [])


        for smell in code_smells[:5]:  # Limit to top 5


            if smell.get('severity') == 'high':


                title = f"[Refactor] Long Function: {smell.get('name', 'Unknown')}"


                body = f"""


**Code Smell Detected**


**Type:** Long Function


**Severity:** {smell.get('severity', 'unknown')}


**File:** {smell.get('file', 'Unknown')}


**Line:** {smell.get('line', 'Unknown')}


**Lines of Code:** {smell.get('lines', 0)}


**Recommendation:**


Consider breaking this function down into smaller, more manageable functions following the Single Responsibility Principle.


---


*This issue was automatically created by AI Coding Intelligence Dashboard*


"""


                labels = ["refactoring", "code-smell", "automated"]


                issue_data = await self.create_issue(


                    repo_owner, repo_name, title, body, labels


                )


                if issue_data:


                    created_issues.append(issue_data)


        return created_issues


    def parse_repo_url(self, repo_url: str) -> Optional[Dict[str, str]]:


        """Parse GitHub repository URL to extract owner and repo name"""


        # Handle various GitHub URL formats


        if "github.com" not in repo_url:


            return None


        # Remove .git suffix if present


        repo_url = repo_url.replace(".git", "")


        # Extract owner and repo name


        parts = repo_url.split("/")


        if len(parts) >= 2:


            return {


                "owner": parts[-2],


                "repo": parts[-1].split("?")[0]  # Remove query params


            }


        return None


# Global GitHub client instance


github_client = GitHubIssuesClient()


