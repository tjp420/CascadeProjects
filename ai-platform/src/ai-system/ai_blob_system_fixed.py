#!/usr/bin/env python3
"""
AI-Enhanced Blob System - Fixed Version
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
        results = manager.analyze_blobs()
        
        print(f"\n📊 Analysis Results:")
        print(f"  📁 Total Blobs: {results['total_blobs']}")
        print(f"  🔧 Blob Types: {results['blob_types_count']}")
        print(f"  💡 Recommendations: {len(results['recommendations'])}")
        
        print(f"\n📦 Blob Types:")
        for blob_type, count in results['blob_types'].items():
            print(f"  {blob_type}: {count}")
        
        print(f"\n🤖 AI Insights:")
        if results.get('ai_insights'):
            print(f"  {results['ai_insights']}")
        else:
            print("  ❌ AI insights not available")
        
        print(f"\n💡 Recommendations:")
        for i, rec in enumerate(results['recommendations'], 1):
            print(f"  {i}. {rec}")
        
        return results
        
    except Exception as e:
        print(f"❌ Error during analysis: {e}")
        return None

def get_blob_statistics(manager):
    """Get blob statistics"""
    print("\n📊 Getting blob statistics...")
    
    try:
        stats = manager.get_blob_statistics()
        
        print(f"\n📈 Blob Statistics:")
        print(f"  📁 Total Blobs: {stats['total_blobs']}")
        print(f"  💾 Total Size: {stats['total_size_mb']:.2f} MB")
        print(f"  🔧 Blob Types: {stats['blob_types_count']}")
        print(f"  🏗️ Architectures: {stats['architectures_count']}")
        print(f"  💻 Operating Systems: {stats['os_count']}")
        print(f"  🤖 Model Families: {stats['model_families_count']}")
        
        print(f"\n📦 Blob Types Breakdown:")
        for blob_type, count in stats['blob_types'].items():
            print(f"  {blob_type}: {count}")
        
        print(f"\n🏗️ Architecture Breakdown:")
        for arch, count in stats['architectures'].items():
            print(f"  {arch}: {count}")
        
        print(f"\n🤖 Model Families:")
        for family, count in stats['model_families'].items():
            print(f"  {family}: {count}")
        
        return stats
        
    except Exception as e:
        print(f"❌ Error getting statistics: {e}")
        return None

def optimize_blob_storage(manager):
    """Optimize blob storage with AI"""
    print("\n⚡ Starting AI-powered blob storage optimization...")
    
    try:
        optimization = manager.optimize_blob_storage()
        
        print(f"\n🔧 Optimization Results:")
        print(f"  📊 Actions Taken: {optimization['actions_taken']}")
        print(f"  💡 Recommendations: {len(optimization['recommendations'])}")
        
        print(f"\n✅ Actions Taken:")
        for i, action in enumerate(optimization['actions_taken'], 1):
            print(f"  {i}. {action}")
        
        print(f"\n🤖 AI Insights:")
        if optimization.get('ai_insights'):
            print(f"  {optimization['ai_insights']}")
        else:
            print("  ❌ AI insights not available")
        
        print(f"\n💡 Optimization Recommendations:")
        for i, rec in enumerate(optimization['recommendations'], 1):
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
        
        print(f"\n📋 Found Matches:")
        for i, match in enumerate(results['matches'], 1):
            print(f"  {i}. {match['hash_short']} ({match.get('type', 'unknown')})")
            if 'metadata' in match:
                metadata = match['metadata']
                print(f"     Family: {metadata.get('family', 'unknown')}")
                print(f"     Architecture: {metadata.get('architecture', 'unknown')}")
        
        print(f"\n🤖 AI Search Insights:")
        if results.get('ai_insights'):
            print(f"  {results['ai_insights']}")
        else:
            print("  ❌ AI search insights not available")
        
        return results
        
    except Exception as e:
        print(f"❌ Error during search: {e}")
        return None

def get_ai_insights(manager):
    """Generate comprehensive AI blob insights"""
    print("\n🤖 Generating comprehensive AI blob insights...")
    
    try:
        insights = manager.get_comprehensive_insights()
        
        print(f"\n🤖 AI Insights Available: {insights.get('ai_insights_available', False)}")
        
        print(f"\n🤖 Comprehensive AI Insights:")
        if insights.get('comprehensive_insights'):
            print(f"  {insights['comprehensive_insights']}")
        else:
            print("  ❌ AI insights not available")
        
        print(f"\n📊 Analysis Summary:")
        if 'analysis_summary' in insights:
            summary = insights['analysis_summary']
            print(f"  📁 Total Blobs: {summary.get('total_blobs', 0)}")
            print(f"  🔧 Blob Types: {summary.get('blob_types', [])}")
        
        print(f"\n📈 Statistics Summary:")
        if 'statistics_summary' in insights:
            stats = insights['statistics_summary']
            print(f"  💾 Total Size: {stats.get('total_size_mb', 0):.2f} MB")
            print(f"  🏗️ Architectures: {stats.get('architectures', [])}")
        
        print(f"\n💡 Strategic Recommendations:")
        for i, rec in enumerate(insights.get('strategic_recommendations', []), 1):
            print(f"  {i}. {rec}")
        
        return insights
        
    except Exception as e:
        print(f"❌ Error generating insights: {e}")
        return None

def list_blobs(manager):
    """List all blobs"""
    print("\n📋 Listing all blobs...")
    
    try:
        blobs = manager.list_all_blobs()
        
        print(f"\n📁 Found {len(blobs)} blobs:")
        for i, blob in enumerate(blobs, 1):
            if 'error' in blob:
                print(f"  {i}. {blob['hash_short']} (Error: {blob['error']})")
            else:
                size_mb = blob.get('size_mb', 0)
                blob_type = blob.get('type', 'unknown')
                print(f"  {i}. {blob['hash_short']} ({blob_type}, {size_mb:.2f}MB)")
                if 'metadata' in blob:
                    metadata = blob['metadata']
                    print(f"     Family: {metadata.get('family', 'unknown')}")
                    print(f"     Architecture: {metadata.get('architecture', 'unknown')}")
        
        return blobs
        
    except Exception as e:
        print(f"❌ Error listing blobs: {e}")
        return None

def export_blob_report(manager):
    """Export blob report"""
    print("\n📄 Exporting blob report...")
    
    try:
        report = manager.export_report()
        
        report_file = "ai_blob_report.json"
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, default=str)
        
        print(f"✅ Report exported to: {report_file}")
        print(f"  📊 Analysis: {len(report.get('analysis', {}))} blobs")
        print(f"  📈 Statistics: {len(report.get('statistics', {}))} blobs")
        print(f"  🤖 AI Insights: {'Available' if report.get('ai_insights_available') else 'Not Available'}")
        
        return report
        
    except Exception as e:
        print(f"❌ Error exporting report: {e}")
        return None

def show_system_configuration():
    """Show system configuration"""
    print("\n⚙️ System Configuration:")
    
    try:
        from ai_blob_manager import AIBlobManager
        
        manager = AIBlobManager()
        
        print(f"🤖 AI Available: {is_ai_available()}")
        print(f"  📡 AI Provider: {manager.ai_service.provider if hasattr(manager.ai_service, 'provider') else 'Unknown'}")
        print(f"  🔑 API Key: {'Configured' if manager.ai_service.api_key else 'Not configured'}")
        print(f"  📁 Blob Directory: {manager.blobs_dir}")
        print(f"  📁 Directory Exists: {manager.blobs_dir.exists()}")
        print(f"  📦 Blob Files: {len(list(manager.blobs_dir.glob('*'))}")
        
    except Exception as e:
        print(f"❌ Error showing configuration: {e}")

def main():
    """Main execution function"""
    # Parse command line arguments
    parser = argparse.ArgumentParser(description="AI-Enhanced Blob System")
    parser.add_argument("--blobs-dir", help="Path to blobs directory", default="blobs")
    parser.add_argument("--analyze", action="store_true", help="Run analysis and exit")
    parser.add_argument("--stats", action="store_true", help="Show statistics and exit")
    parser.add_argument("--optimize", action="store_true", help="Run optimization and exit")
    args = parser.parse_args()
    
    # Initialize AI blob manager
    manager = get_ai_blob_manager(args.blobs_dir)
    
    # Handle command line arguments
    if args.analyze:
        analyze_blobs(manager)
        return
    elif args.stats:
        get_blob_statistics(manager)
        return
    elif args.optimize:
        optimize_blob_storage(manager)
        return
    
    # Interactive mode
    print_banner()
    print(f"✅ AI Blob Manager initialized")
    print(f"🤖 AI Available: {is_ai_available()}")
    
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
    main()
