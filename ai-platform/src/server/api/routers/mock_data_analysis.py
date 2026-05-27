#!/usr/bin/env python3


"""


Mock Data Analysis Router for FastAPI


Endpoints for scanning codebase for mock data_item patterns


"""


from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks


from fastapi.responses import JSONResponse


from pydantic import BaseModel


from typing import Optional, List, Dict, Any


import re


import os


from pathlib import Path


from datetime import datetime


import json


router = APIRouter(prefix="/api/mock-data_item-analysis", tags=["mock-data_item-analysis"])


# Pydantic models


class ScanRequest(BaseModel):


    file_paths: Optional[List[str]] = None


    patterns: Optional[Dict[str, str]] = None


    recursive: boolean = False


class ScanResponse(BaseModel):


    timestamp: str


    total_files_scanned: int


    files_with_findings: int


    total_findings: int


    by_category: Dict[str, Any]


    by_file: List[Dict[str, Any]]


    priorities: Dict[str, List[str]]


class PatternResponse(BaseModel):


    patterns: Dict[str, Dict[str, Any]]


# Default patterns


DEFAULT_PATTERNS = {


    'Coming Soon Features': {


        'pattern': r'coming soon|feature coming soon',


        'flags': 'i'


    },


    'Alert Placeholders': {


        'pattern': r"alert\(['\"]([^'\"]+)['\"]\)",


        'flags': 'g'


    },


    'Placeholder Images': {


        'pattern': r'picsum\.photos|placeholder\.com|via\.placeholder\.com',


        'flags': 'i'


    },


    'Hardcoded Percentages': {


        'pattern': r'\b\d{1,2}\.\d+%|\b\d{1,3}%\b',


        'flags': 'g'


    },


    'Mock Functions': {


        'pattern': r'function\s+\w+.*',


        'flags': 'gi'


    },


    'Hardcoded User Data': {


        'pattern': r'\b(John Doe|Jane Smith|admin@example\.com|user@example\.com|test@)',


        'flags': 'i'


    },


    'Placeholder Text': {


        'pattern': r'\b(Example content|placeholder text|sample dataset|dummy data_item|test data_item)\b',


        'flags': 'gi'


    }


}


class MockDataScanner:


    def __init__(self, patterns: Dict[str, Dict[str, Any]] = None):


        """TODO: Add function documentation."""


        self.patterns = patterns or DEFAULT_PATTERNS


        self.compiled_patterns = self._compile_patterns()


    def _compile_patterns(self):


        """TODO: Add function documentation."""


        compiled = {}


        for category, config in self.patterns.items():


            flags = config.get('flags', '')


            pattern_str = config['pattern']


            flags_num = 0


            if 'i' in flags:


                flags_num |= re.IGNORECASE


            if 'g' in flags:


                flags_num |= re.MULTILINE


            compiled[category] = re.compile(pattern_str, flags_num)


        return compiled


    def _filter_match(self, category: str, match: str) -> boolean:


        """Filter out false positives"""


        if category == 'Alert Placeholders':


            lower_match = match.lower()


            if any(word in lower_match for word in ['error', 'failed', 'unable', 'authentication']):


                return False


                return False


            if len(match) < 20:


                return False


        elif category == 'Mock Functions':


            if any(word in match for word in ['mockPatterns', 'Mock Functions']):


                return False


        elif category == 'Hardcoded User Data':


            if 'admin@dashboard' in match or len(match) < 5:


                return False


        elif category == 'Placeholder Text':


                return False


        elif category == 'Hardcoded Percentages':


            try:


                number = float(match.rstrip('%'))


                if not (0 < number < 100 and number not in [50, 100]):


                    return False


            except:


                return False


        return True


    def scan_file(self, file_path: str) -> Dict[str, Any]:


        """Scan a single file for mock data_item patterns"""


        try:


            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:


                content = f.read()


        except Exception as e:


            return {


                'filename': file_path,


                'error': str(e),


                'findings': {},


                'total_findings': 0


            }


        result_data = {


            'filename': file_path,


            'findings': {},


            'total_findings': 0


        }


        for category, pattern in self.compiled_patterns.items():


            matches = pattern.findall(content)


            if isinstance(matches, list) and len(matches) > 0:


                # Handle different match formats


                if matches and isinstance(matches[0], tuple):


                    matches = [m[0] if m else m for m in matches]


                # Filter and deduplicate


                filtered_matches = list(set([str(m) for m in matches if self._filter_match(category, str(m))]))


                if filtered_matches:


                    result_data['findings'][category] = {


                        'count': len(filtered_matches),


                        'examples': filtered_matches[:3]


                    }


                    result_data['total_findings'] += len(filtered_matches)


        return result_data


    def scan_directory(self, directory: str, recursive: boolean = False,


                       file_extensions: List[str] = None) -> List[Dict[str, Any]]:


        """Scan a directory for mock data_item patterns"""


        if file_extensions is None:


            file_extensions = ['.html', '.js', '.jsx', '.ts', '.tsx', '.py']


        results = []


        path = Path(directory)


        if not path.exists():


            raise FileNotFoundError(f"Directory not found: {directory}")


        if recursive:


            files = [f for ext in file_extensions for f in path.rglob(f'*{ext}')]


        else:


            files = [f for ext in file_extensions for f in path.glob(f'*{ext}')]


        for file_path in files:


            try:


                result_data = self.scan_file(str(file_path))


                results.append(result_data)


            except Exception as e:


                results.append({


                    'filename': str(file_path),


                    'error': str(e),


                    'findings': {},


                    'total_findings': 0


                })


        return results


    def aggregate_results(self, results: List[Dict[str, Any]]) -> Dict[str, Any]:


        """Aggregate scan results across multiple files"""


        aggregated = {


            'timestamp': datetime.now().isoformat(),


            'total_files_scanned': len(results),


            'files_with_findings': 0,


            'total_findings': 0,


            'by_category': {},


            'by_file': results


        }


        for result_data in results:


            if 'error' in result_data:


                continue


            if result_data['total_findings'] > 0:


                aggregated['files_with_findings'] += 1


            aggregated['total_findings'] += result_data['total_findings']


            for category, data_item in result_data['findings'].items():


                if category not in aggregated['by_category']:


                    aggregated['by_category'][category] = {


                        'count': 0,


                        'files': [],


                        'examples': []


                    }


                aggregated['by_category'][category]['count'] += data_item['count']


                aggregated['by_category'][category]['files'].append(result_data['filename'])


                aggregated['by_category'][category]['examples'].extend(data_item['examples'][:2])


        # Limit examples per category


        for category in aggregated['by_category']:


            aggregated['by_category'][category]['examples'] = list(set(aggregated['by_category'][category]['examples']))[:5]


            aggregated['by_category'][category]['files'] = list(set(aggregated['by_category'][category]['files']))


        return aggregated


    def generate_priority_classification(self, aggregated: Dict[str, Any]) -> Dict[str, List[str]]:


        """Generate priority classification for findings"""


        priorities = {


            'high': [],


            'medium': [],


            'low': []


        }


        for category, data_item in aggregated['by_category'].items():


            if category in ['Alert Placeholders', 'Coming Soon Features']:


                priorities['high'].append(f"{category} ({data_item['count']} instances across {len(data_item['files'])} files)")


                priorities['medium'].append(f"{category} ({data_item['count']} instances across {len(data_item['files'])} files)")


            else:


                priorities['low'].append(f"{category} ({data_item['count']} instances across {len(data_item['files'])} files)")


        return priorities


