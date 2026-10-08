import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


REPO = Path(__file__).resolve().parents[1]
FINALIZER = REPO / "tools" / "mcq_audit_finalize.py"


class AuditFinalizerTests(unittest.TestCase):
    def test_reconciles_candidates_and_preserves_bangla_while_reporting_conflict(self):
        with tempfile.TemporaryDirectory(prefix="mcq-audit-finalize-") as temp:
            base = Path(temp)
            source_root = base / "Exam"
            audit_dir = base / "audit"
            source_files = [
                source_root / "Class 3" / "1. Math" / "2. MCQ" / "Chapter 1.docx",
                source_root / "Class 3" / "1. Math" / "2. MCQ" / "Chapter 1.pdf",
            ]
            records_dir = audit_dir / "files"
            records_dir.mkdir(parents=True)
            audit_dir.mkdir(exist_ok=True)
            for source_file in source_files:
                source_file.parent.mkdir(parents=True, exist_ok=True)
                source_file.write_bytes(b"fixture")

            raw_question = "বাংলাদেশের রাজধানী কোনটি?"
            questions = []
            for index, source_file in enumerate(source_files):
                relative = source_file.relative_to(source_root).as_posix()
                question = {
                    "candidate_index": 1,
                    "source_number": "১",
                    "source_page": 1,
                    "raw_text": raw_question,
                    "question": raw_question,
                    "options": [
                        {"label": "ক", "text": "চট্টগ্রাম"},
                        {"label": "খ", "text": "ঢাকা"},
                        {"label": "গ", "text": "রাজশাহী"},
                        {"label": "ঘ", "text": "খুলনা"},
                    ],
                    "correct_option": index,
                    "media_sha256": [],
                }
                record = {
                    "source": {"source_path": relative, "file_hash": f"hash-{index}", "file_type": source_file.suffix.upper()},
                    "questions": [question],
                    "issues": [{"candidate_index": 2, "source_page": 1, "raw_text": "অসম্পূর্ণ", "problem": "answer missing"}, {"candidate_index": None, "problem": "page warning"}],
                    "media": [],
                    "page_count": 1,
                }
                (records_dir / f"{index}.json").write_text(json.dumps(record, ensure_ascii=False), encoding="utf-8")
                questions.append({"source_path": relative, "processing_status": "REVIEW_REQUIRED", "seconds": 0.01})
            (audit_dir / "audit.jsonl").write_text("".join(json.dumps(row, ensure_ascii=False) + "\n" for row in questions), encoding="utf-8")

            result = subprocess.run(
                [sys.executable, str(FINALIZER), str(source_root), str(audit_dir)],
                cwd=REPO,
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            summary = json.loads((audit_dir / "summary.json").read_text(encoding="utf-8"))
            self.assertTrue(summary["candidate_reconciliation_ok"])
            self.assertEqual(summary["files_discovered"], 2)
            self.assertEqual(summary["totals"]["detected"], 4)
            self.assertEqual(summary["totals"]["needs_review"], 2)
            self.assertEqual(summary["totals"]["source_issue_count"], 2)
            self.assertEqual(summary["potential_duplicate_group_count"], 1)
            self.assertEqual(summary["potential_answer_conflict_group_count"], 1)
            finalized_rows = [json.loads(line) for line in (audit_dir / "audit.jsonl").read_text(encoding="utf-8").splitlines()]
            self.assertNotIn("seconds", finalized_rows[0])
            saved = json.loads((records_dir / "0.json").read_text(encoding="utf-8"))
            self.assertEqual(saved["questions"][0]["question"], raw_question)
            self.assertEqual(saved["source"]["class_level"], "Class 3")
            self.assertEqual(saved["source"]["chapter"], "Chapter 1")


if __name__ == "__main__":
    unittest.main()
