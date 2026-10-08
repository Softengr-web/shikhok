import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from docx import Document


REPO = Path(__file__).resolve().parents[1]
IMPORTER = REPO / "tools" / "mcq_importer.py"


class ImporterResumeTests(unittest.TestCase):
    def test_resume_skips_unchanged_saved_file_and_reprocesses_changed_file(self):
        with tempfile.TemporaryDirectory(prefix="mcq-import-resume-") as temp:
            base = Path(temp)
            source_root = base / "Exam"
            source_file = source_root / "Class 3" / "Math" / "1. MCQ" / "sample.docx"
            output_dir = base / "audit"
            source_file.parent.mkdir(parents=True)

            def save_document(text):
                document = Document()
                document.add_paragraph(text)
                document.save(source_file)

            def run(*args):
                return subprocess.run(
                    [sys.executable, str(IMPORTER), str(source_root), "--output-dir", str(output_dir), "--workers", "1", *args],
                    cwd=REPO,
                    capture_output=True,
                    text=True,
                    check=False,
                )

            save_document("No MCQ content in this fixture.")
            first = run("--max-files", "1")
            self.assertEqual(first.returncode, 0, first.stdout + first.stderr)
            first_rows = [json.loads(line) for line in (output_dir / "audit.jsonl").read_text(encoding="utf-8").splitlines()]
            self.assertEqual(len(first_rows), 1)
            first_hash = first_rows[0]["file_hash"]

            resumed = run("--resume")
            self.assertEqual(resumed.returncode, 0, resumed.stdout + resumed.stderr)
            resumed_rows = [json.loads(line) for line in (output_dir / "audit.jsonl").read_text(encoding="utf-8").splitlines()]
            self.assertEqual(len(resumed_rows), 1)
            self.assertEqual(resumed_rows[0]["file_hash"], first_hash)

            save_document("Changed source; still no MCQ content.")
            changed = run("--resume")
            self.assertEqual(changed.returncode, 0, changed.stdout + changed.stderr)
            changed_rows = [json.loads(line) for line in (output_dir / "audit.jsonl").read_text(encoding="utf-8").splitlines()]
            self.assertEqual(len(changed_rows), 1)
            self.assertNotEqual(changed_rows[0]["file_hash"], first_hash)
            self.assertEqual(changed_rows[0]["source_path"], "Class 3/Math/1. MCQ/sample.docx")


if __name__ == "__main__":
    unittest.main()