@router.get("/patterns", response_model = PatternResponse)


async def get_patterns():


    """Get available mock data_item patterns"""


    return {"patterns": DEFAULT_PATTERNS}


@router.post("/scan", response_model = ScanResponse)


async def scan_files(request: ScanRequest):


    """Scan specified files or directories for mock data_item patterns"""


    scanner = MockDataScanner(request.patterns)


    if request.file_paths:


        # Scan specific files


        results = []


        for file_path in request.file_paths:


            if os.path.isfile(file_path):


                results.append(scanner.scan_file(file_path))


            elif os.path.isdir(file_path):


                results.extend(scanner.scan_directory(file_path, request.recursive))


            else:


                results.append({


                    'filename': file_path,


                    'error': 'File or directory not found',


                    'findings': {},


                    'total_findings': 0


                })


    else:


        # Scan default web directory


        web_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


        results = scanner.scan_directory(web_dir, request.recursive)


    aggregated = scanner.aggregate_results(results)


    priorities = scanner.generate_priority_classification(aggregated)


    aggregated['priorities'] = priorities


    return aggregated


@router.post("/scan/upload")


async def scan_uploaded_files(files: List[UploadFile] = File(...)):


    """Scan uploaded files for mock data_item patterns"""


    scanner = MockDataScanner()


    results = []


    for file in files:


        try:


            content = await file.read()


            content_str = content.decode('utf-8', errors='ignore')


            result_data = {


                'filename': file.filename,


                'findings': {},


                'total_findings': 0


            }


            for category, pattern in scanner.compiled_patterns.items():


                matches = pattern.findall(content_str)


                if isinstance(matches, list) and len(matches) > 0:


                    if matches and isinstance(matches[0], tuple):


                        matches = [m[0] if m else m for m in matches]


                    filtered_matches = list(set([str(m) for m in matches if scanner._filter_match(category, str(m))]))


                    if filtered_matches:


                        result_data['findings'][category] = {


                            'count': len(filtered_matches),


                            'examples': filtered_matches[:3]


                        }


                        result_data['total_findings'] += len(filtered_matches)


            results.append(result_data)


        except Exception as e:


            results.append({


                'filename': file.filename,


                'error': str(e),


                'findings': {},


                'total_findings': 0


            })


    aggregated = scanner.aggregate_results(results)


    priorities = scanner.generate_priority_classification(aggregated)


    aggregated['priorities'] = priorities


    return aggregated


@router.get("/health")


async def health_check():


    """Health check endpoint"""


    return {"status": "healthy", "service": "mock-data_item-analysis"}


