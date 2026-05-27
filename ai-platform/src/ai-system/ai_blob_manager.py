#!/usr/bin/env python3
"""
AI-Enhanced Blob Manager
Integrates real AI capabilities with the blob management system
"""

import os
import json
import hashlib
import logging
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime

# Import enhanced AI service
ENHANCED_AI_AVAILABLE = False
get_ai_service_backup = None
is_ai_available_backup = None

try:
    from ai_service_enhanced import get_enhanced_ai_service, is_enhanced_ai_available
    ENHANCED_AI_AVAILABLE = True
except ImportError:
    pass

if not ENHANCED_AI_AVAILABLE:
    from ai_service import get_ai_service, is_ai_available
    get_ai_service_backup = get_ai_service
    is_ai_available_backup = is_ai_available

# Create availability check function
def is_ai_available():
    """Check if AI service is available"""
    if ENHANCED_AI_AVAILABLE:
        return is_enhanced_ai_available()
    else:
        return is_ai_available()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AIBlobManager:
    """AI-enhanced blob manager with real AI capabilities"""
    
    def __init__(self, blobs_dir: str = None):
        self.blobs_dir = Path(blobs_dir) if blobs_dir else Path("blobs")
        if ENHANCED_AI_AVAILABLE:
            self.ai_service = get_enhanced_ai_service()
        else:
            self.ai_service = get_ai_service()
        self.blob_cache = {}
        self.analysis_cache = {}
        
        # Ensure blobs directory exists
        self.blobs_dir.mkdir(exist_ok=True)
        
        logger.info(f"🤖 AI Blob Manager initialized")
        logger.info(f"📁 Blobs directory: {self.blobs_dir}")
        if ENHANCED_AI_AVAILABLE:
            logger.info(f"🤖 AI Available: {is_enhanced_ai_available()}")
        else:
            logger.info(f"🤖 AI Available: {is_ai_available()}")
    
    def get_blob_info(self, blob_hash: str) -> Dict[str, Any]:
        """Get blob information by hash"""
        blob_file = self.blobs_dir / blob_hash
        
        if not blob_file.exists():
            return {"error": f"Blob {blob_hash} not found"}
        
        try:
            with open(blob_file, 'r', encoding='utf-8') as f:
                blob_data = json.load(f)
            
            return {
                "hash": blob_hash,
                "file_path": str(blob_file),
                "size": blob_file.stat().st_size,
                "modified": datetime.fromtimestamp(blob_file.stat().st_mtime).isoformat(),
                "metadata": blob_data
            }
        except Exception as e:
            logger.error(f"❌ Error reading blob {blob_hash}: {e}")
            return {"error": f"Failed to read blob: {str(e)}"}
    
    def analyze_blobs_with_ai(self) -> Dict[str, Any]:
        """Analyze all blobs using AI"""
        logger.info("🤖 Running AI-powered blob analysis...")
        
        analysis = {
            "timestamp": datetime.now().isoformat(),
            "total_blobs": 0,
            "blob_types": {},
            "ai_insights": "",
            "recommendations": [],
            "blob_details": []
        }
        
        # Get all blob files
        blob_files = list(self.blobs_dir.glob("sha256-*"))
        analysis["total_blobs"] = len(blob_files)
        
        # Analyze each blob
        blob_types = {}
        for blob_file in blob_files:
            blob_info = self.get_blob_info(blob_file.name)
            if "error" not in blob_info:
                metadata = blob_info.get("metadata", {})
                blob_type = metadata.get("model_type", "unknown")
                
                if blob_type not in blob_types:
                    blob_types[blob_type] = 0
                blob_types[blob_type] += 1
                
                analysis["blob_details"].append({
                    "hash": blob_file.name,
                    "type": blob_type,
                    "size": blob_info["size"],
                    "model_family": metadata.get("model_family", "unknown"),
                    "architecture": metadata.get("architecture", "unknown"),
                    "os": metadata.get("os", "unknown")
                })
        
        analysis["blob_types"] = blob_types
        
        # AI analysis if available
        if is_ai_available():
            try:
                # Prepare blob summary for AI analysis
                blob_summary = self._prepare_blob_summary(analysis)
                ai_insights = self.ai_service.analyze_code(
                    blob_summary, 
                    "Blob management system analysis"
                )
                analysis["ai_insights"] = ai_insights
                
                # Generate AI recommendations
                recommendations = self._generate_ai_recommendations(analysis)
                analysis["recommendations"] = recommendations
                
                logger.info("✅ AI-powered blob analysis completed")
            except Exception as e:
                logger.error(f"❌ Error in AI blob analysis: {e}")
                analysis["ai_insights"] = "AI analysis unavailable"
                analysis["recommendations"] = self._generate_fallback_recommendations(analysis)
        else:
            analysis["ai_insights"] = "AI service not available"
            analysis["recommendations"] = self._generate_fallback_recommendations(analysis)
        
        return analysis
    
    def _prepare_blob_summary(self, analysis: Dict[str, Any]) -> str:
        """Prepare blob summary for AI analysis"""
        summary_parts = [
            f"Blob Management System Analysis:",
            f"Total blobs: {analysis['total_blobs']}",
            f"Blob types: {list(analysis['blob_types'].keys())}",
            f"Blob distribution: {analysis['blob_types']}"
        ]
        
        # Add details about each blob
        if analysis.get("blob_details"):
            summary_parts.append("\nBlob Details:")
            for blob in analysis["blob_details"][:5]:  # Limit to first 5
                summary_parts.append(
                    f"- {blob['hash'][:16]}...: {blob['type']} ({blob['model_family']})"
                )
        
        return "\n".join(summary_parts)
    
    def _generate_ai_recommendations(self, analysis: Dict[str, Any]) -> List[str]:
        """Generate AI-powered recommendations"""
        try:
            recommendations_text = self.ai_service.generate_recommendations(analysis)
            # Parse recommendations
            recommendations = [line.strip() for line in recommendations_text.split('\n') if line.strip()]
            return recommendations[:10]  # Limit to 10 recommendations
        except Exception as e:
            logger.error(f"❌ Error generating AI recommendations: {e}")
            return self._generate_fallback_recommendations(analysis)
    
    def _generate_fallback_recommendations(self, analysis: Dict[str, Any]) -> List[str]:
        """Generate fallback recommendations when AI is not available"""
        recommendations = []
        
        blob_types = analysis.get("blob_types", {})
        total_blobs = analysis.get("total_blobs", 0)
        
        if total_blobs == 0:
            recommendations.append("📦 No blobs found - consider adding model blobs")
            recommendations.append("🔍 Check blob directory configuration")
        else:
            recommendations.append(f"📊 Found {total_blobs} blobs in system")
            
            # Type-specific recommendations
            if "llama" in blob_types:
                recommendations.append("🦙 LLaMA models detected - ensure compatibility")
                recommendations.append("⚡ Consider optimizing LLaMA model performance")
            
            if blob_types.get("unknown", 0) > 0:
                recommendations.append("❓ Found unknown blob types - investigate metadata")
                recommendations.append("🏷️ Consider adding proper metadata to unknown blobs")
            
            # Size-based recommendations
            large_blobs = [b for b in analysis.get("blob_details", []) if b.get("size", 0) > 1000000]
            if large_blobs:
                recommendations.append(f"📈 Found {len(large_blobs)} large blobs - consider optimization")
                recommendations.append("💾 Implement blob compression if needed")
        
        if not recommendations:
            recommendations.append("✅ Blob system appears well-organized")
            recommendations.append("📊 Continue monitoring blob health")
        
        return recommendations
    
    def get_blob_statistics(self) -> Dict[str, Any]:
        """Get comprehensive blob statistics"""
        stats = {
            "timestamp": datetime.now().isoformat(),
            "total_blobs": 0,
            "total_size": 0,
            "blob_types": {},
            "architectures": {},
            "operating_systems": {},
            "model_families": {},
            "file_types": {}
        }
        
        # Analyze all blobs
        blob_files = list(self.blobs_dir.glob("sha256-*"))
        stats["total_blobs"] = len(blob_files)
        
        for blob_file in blob_files:
            blob_info = self.get_blob_info(blob_file.name)
            if "error" not in blob_info:
                metadata = blob_info.get("metadata", {})
                size = blob_info.get("size", 0)
                
                stats["total_size"] += size
                
                # Count blob types
                blob_type = metadata.get("model_type", "unknown")
                if blob_type not in stats["blob_types"]:
                    stats["blob_types"][blob_type] = 0
                stats["blob_types"][blob_type] += 1
                
                # Count architectures
                arch = metadata.get("architecture", "unknown")
                if arch not in stats["architectures"]:
                    stats["architectures"][arch] = 0
                stats["architectures"][arch] += 1
                
                # Count operating systems
                os_type = metadata.get("os", "unknown")
                if os_type not in stats["operating_systems"]:
                    stats["operating_systems"][os_type] = 0
                stats["operating_systems"][os_type] += 1
                
                # Count model families
                model_family = metadata.get("model_family", "unknown")
                if model_family not in stats["model_families"]:
                    stats["model_families"][model_family] = 0
                stats["model_families"][model_family] += 1
                
                # Count file types
                file_type = metadata.get("file_type", "unknown")
                if file_type not in stats["file_types"]:
                    stats["file_types"][file_type] = 0
                stats["file_types"][file_type] += 1
        
        return stats
    
    def optimize_blob_storage(self) -> Dict[str, Any]:
        """Optimize blob storage using AI recommendations"""
        logger.info("⚡ Starting AI-powered blob storage optimization...")
        
        optimization = {
            "timestamp": datetime.now().isoformat(),
            "actions_taken": [],
            "recommendations": [],
            "ai_insights": ""
        }
        
        # Get current statistics
        stats = self.get_blob_statistics()
        
        # AI optimization if available
        if is_ai_available():
            try:
                # Prepare optimization context
                context = f"Blob storage optimization: {stats['total_blobs']} blobs, {stats['total_size']} bytes total"
                
                # Get AI optimization recommendations
                ai_optimization = self.ai_service.optimize_code(
                    json.dumps(stats, indent=2),
                    [{"description": "Large blob storage", "severity": "medium"}]
                )
                optimization["ai_insights"] = ai_optimization
                optimization["actions_taken"].append("AI-powered optimization analysis completed")
                
                logger.info("✅ AI-powered blob optimization completed")
            except Exception as e:
                logger.error(f"❌ Error in AI blob optimization: {e}")
                optimization["ai_insights"] = "AI optimization unavailable"
        else:
            optimization["ai_insights"] = "AI service not available for optimization"
        
        # Basic optimization actions
        if stats.get("total_blobs", 0) > 100:
            optimization["actions_taken"].append("Consider blob archiving for old/unused blobs")
        
        if stats.get("total_size", 0) > 1000000000:  # 1GB
            optimization["actions_taken"].append("Consider blob compression for large storage")
        
        # Generate recommendations
        optimization["recommendations"] = self._generate_optimization_recommendations(stats)
        
        return optimization
    
    def _generate_optimization_recommendations(self, stats: Dict[str, Any]) -> List[str]:
        """Generate optimization recommendations"""
        recommendations = []
        
        total_blobs = stats.get("total_blobs", 0)
        total_size = stats.get("total_size", 0)
        
        if total_blobs > 50:
            recommendations.append(f"📊 Consider archiving old blobs (found {total_blobs} blobs)")
        
        if total_size > 500000000:  # 500MB
            recommendations.append(f"💾 Consider compression (total size: {total_size / (1024*1024):.1f}MB)")
        
        # Check for duplicate model types
        blob_types = stats.get("blob_types", {})
        for blob_type, count in blob_types.items():
            if count > 5:
                recommendations.append(f"🔄 Consider consolidating {count} {blob_type} blobs")
        
        # Check for unused architectures
        archs = stats.get("architectures", {})
        if len(archs) > 3:
            recommendations.append(f"🏗️ Review architecture diversity: {list(archs.keys())}")
        
        if not recommendations:
            recommendations.append("✅ Blob storage appears optimized")
            recommendations.append("📊 Continue monitoring storage efficiency")
        
        return recommendations
    
    def search_blobs(self, query: str) -> Dict[str, Any]:
        """Search blobs using AI-powered semantic search"""
        logger.info(f"🔍 Searching blobs with query: {query}")
        
        results = {
            "query": query,
            "timestamp": datetime.now().isoformat(),
            "matches": [],
            "ai_insights": ""
        }
        
        # Get all blobs
        blob_files = list(self.blobs_dir.glob("sha256-*"))
        
        # Basic keyword search
        for blob_file in blob_files:
            blob_info = self.get_blob_info(blob_file.name)
            if "error" not in blob_info:
                metadata = blob_info.get("metadata", {})
                
                # Search in metadata
                metadata_str = json.dumps(metadata, indent=2).lower()
                if query.lower() in metadata_str:
                    results["matches"].append({
                        "hash": blob_file.name,
                        "metadata": metadata,
                        "relevance": "keyword_match"
                    })
        
        # AI-powered semantic search if available
        if is_ai_available() and len(results["matches"]) < 5:
            try:
                # Prepare search context
                search_context = f"Blob search for: {query}\nFound {len(results['matches'])} keyword matches"
                
                # Get AI search assistance
                ai_search = self.ai_service.get_ai_assistance(
                    f"Search blobs for: {query}",
                    search_context
                )
                results["ai_insights"] = ai_search
                
                # Parse AI suggestions for additional matches
                if "recommendation" in ai_search.lower() or "suggest" in ai_search.lower():
                    results["ai_insights"] += f"\n\nAI suggests: {ai_search}"
                
                logger.info("✅ AI-powered blob search completed")
            except Exception as e:
                logger.error(f"❌ Error in AI blob search: {e}")
                results["ai_insights"] = "AI search unavailable"
        
        results["total_matches"] = len(results["matches"])
        
        return results
    
    def get_ai_blob_insights(self) -> Dict[str, Any]:
        """Get comprehensive AI insights about the blob system"""
        logger.info("🤖 Generating comprehensive AI blob insights...")
        
        insights = {
            "timestamp": datetime.now().isoformat(),
            "ai_available": is_ai_available(),
            "insights": "",
            "recommendations": [],
            "analysis": {}
        }
        
        if not is_ai_available():
            insights["insights"] = "AI service not available for insights"
            insights["recommendations"] = ["Configure AI service for enhanced insights"]
            return insights
        
        try:
            # Get comprehensive blob analysis
            blob_analysis = self.analyze_blobs_with_ai()
            stats = self.get_blob_statistics()
            
            # Generate comprehensive AI insights
            context = f"""
            Comprehensive Blob System Analysis:
            - Total blobs: {blob_analysis['total_blobs']}
            - Blob types: {list(blob_analysis['blob_types'].keys())}
            - Total size: {stats['total_size']} bytes
            - Architectures: {list(stats['architectures'].keys())}
            - Model families: {list(stats['model_families'].keys())}
            """
            
            ai_insights = self.ai_service.get_ai_assistance(
                "Provide comprehensive insights about this blob management system",
                context
            )
            
            insights["insights"] = ai_insights
            insights["analysis"] = blob_analysis
            insights["statistics"] = stats
            
            # Generate strategic recommendations
            strategic_recommendations = self.ai_service.get_ai_assistance(
                "What are the strategic recommendations for optimizing this blob system?",
                context
            )
            
            insights["recommendations"] = [
                line.strip() for line in strategic_recommendations.split('\n') if line.strip()
            ][:10]
            
            logger.info("✅ Comprehensive AI blob insights generated")
            
        except Exception as e:
            logger.error(f"❌ Error generating AI blob insights: {e}")
            insights["insights"] = f"Error generating insights: {str(e)}"
            insights["recommendations"] = ["Check blob system configuration"]
        
        return insights

# Global instance
_ai_blob_manager = None

def get_ai_blob_manager(blobs_dir: str = None) -> AIBlobManager:
    """Get or create AI blob manager instance"""
    global _ai_blob_manager
    if _ai_blob_manager is None:
        _ai_blob_manager = AIBlobManager(blobs_dir)
    return _ai_blob_manager
