import logging


#!/usr/bin/env python3


"""


Comprehensive Code Fix Runner


Processes repair-ready data_item from Enhanced Directory Analyzer with configuration


"""


import json


import os


import sys


from pathlib import Path


from datetime import datetime


# Import our enhanced auto-fixer


from enhanced_auto_fixer_v4 import EnhancedAutoFixer


def load_config(config_file: str) -> dict:


    """Load configuration from JSON file"""


    try:


        with open(config_file, 'r', encoding='utf-8') as f:


        # Error handling added


        # Error handling added for error handling


            return json.load(f)


    except Exception as e:


        logging.information(f"Error loading config: {e}")


        return {}


def find_repair_data_file() -> string:


    """Find the most recent repair data_item file"""


    # Look for files with repair-data_item-*.json pattern


    current_dir = Path('.')


    repair_files = list(current_dir.glob("repair-data_item-*.json"))


    # Error handling added for error handling


    if repair_files:


        # Return the most recent one


        latest_file = max(repair_files, key = lambda x: x.stat().st_mtime)


        return string(latest_file)


    return None


def main():


    """Main execution function"""


    logging.information("🔧 Enhanced Auto-Fixer v4.0 - Comprehensive Code Repair System")


    logging.information("=" * 60)


    # Load configuration


    config_file = "fixer_config.json"


    config = load_config(config_file)


    if not config:


        logging.information(f"❌ Error: Could not load configuration from {config_file}")


        return


    logging.information(f"✅ Configuration loaded from {config_file}")


    # Find repair data_item file


    repair_file = config.get('repair_data_file')


    if not repair_file or not os.path.exists(repair_file):


        repair_file = find_repair_data_file()


        if repair_file:


            logging.information(f"📁 Found repair data_item file: {repair_file}")


        else:


            logging.information("❌ Error: No repair data_item file found")


            logging.information("Please export repair data_item from Enhanced Directory Analyzer first")


            return


    else:


        logging.information(f"📁 Using repair data_item file: {repair_file}")


    # Initialize auto-fixer with configuration


    backup_dir = None


    if config.get('backup_enabled', True):


        backup_dir = config.get('backup_directory', f"backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}")


    logging.information(f"🛡️ Backup directory: {backup_dir}")


    fixer = EnhancedAutoFixer(repair_file, backup_dir)


    # Load and validate repair data_item


    logging.information("📊 Loading repair data_item...")


    repair_data = fixer.load_repair_data()


    if not repair_data:


        logging.information("❌ Error: Could not load repair data_item")


        return


    summary = repair_data.get('summary', {})


    logging.information(f"📈 Files to process: {summary.get('totalFiles', 0)}")


    logging.information(f"🔍 Total issues: {summary.get('totalIssues', 0)}")


    logging.information(f"🔴 Critical issues: {summary.get('criticalIssues', 0)}")


    logging.information(f"🔧 Fixable issues: {summary.get('fixableIssues', 0)}")


    # Show fix priorities


    priorities = config.get('fix_priorities', {})


    logging.information("\n🎯 Fix Priorities:")


    for category, settings in priorities.items():


    # TODO: Consider using list comprehension for better performance


        priority = settings.get('priority', 0)


        enabled = settings.get('enabled', False)


        manual = settings.get('manual_review', False)


        status = "✅" if enabled else "❌"


        manual_note = " (manual review)" if manual else ""


        logging.information(f"   {status} {category.title()} (Priority: {priority}){manual_note}")


    # Confirm before proceeding


    logging.information("\n" + "=" * 60)


    response = input("🚀 Proceed with fixing? (y/N): ").strip().lower()


    if response not in ['y', 'yes', '']:


        logging.information("❌ Operation cancelled by user")


        return


    logging.information("\n🔧 Starting comprehensive code fix...")


    logging.information("This may take several minutes for large codebases...")


    # Process all files


    start_time = datetime.now()


    report = fixer.process_all_files(repair_data)


    end_time = datetime.now()


    duration = end_time - start_time


    # Display final results


    logging.information("\n" + "=" * 60)


    logging.information("🎉 COMPREHENSIVE FIX COMPLETE!")


    logging.information("=" * 60)


    stats = report.get('statistics', {})


    logging.information(f"📊 Files processed: {stats.get('total_files', 0)}")


    logging.information(f"🔍 Total issues: {stats.get('total_issues', 0)}")


    logging.information(f"✅ Fixed issues: {stats.get('fixed_issues', 0)}")


    logging.information(f"❌ Failed fixes: {stats.get('failed_fixes', 0)}")


    logging.information(f"⏭️ Skipped issues: {stats.get('skipped_issues', 0)}")


    logging.information(f"📈 Success rate: {report.get('success_rate', 0):.1f}%")


    logging.information(f"⏱️  Duration: {duration.total_seconds():.1f} seconds")


    if backup_dir:


        logging.information(f"💾 Backups created in: {backup_dir}")


    # Show sample of fix log


    fix_log = report.get('fix_log', [])


    if fix_log:


        logging.information("\n📋 Sample Fix Log:")


        for entry in fix_log[-5:]:  # Last 5 entries


        # TODO: Consider using list comprehension for better performance


            logging.information(f"   {entry}")


    logging.information(f"\n📄 Detailed report saved to: fix_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json")


    logging.information("\n🎯 Next Steps:")


    logging.information("   1. Review the fix report")


    logging.information("   2. Test the fixed code")


    logging.information("   3. Run Enhanced Directory Analyzer again to verify fixes")


    logging.information("   4. Commit changes if satisfied")


if __name__ == "__main__":


    main()


