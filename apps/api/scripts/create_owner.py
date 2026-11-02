"""Create the platform owner (run once).

uv run python scripts/create_owner.py you@example.com 'Strong#Pass1' 'Your Name'
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.security import hash_password  # noqa: E402
from app.db.session import system_session  # noqa: E402
from app.models.enums import UserKind  # noqa: E402
from app.models.user import User  # noqa: E402


async def main(email: str, password: str, name: str) -> None:
    async with system_session() as db:
        db.add(
            User(
                kind=UserKind.owner.value,
                name=name,
                email=email,
                is_admin=True,
                must_change_password=False,
                password_hash=await hash_password(password),
            )
        )
    print("owner created:", email)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    asyncio.run(main(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else "Slov Owner"))
