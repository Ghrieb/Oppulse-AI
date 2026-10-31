"""Intent classification for student messages.

Determines what the student is trying to do so the assistant can route
to the appropriate handler without running the full research pipeline
for every message.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from enum import Enum
from typing import Any, Optional, Literal

from .providers.base import ModelProvider
from .types import IntentType


class IntentConfidence(Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


@dataclass(frozen=True)
class ClassifiedIntent:
    """The result of intent classification."""
    intent: IntentType
    confidence: IntentConfidence
    entities: dict[str, Any]
    reasoning: str
    suggested_handler: str


# Deterministic patterns for common intents (no Groq call needed)
GREETING_PATTERNS = [
    r"^\s*(hi|hello|hey|hiya|howdy)\s*[!.?]*\s*$",
    r"^\s*(good\s+(morning|afternoon|evening))\s*[!.?]*\s*$",
]

CASUAL_PATTERNS = [
    r"^\s*(how\s+are\s+you|how's\s+it\s+going|what's\s+up)\s*[!.?]*\s*$",
    r"^\s*(thanks?|thank\s+you|cheers)\s*[!.?]*\s*$",
    r"^\s*(ok|okay|sure|alright|cool|great|awesome)\s*[!.?]*\s*$",
    r"^\s*(bye|goodbye|see\s+you|take\s+care)\s*[!.?]*\s*$",
]

URL_PATTERN = re.compile(
    r"https?://(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*)"
)

SHORT_REPLY_PATTERNS = [
    r"^\s*(what\??|why\??|huh\??|hmm\??)\s*$",
    r"^\s*(yes|yeah|yep|no|nope|maybe|idk|i\s+don't\s+know)\s*[!.?]*\s*$",
    r"^\s*(germany|france|uk|usa|canada|australia|netherlands|sweden|norway|denmark|italy|spain)\s*[!.?]*\s*$",
    r"^\s*(funded|fully\s+funded|partial|scholarship|fellowship|grant)\s*[!.?]*\s*$",
    r"^\s*(bachelor|master|phd|ph\.d|undergrad|postgrad)\s*[!.?]*\s*$",
    r"^\s*(computer\s+science|ai|ml|machine\s+learning|biology|physics|math|engineering)\s*[!.?]*\s*$",
]

GENERAL_QUESTION_PATTERNS = [
    r"^\s*what\s+(does|is|are)\s+.*\??\s*$",
    r"^\s*how\s+(does|is|are|to)\s+.*\??\s*$",
    r"^\s*define\s+.*\??\s*$",
    r"^\s*explain\s+.*\??\s*$",
    r"^\s*meaning\s+of\s+.*\??\s*$",
]

FUNDING_QUESTION_PATTERNS = [
    r".*\b(fully\s+funded|funding|scholarship|stipend|tuition|living\s+allowance|travel|insurance)\b.*\??",
]

ELIGIBILITY_PATTERNS = [
    r".*\b(eligible|eligibility|qualify|requirement|require|prerequisite)\b.*\??",
]

PREFERENCE_CHANGE_PATTERNS = [
    r"^\s*(actually|instead|rather|change|update|prefer)\s+.*",
    r".*\b(prefer|preference|want|need|looking\s+for)\b.*",
]

APPLICATION_PATTERNS = [
    r".*\b(apply|application|essay|statement|motivation|letter|recommendation|reference|cv|resume)\b.*",
]

CV_PROFILE_PATTERNS = [
    r".*\b(cv|resume|profile|transcript|degree|certificate|transcript|grades|gpa)\b.*",
]

CLARIFICATION_PATTERNS = [
    r"^\s*(what|why|how|when|where|who)\??\s*$",
    r"^\s*(sorry|confused|unclear|don't\s+understand|doesn't\s+make\s+sense)\s*[!.?]*\s*$",
]


def classify_deterministic(text: str, context: Optional[dict[str, Any]] = None) -> Optional[ClassifiedIntent]:
    """
    Fast path: classify using regex patterns only.
    Returns None if no pattern matches (fall back to Groq).
    """
    normalized = text.strip().lower()
    
    # URL detection (highest priority - explicit action)
    if URL_PATTERN.search(text):
        return ClassifiedIntent(
            intent="URL_ANALYSIS",
            confidence=IntentConfidence.HIGH,
            entities={"url": URL_PATTERN.search(text).group(0)},
            reasoning="URL detected in message",
            suggested_handler="url_analysis",
        )
    
    # Greeting
    for pattern in GREETING_PATTERNS:
        if re.match(pattern, normalized):
            return ClassifiedIntent(
                intent="GREETING",
                confidence=IntentConfidence.HIGH,
                entities={},
                reasoning="Greeting pattern matched",
                suggested_handler="greeting",
            )
    
    # Casual conversation
    for pattern in CASUAL_PATTERNS:
        if re.match(pattern, normalized):
            return ClassifiedIntent(
                intent="CASUAL",
                confidence=IntentConfidence.HIGH,
                entities={},
                reasoning="Casual pattern matched",
                suggested_handler="casual",
            )
    
    # Short reply - interpret from context
    for pattern in SHORT_REPLY_PATTERNS:
        if re.match(pattern, normalized):
            return ClassifiedIntent(
                intent="FOLLOWUP",
                confidence=IntentConfidence.MEDIUM,
                entities={"reply": text.strip()},
                reasoning="Short reply, needs context",
                suggested_handler="followup",
            )
    
    # General knowledge question
    for pattern in GENERAL_QUESTION_PATTERNS:
        if re.match(pattern, normalized):
            return ClassifiedIntent(
                intent="GENERAL_QUESTION",
                confidence=IntentConfidence.MEDIUM,
                entities={"question": text.strip()},
                reasoning="General question pattern matched",
                suggested_handler="general_question",
            )
    
    # Funding question
    for pattern in FUNDING_QUESTION_PATTERNS:
        if re.search(pattern, normalized):
            return ClassifiedIntent(
                intent="FUNDING_QUESTION",
                confidence=IntentConfidence.MEDIUM,
                entities={"question": text.strip()},
                reasoning="Funding-related question",
                suggested_handler="funding_question",
            )
    
    # Eligibility question
    for pattern in ELIGIBILITY_PATTERNS:
        if re.search(pattern, normalized):
            return ClassifiedIntent(
                intent="ELIGIBILITY_QUESTION",
                confidence=IntentConfidence.MEDIUM,
                entities={"question": text.strip()},
                reasoning="Eligibility-related question",
                suggested_handler="eligibility_question",
            )
    
    # Preference change
    for pattern in PREFERENCE_CHANGE_PATTERNS:
        if re.search(pattern, normalized):
            return ClassifiedIntent(
                intent="PREFERENCE_CHANGE",
                confidence=IntentConfidence.MEDIUM,
                entities={"statement": text.strip()},
                reasoning="Preference change detected",
                suggested_handler="preference_change",
            )
    
    # Application help
    for pattern in APPLICATION_PATTERNS:
        if re.search(pattern, normalized):
            return ClassifiedIntent(
                intent="APPLICATION_HELP",
                confidence=IntentConfidence.MEDIUM,
                entities={"statement": text.strip()},
                reasoning="Application-related request",
                suggested_handler="application_help",
            )
    
    # CV/Profile question
    for pattern in CV_PROFILE_PATTERNS:
        if re.search(pattern, normalized):
            return ClassifiedIntent(
                intent="CV_QUESTION",
                confidence=IntentConfidence.MEDIUM,
                entities={"statement": text.strip()},
                reasoning="CV/profile-related request",
                suggested_handler="cv_question",
            )
    
    # Clarification
    for pattern in CLARIFICATION_PATTERNS:
        if re.match(pattern, normalized):
            return ClassifiedIntent(
                intent="CLARIFICATION",
                confidence=IntentConfidence.MEDIUM,
                entities={"question": text.strip()},
                reasoning="Clarification request",
                suggested_handler="clarification",
            )
    
    # Discovery request - broad pattern
    discovery_keywords = [
        "find", "search", "look for", "discover", "explore", "opportunities",
        "internship", "scholarship", "fellowship", "programme", "program",
        "summer school", "conference", "research", "study", "master", "phd",
        "bachelor", "grant", "funding", "position", "placement"
    ]
    if any(kw in normalized for kw in discovery_keywords):
        return ClassifiedIntent(
            intent="DISCOVERY",
            confidence=IntentConfidence.LOW,
            entities={"statement": text.strip()},
            reasoning="Discovery keywords detected",
            suggested_handler="discovery",
        )
    
    return None


async def classify_with_groq(
    provider: ModelProvider,
    text: str,
    context: Optional[dict[str, Any]] = None
) -> ClassifiedIntent:
    """
    Fallback: use Groq to classify ambiguous messages.
    """
    system_prompt = """You are an intent classifier for an academic opportunity adviser.
