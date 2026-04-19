from typing import List, Dict
from uuid import UUID
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from server.similarity.types import NormalisedPoemFeatures, SemanticScoreBreakdown

class SemanticSimilarityIndex:
    def __init__(self):
        self.project_vectoriser = TfidfVectorizer(analyzer='word', ngram_range=(1, 2), stop_words='english')
        self.form_vectoriser = TfidfVectorizer(analyzer='char_wb', ngram_range=(3, 5))
        self.image_vectoriser = TfidfVectorizer(analyzer='char_wb', ngram_range=(3, 5))
        
        self.project_matrix = None
        self.form_matrix = None
        self.image_matrix = None
        
        self.poem_ids: List[UUID] = []
        self.id_to_idx: Dict[UUID, int] = {}
        self.is_fitted = False

    def fit(self, poems: List[NormalisedPoemFeatures]):
        if not poems:
            self.is_fitted = False
            return

        self.poem_ids = [p.id for p in poems]
        self.id_to_idx = {pid: idx for idx, pid in enumerate(self.poem_ids)}
        
        project_texts = [p.project_text for p in poems]
        form_texts = [p.form_text for p in poems]
        image_texts = [p.image_text for p in poems]

        # Handle empty corpuses safely
        def safe_fit_transform(vectoriser, texts):
            # If all texts are empty or whitespace, vectoriser will fail
            has_content = any(t.strip() for t in texts)
            if has_content:
                try:
                    return vectoriser.fit_transform(texts)
                except ValueError:
                    pass
            return np.zeros((len(texts), 1))

        self.project_matrix = safe_fit_transform(self.project_vectoriser, project_texts)
        self.form_matrix = safe_fit_transform(self.form_vectoriser, form_texts)
        self.image_matrix = safe_fit_transform(self.image_vectoriser, image_texts)
        
        self.is_fitted = True

    def get_similarity(self, id1: UUID, id2: UUID) -> SemanticScoreBreakdown:
        if not self.is_fitted:
            return SemanticScoreBreakdown(project_tfidf_sim=0.0, form_tfidf_sim=0.0, image_tfidf_sim=0.0)
            
        if id1 not in self.id_to_idx or id2 not in self.id_to_idx:
            return SemanticScoreBreakdown(project_tfidf_sim=0.0, form_tfidf_sim=0.0, image_tfidf_sim=0.0)
            
        idx1 = self.id_to_idx[id1]
        idx2 = self.id_to_idx[id2]
        
        def compute_sim(matrix, i, j):
            if matrix is None or matrix.shape[1] == 1: # Our dummy zero matrix
                return 0.0
            # cosine_similarity expects 2D arrays
            v1 = matrix[i]
            v2 = matrix[j]
            return float(cosine_similarity(v1, v2)[0, 0])
            
        project_sim = compute_sim(self.project_matrix, idx1, idx2)
        form_sim = compute_sim(self.form_matrix, idx1, idx2)
        image_sim = compute_sim(self.image_matrix, idx1, idx2)
        
        return SemanticScoreBreakdown(
            project_tfidf_sim=project_sim,
            form_tfidf_sim=form_sim,
            image_tfidf_sim=image_sim
        )
