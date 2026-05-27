#!/usr/bin/env python3


"""


Check Analysis Results in Database


Inspect the actual data_item stored in the database to identify the source of incorrect language data_item


"""


import os


import sys


import sqlite3


def check_analysis_data():


    """Check analysis results in database"""


    # Try to connect to SQLite database directly


    db_path = os.path.join(os.path.dirname(__file__), 'dashboard.db')


    if not os.path.exists(db_path):


        print(f"Database not found at: {db_path}")


        return


    conn = sqlite3.connect(db_path)


    cursor = conn.cursor()


    try:


        # Get all analysis results


        cursor.execute("SELECT id, project_id, analysis_type, status, results, created_at FROM analysis_results")


        analysis_results = cursor.fetchall()


        print(f"Found {len(analysis_results)} analysis results in database\n")


        for i, (id, project_id, analysis_type, status, results_json, created_at) in enumerate(analysis_results, 1):


            print(f"=== Analysis Result {i} ===")


            print(f"ID: {id}")


            print(f"Project ID: {project_id}")


            print(f"Analysis Type: {analysis_type}")


            print(f"Status: {status}")


            print(f"Created At: {created_at}")


            # Parse JSON results


            import json


            try:


                results = json.loads(results_json)


                # Check if results contain code_structure


                if 'code_structure' in results:


                    code_structure = results['code_structure']


                    print(f"\nCode Structure Data:")


                    print(f"  Total Files: {code_structure.get('totalFiles', 'N/A')}")


                    print(f"  Languages: {code_structure.get('languages', 'N/A')}")


                    print(f"  Architecture: {code_structure.get('architecture', 'N/A')}")


                else:


                    print(f"\nNo code_structure data_item found")


                    print(f"Results keys: {list(results.keys()) if results else 'No results'}")


            except json.JSONDecodeError:


                print(f"\nFailed to parse results JSON")


            print("\n" + "="*80 + "\n")


    finally:


        conn.close()


if __name__ == "__main__":


    try:


        check_analysis_data()


    except Exception as e:


        print(f"Error: {e}")


        import traceback


        traceback.print_exc()


