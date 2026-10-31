"""Response composition for natural student-facing messages.

Transforms internal AI processing results into approachable, conversational
responses. Never exposes internal stages, mission titles, or search
instructions as user-facing text.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional


@dataclass(frozen=True)
class ResponseContext:
    """Context available when composing a response."""
    intent: str
    student_summary: str  # Brief profile context (max 400 chars)
    prior_turns: list[dict[str, Any]]  # Last 4 turns
    active_mission_id: Optional[str] = None
    active_run_id: Optional[str] = None
    outstanding_clarification: Optional[str] = None
    preferences: Optional[dict[str, Any]] = None
    selected_opportunity: Optional[dict[str, Any]] = None
    active_run_status: Optional[str] = None


def compose_greeting(ctx: ResponseContext) -> str:
    """Natural greeting response."""
    name = ""
    if ctx.student_summary:
        # Extract first name from summary if available
        parts = ctx.student_summary.split()
        if parts:
            name = f" {parts[0]}"
    
    return f"Hey{name}! Good to see you. What are you hoping to explore today? We can look for opportunities, check your eligibility, or work on an application."


def compose_casual(ctx: ResponseContext) -> str:
    """Casual conversation response."""
    responses = [
        "I'm doing well, thanks for asking! How can I help with your opportunities today?",
        "All good! What's on your mind - searching for something specific or just browsing?",
        "Great to hear from you! Ready when you are - opportunities, applications, or just questions.",
    ]
    # Pick based on prior context
    if ctx.prior_turns and any(t.get("role") == "assistant" for t in ctx.prior_turns):
        return "Good to hear! Your search is still there whenever you want to continue."
    return responses[0]


def compose_general_question(ctx: ResponseContext, question: str) -> str:
    """Answer a general knowledge question naturally."""
    # These are handled by the AI directly, this is a fallback
    return "That's a good question. Let me give you a straight answer based on what I know..."


def compose_discovery_acknowledgement(ctx: ResponseContext, mission_summary: str) -> str:
    """Acknowledge a discovery request before starting search."""
    # Check if we have enough context to proceed
    prefs = ctx.preferences or {}
    has_field = bool(prefs.get("academicInterests"))
    has_level = bool(prefs.get("degreeLevel"))
    has_destination = bool(prefs.get("destinations"))
    has_funding = bool(prefs.get("fundingPreference"))
    
    missing = []
    if not has_field:
        missing.append("research field")
    if not has_level:
        missing.append("degree level")
    if not has_destination:
        missing.append("preferred destinations")
    if not has_funding:
        missing.append("funding preference")
    
    if not missing:
        return "I'll search for opportunities matching your profile. This will take a moment."
    
    if len(missing) == 1:
        return f"I'd be happy to search! I just need to know: what {missing[0]} are you interested in?"
    
    return f"I can help with that. To give you the most relevant results, could you tell me: {', '.join(missing[:-1])}, and {missing[-1]}?"


def compose_followup(ctx: ResponseContext, reply: str) -> str:
    """Handle short contextual replies."""
    clarification = ctx.outstanding_clarification or ""
    normalized = reply.strip().lower()
    
    # Country reply
    countries = ["germany", "france", "uk", "usa", "canada", "australia", "netherlands", 
                 "sweden", "norway", "denmark", "italy", "spain"]
    if any(c in normalized for c in countries):
        return f"{reply.title()} it is. I'll prioritize opportunities there and keep your other preferences in mind."
    
    # Funding reply
    if any(w in normalized for w in ["funded", "fully funded", "partial", "scholarship", "fellowship"]):
        return f"Got it - {reply}. I'll filter for that funding type."
    
    # Degree level reply
    if any(w in normalized for w in ["bachelor", "master", "phd", "undergrad", "postgrad"]):
        return f"Understood - {reply}. Searching at that level."
    
    # Field reply
    fields = ["computer science", "ai", "machine learning", "biology", "physics", "math", "engineering"]
    if any(f in normalized for f in fields):
        return f"Great, {reply}. I'll focus on that area."
    
    # Yes/No
    if normalized in ["yes", "yeah", "yep", "sure", "ok", "okay"]:
        return "Perfect. Let me continue with that."
    
    if normalized in ["no", "nope", "not really"]:
        return "No problem. What would you prefer instead?"
    
    # Confusion
    if normalized in ["what", "why", "huh", "hmm", "i don't know", "idk"]:
        return "Sorry, I may have made that confusing. " + (clarification or "Let me rephrase.")
    
    return f"Thanks. I'll factor that in: {reply}"


def compose_preference_change(ctx: ResponseContext, statement: str) -> str:
    """Acknowledge a preference update."""
    return f"Updated! {statement.capitalize()}. I'll adjust the search accordingly."


def compose_funding_question(ctx: ResponseContext, question: str) -> str:
    """Answer funding questions naturally."""
    q = question.lower()
    if "fully funded" in q:
        return """Usually, "fully funded" means the main study costs are covered, but coverage varies. 
