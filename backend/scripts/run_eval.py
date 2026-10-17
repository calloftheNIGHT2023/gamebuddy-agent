"""Run from backend: python scripts/run_eval.py [--output report.json]."""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.evaluation import run_evaluation


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--policy-id")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    report = run_evaluation(args.policy_id, persist=False)
    rendered = json.dumps(report, indent=2, ensure_ascii=False)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    print(rendered)
    return 0 if report["passed"] == report["total"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
