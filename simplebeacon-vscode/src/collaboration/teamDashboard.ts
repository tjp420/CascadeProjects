import * as vscode from 'vscode';
import * as path from 'path';
import { designTokens } from '../designSystem';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'lead' | 'developer' | 'reviewer';
  avatar?: string;
  lastActive: Date;
  contributions: {
    issuesFixed: number;
    codeReviews: number;
    commits: number;
    qualityScore: number;
  };
}

export interface TeamMetrics {
  totalMembers: number;
  activeMembers: number;
  averageQualityScore: number;
  totalIssuesFixed: number;
  totalCodeReviews: number;
  averageResponseTime: number;
  teamProductivity: number;
  collaborationScore: number;
}

export interface TeamInsight {
  type: 'improvement' | 'concern' | 'achievement' | 'recommendation';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  actionable: boolean;
  suggestedActions: string[];
  affectedMembers: string[];
  timeframe: string;
}

export interface CollaborationActivity {
  id: string;
  type: 'code_review' | 'issue_fixed' | 'merge_request' | 'discussion' | 'knowledge_share';
  title: string;
  description: string;
  author: string;
  timestamp: Date;
  participants: string[];
  impact: 'high' | 'medium' | 'low';
  status: 'active' | 'completed' | 'pending';
}

export class TeamDashboard {
  private static instance: TeamDashboard;
  private outputChannel: vscode.OutputChannel;
  private teamMembers: TeamMember[] = [];
  private activities: CollaborationActivity[] = [];
  private insights: TeamInsight[] = [];
  private workspaceFolder: vscode.WorkspaceFolder | undefined;

  private constructor() {
    this.outputChannel = vscode.window.createOutputChannel('SimpleBeacon Team Dashboard');
  }

  static getInstance(): TeamDashboard {
    if (!TeamDashboard.instance) {
      TeamDashboard.instance = new TeamDashboard();
    }
    return TeamDashboard.instance;
  }

  async initializeTeam(workspaceFolder: vscode.WorkspaceFolder): Promise<void> {
    this.workspaceFolder = workspaceFolder;
    this.outputChannel.appendLine('👥 Initializing team dashboard...');
    
    try {
      // Load team configuration
      await this.loadTeamConfiguration();
      
      // Generate initial insights
      await this.generateTeamInsights();
      
      // Start activity monitoring
      this.startActivityMonitoring();
      
      this.outputChannel.appendLine(`✅ Team dashboard initialized with ${this.teamMembers.length} members`);
      
    } catch (error) {
      this.outputChannel.appendLine(`❌ Failed to initialize team dashboard: ${error}`);
      throw error;
    }
  }

  async addTeamMember(member: Omit<TeamMember, 'id' | 'lastActive' | 'contributions'>): Promise<TeamMember> {
    const newMember: TeamMember = {
      ...member,
      id: this.generateId(),
      lastActive: new Date(),
      contributions: {
        issuesFixed: 0,
        codeReviews: 0,
        commits: 0,
        qualityScore: 75
      }
    };

    this.teamMembers.push(newMember);
    await this.generateTeamInsights();
    
    this.outputChannel.appendLine(`➕ Added team member: ${newMember.name} (${newMember.role})`);
    
    return newMember;
  }

  async removeTeamMember(memberId: string): Promise<void> {
    const memberIndex = this.teamMembers.findIndex(m => m.id === memberId);
    if (memberIndex !== -1) {
      const removedMember = this.teamMembers[memberIndex];
      this.teamMembers.splice(memberIndex, 1);
      await this.generateTeamInsights();
      
      this.outputChannel.appendLine(`➖ Removed team member: ${removedMember.name}`);
    }
  }

  async recordActivity(activity: Omit<CollaborationActivity, 'id' | 'timestamp'>): Promise<CollaborationActivity> {
    const newActivity: CollaborationActivity = {
      id: this.generateId(),
      timestamp: new Date(),
      type: activity.type,
      title: activity.title,
      description: activity.description,
      author: activity.author,
      participants: activity.participants,
      impact: activity.impact,
      status: activity.status
    };

    this.activities.unshift(newActivity);
    
    // Keep only last 100 activities
    if (this.activities.length > 100) {
      this.activities = this.activities.slice(0, 100);
    }

    // Update member contributions
    if (activity.author) {
      const member = this.teamMembers.find(m => m.name === activity.author);
      if (member) {
        member.lastActive = new Date();
        this.updateMemberContributions(member, newActivity);
      }
    }

    await this.generateTeamInsights();
    
    return newActivity;
  }

