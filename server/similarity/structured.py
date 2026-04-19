from typing import Set, Tuple
from server.similarity.types import NormalisedPoemFeatures, StructuredScoreBreakdown

def jaccard_similarity(set1: Set[str], set2: Set[str]) -> Tuple[float, list[str]]:
    if not set1 and not set2:
        return 0.0, [] # Or 1.0? Usually 0 if both empty for similarity, let's say 0.0 to avoid artificial boosting
    intersection = set1.intersection(set2)
    union = set1.union(set2)
    if not union:
        return 0.0, []
    score = len(intersection) / len(union)
    return score, sorted(list(intersection))

def compute_structured_similarity(p1: NormalisedPoemFeatures, p2: NormalisedPoemFeatures) -> StructuredScoreBreakdown:
    theme_sim, theme_overlap = jaccard_similarity(p1.themes, p2.themes)
    register_sim, register_overlap = jaccard_similarity(p1.register, p2.register)
    form_sim, form_overlap = jaccard_similarity(p1.form, p2.form)
    imagery_sim, imagery_overlap = jaccard_similarity(p1.images, p2.images)
    fit_sim, fit_overlap = jaccard_similarity(p1.fit, p2.fit)
    
    return StructuredScoreBreakdown(
        theme_sim=theme_sim,
        register_sim=register_sim,
        form_sim=form_sim,
        imagery_sim=imagery_sim,
        fit_sim=fit_sim,
        theme_overlap=theme_overlap,
        register_overlap=register_overlap,
        form_overlap=form_overlap,
        imagery_overlap=imagery_overlap,
        fit_overlap=fit_overlap
    )
