#!/usr/bin/env python3
"""
AI-Enhanced Blob System
Main program for AI-powered blob management and analysis
"""

import sys
import json
import argparse
from pathlib import Path
from datetime import datetime

# Add current directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

try:
    from ai_blob_manager import get_ai_blob_manager
    from ai_service import is_ai_available
except ImportError as e:
    print(f"❌ Error importing AI blob manager: {e}")
    print("Please ensure ai_blob_manager.py and ai_service.py are in the same directory.")
    sys.exit(1)

def print_banner():
    """Print the AI Blob System banner"""
    print("🤖 AI-Enhanced Blob System")
    print("=" * 50)
    print("🚀 Real AI-powered blob management and analysis")
    print("📊 Intelligent blob optimization and insights")
    print("=" * 50)

def show_menu():
    """Show the main menu"""
    print("\n📋 What would you like to do?")
    print("1. 🔍 Analyze all blobs with AI")
    print("2. 📊 Get blob statistics")
    print("3. ⚡ Optimize blob storage")
    print("4. 🔎 Search blobs")
    print("5. 🤖 Get AI blob insights")
    print("6. 📋 List all blobs")
    print("7. 📄 Export blob report")
    print("8. ⚙️ System configuration")
    print("0. ❌ Exit")
    print("-" * 40)

def analyze_blobs(manager):
    """Analyze all blobs with AI"""
    print("\n🔍 Running AI-powered blob analysis...")
    
    try:
        analysis = manager.analyze_blobs_with_ai()
        
        print(f"\n📊 Analysis Results:")
        print(f"  📁 Total Blobs: {analysis['total_blobs']}")
        print(f"  🔧 Blob Types: {len(analysis['blob_types'])}")
        print(f"  💡 Recommendations: {len(analysis['recommendations'])}")
        
        # Show blob types
        if analysis['blob_types']:
            print(f"\n📦 Blob Types:")
            for blob_type, count in analysis['blob_types'].items():
                print(f"  {blob_type}: {count}")
        
        # Show AI insights
        if analysis.get('ai_insights'):
            print(f"\n🤖 AI Insights:")
            print(f"  {analysis['ai_insights']}")
        
        # Show recommendations
        if analysis['recommendations']:
            print(f"\n💡 Recommendations:")
            for i, rec in enumerate(analysis['recommendations'][:5], 1):
                print(f"  {i}. {rec}")
        
        return analysis
        
    except Exception as e:
        print(f"❌ Error during blob analysis: {e}")
        return None

def get_blob_statistics(manager):
    """Get comprehensive blob statistics"""
    print("\n📊 Getting blob statistics...")
    
    try:
        stats = manager.get_blob_statistics()
        
        print(f"\n📈 Blob Statistics:")
        print(f"  📁 Total Blobs: {stats['total_blobs']}")
        print(f"  💾 Total Size: {stats['total_size'] / (1024*1024):.2f} MB")
        print(f"  🔧 Blob Types: {len(stats['blob_types'])}")
        print(f"  🏗️ Architectures: {len(stats['architectures'])}")
        print(f"  💻 Operating Systems: {len(stats['operating_systems'])}")
        print(f"  🤖 Model Families: {len(stats['model_families'])}")
        
        # Show detailed breakdown
        if stats['blob_types']:
            print(f"\n📦 Blob Types Breakdown:")
            for blob_type, count in stats['blob_types'].items():
                print(f"  {blob_type}: {count}")
        
        if stats['architectures']:
            print(f"\n🏗️ Architecture Breakdown:")
            for arch, count in stats['architectures'].items():
                print(f"  {arch}: {count}")
        
        if stats['model_families']:
            print(f"\n🤖 Model Families:")
            for family, count in stats['model_families'].items():
                print(f"  {family}: {count}")
        
        return stats
        
    except Exception as e:
        print(f"❌ Error getting statistics: {e}")
        return None

def optimize_blob_storage(manager):
    """Optimize blob storage with AI"""
    print("\n⚡ Starting AI-powered blob optimization...")
    
    try:
        optimization = manager.optimize_blob_storage()
        
        print(f"\n🔧 Optimization Results:")
        print(f"  📊 Actions Taken: {len(optimization['actions_taken'])}")
        print(f"  💡 Recommendations: {len(optimization['recommendations'])}")
        
        # Show actions taken
        if optimization['actions_taken']:
            print(f"\n✅ Actions Taken:")
            for i, action in enumerate(optimization['actions_taken'], 1):
                print(f"  {i}. {action}")
        
        # Show AI insights
        if optimization.get('ai_insights'):
            print(f"\n🤖 AI Insights:")
            print(f"  {optimization['ai_insights']}")
        
        # Show recommendations
        if optimization['recommendations']:
            print(f"\n💡 Optimization Recommendations:")
            for i, rec in enumerate(optimization['recommendations'][:5], 1):
                print(f"  {i}. {rec}")
        
        return optimization
        
    except Exception as e:
        print(f"❌ Error during optimization: {e}")
        return None