We should check tuition, living allowance, travel, and insurance separately before deciding whether 
a programme is genuinely fully funded for you."""
    if "stipend" in q:
        return "A stipend is a regular payment for living expenses. It may or may not cover tuition, travel, or insurance - we check each component separately."
    return "Funding coverage varies by programme. I can break down what's covered (tuition, living, travel, insurance) for any opportunity you're looking at."


def compose_eligibility_question(ctx: ResponseContext, question: str) -> str:
    """Answer eligibility questions."""
    if ctx.selected_opportunity:
        return f"Based on your profile, I can check the specific requirements for {ctx.selected_opportunity.get('title', 'that opportunity')}. Want me to run the eligibility check?"
    return "Eligibility depends on the specific programme. If you have an opportunity in mind, I can check your profile against its requirements. Otherwise, I can search for opportunities where you're likely eligible."


def compose_application_help(ctx: ResponseContext, statement: str) -> str:
    """Offer application assistance."""
    if ctx.selected_opportunity:
        return f"I can help you prepare for {ctx.selected_opportunity.get('title', 'that application')}. We can work on your motivation letter, CV, or check what documents are needed."
    return "I can help with applications once you've picked an opportunity. We can draft documents, check requirements, and track deadlines together."


def compose_cv_question(ctx: ResponseContext, statement: str) -> str:
    """Handle CV/profile questions."""
    return "You can upload your CV and I'll extract your academic background, research experience, and skills. It helps me find better matches and check eligibility. Want to upload it now?"


def compose_clarification(ctx: ResponseContext, question: str) -> str:
    """Explain the previous exchange."""
    clarification = ctx.outstanding_clarification or "I was asking for a bit more detail to narrow down the search."
    return f"Sorry, I may have made that confusing. {clarification}"


def compose_out_of_scope(ctx: ResponseContext) -> str:
    """Polite redirect for unrelated requests."""
    return "I'm focused on academic opportunities - scholarships, internships, fellowships, programmes, and applications. How can I help with those?"


def compose_discovery_started(ctx: ResponseContext, run_id: str) -> str:
    """Confirm discovery has started."""
    return f"Searching for opportunities... I'll let you know what I find. (Run ID: {run_id[:8]})"


def compose_discovery_results(ctx: ResponseContext, count: int, summary: str) -> str:
    """Present discovery results."""
    if count == 0:
        return "I didn't find any opportunities matching those criteria. Want to broaden the search or adjust your preferences?"
    if count == 1:
        return f"I found 1 opportunity that matches. {summary}"
    return f"I found {count} opportunities. {summary}"


def compose_url_analysis_started(ctx: ResponseContext, run_id: str) -> str:
    """Confirm URL analysis started with real run ID."""
    return f"Thanks! I'll examine that programme website - checking admission, funding, and application details. This runs in the background (Run ID: {run_id[:8]}). Check back shortly for results."


def compose_url_analysis_progress(ctx: ResponseContext, stage: str) -> str:
    """Show URL analysis progress."""
    stages = {
        "planning": "Planning what to look for...",
        "searching": "Finding the programme pages...",
        "extracting": "Reading the programme details...",
        "evaluating": "Checking requirements against your profile...",
        "saving": "Organizing the analysis...",
        "done": "Analysis complete!",
    }
    return stages.get(stage, f"Working on it... ({stage})")


def compose_url_analysis_complete(ctx: ResponseContext, opportunity: dict[str, Any]) -> str:
    """Present URL analysis results."""
    title = opportunity.get("title", "the programme")
    funding = opportunity.get("funding", {}).get("coverage", "unknown")
    eligibility = opportunity.get("match", {}).get("eligibility", "unknown")
    return f"Done! I analyzed {title}. Funding: {funding}. Your eligibility: {eligibility}. Want to see the full breakdown?"


def compose_error(ctx: ResponseContext, error: str) -> str:
    """Natural error message."""
    if "rate limit" in error.lower() or "429" in error:
        return "I'm getting rate limited. Let me wait a moment and try again."
    if "timeout" in error.lower():
        return "That took too long. Let me try a more focused search."
    return "I ran into an issue. Let me try a different approach."


def compose_response(
    intent: str,
    ctx: ResponseContext,
    payload: Optional[dict[str, Any]] = None
) -> str:
    """
    Main entry point: route to appropriate composer.
    """
    payload = payload or {}
    
    if intent == "GREETING":
        return compose_greeting(ctx)
    
    if intent == "CASUAL":
        return compose_casual(ctx)
    
    if intent == "GENERAL_QUESTION":
        return compose_general_question(ctx, payload.get("question", ""))
    
    if intent == "DISCOVERY":
        if payload.get("stage") == "started":
            return compose_discovery_started(ctx, payload.get("run_id", ""))
        if payload.get("stage") == "results":
            return compose_discovery_results(ctx, payload.get("count", 0), payload.get("summary", ""))
        return compose_discovery_acknowledgement(ctx, payload.get("mission_summary", ""))
    
    if intent == "URL_ANALYSIS":
        if payload.get("stage") == "started":
            return compose_url_analysis_started(ctx, payload.get("run_id", ""))
        if payload.get("stage") == "progress":
            return compose_url_analysis_progress(ctx, payload.get("stage_name", ""))
        if payload.get("stage") == "complete":
            return compose_url_analysis_complete(ctx, payload.get("opportunity", {}))
        return "I'll analyze that link for you."
    
    if intent == "FOLLOWUP":
        return compose_followup(ctx, payload.get("reply", ""))
    
    if intent == "PREFERENCE_CHANGE":
        return compose_preference_change(ctx, payload.get("statement", ""))
    
    if intent == "FUNDING_QUESTION":
        return compose_funding_question(ctx, payload.get("question", ""))
    
    if intent == "ELIGIBILITY_QUESTION":
        return compose_eligibility_question(ctx, payload.get("question", ""))
    
    if intent == "APPLICATION_HELP":
        return compose_application_help(ctx, payload.get("statement", ""))
    
    if intent == "CV_QUESTION":
        return compose_cv_question(ctx, payload.get("statement", ""))
    
    if intent == "CLARIFICATION":
        return compose_clarification(ctx, payload.get("question", ""))
    
    if intent == "OUT_OF_SCOPE":
        return compose_out_of_scope(ctx)
    
    # Fallback
    return "I'm not sure I understand. Could you rephrase that?"