Classify the student's message into exactly one of these intents:

- GREETING: Hello, hi, hey, good morning
- CASUAL: How are you, thanks, bye, okay
- GENERAL_QUESTION: What is X, explain Y, define Z
- DISCOVERY: Find opportunities, search for internships
- URL_ANALYSIS: A URL was pasted
- FOLLOWUP: Short reply like "Germany", "funded", "yes", "what?"
- PREFERENCE_CHANGE: "Actually I want...", "I prefer..."
- ELIGIBILITY_QUESTION: "Am I eligible?", "What are requirements?"
- FUNDING_QUESTION: "What does fully funded mean?"
- APPLICATION_HELP: "Help me apply", "write my essay"
- CV_QUESTION: "Upload CV", "my profile", "my grades"
- CLARIFICATION: "What?", "Why?", "I don't understand"
- OUT_OF_SCOPE: Unrelated to academic opportunities

Return JSON: {"intent": "INTENT_NAME", "confidence": "high|medium|low", "entities": {}, "reasoning": "..."}"""

    user_prompt = f"""Student message: "{text}"

Context: {context or 'No prior context'}

Classify this message."""

    try:
        response = await provider.chat(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.1,
            max_tokens=200,
        )
        
        import json
        result = json.loads(response.content)
        
        return ClassifiedIntent(
            intent=result["intent"],
            confidence=IntentConfidence(result["confidence"]),
            entities=result.get("entities", {}),
            reasoning=result.get("reasoning", "Groq classification"),
            suggested_handler=result["intent"].lower(),
        )
    except Exception:
        # Ultimate fallback
        return ClassifiedIntent(
            intent="DISCOVERY",
            confidence=IntentConfidence.LOW,
            entities={"statement": text.strip()},
            reasoning="Groq classification failed, defaulting to discovery",
            suggested_handler="discovery",
        )


async def classify_intent(
    provider: ModelProvider,
    text: str,
    context: Optional[dict[str, Any]] = None
) -> ClassifiedIntent:
    """
    Main entry point: try deterministic first, fall back to Groq.
    """
    # Fast path: deterministic patterns
    deterministic = classify_deterministic(text, context)
    if deterministic and deterministic.confidence != IntentConfidence.LOW:
        return deterministic
    
    # Ambiguous: use Groq
    return await classify_with_groq(provider, text, context)