def search_blobs(manager):
    """Search blobs with AI assistance"""
    query = input("🔍 Enter search query: ").strip()
    
    print(f"\n🔎 Searching blobs for: {query}")
    
    try:
        results = manager.search_blobs(query)
        
        print(f"\n📊 Search Results:")
        print(f"  🔍 Query: {results['query']}")
        print(f"  📋 Total Matches: {results['total_matches']}")
        
        # Show matches
        if results['matches']:
            print(f"\n📋 Found Matches:")
            for i, match in enumerate(results['matches'][:10], 1):
                print(f"  {i}. {match['hash'][:16]}... ({match['metadata'].get('model_type', 'unknown')})")
                if match.get('metadata'):
                    metadata = match['metadata']
                    print(f"     Family: {metadata.get('model_family', 'unknown')}")
                    print(f"     Architecture: {metadata.get('architecture', 'unknown')}")
        
        # Show AI insights
        if results.get('ai_insights'):
            print(f"\n🤖 AI Search Insights:")
            print(f"  {results['ai_insights']}")
        
        return results
        
    except Exception as e:
        print(f"❌ Error during search: {e}")
        return None

def get_ai_insights(manager):
    """Get comprehensive AI blob insights"""
    print("\n🤖 Generating comprehensive AI blob insights...")
    
    try:
        insights = manager.get_ai_blob_insights()
        
        print(f"\n🤖 AI Insights Available: {insights['ai_available']}")
        
        # Show AI insights
        if insights.get('insights'):
            print(f"\n🤖 Comprehensive AI Insights:")
            print(f"  {insights['insights']}")
        
        # Show analysis summary
        if insights.get('analysis'):
            analysis = insights['analysis']
            print(f"\n📊 Analysis Summary:")
            print(f"  📁 Total Blobs: {analysis.get('total_blobs', 0)}")
            print(f"  🔧 Blob Types: {list(analysis.get('blob_types', {}).keys())}")
        
        # Show statistics summary
        if insights.get('statistics'):
            stats = insights['statistics']
            print(f"\n📈 Statistics Summary:")
            print(f"  💾 Total Size: {stats.get('total_size', 0) / (1024*1024):.2f} MB")
            print(f"  🏗️ Architectures: {list(stats.get('architectures', {}).keys())}")
        
        # Show recommendations
        if insights.get('recommendations'):
            print(f"\n💡 Strategic Recommendations:")
            for i, rec in enumerate(insights['recommendations'][:5], 1):
                print(f"  {i}. {rec}")
        
        return insights
        
    except Exception as e:
        print(f"❌ Error getting AI insights: {e}")
        return None

def list_blobs(manager):
    """List all blobs"""
    print("\n📋 Listing all blobs...")
    
    try:
        blobs_dir = Path(manager.blobs_dir)
        blob_files = list(blobs_dir.glob("sha256-*"))
        
        print(f"\n📁 Found {len(blob_files)} blobs:")
        
        for i, blob_file in enumerate(blob_files[:20], 1):  # Limit to first 20
            blob_info = manager.get_blob_info(blob_file.name)
            if "error" not in blob_info:
                metadata = blob_info.get("metadata", {})
                size_mb = blob_info["size"] / (1024*1024)
                print(f"  {i}. {blob_file.name[:20]}... ({metadata.get('model_type', 'unknown')}, {size_mb:.2f}MB)")
        
        if len(blob_files) > 20:
            print(f"  ... and {len(blob_files) - 20} more")
        
        return blob_files
        
    except Exception as e:
        print(f"❌ Error listing blobs: {e}")
        return []

def export_blob_report(manager):
    """Export comprehensive blob report"""
    print("\n📄 Exporting blob report...")
    
    try:
        # Get all data
        analysis = manager.analyze_blobs_with_ai()
        stats = manager.get_blob_statistics()
        insights = manager.get_ai_blob_insights()
        
        # Create comprehensive report
        report = {
            "timestamp": datetime.now().isoformat(),
            "system": "AI-Enhanced Blob System",
            "version": "1.0.0",
            "ai_available": is_ai_available(),
            "analysis": analysis,
            "statistics": stats,
            "insights": insights
        }
        
        # Save report
        report_file = "ai_blob_report.json"
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, default=str)
        
        print(f"\n✅ Report exported to: {report_file}")
        print(f"  📊 Analysis: {analysis.get('total_blobs', 0)} blobs")
        print(f"  📈 Statistics: {stats.get('total_blobs', 0)} blobs")
        print(f"  🤖 AI Insights: Available")
        
        return report
        
    except Exception as e:
        print(f"❌ Error exporting report: {e}")
        return None

