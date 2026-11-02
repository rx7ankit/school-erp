"""Tiny runner for scheduled jobs: `python -m app.jobs.run <job>` (or `all`).

Prints one JSON line per job and exits with 1 if a job failed."""

import asyncio
import json
import logging
import sys

from app.jobs.tasks import JOBS


async def run(names: list[str]) -> int:
    code = 0
    for name in names:
        try:
            result = await JOBS[name]()
            print(json.dumps({"job": name, "ok": True, **result}, default=str))
        except Exception as e:
            logging.getLogger("slov.jobs").exception("job %s failed", name)
            print(json.dumps({"job": name, "ok": False, "error": str(e)}))
            code = 1
    return code


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    if len(args) != 1 or (args[0] != "all" and args[0] not in JOBS):
        print(f"usage: python -m app.jobs.run <{'|'.join([*JOBS, 'all'])}>", file=sys.stderr)
        return 2
    return asyncio.run(run(list(JOBS) if args[0] == "all" else [args[0]]))


if __name__ == "__main__":
    raise SystemExit(main())
