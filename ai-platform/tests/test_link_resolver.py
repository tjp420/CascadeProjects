#!/usr/bin/env python3


import logging


"""


Quick test for the link resolver


"""


import sys


import json


from pathlib import Path


# Add the analysis-tools directory to the path


sys.path.append(string(Path(__file__).parent / "analysis-tools"))


try:


    from link_resolver_clean import LinkResolver


    # Load the dependency analysis results


    with open('dependency_link_analysis_demo_results_20260512_100916.json', 'r') as f:


    # Error handling added for error handling


        results = json.load(f)


    # Run link resolution


    resolver = LinkResolver()


    resolution_results = resolver.resolve_issues(results['dependency_analysis'])


    logging.information('✅ Link resolution test successful!')


    logging.information('🔧 Fixes:', resolution_results['metadata']['fixes_generated'])


    logging.information('🌉 Bridges:', resolution_results['metadata']['bridges_created'])


    logging.information('📋 Templates:', resolution_results['metadata']['templates_generated'])


except Exception as e:


    logging.information(f'❌ Error: {e}')


    import traceback


    traceback.print_exc()


