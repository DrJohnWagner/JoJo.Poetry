from server.similarity.types import StructuredScoreBreakdown, SemanticScoreBreakdown, FusedScoreBreakdown

# Weights for blending structured vs semantic per axis
# Structured dominates (e.g., 0.8 / 0.2)
THEME_WEIGHTS = {"struct": 1.0, "sem": 0.0}       # Themes don't have a specific text field here, so just structured
FORM_WEIGHTS = {"struct": 0.8, "sem": 0.2}        # form metadata vs form_text
IMAGERY_WEIGHTS = {"struct": 0.8, "sem": 0.2}     # images metadata vs image_text
EMOTION_WEIGHTS = {"struct": 1.0, "sem": 0.0}    # no text field for register

# Weights for overall fusion
OVERALL_AXES_WEIGHTS = {
    "theme": 0.30,
    "form": 0.20,
    "emotion": 0.15,
    "imagery": 0.15,
    "fit": 0.10,          # struct only
    "project": 0.10       # sem only (project_tfidf_sim)
}

def compute_fused_similarity(struct: StructuredScoreBreakdown, sem: SemanticScoreBreakdown) -> FusedScoreBreakdown:
    theme_score = struct.theme_sim * THEME_WEIGHTS["struct"]
    
    form_score = (struct.form_sim * FORM_WEIGHTS["struct"]) + (sem.form_tfidf_sim * FORM_WEIGHTS["sem"])
    
    emotion_score = struct.emotion_sim * EMOTION_WEIGHTS["struct"]
    
    imagery_score = (struct.imagery_sim * IMAGERY_WEIGHTS["struct"]) + (sem.image_tfidf_sim * IMAGERY_WEIGHTS["sem"])
    
    fit_score = struct.fit_sim
    project_score = sem.project_tfidf_sim
    
    overall_score = (
        theme_score * OVERALL_AXES_WEIGHTS["theme"] +
        form_score * OVERALL_AXES_WEIGHTS["form"] +
        emotion_score * OVERALL_AXES_WEIGHTS["emotion"] +
        imagery_score * OVERALL_AXES_WEIGHTS["imagery"] +
        fit_score * OVERALL_AXES_WEIGHTS["fit"] +
        project_score * OVERALL_AXES_WEIGHTS["project"]
    )
    
    return FusedScoreBreakdown(
        overall_score=overall_score,
        theme_score=theme_score,
        form_score=form_score,
        emotion_score=emotion_score,
        imagery_score=imagery_score,
        structured=struct,
        semantic=sem
    )
