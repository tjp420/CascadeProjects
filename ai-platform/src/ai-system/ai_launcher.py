#!/usr/bin/env python3
"""
AI Development Assistant Launcher
Simple interface to use AI for building the entire program
"""

import sys
import json
from pathlib import Path
from datetime import datetime

# Add the current directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

try:
    from ai_development_assistant import AIDevelopmentAssistant
except ImportError as e:
    print(f"❌ Error importing AI Development Assistant: {e}")
    print("Please ensure ai_development_assistant.py is in the same directory.")
    sys.exit(1)

def print_banner():
    """Print the AI Development Assistant banner"""
    print("🤖 AI Development Assistant")
    print("=" * 60)
    print("🚀 Your intelligent companion for building the entire program")
    print("📊 AI-powered analysis, planning, optimization, and automation")
    print("=" * 60)

def show_menu():
    """Show the main menu"""
    print("\n📋 What would you like to do?")
    print("1. 🔍 Analyze entire project")
    print("2. 📋 Generate development plan")
    print("3. ⚡ Optimize codebase with AI")
    print("4. 📚 Generate documentation")
    print("5. 📊 Create development dashboard")
    print("6. 🔄 Run continuous improvement")
    print("7. 📄 Export comprehensive report")
    print("8. 🤖 Get AI assistance (custom query)")
    print("9. 🚀 Execute development phase")
    print("0. ❌ Exit")
    print("-" * 40)

def run_analysis(assistant):
    """Run project analysis"""
    print("\n🔍 Running comprehensive project analysis...")
    
    try:
        analysis = assistant.analyze_project_structure()
        
        print(f"\n📊 Analysis Results:")
        print(f"  📁 Total Files: {analysis['structure']['total_files']}")
        print(f"  📁 Total Directories: {analysis['structure']['total_dirs']}")
        print(f"  💾 Total Size: {analysis['structure']['size_bytes'] / (1024*1024):.1f} MB")
        print(f"  🔧 Technologies: {', '.join(analysis['technologies'])}")
        print(f"  ⚠️  Issues Found: {len(analysis['issues'])}")
        print(f"  💡 Recommendations: {len(analysis['recommendations'])}")
        
        if analysis['issues']:
            print(f"\n⚠️  Top Issues:")
            for i, issue in enumerate(analysis['issues'][:5]):
                print(f"  {i+1}. {issue['description']} ({issue['severity']})")
        
        if analysis['recommendations']:
            print(f"\n💡 Top Recommendations:")
            for i, rec in enumerate(analysis['recommendations'][:5]):
                print(f"  {i+1}. {rec['title']} - {rec['description']}")
        
        input("\nPress Enter to continue...")
        
    except Exception as e:
        print(f"❌ Error during analysis: {e}")
        input("Press Enter to continue...")

def run_development_plan(assistant):
    """Generate development plan"""
    print("\n📋 Generating comprehensive development plan...")
    
    try:
        plan = assistant.generate_development_plan()
        
        print(f"\n📅 Development Plan:")
        print(f"  ⏱️  Total Duration: {plan['timeline']['total_duration_days']} days")
        print(f"  🚀 Phases: {len(plan['phases'])}")
        print(f"  👥 Team Size: {plan['resources']['developers']} developers")
        print(f"  📊 Estimated Hours: {plan['resources']['estimated_hours']}")
        
        print(f"\n🎯 Development Phases:")
        for i, phase in enumerate(plan['phases']):
            print(f"  {i+1}. {phase['name']} ({phase['duration_days']} days)")
            print(f"     Objectives: {len(phase['objectives'])}")
            print(f"     Deliverables: {len(phase['deliverables'])}")
        
        print(f"\n📈 Success Metrics:")
        for metric, target in plan['success_metrics'].items():
            print(f"  • {metric}: {target}")
        
        input("\nPress Enter to continue...")
        
    except Exception as e:
        print(f"❌ Error generating plan: {e}")
        input("Press Enter to continue...")

