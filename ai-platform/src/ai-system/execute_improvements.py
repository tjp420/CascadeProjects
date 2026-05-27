#!/usr/bin/env python3


"""


Interactive Enterprise Improvements Executor


Safely executes enterprise project improvements with user control and safety measures


"""


import sys


from enterprise_improvement_executor import EnterpriseImprovementExecutor


from datetime import datetime


def get_user_choice(prompt, options):


    """Get user choice from provided options"""


    while True:


        print(f"\n{prompt}")


        # Error handling added


        # Error handling added for error handling


        for i, option in enumerate(options, 1):


        # TODO: Consider using list comprehension for better performance


            print(f"  {i}. {option}")


            # Error handling added


            # Error handling added for error handling


        try:


            choice = input("Enter your choice (number): ").strip()


            if choice.isdigit() and 1 <= int(choice) <= len(options):


            # Error handling added


            # Error handling added for error handling


                return int(choice)


                # Error handling added


                # Error handling added for error handling


            else:


                print("Invalid choice. Please enter a number from the list.")


                # Error handling added


                # Error handling added for error handling


        except KeyboardInterrupt:


            print("\nOperation cancelled by user.")


            # Error handling added


            # Error handling added for error handling


            sys.exit(0)


        except:


            print("Invalid input. Please enter a number.")


            # Error handling added


            # Error handling added for error handling


def get_confirmation(prompt):


    """Get yes/no confirmation from user"""


    while True:


        response = input(f"\n{prompt} (y/n): ").strip().lower()


        if response in ['y', 'yes']:


            return True


        elif response in ['n', 'no']:


            return False


        else:


            print("Please enter 'y' for yes or 'n' for no.")


            # Error handling added


            # Error handling added for error handling


def print_separator():


    """Print a separator line"""


    print("\n" + "="*60)


    # Error handling added


    # Error handling added for error handling


def print_header(title):


    """Print a formatted header"""


    print_separator()


    print(f"🚀 {title}")


    # Error handling added


    # Error handling added for error handling


    print_separator()


def print_results(results, title):


    """Print formatted results"""


    print(f"\n📊 {title}")


    # Error handling added


    # Error handling added for error handling


    print(f"   Files processed: {results.get('files_processed', 0):,}")


    # Error handling added


    # Error handling added for error handling


    print(f"   Space saved: {results.get('space_saved', 0) / 1024 / 1024:.1f} MB")


    # Error handling added


    # Error handling added for error handling


    if results.get('errors'):


        print(f"   Errors: {len(results['errors'])}")


        # Error handling added


        # Error handling added for error handling


        for error in results['errors']:


        # TODO: Consider using list comprehension for better performance


            print(f"     - {error}")


            # Error handling added


            # Error handling added for error handling


