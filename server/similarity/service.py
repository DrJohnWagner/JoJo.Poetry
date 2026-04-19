from typing import List, Optional
from uuid import UUID
from database.schemas.poem import Poem
from server.similarity.types import (
    NormalisedPoemFeatures,
    FusedScoreBreakdown,
    NeighbourResult,
    NeighbourListResult
)
from server.similarity.normalise import normalise_poem
from server.similarity.structured import compute_structured_similarity
from server.similarity.semantic import SemanticSimilarityIndex
from server.similarity.fusion import compute_fused_similarity

class PoemSimilarityService:
    def __init__(self):
        self.poems: List[NormalisedPoemFeatures] = []
        self.semantic_index = SemanticSimilarityIndex()
        self.poem_map = {}

    def rebuild(self, poems: List[Poem]) -> None:
        self.poems = [normalise_poem(p) for p in poems]
        self.poem_map = {p.id: p for p in self.poems}
        self.semantic_index.fit(self.poems)

    def _get_neighbours(self, query_id: UUID, sort_key: callable, k: int) -> Optional[NeighbourListResult]:
        if query_id not in self.poem_map:
            return None

        query_poem = self.poem_map[query_id]
        
        results = []
        for target in self.poems:
            if target.id == query_id:
                continue
                
            struct_sim = compute_structured_similarity(query_poem, target)
            sem_sim = self.semantic_index.get_similarity(query_id, target.id)
            fused_sim = compute_fused_similarity(struct_sim, sem_sim)
            
            results.append(NeighbourResult(
                id=target.id,
                title=target.title,
                project=target.project,
                score=sort_key(fused_sim),
                breakdown=fused_sim
            ))

        # Sort: score desc, then id asc (UUID as string for stable sorting)
        results.sort(key=lambda x: (-x.score, str(x.id)))
        
        return NeighbourListResult(
            query_id=query_id,
            neighbours=results[:k]
        )

    def get_overall_similar(self, query_id: UUID, k: int = 5) -> Optional[NeighbourListResult]:
        return self._get_neighbours(query_id, lambda f: f.overall_score, k)

    def get_theme_similar(self, query_id: UUID, k: int = 5) -> Optional[NeighbourListResult]:
        return self._get_neighbours(query_id, lambda f: f.theme_score, k)

    def get_form_similar(self, query_id: UUID, k: int = 5) -> Optional[NeighbourListResult]:
        return self._get_neighbours(query_id, lambda f: f.form_score, k)

    def get_register_similar(self, query_id: UUID, k: int = 5) -> Optional[NeighbourListResult]:
        return self._get_neighbours(query_id, lambda f: f.register_score, k)

    def get_imagery_similar(self, query_id: UUID, k: int = 5) -> Optional[NeighbourListResult]:
        return self._get_neighbours(query_id, lambda f: f.imagery_score, k)

# Global service instance
_similarity_service: Optional[PoemSimilarityService] = None

def get_similarity_service() -> PoemSimilarityService:
    if _similarity_service is None:
        raise RuntimeError("Similarity service not initialized")
    return _similarity_service

def init_similarity_service(poems: List[Poem]) -> PoemSimilarityService:
    global _similarity_service
    _similarity_service = PoemSimilarityService()
    _similarity_service.rebuild(poems)
    return _similarity_service

def rebuild_similarity_service(poems: List[Poem]) -> None:
    if _similarity_service:
        _similarity_service.rebuild(poems)