  async getTeamMetrics(): Promise<TeamMetrics> {
    const activeMembers = this.teamMembers.filter(m => 
      (Date.now() - m.lastActive.getTime()) < 7 * 24 * 60 * 60 * 1000 // Active in last 7 days
    );

    const averageQualityScore = this.teamMembers.reduce((sum, m) => sum + m.contributions.qualityScore, 0) / this.teamMembers.length || 0;
    const totalIssuesFixed = this.teamMembers.reduce((sum, m) => sum + m.contributions.issuesFixed, 0);
    const totalCodeReviews = this.teamMembers.reduce((sum, m) => sum + m.contributions.codeReviews, 0);
    
    // Calculate team productivity (issues fixed + code reviews per member per week)
    const teamProductivity = activeMembers.length > 0 ? 
      ((totalIssuesFixed + totalCodeReviews) / activeMembers.length) : 0;
    
    // Calculate collaboration score based on activity diversity
    const collaborationScore = this.calculateCollaborationScore();

    return {
      totalMembers: this.teamMembers.length,
      activeMembers: activeMembers.length,
      averageQualityScore,
      totalIssuesFixed,
      totalCodeReviews,
      averageResponseTime: this.calculateAverageResponseTime(),
      teamProductivity,
      collaborationScore
    };
  }

  async getTeamInsights(): Promise<TeamInsight[]> {
    return [...this.insights];
  }

  async getRecentActivities(limit: number = 10): Promise<CollaborationActivity[]> {
    return this.activities.slice(0, limit);
  }

  async generateTeamReport(): Promise<string> {
    const metrics = await this.getTeamMetrics();
    const insights = await this.getTeamInsights();
    const recentActivities = await this.getRecentActivities(5);

    let report = `# Team Dashboard Report\n\n`;
    report += `**Generated**: ${new Date().toISOString()}\n`;
    report += `**Team Size**: ${metrics.totalMembers} members\n`;
    report += `**Active Members**: ${metrics.activeMembers} members\n\n`;

    // Executive Summary
    report += `## Executive Summary\n\n`;
    report += `- **Average Quality Score**: ${metrics.averageQualityScore.toFixed(1)}/100\n`;
    report += `- **Team Productivity**: ${metrics.teamProductivity.toFixed(1)} activities/member/week\n`;
    report += `- **Collaboration Score**: ${metrics.collaborationScore.toFixed(1)}/100\n`;
    report += `- **Total Issues Fixed**: ${metrics.totalIssuesFixed}\n`;
    report += `- **Total Code Reviews**: ${metrics.totalCodeReviews}\n\n`;

    // Team Members
    report += `## Team Members\n\n`;
    for (const member of this.teamMembers) {
      const isActive = (Date.now() - member.lastActive.getTime()) < 7 * 24 * 60 * 60 * 1000;
      report += `### ${member.name} (${member.role})\n`;
      report += `- **Status**: ${isActive ? '🟢 Active' : '🔴 Inactive'}\n`;
      report += `- **Quality Score**: ${member.contributions.qualityScore}/100\n`;
      report += `- **Issues Fixed**: ${member.contributions.issuesFixed}\n`;
      report += `- **Code Reviews**: ${member.contributions.codeReviews}\n`;
      report += `- **Commits**: ${member.contributions.commits}\n`;
      report += `- **Last Active**: ${member.lastActive.toLocaleDateString()}\n\n`;
    }

    // Insights
    report += `## Team Insights\n\n`;
    for (const insight of insights) {
      const icon = insight.type === 'achievement' ? '🎉' : 
                   insight.type === 'concern' ? '⚠️' : 
                   insight.type === 'improvement' ? '📈' : '💡';
      report += `### ${icon} ${insight.title}\n`;
      report += `${insight.description}\n`;
      report += `- **Impact**: ${insight.impact}\n`;
      report += `- **Timeframe**: ${insight.timeframe}\n`;
      if (insight.suggestedActions.length > 0) {
        report += `- **Suggested Actions**:\n`;
        insight.suggestedActions.forEach(action => {
          report += `  - ${action}\n`;
        });
      }
      report += `\n`;
    }

    // Recent Activities
    report += `## Recent Activities\n\n`;
    for (const activity of recentActivities) {
      const icon = activity.type === 'code_review' ? '👀' : 
                   activity.type === 'issue_fixed' ? '✅' : 
                   activity.type === 'merge_request' ? '🔀' : 
                   activity.type === 'discussion' ? '💬' : '📚';
      report += `### ${icon} ${activity.title}\n`;
      report += `- **Author**: ${activity.author}\n`;
      report += `- **Date**: ${activity.timestamp.toLocaleDateString()}\n`;
      report += `- **Status**: ${activity.status}\n`;
      report += `${activity.description}\n\n`;
    }

    return report;
  }

  private async loadTeamConfiguration(): Promise<void> {
    // Simulate loading team configuration
    // In a real implementation, this would load from a config file or API
    
    // Add some default team members for demonstration
    this.teamMembers = [
      {
        id: '1',
        name: 'John Doe',
        email: 'user-1-local',
        role: 'lead',
        lastActive: new Date(),
        contributions: {
          issuesFixed: 15,
          codeReviews: 23,
          commits: 45,
          qualityScore: 85
        }
      },
      {
        id: '2',
        name: 'Jane Smith',
        email: 'user-2-local',
        role: 'developer',
        lastActive: new Date(),
        contributions: {
          issuesFixed: 8,
          codeReviews: 12,
          commits: 28,
          qualityScore: 78
        }
      },
      {
        id: '3',
        name: 'Bob Johnson',
        email: 'user-3-local',
        role: 'developer',
        lastActive: new Date(),
        contributions: {
          issuesFixed: 12,
          codeReviews: 18,
          commits: 35,
          qualityScore: 82
        }
      }
    ];
  }

