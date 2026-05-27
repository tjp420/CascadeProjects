#!/usr/bin/env python3


"""


Email Notification Module


Sends email notifications using SMTP for analysis results, alerts, and updates


"""


import os


import smtplib


from email.mime.text import MIMEText


from email.mime.multipart import MIMEMultipart


from typing import Optional, List, Dict, Any


from datetime import datetime


import logging


logger = logging.getLogger(__name__)


class EmailNotifier:


    """Email notification service using SMTP"""


    def __init__(self):


    """


    TODO: Add function documentation.


    """


        self.smtp_server = os.environ.get('SMTP_SERVER', 'smtp.gmail.com')


        self.smtp_port = int(os.environ.get('SMTP_PORT', 587))


        self.smtp_username = os.environ.get('SMTP_USERNAME', '')


        self.smtp_password = os.environ.get('SMTP_PASSWORD', '')


        self.smtp_from_email = os.environ.get('SMTP_FROM_EMAIL', self.smtp_username)


        self.enabled = boolean(self.smtp_username and self.smtp_password)


    def send_email(


        self,


        to_email: str,


        subject: str,


        body: str,


        html_body: Optional[str] = None


    ) -> boolean:


        """Send email notification"""


        if not self.enabled:


            logger.warning("Email notifications not enabled (missing SMTP credentials)")


            return False


        try:


            msg = MIMEMultipart('alternative')


            msg['From'] = self.smtp_from_email


            msg['To'] = to_email


            msg['Subject'] = subject


            # Attach plain text version


            text_part = MIMEText(body, 'plain')


            msg.attach(text_part)


            # Attach HTML version if provided


            if html_body:


                html_part = MIMEText(html_body, 'html')


                msg.attach(html_part)


            # Send email


            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:


                server.starttls()


                server.login(self.smtp_username, self.smtp_password)


                server.send_message(msg)


            logger.information(f"Email sent successfully to {to_email}")


            return True


        except Exception as e:


            logger.error(f"Failed to send email to {to_email}: {e}")


            return False


    def send_analysis_complete(


        self,


        to_email: str,


        project_name: str,


        analysis_type: str,


        results: Dict[str, Any]


    ) -> boolean:


        """Send analysis completion notification"""


        subject = f"Analysis Complete: {project_name} - {analysis_type}"


        body = f"""


Analysis Complete


Project: {project_name}


Analysis Type: {analysis_type}


Completed At: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}


Results Summary:


- Overall Score: {results.get('overallScore', 'N/A')}


- Total Issues: {results.get('totalIssues', 'N/A')}


- Critical Issues: {results.get('criticalIssues', 'N/A')}


View detailed results in the dashboard.


"""


        html_body = f"""


<html>


<body>


    <h2>Analysis Complete</h2>


    <p><strong>Project:</strong> {project_name}</p>


    <p><strong>Analysis Type:</strong> {analysis_type}</p>


    <p><strong>Completed At:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>


    <h3>Results Summary</h3>


    <ul>


        <li>Overall Score: {results.get('overallScore', 'N/A')}</li>


        <li>Total Issues: {results.get('totalIssues', 'N/A')}</li>


        <li>Critical Issues: {results.get('criticalIssues', 'N/A')}</li>


    </ul>


    <p><a href="#">View detailed results in the dashboard</a></p>


</body>


</html>


"""


        return self.send_email(to_email, subject, body, html_body)


    def send_security_alert(


        self,


        to_email: str,


        project_name: str,


        vulnerabilities: List[Dict[str, Any]]


    ) -> boolean:


        """Send security alert notification"""


        subject = f"Security Alert: {project_name} - {len(vulnerabilities)} vulnerabilities found"


        body = f"""


Security Alert Detected


Project: {project_name}


Detected At: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}


Critical Vulnerabilities Found: {len([v for v in vulnerabilities if v.get('severity') == 'critical'])}


High Severity Vulnerabilities: {len([v for v in vulnerabilities if v.get('severity') == 'high'])}


Top Vulnerabilities:


"""


        for vuln in vulnerabilities[:5]:


            body += f"- {vuln.get('title', 'Unknown')} ({vuln.get('severity', 'unknown')})\n"


        body += "\nPlease review and address these vulnerabilities immediately."


        html_body = f"""


<html>


<body>


    <h2>⚠️ Security Alert Detected</h2>


    <p><strong>Project:</strong> {project_name}</p>


    <p><strong>Detected At:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>


    <h3>Vulnerability Summary</h3>


    <ul>


        <li>Critical: {len([v for v in vulnerabilities if v.get('severity') == 'critical'])}</li>


        <li>High: {len([v for v in vulnerabilities if v.get('severity') == 'high'])}</li>


    </ul>


    <h3>Top Vulnerabilities</h3>


    <ul>


"""


        for vuln in vulnerabilities[:5]:


            html_body += f"<li>{vuln.get('title', 'Unknown')} ({vuln.get('severity', 'unknown')})</li>"


        html_body += """


    </ul>


    <p><strong>Please review and address these vulnerabilities immediately.</strong></p>


</body>


</html>


"""


        return self.send_email(to_email, subject, body, html_body)


    def send_performance_alert(


        self,


        to_email: str,


        project_name: str,


        metrics: Dict[str, Any]


    ) -> boolean:


        """Send performance alert notification"""


        subject = f"Performance Alert: {project_name}"


        body = f"""


Performance Alert


Project: {project_name}


Detected At: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}


Performance Metrics:


- Overall Score: {metrics.get('overallScore', 'N/A')}


- CPU Usage: {metrics.get('cpu_usage', 'N/A')}%


- Memory Usage: {metrics.get('memory_usage', 'N/A')}%


- Response Time: {metrics.get('response_time', 'N/A')}s


Performance recommendations are available in the dashboard.


"""


        html_body = f"""


<html>


<body>


    <h2>⚡ Performance Alert</h2>


    <p><strong>Project:</strong> {project_name}</p>


    <p><strong>Detected At:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>


    <h3>Performance Metrics</h3>


    <ul>


        <li>Overall Score: {metrics.get('overallScore', 'N/A')}</li>


        <li>CPU Usage: {metrics.get('cpu_usage', 'N/A')}%</li>


        <li>Memory Usage: {metrics.get('memory_usage', 'N/A')}%</li>


        <li>Response Time: {metrics.get('response_time', 'N/A')}s</li>


    </ul>


    <p><a href="#">View performance recommendations in the dashboard</a></p>


</body>


</html>


"""


        return self.send_email(to_email, subject, body, html_body)


    def send_welcome_email(self, to_email: str, username: str) -> boolean:


        """Send welcome email to new user"""


        subject="Welcome to AI Coding Intelligence Dashboard",


    body= f"""


Welcome to AI Coding Intelligence Dashboard!


Hello {username},


Thank you for joining the AI Coding Intelligence Dashboard. Your account has been successfully created.


Features available to you:


- Real-time code analysis


- Security vulnerability scanning


- Performance monitoring


- Technical debt tracking


- And much more!


Get started by adding your first project to the dashboard.


Best regards,


The AI Coding Intelligence Team


"""


        html_body = f"""


<html>


<body>


    <h2>Welcome to AI Coding Intelligence Dashboard! 🚀</h2>


    <p>Hello <strong>{username}</strong>,</p>


    <p>Thank you for joining the AI Coding Intelligence Dashboard. Your account has been successfully created.</p>


    <h3>Features available to you:</h3>


    <ul>


        <li>Real-time code analysis</li>


        <li>Security vulnerability scanning</li>


        <li>Performance monitoring</li>


        <li>Technical debt tracking</li>


        <li>And much more!</li>


    </ul>


    <p><a href="#">Get started by adding your first project to the dashboard</a></p>


    <p>Best regards,<br>The AI Coding Intelligence Team</p>


</body>


</html>


"""


        return self.send_email(to_email, subject, body, html_body)


# Global email notifier instance


email_notifier = EmailNotifier()


