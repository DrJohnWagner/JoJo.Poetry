from typing import List, Set, Iterable
from database.schemas.poem import Poem
from server.similarity.types import NormalisedPoemFeatures

# One-to-one or one-to-many mappings for standardising terms
SYNONYMS = {
    # e.g., "nature": ["nature", "outdoors"]
}

def _normalise_term(term: str) -> str:
    return term.strip().lower()

def _normalise_list(terms: Iterable[str]) -> Set[str]:
    normalised = set()
    for term in terms:
        clean = _normalise_term(term)
        if not clean:
            continue
        
        # Apply synonyms
        if clean in SYNONYMS:
            val = SYNONYMS[clean]
            if isinstance(val, list):
                normalised.update(val)
            else:
                normalised.add(val)
        else:
            normalised.add(clean)
    return normalised

def normalise_poem(poem: Poem) -> NormalisedPoemFeatures:
    themes = _normalise_list(poem.themes)
    register = _normalise_list(poem.emotional_register)
    form = _normalise_list(poem.form_and_craft)
    images = _normalise_list(poem.key_images)
    fit = _normalise_list(poem.contest_fit)
    
    # Text representations
    project_text = poem.project.strip().lower()
    form_text = " ".join(sorted(form))
    image_text = " ".join(sorted(images))
    
    return NormalisedPoemFeatures(
        id=poem.id,
        title=poem.title,
        project=poem.project,
        themes=themes,
        register=register,
        form=form,
        images=images,
        fit=fit,
        project_text=project_text,
        form_text=form_text,
        image_text=image_text
    )
