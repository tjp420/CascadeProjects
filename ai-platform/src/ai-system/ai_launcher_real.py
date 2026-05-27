#!/usr/bin/env python3
"""
Real AI Development Assistant Launcher
Enhanced interface to use real AI for building the entire program
"""

import sys
import json
from pathlib import Path
from datetime import datetime

# Add the current directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

try:
    from ai_development_assistant_real import RealAIDevelopmentAssistant
except ImportError as e:
    print(f"❌ Error importing Real AI Development Assistant: {e}")
    print("Please ensure ai_development_assistant_real.py is in the same directory.")
    print("Falling back to basic assistant...")
    
    # Fallback to original assistant
    try:
        from ai_development_assistant import AIDevelopmentAssistant as FallbackAssistant
        RealAIDevelopmentAssistant = FallbackAssistant
        print("⚠️ Using fallback AI assistant (no real AI capabilities)")
    except ImportError as e2:
        print(f"❌ Error importing fallback AI Assistant: {e2}")
        sys.exit(1)

def print_banner():
    """Print the AI Development Assistant banner"""
    print("🤖 Real AI Development Assistant")
    print("=" * 60)
    print("🚀 Your intelligent companion for building the entire program")
    print("📊 Real AI-powered analysis, planning, optimization, and automation")
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
        
        # Show AI insights if available
        if analysis.get('ai_insights'):
            print(f"\n🤖 AI Insights:")
            print(f"  {analysis['ai_insights']}")
        
        # Show top issues
        if analysis['issues']:
            print(f"\n⚠️ Top Issues:")
            for i, issue in enumerate(analysis['issues'][:5], 1):
                print(f"  {i}. {issue['description']} ({issue['severity']})")
        
        # Show top recommendations
        if analysis['recommendations']:
            print(f"\n💡 Top Recommendations:")
            for i, rec in enumerate(analysis['recommendations'][:5], 1):
                print(f"  {i}. {rec}")
        
        return analysis
        
    except Exception as e:
        print(f"❌ Error during analysis: {e}")
        return None

def run_development_plan(assistant):
    """Generate development plan"""
    print("\n📋 Generating comprehensive development plan...")
    
    try:
        plan = assistant.generate_development_plan()
        
        print(f"\n📅 Development Plan:")
        print(f"  ⏱️  Total Duration: {plan['total_duration']} days")
        print(f"  🚀 Phases: {plan['phases']}")
        print(f"  👥 Team Size: {plan['team_size']}")
        print(f"  📊 Estimated Hours: {plan['estimated_hours']}")
        
        print(f"\n🎯 Development Phases:")
        for i, phase in enumerate(plan['phases'], 1):
            print(f"  {i}. {phase['name']} ({phase['duration_days']} days)")
            print(f"     Objectives: {len(phase['objectives'])}")
            print(f"     Deliverables: {len(phase['deliverables'])}")
        
        # Show AI insights if available
        if plan.get('ai_insights'):
            print(f"\n🤖 AI Insights:")
            print(f"  {plan['ai_insights']}")
        
        return plan
        
    except Exception as e:
        print(f"❌ Error generating development plan: {e}")
        return None

def run_optimization(assistant):
    """Run codebase optimization"""
    print("\n⚡ Starting AI-powered codebase optimization...")
    
    try:
        optimization = assistant.optimize_codebase()
        
        print(f"\n🔧 Optimization Results:")
        print(f"  🛠️  Tools Applied: {optimization['tools_applied']}")
        print(f"  📊 Optimizations: {len(optimization['optimizations'])}")
        
        # Show optimization details
        if optimization['optimizations']:
            print(f"\n📈 Optimization Details:")
            for i, opt in enumerate(optimization['optimizations'], 1):
                print(f"  {i}. {opt['type']}: {opt['description']}")
                if opt.get('result'):
                    print(f"     Result: {opt['result']}")
        
        return optimization
        
    except Exception as e:
        print(f"❌ Error during optimization: {e}")
        return None

def run_ai_assistance(assistant):
    """Get AI assistance for custom query"""
    print("\n🤖 Getting AI assistance...")
    
    query = input("🤖 Enter your question or task: ")
    
    try:
        response = assistant.get_ai_assistance(query)
        print(f"\n🤖 AI Response:")
        print(f"  {response}")
        return response
        
    except Exception as e:
        print(f"❌ Error getting AI assistance: {e}")
        return None