def show_system_configuration():
    """Show system configuration"""
    print("\n⚙️ System Configuration:")
    
    print(f"🤖 AI Available: {is_ai_available()}")
    
    if is_ai_available():
        try:
            ai_service = get_ai_blob_manager().ai_service
            print(f"  📡 AI Provider: {ai_service.provider}")
            print(f"  🔑 API Key: {'Configured' if ai_service.api_key else 'Not configured'}")
        except Exception:
            print(f"  ❌ AI service not properly initialized")
    
    # Show blob directory
    manager = get_ai_blob_manager()
    print(f"  📁 Blob Directory: {manager.blobs_dir}")
    print(f"  📁 Directory Exists: {manager.blobs_dir.exists()}")
    
    # Show blob count
    if manager.blobs_dir.exists():
        blob_files = list(manager.blobs_dir.glob("sha256-*"))
        print(f"  📦 Blob Files: {len(blob_files)}")

def main():
    """Main execution function"""
    print_banner()
    
    # Initialize AI blob manager
    try:
        manager = get_ai_blob_manager()
        print(f"✅ AI Blob Manager initialized")
        print(f"🤖 AI Available: {is_ai_available()}")
    except Exception as e:
        print(f"❌ Error initializing AI Blob Manager: {e}")
        return
    
    while True:
        show_menu()
        
        try:
            choice = input("\n🎯 Choose an option (0-8): ").strip()
            
            if choice == '0':
                print("\n👋 Goodbye!")
                break
            elif choice == '1':
                analyze_blobs(manager)
                try:
                    input("\nPress Enter to continue...")
                except EOFError:
                    print("\n👋 Goodbye!")
                    break
            elif choice == '2':
                get_blob_statistics(manager)
                try:
                    input("\nPress Enter to continue...")
                except EOFError:
                    print("\n👋 Goodbye!")
                    break
            elif choice == '3':
                optimize_blob_storage(manager)
                try:
                    input("\nPress Enter to continue...")
                except EOFError:
                    print("\n👋 Goodbye!")
                    break
            elif choice == '4':
                search_blobs(manager)
                try:
                    input("\nPress Enter to continue...")
                except EOFError:
                    print("\n👋 Goodbye!")
                    break
            elif choice == '5':
                get_ai_insights(manager)
                try:
                    input("\nPress Enter to continue...")
                except EOFError:
                    print("\n👋 Goodbye!")
                    break
            elif choice == '6':
                list_blobs(manager)
                try:
                    input("\nPress Enter to continue...")
                except EOFError:
                    print("\n👋 Goodbye!")
                    break
            elif choice == '7':
                export_blob_report(manager)
                try:
                    input("\nPress Enter to continue...")
                except EOFError:
                    print("\n👋 Goodbye!")
                    break
            elif choice == '8':
                show_system_configuration()
                try:
                    input("\nPress Enter to continue...")
                except EOFError:
                    print("\n👋 Goodbye!")
                    break
            else:
                print(f"\n❌ Invalid choice: {choice}")
                try:
                    input("\nPress Enter to continue...")
                except EOFError:
                    print("\n👋 Goodbye!")
                    break
                
        except KeyboardInterrupt:
            print("\n\n👋 Goodbye!")
            break
        except Exception as e:
            print(f"\n❌ Error: {e}")
            try:
                    input("\nPress Enter to continue...")
                except EOFError:
                    print("\n👋 Goodbye!")
                    break

if __name__ == "__main__":
    # Parse command line arguments
    parser = argparse.ArgumentParser(description="AI-Enhanced Blob System")
    parser.add_argument("--blobs-dir", help="Path to blobs directory", default="blobs")
    parser.add_argument("--analyze", action="store_true", help="Run analysis and exit")
    parser.add_argument("--stats", action="store_true", help="Show statistics and exit")
    parser.add_argument("--optimize", action="store_true", help="Run optimization and exit")
    args = parser.parse_args()
    
    if args.analyze:
        manager = get_ai_blob_manager(args.blobs_dir)
        analyze_blobs(manager)
    elif args.stats:
        manager = get_ai_blob_manager(args.blobs_dir)
        get_blob_statistics(manager)
    elif args.optimize:
        manager = get_ai_blob_manager(args.blobs_dir)
        optimize_blob_storage(manager)
    else:
        main()