def run_optimization(assistant):
    """Optimize codebase"""
    print("\n⚡ Starting AI-powered codebase optimization...")
    
    try:
        optimization = assistant.optimize_codebase()
        
        print(f"\n🔧 Optimization Results:")
        print(f"  🛠️  Tools Applied: {len(optimization['optimizations_applied'])}")
        
        for tool_result in optimization['optimizations_applied']:
            status_icon = "✅" if tool_result['status'] == 'completed' else "❌"
            print(f"  {status_icon} {tool_result['tool']}: {tool_result['status']}")
        
        if optimization['issues_fixed']:
            print(f"\n🔨 Issues Fixed:")
            for issue in optimization['issues_fixed']:
                print(f"  • {issue}")
        
        input("\nPress Enter to continue...")
        
    except Exception as e:
        print(f"❌ Error during optimization: {e}")
        input("Press Enter to continue...")

def run_documentation(assistant):
    """Generate documentation"""
    print("\n📚 Generating comprehensive documentation...")
    
    try:
        docs = assistant.generate_documentation()
        
        print(f"\n📚 Documentation Generated:")
        print(f"  📄 Sections: {len(docs)}")
        
        for section_name, section_content in docs.items():
            if isinstance(section_content, dict) and 'title' in section_content:
                print(f"  • {section_content['title']}")
        
        print(f"\n📖 Documentation includes:")
        print(f"  • Project overview and getting started")
        print(f"  • Architecture guide and design principles")
        print(f"  • API documentation with endpoints")
        print(f"  • User guide with troubleshooting")
        print(f"  • Developer guide with setup instructions")
        
        input("\nPress Enter to continue...")
        
    except Exception as e:
        print(f"❌ Error generating documentation: {e}")
        input("Press Enter to continue...")

def run_dashboard(assistant):
    """Create development dashboard"""
    print("\n📊 Creating AI-powered development dashboard...")
    
    try:
        dashboard = assistant.create_development_dashboard()
        
        print(f"\n📊 Dashboard Created:")
        print(f"  📈 Project Status: {dashboard['project_status']}")
        print(f"  🎯 Current Phase: {dashboard['development_progress']['current_phase']}")
        print(f"  📊 Overall Progress: {dashboard['development_progress']['overall_progress']}%")
        
        print(f"\n🤖 AI Metrics:")
        for metric, value in dashboard['ai_metrics'].items():
            print(f"  • {metric}: {value}")
        
        print(f"\n👥 Team Productivity:")
        for metric, value in dashboard['team_productivity'].items():
            print(f"  • {metric}: {value}")
        
        print(f"\n📋 Upcoming Tasks:")
        for task in dashboard['upcoming_tasks']:
            print(f"  • {task}")
        
        print(f"\n🌐 View your dashboard at: http://localhost:8080/dashboard-new.html")
        
        input("\nPress Enter to continue...")
        
    except Exception as e:
        print(f"❌ Error creating dashboard: {e}")
        input("Press Enter to continue...")

def run_continuous_improvement(assistant):
    """Run continuous improvement cycle"""
    print("\n🔄 Starting continuous improvement cycle...")
    
    try:
        improvement = assistant.run_continuous_improvement()
        
        print(f"\n🔄 Improvement Cycle #{improvement['cycle_number']}:")
        print(f"  ⏰ Timestamp: {improvement['timestamp']}")
        print(f"  🛠️  Actions Taken: {len(improvement['actions_taken'])}")
        
        for action in improvement['actions_taken']:
            print(f"  • {action}")
        
        if improvement['next_recommendations']:
            print(f"\n💡 Next Recommendations:")
            for rec in improvement['next_recommendations'][:3]:
                print(f"  • {rec['title']}")
        
        input("\nPress Enter to continue...")
        
    except Exception as e:
        print(f"❌ Error in improvement cycle: {e}")
        input("Press Enter to continue...")

def run_export_report(assistant):
    """Export comprehensive report"""
    print("\n📄 Exporting comprehensive project report...")
    
    try:
        report = assistant.export_project_report()
        
        print(f"\n📄 Report Exported Successfully!")
        print(f"  📊 Summary:")
        print(f"    • Total Files: {report['summary']['total_files']}")
        print(f"    • Components: {report['summary']['total_components']}")
        print(f"    • Technologies: {len(report['summary']['technologies_used'])}")
        print(f"    • Issues Detected: {report['summary']['issues_detected']}")
        print(f"    • Recommendations: {report['summary']['recommendations_generated']}")
        print(f"    • Optimization Cycles: {report['summary']['optimization_cycles']}")
        
        print(f"\n📁 Report saved to: ai_development_report.json")
        print(f"🌐 View dashboard at: http://localhost:8080/dashboard-new.html")
        
        input("\nPress Enter to continue...")
        
    except Exception as e:
        print(f"❌ Error exporting report: {e}")
        input("Press Enter to continue...")