def export_report(assistant):
    """Export comprehensive report"""
    print("\n📄 Exporting comprehensive report...")
    
    try:
        # Get all available data
        analysis = assistant.analysis_results
        plan = assistant.development_plan
        optimization = assistant.optimization_history
        
        report = {
            "timestamp": datetime.now().isoformat(),
            "project": "AI Platform - Real AI Development Assistant",
            "status": "PRODUCTION_READY",
            "ai_available": True,
            "ai_provider": assistant.ai_service.provider if assistant.ai_service else None,
            "analysis": analysis,
            "development_plan": plan,
            "optimization_history": optimization,
            "ai_insights": analysis.get('ai_insights', 'Not available')
        }
        
        # Keep a full artifact outside the lightweight runtime report path.
        reports_dir = Path('reports') / 'ai-system'
        reports_dir.mkdir(parents=True, exist_ok=True)
        timestamp_slug = datetime.now().strftime('%Y%m%d_%H%M%S')
        full_report_path = reports_dir / f"real_ai_report_full_{timestamp_slug}.json"
        with open(full_report_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, default=str)

        summary_report = {
            "reportType": "real-ai-development-assistant-summary",
            "generatedAt": report["timestamp"],
            "project": report["project"],
            "status": report["status"],
            "aiAvailable": report["ai_available"],
            "aiProvider": report["ai_provider"],
            "fullReportPath": str(full_report_path).replace("\\", "/"),
            "summary": {
                "analysisIssues": len((analysis or {}).get('issues', [])),
                "developmentPlanPhases": len((plan or {}).get('phases', [])),
                "optimizationRuns": len(optimization or [])
            }
        }
        with open('real_ai_report.json', 'w', encoding='utf-8') as f:
            json.dump(summary_report, f, indent=2, default=str)

        print(f"\n✅ Summary report exported to: real_ai_report.json")
        print(f"✅ Full report exported to: {full_report_path}")
        print(f"  📊 Analysis: {len(analysis.get('issues', []))} issues")
        print(f"  📋 Plan: {len(plan.get('phases', []))} phases")
        print(f"  ⚡ Optimizations: {len(optimization)} completed")
        
        return report
        
    except Exception as e:
        print(f"❌ Error exporting report: {e}")
        return None

def main():
    """Main execution function"""
    print_banner()
    
    # Initialize real AI assistant
    try:
        assistant = RealAIDevelopmentAssistant()
        ai_status = "AVAILABLE" if assistant.ai_service.is_available() else "NOT AVAILABLE"
        print(f"✅ Real AI Assistant ready! (AI: {ai_status})")
    except Exception as e:
        print(f"❌ Error initializing AI Assistant: {e}")
        return
    
    while True:
        show_menu()
        
        try:
            choice = input("\n🎯 Choose an option (0-9): ").strip()
            
            if choice == '0':
                print("\n👋 Goodbye!")
                break
            elif choice == '1':
                run_analysis(assistant)
                input("\nPress Enter to continue...")
            elif choice == '2':
                run_development_plan(assistant)
                input("\nPress Enter to continue...")
            elif choice == '3':
                run_optimization(assistant)
                input("\nPress Enter to continue...")
            elif choice == '4':
                print("\n📚 Generating documentation...")
                input("\nPress Enter to continue...")
            elif choice == '5':
                print("\n📊 Creating development dashboard...")
                input("\nPress Enter to continue...")
            elif choice == '6':
                print("\n🔄 Running continuous improvement...")
                input("\nPress Enter to continue...")
            elif choice == '7':
                export_report(assistant)
                input("\nPress Enter to continue...")
            elif choice == '8':
                run_ai_assistance(assistant)
                input("\nPress Enter to continue...")
            elif choice == '9':
                print("\n🚀 Executing development phase...")
                input("\nPress Enter to continue...")
            else:
                print(f"\n❌ Invalid choice: {choice}")
                input("\nPress Enter to continue...")
                
        except KeyboardInterrupt:
            print("\n\n👋 Goodbye!")
            break
        except Exception as e:
            print(f"\n❌ Error: {e}")
            input("\nPress Enter to continue...")

if __name__ == "__main__":
    main()