  private async generateTeamInsights(): Promise<void> {
    this.insights = [];
    const metrics = await this.getTeamMetrics();

    // Generate insights based on metrics
    if (metrics.averageQualityScore < 70) {
      this.insights.push({
        type: 'concern',
        title: 'Low Average Quality Score',
        description: `The team's average quality score is ${metrics.averageQualityScore.toFixed(1)}/100, which is below the recommended threshold of 70.`,
        impact: 'high',
        actionable: true,
        suggestedActions: [
          'Schedule code quality training sessions',
          'Implement peer review process',
          'Set quality gates for pull requests'
        ],
        affectedMembers: this.teamMembers.filter(m => m.contributions.qualityScore < 70).map(m => m.name),
        timeframe: '2 weeks'
      });
    }

    if (metrics.teamProductivity < 5) {
      this.insights.push({
        type: 'improvement',
        title: 'Low Team Productivity',
        description: `Team productivity is ${metrics.teamProductivity.toFixed(1)} activities per member per week, which could be improved.`,
        impact: 'medium',
        actionable: true,
        suggestedActions: [
          'Review workload distribution',
          'Identify bottlenecks in development process',
          'Provide productivity tools and training'
        ],
        affectedMembers: this.teamMembers.map(m => m.name),
        timeframe: '1 month'
      });
    }

    if (metrics.collaborationScore > 80) {
      this.insights.push({
        type: 'achievement',
        title: 'Excellent Team Collaboration',
        description: `The team has a collaboration score of ${metrics.collaborationScore.toFixed(1)}/100, showing great teamwork.`,
        impact: 'high',
        actionable: false,
        suggestedActions: [
          'Share best practices with other teams',
          'Document collaboration processes'
        ],
        affectedMembers: this.teamMembers.map(m => m.name),
        timeframe: 'Ongoing'
      });
    }

    // Individual member insights
    for (const member of this.teamMembers) {
      if (member.contributions.issuesFixed > 20) {
        this.insights.push({
          type: 'achievement',
          title: `High Performer: ${member.name}`,
          description: `${member.name} has fixed ${member.contributions.issuesFixed} issues, showing excellent contribution.`,
          impact: 'medium',
          actionable: true,
          suggestedActions: [
            'Consider for team lead role',
            'Mentor other team members',
            'Recognize achievements publicly'
          ],
          affectedMembers: [member.name],
          timeframe: 'Immediate'
        });
      }
    }
  }

  private startActivityMonitoring(): void {
    // Simulate activity monitoring
    // In a real implementation, this would integrate with Git, issue trackers, etc.
  }

  private updateMemberContributions(member: TeamMember, activity: CollaborationActivity): void {
    switch (activity.type) {
      case 'issue_fixed':
        member.contributions.issuesFixed++;
        break;
      case 'code_review':
        member.contributions.codeReviews++;
        break;
      case 'merge_request':
        member.contributions.commits++;
        break;
    }
  }

  private calculateCollaborationScore(): number {
    if (this.teamMembers.length === 0) return 0;

    const activityTypes = new Set(this.activities.map(a => a.type));
    const participantDiversity = this.activities.reduce((set, activity) => {
      activity.participants.forEach(p => set.add(p));
      return set;
    }, new Set<string>()).size;

    // Score based on activity diversity and participant involvement
    const diversityScore = (activityTypes.size / 5) * 50; // 5 activity types
    const involvementScore = (participantDiversity / this.teamMembers.length) * 50;

    return Math.min(100, diversityScore + involvementScore);
  }

  private calculateAverageResponseTime(): number {
    // Simulate response time calculation
    // In a real implementation, this would analyze actual response times
    return 2.5; // hours
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  public getTeamMembers(): TeamMember[] {
    return [...this.teamMembers];
  }

  public getActivities(): CollaborationActivity[] {
    return [...this.activities];
  }

  public exportTeamData(): string {
    return JSON.stringify({
      teamMembers: this.teamMembers,
      activities: this.activities,
      insights: this.insights
    }, null, 2);
  }

  public importTeamData(jsonData: string): void {
    try {
      const data = JSON.parse(jsonData);
      this.teamMembers = data.teamMembers || [];
      this.activities = data.activities || [];
      this.insights = data.insights || [];
    } catch (error) {
      this.outputChannel.appendLine(`❌ Failed to import team data: ${error}`);
    }
  }

  public dispose(): void {
    this.outputChannel.dispose();
  }
}
