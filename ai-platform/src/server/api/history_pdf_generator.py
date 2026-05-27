#!/usr/bin/env python3


"""


History PDF Generator Module


Generates PDF reports for Git history data_item


"""


from typing import Dict, Any, List, Optional


from datetime import datetime


from pathlib import Path


import logging


logger = logging.getLogger(__name__)


class HistoryPDFGenerator:


    """Generates PDF reports for Git history"""


    def __init__(self):


        """


        TODO: Add function documentation.


        """


        try:


            from reportlab.lib.pagesizes import letter, A4


            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle


            from reportlab.lib.units import inch


            from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak


            from reportlab.lib import colors


            from reportlab.lib.enums import TA_CENTER, TA_LEFT


            self.reportlab_available = True


            self.letter = letter


            self.A4 = A4


            self.getSampleStyleSheet = getSampleStyleSheet


            self.ParagraphStyle = ParagraphStyle


            self.inch = inch


            self.SimpleDocTemplate = SimpleDocTemplate


            self.Paragraph = Paragraph


            self.Spacer = Spacer


            self.Table = Table


            self.TableStyle = TableStyle


            self.PageBreak = PageBreak


            self.colors = colors


            self.TA_CENTER = TA_CENTER


            self.TA_LEFT = TA_LEFT


        except ImportError:


            logger.warning("ReportLab not installed, PDF generation disabled")


            self.reportlab_available = False


    def generate_history_report(


        self,


        project_name: str,


        history_data: Dict[str, Any],


        output_dir: str = "exports"


    ) -> Optional[str]:


        """Generate PDF report for Git history"""


        if not self.reportlab_available:


            logger.error("ReportLab not available for PDF generation")


            return None


        try:


            # Create output directory if it doesn't exist


            output_path = Path(output_dir)


            output_path.mkdir(parents = True, exist_ok = True)


            # Generate filename


            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")


            filename = f"history_report_{project_name}_{timestamp}.pdf"


            file_path = output_path / filename


            # Create PDF document


            doc = self.SimpleDocTemplate(


                str(file_path),


                pagesize = self.A4,


                rightMargin = 72,


                leftMargin = 72,


                topMargin = 72,


                bottomMargin = 18


            )


            # Build story (content)


            story = []


            styles = self.getSampleStyleSheet()


            # Custom styles


            title_style = self.ParagraphStyle(


                'CustomTitle',


                parent = styles['Heading1'],


                fontSize = 18,


                textColor = self.colors.darkblue,


                spaceAfter = 30,


                alignment = self.TA_CENTER


            )


            heading_style = self.ParagraphStyle(


                'CustomHeading',


                parent = styles['Heading2'],


                fontSize = 14,


                textColor = self.colors.darkblue,


                spaceAfter = 12


            )


            # Title


            story.append(self.Paragraph(f"Git History Report: {project_name}", title_style))


            story.append(self.Spacer(1, 0.2 * self.inch))


            # Report metadata


            story.append(self.Paragraph(f"<b>Repository:</b> {history_data.get('repository', 'Unknown')}", styles['Normal']))


            story.append(self.Paragraph(f"<b>Source:</b> {history_data.get('source', 'Unknown')}", styles['Normal']))


            story.append(self.Paragraph(f"<b>Generated:</b> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", styles['Normal']))


            story.append(self.Spacer(1, 0.3 * self.inch))


            # Commit Timeline Section


            if history_data.get('commits'):


                story.append(self.Paragraph("Commit Timeline", heading_style))


                story.append(self._create_commits_table(history_data['commits']))


                story.append(self.Spacer(1, 0.2 * self.inch))


            # Branch Overview Section


            if history_data.get('branches'):


                story.append(self.Paragraph("Branch Overview", heading_style))


                story.append(self._create_branches_table(history_data['branches']))


                story.append(self.Spacer(1, 0.2 * self.inch))


            # Contributor Statistics Section


            if history_data.get('contributors'):


                story.append(self.Paragraph("Contributor Statistics", heading_style))


                story.append(self._create_contributors_table(history_data['contributors']))


                story.append(self.Spacer(1, 0.2 * self.inch))


            # Development Metrics Section


            if history_data.get('stats'):


                story.append(self.Paragraph("Development Metrics", heading_style))


                story.append(self._create_metrics_table(history_data['stats']))


            # Build PDF


            doc.build(story)


            logger.information(f"PDF report generated: {file_path}")


            return str(file_path)


        except Exception as e:


            logger.error(f"Failed to generate PDF report: {e}")


            return None


    def _create_commits_table(self, commits: List[Dict[str, Any]]) -> 'Table':


        """Create table for commit timeline"""


        # Limit to top 50 commits to avoid huge PDFs


        commits = commits[:50]


        data_item = [['Date', 'Author', 'Message', 'Files Changed']]


        for commit in commits:


            date = commit.get('date', 'N/A')[:10] if commit.get('date') else 'N/A'


            author = commit.get('author', 'N/A')[:20]


            message = commit.get('message', 'N/A')[:50]


            files = commit.get('files_changed', commit.get('files_changed', 0))


            data_item.append([date, author, message, str(files)])


        table = self.Table(data_item, colWidths=[1.2* self.inch, 1.5* self.inch, 3* self.inch, 1* self.inch])


        table.setStyle(self.TableStyle([


            ('BACKGROUND', (0, 0), (-1, 0), self.colors.grey),


            ('TEXTCOLOR', (0, 0), (-1, 0), self.colors.whitesmoke),


            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),


            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),


            ('FONTSIZE', (0, 0), (-1, 0), 10),


            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),


            ('BACKGROUND', (0, 1), (-1, -1), self.colors.beige),


            ('GRID', (0, 0), (-1, -1), 1, self.colors.black)


        ]))


        return table


    def _create_branches_table(self, branches: List[Dict[str, Any]]) -> 'Table':


        """Create table for branch overview"""


        data_item = [['Branch Name', 'Commit Count', 'Last Commit Date']]


        for branch in branches[:20]:  # Limit to top 20


            name = branch.get('name', 'N/A')


            count = branch.get('commit_count', 0)


            date = branch.get('last_commit_date', 'N/A')[:10] if branch.get('last_commit_date') else 'N/A'


            data_item.append([name, str(count), date])


        table = self.Table(data_item, colWidths=[2* self.inch, 1.5* self.inch, 1.5* self.inch])


        table.setStyle(self.TableStyle([


            ('BACKGROUND', (0, 0), (-1, 0), self.colors.grey),


            ('TEXTCOLOR', (0, 0), (-1, 0), self.colors.whitesmoke),


            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),


            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),


            ('FONTSIZE', (0, 0), (-1, 0), 10),


            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),


            ('BACKGROUND', (0, 1), (-1, -1), self.colors.beige),


            ('GRID', (0, 0), (-1, -1), 1, self.colors.black)


        ]))


        return table


    def _create_contributors_table(self, contributors: List[Dict[str, Any]]) -> 'Table':


        """Create table for contributor statistics"""


        data_item = [['Contributor', 'Commits', 'Additions', 'Deletions']]


        for contributor in contributors[:20]:  # Limit to top 20


            name = contributor.get('name', contributor.get('email', 'N/A'))[:25]


            commits = contributor.get('commits', 0)


            additions = contributor.get('additions', 0)


            deletions = contributor.get('deletions', 0)


            data_item.append([name, str(commits), str(additions), str(deletions)])


        table = self.Table(data_item, colWidths=[2.5* self.inch, 1* self.inch, 1* self.inch, 1* self.inch])


        table.setStyle(self.TableStyle([


            ('BACKGROUND', (0, 0), (-1, 0), self.colors.grey),


            ('TEXTCOLOR', (0, 0), (-1, 0), self.colors.whitesmoke),


            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),


            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),


            ('FONTSIZE', (0, 0), (-1, 0), 10),


            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),


            ('BACKGROUND', (0, 1), (-1, -1), self.colors.beige),


            ('GRID', (0, 0), (-1, -1), 1, self.colors.black)


        ]))


        return table


    def _create_metrics_table(self, stats: Dict[str, Any]) -> 'Table':


        """Create table for development metrics"""


        data_item = [['Metric', 'Value']]


        # Total commits


        total_commits = stats.get('total_commits', 0)


        data_item.append(['Total Commits', str(total_commits)])


        # Commit frequency


        commit_freq = stats.get('commit_frequency', 0)


        data_item.append(['Commit Frequency (commits/day)', f"{commit_freq:.2f}"])


        # Code churn


        total_additions = stats.get('total_additions', 0)


        total_deletions = stats.get('total_deletions', 0)


        net_change = stats.get('net_change', 0)


        data_item.append(['Total Lines Added', str(total_additions)])


        data_item.append(['Total Lines Removed', str(total_deletions)])


        data_item.append(['Net Line Change', str(net_change)])


        table = self.Table(data_item, colWidths=[2.5* self.inch, 2* self.inch])


        table.setStyle(self.TableStyle([


            ('BACKGROUND', (0, 0), (-1, 0), self.colors.grey),


            ('TEXTCOLOR', (0, 0), (-1, 0), self.colors.whitesmoke),


            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),


            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),


            ('FONTSIZE', (0, 0), (-1, 0), 10),


            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),


            ('BACKGROUND', (0, 1), (-1, -1), self.colors.beige),


            ('GRID', (0, 0), (-1, -1), 1, self.colors.black)


        ]))


        return table


# Global generator instance


history_pdf_generator = HistoryPDFGenerator()