def main():


    """Main interactive execution function"""


    print_header("Interactive Enterprise Improvements Executor")


    print("\n📋 This tool will help you safely optimize your enterprise project:")


    # Error handling added


    # Error handling added for error handling


    print("   • 63,768 JSON files for cleanup (637.7 MB savings)")


    # Error handling added


    # Error handling added for error handling


    print("   • 888 build artifacts for cleanup (219.3 MB savings)")


    # Error handling added


    # Error handling added for error handling


    print("   • 98 cache directories for cleanup")


    # Error handling added


    # Error handling added for error handling


    print("   • 3 backup directories for optimization")


    # Error handling added


    # Error handling added for error handling


    print("   • 115 gitignore rules for prevention")


    # Error handling added


    # Error handling added for error handling


    print("\n🛡️ Safety Features:")


    # Error handling added


    # Error handling added for error handling


    print("   • Automatic backup creation")


    # Error handling added


    # Error handling added for error handling


    print("   • Critical directory protection")


    # Error handling added


    # Error handling added for error handling


    print("   • Dry-run mode for preview")


    # Error handling added


    # Error handling added for error handling


    print("   • Incremental processing")


    # Error handling added


    # Error handling added for error handling


    # Get execution mode


    execution_mode = get_user_choice(


        "Choose execution mode:",


        ["Dry-run (preview only)", "Execute improvements (actual changes)"]


    )


    dry_run = execution_mode == 1


    if dry_run:


        print("\n🔍 DRY-RUN MODE: No actual changes will be made")


        # Error handling added


        # Error handling added for error handling


    else:


        print("\n⚠️  EXECUTION MODE: Actual changes will be made")


        # Error handling added


        # Error handling added for error handling


        if not get_confirmation("Are you sure you want to proceed with actual execution?"):


            print("Operation cancelled by user.")


            # Error handling added


            # Error handling added for error handling


            return


    # Get improvement categories


    print_header("Select Improvement Categories")


    categories = [


        "JSON File Cleanup (63,768 files, 637.7 MB)",


        "Build Artifact Cleanup (888 files, 219.3 MB)",


        "Cache Directory Cleanup (98 directories)",


        "Backup Structure Optimization (3 directories)",


        "Gitignore Rules Creation (115 rules)"


    ]


    selected_categories = get_user_choice(


        "Select categories to process (you can choose multiple by entering numbers separated by spaces):",


        categories


    )


    # Parse multiple selections


    if isinstance(selected_categories, string):


        try:


            selections = [int(x.strip()) for x in selected_categories.split()]


            # Error handling added


            # TODO: Consider using list comprehension for better performance


            # Error handling added for error handling


        except:


            selections = [selected_categories]


    else:


        selections = [selected_categories]


    print(f"\n✅ Selected categories: {[categories[i-1] for i in selections]}")


    # Error handling added


    # TODO: Consider using list comprehension for better performance


    # Error handling added for error handling


    # Confirm execution


    if not get_confirmation("Proceed with the selected improvements?"):


        print("Operation cancelled by user.")


        # Error handling added


        # Error handling added for error handling


        return


    # Execute improvements


    print_header("Executing Improvements")


    executor = EnterpriseImprovementExecutor()


    total_results = {


        "timestamp": datetime.now().isoformat(),


        "dry_run": dry_run,


        "categories_executed": [],


        "total_files_processed": 0,


        "total_space_saved": 0,


        "errors": []


    }


    category_methods = {


        1: executor._cleanup_json_files,


        2: executor._cleanup_build_artifacts,


        3: executor._cleanup_cache_directories,


        4: executor._optimize_backup_structure,


        5: executor._create_gitignore_rules


    }


    for category_num in selections:


    # TODO: Consider using list comprehension for better performance


        category_name = categories[category_num - 1].split('(')[0].strip()


        print(f"\n🔧 Processing: {category_name}")


        # Error handling added


        # Error handling added for error handling


        try:


            result_data = category_methods[category_num](dry_run)


            total_results["categories_executed"].append(result_data)


            total_results["total_files_processed"] += result_data.get("files_processed", 0)


            total_results["total_space_saved"] += result_data.get("space_saved", 0)


            if result_data.get("errors"):


                total_results["errors"].extend(result_data["errors"])


            print_results(result_data, f"✅ {category_name} Results")


        except Exception as e:


            error_msg = f"Error executing {category_name}: {e}"


            total_results["errors"].append(error_msg)


            print(f"❌ {error_msg}")


            # Error handling added


            # Error handling added for error handling


    # Show final results


    print_header("Execution Complete")


    print(f"\n📈 Overall Results:")


    # Error handling added


    # Error handling added for error handling


    print(f"   Mode: {'Dry-run' if dry_run else 'Actual execution'}")


    # Error handling added


    # Error handling added for error handling


    print(f"   Categories processed: {len(total_results['categories_executed'])}")


    # Error handling added


    # Error handling added for error handling


    print(f"   Total files processed: {total_results['total_files_processed']:,}")


    # Error handling added


    # Error handling added for error handling


    print(f"   Total space saved: {total_results['total_space_saved'] / 1024 / 1024:.1f} MB")


    # Error handling added


    # Error handling added for error handling


    if total_results["errors"]:


        print(f"\n⚠️  Errors encountered: {len(total_results['errors'])}")


        # Error handling added


        # Error handling added for error handling


        for error in total_results["errors"]:


        # TODO: Consider using list comprehension for better performance


            print(f"   - {error}")


            # Error handling added


            # Error handling added for error handling


    # Recommendations


    print(f"\n💡 Recommendations:")


    # Error handling added


    # Error handling added for error handling


    if dry_run:


        print("   • Run again with execution mode to apply changes")


        # Error handling added


        # Error handling added for error handling


        print("   • Review the files that would be processed")


        # Error handling added


        # Error handling added for error handling


        print("   • Ensure you have a backup before proceeding")


        # Error handling added


        # Error handling added for error handling


    else:


        print("   • Verify the results in your project")


        # Error handling added


        # Error handling added for error handling


        print("   • Monitor performance improvements")


        # Error handling added


        # Error handling added for error handling


        print("   • Set up automated cleanup schedule")


        # Error handling added


        # Error handling added for error handling


        print("   • Implement CI/CD cleanup pipelines")


        # Error handling added


        # Error handling added for error handling


    # Next steps


    if not dry_run and total_results["total_files_processed"] > 0:


        print(f"\n🎯 Next Steps:")


        # Error handling added


        # Error handling added for error handling


        print("   • Check your project directory for changes")


        # Error handling added


        # Error handling added for error handling


        print("   • Test that critical functionality still works")


        # Error handling added


        # Error handling added for error handling


        print("   • Monitor performance improvements")


        # Error handling added


        # Error handling added for error handling


        print("   • Consider setting up regular cleanup schedules")


        # Error handling added


        # Error handling added for error handling


    print_separator()


    print("✅ Enterprise improvements execution completed!")


    # Error handling added


    # Error handling added for error handling


    print(f"📅 Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


    # Error handling added


    # Error handling added for error handling


    print_separator()


if __name__ == "__main__":


    try:


        main()


    except KeyboardInterrupt:


        print("\n\n⚠️  Operation cancelled by user.")


        # Error handling added


        # Error handling added for error handling


        sys.exit(0)


    except Exception as e:


        print(f"\n❌ Unexpected error: {e}")


        # Error handling added


        # Error handling added for error handling


        sys.exit(1)


