"""Seed one genuinely documented opportunity (Erasmus Mundus Joint Masters).

Idempotent: inserts the real opportunity if missing, removes the previous
invalid-id attempt, and tags the synthetic Helios opportunity as demo data.
"""

from __future__ import annotations

import asyncio
import sys
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from sqlalchemy import delete, select

from app.db.models import Opportunity
from app.db.session import session_factory


REAL_ID = "b1000000-0000-4000-8000-000000000001"
OLD_BAD_ID = "r1000000-0000-4000-8000-000000000001"


async def main() -> None:
    async with session_factory() as session:
        # Remove the earlier invalid-id attempt (id was not a valid UUID).
        await session.execute(delete(Opportunity).where(Opportunity.id == OLD_BAD_ID))

        existing = await session.get(Opportunity, REAL_ID)
        if existing is None:
            opp = Opportunity(
                id=REAL_ID,
                title="Erasmus Mundus Joint Masters (EMJM)",
                institution="European Commission — Erasmus+",
                type="scholarship",
                country={"kind": "country", "name": "Europe (multi-country)", "iso2": "EU", "region": "Europe"},
                source_domain="erasmus-plus.ec.europa.eu",
                canonical_url="https://erasmus-plus.ec.europa.eu/opportunities/opportunities-for-individuals/students/erasmus-mundus-joint-masters",
                summary=(
                    "Prestigious international master's programmes jointly delivered by "
                    "higher education institutions in at least two European and partner "
                    "countries. Full scholarships cover tuition fees, a monthly living "
                    "allowance (approx. EUR 1,400), travel and installation costs. "
                    "Open to students worldwide, including from non-EU countries."
                ),
                institution_brand={
                    "institutionName": "European Commission — Erasmus+",
                    "officialDomain": "erasmus-plus.ec.europa.eu",
                    "logoUrl": None,
                    "bannerUrl": None,
                    "attribution": None,
                    "verifiedAt": None,
                    "source": "fallback",
                    "generated": True,
                    "iconSource": "none",
                },
                duration="1-2 years",
                application_opens_at=None,
                tags=["scholarship", "master's", "international", "funded", "real"],
                deadline={"value": "varies by programme", "timezone": None, "status": "unresolved", "remainingDays": None, "evidenceId": None, "conflicts": [], "note": None},
                additional_deadlines=[],
                funding={"coverage": "fully_funded", "components": [], "estimatedGap": None, "note": "Tuition, monthly living allowance, travel and installation costs"},
                requirements=[],
                saved=False,
                dismissed=False,
            )
            session.add(opp)
            print("inserted real opportunity:", REAL_ID)
        else:
            print("real opportunity already present:", REAL_ID)

        # Mark the synthetic demo opportunity clearly as demo data.
        result = await session.execute(
            select(Opportunity).where(Opportunity.title == "Helios Research Fellowship in Computational Biology")
        )
        for opp in result.scalars().all():
            tags = list(opp.tags or [])
            if "demo" not in tags:
                tags.append("demo")
                opp.tags = tags
                print("tagged Helios as demo:", opp.id)

        await session.commit()
        print("done")


asyncio.run(main())
