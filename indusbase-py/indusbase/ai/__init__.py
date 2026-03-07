"""
IndusBase AI module.

Provides AI/RAG functionality including vector embeddings and semantic search.
"""

from indusbase.ai.client import AIClient, AsyncAIClient, SyncCollectionClient, AsyncCollectionClient

__all__ = [
    "AIClient",
    "AsyncAIClient",
    "SyncCollectionClient",
    "AsyncCollectionClient",
]
