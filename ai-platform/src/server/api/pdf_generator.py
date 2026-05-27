#!/usr/bin/env python3


"""


PDF Report Generation Module


Generates PDF reports for analysis results using ReportLab


"""


import os


from typing import Dict, Any, List, Optional


from datetime import datetime


from pathlib import Path


import logging


logger = logging.getLogger(__name__)


# Try to import ReportLab


try:


    from reportlab.lib.pagesizes import letter, A4


    from reportlab.lib import colors


    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle


    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak


    from reportlab.lib.units import inch


    REPORTLAB_AVAILABLE = True


except ImportError:


    REPORTLAB_AVAILABLE = False


    logger.warning("ReportLab not installed. PDF generation will be disabled.")


class PDFReportGenerator:


    """Generates PDF reports for analysis results"""


    def __init__(self):


        """TODO: Add function documentation."""


        self.enabled = REPORTLAB_AVAILABLE


    def generate_analysis_report(


        self,


        project_name: str,


        analysis_results: Dict[str, Any],


        output_path: Optional[str] = None


    ) -> Optional[str]:


        """Generate a comprehensive PDF analysis report"""


        if not self.enabled:


            logger.warning("PDF generation not enabled (ReportLab not installed)")


            return None


        if output_path is None:


            output_path = f"reports/{project_name}_analysis_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"


        try:


            # Create output directory if it doesn't exist


            Path(output_path).parent.mkdir(parents = True, exist_ok = True)


            # Create PDF document


            doc = SimpleDocTemplate(


                output_path,


                pagesize = A4,


                rightMargin = 72,


                leftMargin = 72,


                topMargin = 72,


                bottomMargin = 18


            )


            # Build story (content)


            story = []


            styles = getSampleStyleSheet()


            # Custom styles


            title_style = ParagraphStyle(


                'CustomTitle',


                parent = styles['Heading1'],


                fontSize = 24,


                textColor = colors.HexColor('#2c3e50'),


                spaceAfter = 30


            )


            heading_style = ParagraphStyle(


                'CustomHeading',


                parent = styles['Heading2'],


                fontSize = 16,


                textColor = colors.HexColor('#34495e'),


                spaceAfter = 12


            )


            # Title


            story.append(Paragraph(f"Analysis Report: {project_name}", title_style))


            story.append(Spacer(1, 12))


            # Report metadata


            story.append(Paragraph(f"<b>Generated:</b> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", styles['Normal']))


            story.append(Spacer(1, 24))


            # Overall Score


            if 'overallScore' in analysis_results:


                score = analysis_results['overallScore']


                score_color = colors.green if score >= 80 else colors.orange if score >= 60 else colors.red


                story.append(Paragraph(f"<b>Overall Score:</b> {score}/100", heading_style))


                story.append(Spacer(1, 12))


            # Code Structure Analysis


            if 'code_structure' in analysis_results:


                story.append(Paragraph("Code Structure Analysis", heading_style))


                self._add_code_structure_section(story, analysis_results['code_structure'], styles)


                story.append(Spacer(1, 12))


            # Code Quality


            if 'code_quality' in analysis_results:


                story.append(Paragraph("Code Quality Metrics", heading_style))


                self._add_code_quality_section(story, analysis_results['code_quality'], styles)


                story.append(Spacer(1, 12))


            # Security Analysis


            if 'securityScore' in analysis_results:


                story.append(Paragraph("Security Analysis", heading_style))


                self._add_security_section(story, analysis_results, styles)


                story.append(Spacer(1, 12))


            # Technical Debt


            if 'totalHours' in analysis_results:


                story.append(Paragraph("Technical Debt", heading_style))


                self._add_technical_debt_section(story, analysis_results, styles)


                story.append(Spacer(1, 12))


            # Performance Metrics


            if 'overallScore' in analysis_results and 'systemMetrics' in analysis_results:


                story.append(Paragraph("Performance Metrics", heading_style))


                self._add_performance_section(story, analysis_results, styles)


                story.append(Spacer(1, 12))


            # Recommendations


            if 'recommendations' in analysis_results:


                story.append(Paragraph("Recommendations", heading_style))


                self._add_recommendations_section(story, analysis_results['recommendations'], styles)


            # Build PDF


            doc.build(story)


            logger.information(f"PDF report generated: {output_path}")


            return output_path


        except Exception as e:


            logger.error(f"Failed to generate PDF report: {e}")


            return None


    def _add_code_structure_section(self, story: List, data_item: Dict, styles: Dict):


        """Add code structure section to PDF"""


        metrics = [


            ['Metric', 'Value'],


            ['Total Files', str(data_item.get('totalFiles', 0))],


            ['Total Lines of Code', str(data_item.get('totalLines', 0))],


            ['Languages', ', '.join(data_item.get('languages', []))],


            ['Architecture Pattern', data_item.get('architecture', 'Unknown')]


        ]


        table = Table(metrics, colWidths=[2.5*inch, 3*inch])


        table.setStyle(TableStyle([


            ('BACKGROUND', (0, 0), (0, 0), colors.grey),


            ('TEXTCOLOR', (0, 0), (0, 0), colors.whitesmoke),


            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),


            ('FONTNAME', (0, 0), (0, 0), 'Helvetica-Bold'),


            ('FONTSIZE', (0, 0), (0, 0), 12),


            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),


            ('BACKGROUND', (1, 0), (-1, -1), colors.beige),


            ('GRID', (0, 0), (-1, -1), 1, colors.black)


        ]))


        story.append(table)


    def _add_code_quality_section(self, story: List, data_item: Dict, styles: Dict):


        """Add code quality section to PDF"""


        metrics = [


            ['Metric', 'Value'],


            ['Code Quality Score', f"{data_item.get('codeQuality', 0)}%"],


            ['Test Coverage', f"{data_item.get('testCoverage', 0)}%"],


            ['Documentation Coverage', f"{data_item.get('documentation', 0)}%"],


            ['Code Duplication', f"{data_item.get('duplication', 0)}%"]


        ]


        table = Table(metrics, colWidths=[2.5*inch, 3*inch])


        table.setStyle(TableStyle([


            ('BACKGROUND', (0, 0), (0, 0), colors.grey),


            ('TEXTCOLOR', (0, 0), (0, 0), colors.whitesmoke),


            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),


            ('FONTNAME', (0, 0), (0, 0), 'Helvetica-Bold'),


            ('FONTSIZE', (0, 0), (0, 0), 12),


            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),


            ('BACKGROUND', (1, 0), (-1, -1), colors.beige),


            ('GRID', (0, 0), (-1, -1), 1, colors.black)


        ]))


        story.append(table)


    def _add_security_section(self, story: List, data_item: Dict, styles: Dict):


        """Add security section to PDF"""


        metrics = [


            ['Metric', 'Value'],


            ['Security Score', f"{data_item.get('securityScore', 0)}/100"],


            ['Total Vulnerabilities', str(data_item.get('totalVulnerabilities', 0))],


            ['Critical Issues', str(data_item.get('criticalIssues', 0))],


            ['High Severity Issues', str(data_item.get('highSeverityIssues', 0))]


        ]


        table = Table(metrics, colWidths=[2.5*inch, 3*inch])


        table.setStyle(TableStyle([


            ('BACKGROUND', (0, 0), (0, 0), colors.grey),


            ('TEXTCOLOR', (0, 0), (0, 0), colors.whitesmoke),


            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),


            ('FONTNAME', (0, 0), (0, 0), 'Helvetica-Bold'),


            ('FONTSIZE', (0, 0), (0, 0), 12),


            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),


            ('BACKGROUND', (1, 0), (-1, -1), colors.beige),


            ('GRID', (0, 0), (-1, -1), 1, colors.black)


        ]))


        story.append(table)


    def _add_technical_debt_section(self, story: List, data_item: Dict, styles: Dict):


        """Add technical debt section to PDF"""


        metrics = [


            ['Metric', 'Value'],


            ['Total Debt Hours', str(data_item.get('totalHours', 0))],


            ['Debt Level', data_item.get('level', 'Unknown')],


            ['Estimated Cost', f"${data_item.get('estimatedCost', 0):,.2f}"],


            ['Priority', data_item.get('priority', 'Unknown')]


        ]


        table = Table(metrics, colWidths=[2.5*inch, 3*inch])


        table.setStyle(TableStyle([


            ('BACKGROUND', (0, 0), (0, 0), colors.grey),


            ('TEXTCOLOR', (0, 0), (0, 0), colors.whitesmoke),


            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),


            ('FONTNAME', (0, 0), (0, 0), 'Helvetica-Bold'),


            ('FONTSIZE', (0, 0), (0, 0), 12),


            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),


            ('BACKGROUND', (1, 0), (-1, -1), colors.beige),


            ('GRID', (0, 0), (-1, -1), 1, colors.black)


        ]))


        story.append(table)


    def _add_performance_section(self, story: List, data_item: Dict, styles: Dict):


        """Add performance section to PDF"""


        system = data_item.get('systemMetrics', {})


        metrics = [


            ['Metric', 'Value'],


            ['Overall Score', f"{data_item.get('overallScore', 0)}/100"],


            ['CPU Usage', f"{system.get('cpu', {}).get('current', 0)}%"],


            ['Memory Usage', f"{system.get('memory', {}).get('current', 0)}%"],


            ['Uptime', f"{data_item.get('uptime', 0):.0f}s"]


        ]


        table = Table(metrics, colWidths=[2.5*inch, 3*inch])


        table.setStyle(TableStyle([


            ('BACKGROUND', (0, 0), (0, 0), colors.grey),


            ('TEXTCOLOR', (0, 0), (0, 0), colors.whitesmoke),


            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),


            ('FONTNAME', (0, 0), (0, 0), 'Helvetica-Bold'),


            ('FONTSIZE', (0, 0), (0, 0), 12),


            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),


            ('BACKGROUND', (1, 0), (-1, -1), colors.beige),


            ('GRID', (0, 0), (-1, -1), 1, colors.black)


        ]))


        story.append(table)


    def _add_recommendations_section(self, story: List, recommendations: List, styles: Dict):


        """Add recommendations section to PDF"""


        if not recommendations:


            story.append(Paragraph("No recommendations available.", styles['Normal']))


            return


        for i, rec in enumerate(recommendations[:10], 1):  # Limit to top 10


            priority = rec.get('priority', 'medium')


            priority_color = colors.red if priority == 'critical' else colors.orange if priority == 'high' else colors.green


            story.append(Paragraph(f"{i}. {rec.get('message', 'No message')}", styles['Normal']))


            story.append(Paragraph(f"   Priority: {priority}", ParagraphStyle(


                'Priority',


                parent = styles['Normal'],


                textColor = priority_color,


                fontSize = 10


            )))


            story.append(Spacer(1, 6))


# Global PDF generator instance


pdf_generator = PDFReportGenerator()