def run_ai_assistance(assistant):
    """Get AI assistance"""
    print("\n🤖 AI Assistance - Ask me anything about your project!")
    print("💡 Examples: 'analyze project', 'create plan', 'optimize codebase', 'generate docs'")
    
    query = input("\n🔍 Enter your query: ").strip()
    
    if not query:
        print("❌ Please enter a query.")
        input("Press Enter to continue...")
        return
    
    try:
        assistance = assistant.get_ai_assistance(query)
        
        print(f"\n🤖 AI Response:")
        print(f"  {assistance['response']}")
        
        if assistance['actions']:
            print(f"\n🎯 Suggested Actions:")
            for action in assistance['actions']:
                print(f"  • {action}")
        
        if assistance['recommendations']:
            print(f"\n💡 Additional Recommendations:")
            for rec in assistance['recommendations']:
                print(f"  • {rec}")
        
        input("\nPress Enter to continue...")
        
    except Exception as e:
        print(f"❌ Error getting AI assistance: {e}")
        input("Press Enter to continue...")

def run_development_phase(assistant):
    """Execute development phase"""
    print("\n🚀 Execute Development Phase")
    print("Available phases:")
    print("1. Analysis & Planning")
    print("2. Core Development")
    print("3. Testing & Quality Assurance")
    print("4. Deployment & Launch")
    
    phase_choice = input("\n🎯 Select phase (1-4): ").strip()
    
    phases = {
        "1": "Analysis & Planning",
        "2": "Core Development",
        "3": "Testing & Quality Assurance",
        "4": "Deployment & Launch"
    }
    
    if phase_choice not in phases:
        print("❌ Invalid phase selection.")
        input("Press Enter to continue...")
        return
    
    phase_name = phases[phase_choice]
    
    print(f"\n🚀 Executing phase: {phase_name}")
    
    try:
        result = assistant.execute_development_phase(phase_name)
        
        print(f"\n✅ Phase Execution Results:")
        print(f"  📊 Status: {result['status']}")
        print(f"  ⏰ Start: {result['start_time']}")
        print(f"  ⏰ End: {result['end_time']}")
        
        if result['actions_taken']:
            print(f"\n🛠️  Actions Taken:")
            for action in result['actions_taken']:
                print(f"  • {action}")
        
        if result['results']:
            print(f"\n📈 Results:")
            for key, value in result['results'].items():
                print(f"  • {key}: {value}")
        
        if result['issues']:
            print(f"\n⚠️  Issues:")
            for issue in result['issues']:
                print(f"  • {issue}")
        
        input("\nPress Enter to continue...")
        
    except Exception as e:
        print(f"❌ Error executing phase: {e}")
        input("Press Enter to continue...")

def main():
    """Main function"""
    print_banner()
    
    # Initialize AI Development Assistant
    try:
        print("🤖 Initializing AI Development Assistant...")
        assistant = AIDevelopmentAssistant()
        print("✅ AI Development Assistant ready!")
    except Exception as e:
        print(f"❌ Error initializing assistant: {e}")
        input("Press Enter to exit...")
        return
    
    # Main menu loop
    while True:
        show_menu()
        
        choice = input("🎯 Choose an option (0-9): ").strip()
        
        if choice == "0":
            print("\n👋 Thank you for using AI Development Assistant!")
            break
        elif choice == "1":
            run_analysis(assistant)
        elif choice == "2":
            run_development_plan(assistant)
        elif choice == "3":
            run_optimization(assistant)
        elif choice == "4":
            run_documentation(assistant)
        elif choice == "5":
            run_dashboard(assistant)
        elif choice == "6":
            run_continuous_improvement(assistant)
        elif choice == "7":
            run_export_report(assistant)
        elif choice == "8":
            run_ai_assistance(assistant)
        elif choice == "9":
            run_development_phase(assistant)
        else:
            print("❌ Invalid choice. Please select 0-9.")
            input("Press Enter to continue...")

if __name__ == "__main__":
    main()
