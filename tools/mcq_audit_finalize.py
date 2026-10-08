#!/usr/bin/env python3
"""Reconcile an offline MCQ import pack against its source tree.

The finalizer never changes question text, options, or answers. It recomputes
folder-derived labels and candidate counts from each saved extraction record,
then emits explicit source issues, media accounting, and potential duplicate
groups for human review. Potential duplicates are never removed here.
"""

from __future__ import annotations

import argparse
import base64
import csv
import hashlib
import json
import os
import re
import tempfile
import unicodedata
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any

from mcq_importer import infer_metadata


SUPPORTED = {".doc", ".docx", ".pdf"}


def read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as stream:
        return json.load(stream)


def atomic_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="") as stream:
            json.dump(value, stream, ensure_ascii=False, indent=2)
            stream.write("\n")
        os.replace(temp_name, path)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)


def clean_for_fingerprint(value: str) -> str:
    # Canonical Unicode composition is used only for comparison. The saved
    # source-faithful text is never modified by this helper.
    return re.sub(r"\s+", " ", unicodedata.normalize("NFC", value).casefold()).strip()


def question_fingerprint(question: dict[str, Any]) -> tuple[str, str]:
    qtext = clean_for_fingerprint(str(question.get("question", "")))
    options = question.get("options") or []
    opt_parts: list[str] = []
    for index, option in enumerate(options):
        if isinstance(option, dict):
            label = clean_for_fingerprint(str(option.get("label", index)))
            text = clean_for_fingerprint(str(option.get("text", "")))
            media = ",".join(sorted(option.get("media_sha256") or []))
        else:
            label, text, media = str(index), clean_for_fingerprint(str(option)), ""
        opt_parts.append(f"{label}:{text}:media={media}")
    body = "\n".join([qtext, *opt_parts])
    full = hashlib.sha256(body.encode("utf-8")).hexdigest()
    q_only = hashlib.sha256(qtext.encode("utf-8")).hexdigest()
    return full, q_only


def csv_write(path: Path, rows: list[dict[str, Any]]) -> None:
    fieldnames: list[str] = []
    for row in rows:
        for key in row:
            if key not in fieldnames:
                fieldnames.append(key)
    if not fieldnames:
        fieldnames = ["source_path", "processing_status"]
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source_root", type=Path, help="Original Class 3–12 folder tree")
    parser.add_argument("audit_dir", type=Path, help="Offline importer output directory")
    args = parser.parse_args()
    root = args.source_root.resolve()
    audit_dir = args.audit_dir.resolve()
    records_dir = audit_dir / "files"
    if not root.is_dir() or not records_dir.is_dir():
        parser.error("source_root and audit_dir/files must both exist")

    discovered = sorted(
        (path for path in root.rglob("*") if path.is_file() and path.suffix.casefold() in SUPPORTED),
        key=lambda value: value.relative_to(root).as_posix().casefold(),
    )
    rows_by_path: dict[str, dict[str, Any]] = {}
    jsonl_path = audit_dir / "audit.jsonl"
    if jsonl_path.exists():
        with jsonl_path.open("r", encoding="utf-8") as stream:
            for line in stream:
                if line.strip():
                    row = json.loads(line)
                    rows_by_path[row["source_path"]] = row

    records: dict[str, dict[str, Any]] = {}
    media: dict[str, int | None] = {}
    valid_groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    question_groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    taxonomy: dict[tuple[str, str, str, str], dict[str, int]] = defaultdict(lambda: {"files": 0, "detected": 0, "valid": 0, "review": 0})
    question_media_refs = review_media_refs = 0

    for record_path in sorted(records_dir.glob("*.json")):
        record = read_json(record_path)
        source = record.get("source") or {}
        source_path = source.get("source_path")
        if not source_path:
            continue
        source_file = root.joinpath(*PurePosixPath(source_path).parts)
        if source_file.is_file():
            source.update(infer_metadata(source_file, root))
        records[source_path] = record

        candidates = record.get("questions") or []
        issues = record.get("issues") or []
        review_indexes = {
            issue.get("candidate_index")
            for issue in issues
            if issue.get("candidate_index") is not None
        }
        detected = len(candidates) + len(review_indexes)
        source_issues = sum(issue.get("candidate_index") is None for issue in issues)
        row = rows_by_path.setdefault(source_path, {"source_path": source_path})
        # Older audit runs accidentally measured only the parent's brief
        # record-write phase. Do not expose that as extraction duration.
        row.pop("seconds", None)
        row.update({
            "file_hash": source.get("file_hash"),
            "file_size": source.get("file_size"),
            "file_type": source.get("file_type"),
            "class_level": source.get("class_level"),
            "group_name": source.get("group_name"),
            "subject": source.get("subject"),
            "part": source.get("part"),
            "chapter": source.get("chapter"),
            "detected": detected,
            "local_valid_candidates": len(candidates),
            "needs_review": len(review_indexes),
            "source_issue_count": source_issues,
            "candidate_reconciliation_ok": detected == len(candidates) + len(review_indexes),
            "page_count": record.get("page_count", 0),
            "source_issues": source_issues,
        })
        if row.get("processing_status") not in {"FAILED", "UPLOAD_FAILED"}:
            row["processing_status"] = "REVIEW_REQUIRED" if issues else "READY_TO_IMPORT"

        key = (str(source.get("class_level") or "Unknown"), str(source.get("group_name") or ""), str(source.get("subject") or "Unknown"), str(source.get("part") or ""))
        bucket = taxonomy[key]
        bucket["files"] += 1
        bucket["detected"] += detected
        bucket["valid"] += len(candidates)
        bucket["review"] += len(review_indexes)

        for asset in record.get("media") or []:
            digest = str(asset.get("sha256") or "")
            if not digest:
                continue
            encoded = asset.get("base64")
            size = len(base64.b64decode(encoded)) if encoded else None
            media[digest] = max(media.get(digest) or 0, size) if size is not None else media.get(digest)
        for candidate in candidates:
            for digest in (candidate.get("media_sha256") or []):
                question_media_refs += 1
                media.setdefault(str(digest), None)
            for option in candidate.get("options") or []:
                if isinstance(option, dict):
                    for digest in (option.get("media_sha256") or []):
                        question_media_refs += 1
                        media.setdefault(str(digest), None)
            full_fp, q_fp = question_fingerprint(candidate)
            item = {
                "source_path": source_path,
                "class_level": source.get("class_level"),
                "subject": source.get("subject"),
                "part": source.get("part"),
                "chapter": source.get("chapter"),
                "source_page": candidate.get("source_page"),
                "source_number": candidate.get("source_number"),
                "candidate_index": candidate.get("candidate_index"),
                "question": candidate.get("question", ""),
                "options": candidate.get("options", []),
                "correct_option": candidate.get("correct_option"),
                "full_fingerprint": full_fp,
                "question_fingerprint": q_fp,
            }
            valid_groups[full_fp].append(item)
            question_groups[q_fp].append(item)
        for issue in issues:
            for digest in (issue.get("media_sha256") or []):
                review_media_refs += 1
                media.setdefault(str(digest), None)

        atomic_json(record_path, record)

    duplicate_groups: list[dict[str, Any]] = []
    for fingerprint, group in valid_groups.items():
        if len(group) < 2:
            continue
        answers = {item.get("correct_option") for item in group}
        duplicate_groups.append({
            "kind": "exact_content_answer_conflict" if len(answers) > 1 else "exact_content_duplicate",
            "fingerprint": fingerprint,
            "occurrences": group,
        })
    for fingerprint, group in question_groups.items():
        if len(group) < 2 or len({item["full_fingerprint"] for item in group}) < 2:
            continue
        answers = {item.get("correct_option") for item in group}
        duplicate_groups.append({
            "kind": "same_question_different_options_or_order_answer_conflict" if len(answers) > 1 else "same_question_different_options_or_order",
            "fingerprint": fingerprint,
            "occurrences": group,
        })
    duplicate_groups.sort(key=lambda item: (item["kind"], item["fingerprint"]))
    with (audit_dir / "potential-duplicates.jsonl").open("w", encoding="utf-8", newline="") as stream:
        for item in duplicate_groups:
            stream.write(json.dumps(item, ensure_ascii=False) + "\n")

    for source_path in discovered:
        rel = source_path.relative_to(root).as_posix()
        rows_by_path.setdefault(rel, {
            "source_path": rel,
            "processing_status": "FAILED",
            "error": "No saved extraction record was produced for this supported file.",
            "detected": 0,
            "local_valid_candidates": 0,
            "needs_review": 0,
            "source_issue_count": 0,
            "candidate_reconciliation_ok": False,
        })
    rows = [rows_by_path[path.relative_to(root).as_posix()] for path in discovered]
    rows.sort(key=lambda item: item["source_path"].casefold())
    audit_jsonl_tmp = audit_dir / ".audit.jsonl.tmp"
    with audit_jsonl_tmp.open("w", encoding="utf-8", newline="") as stream:
        for row in rows:
            stream.write(json.dumps(row, ensure_ascii=False) + "\n")
    os.replace(audit_jsonl_tmp, jsonl_path)
    csv_write(audit_dir / "audit.csv", rows)

    totals = {key: sum(int(row.get(key, 0) or 0) for row in rows) for key in ("detected", "local_valid_candidates", "needs_review", "source_issue_count")}
    files_failed = sum(row.get("processing_status") == "FAILED" for row in rows)
    review_candidates = sum(int(row.get("needs_review", 0) or 0) for row in rows)
    candidate_reconciliation = (
        len(rows) == len(discovered)
        and files_failed == 0
        and all(row.get("candidate_reconciliation_ok") for row in rows)
        and totals["detected"] == totals["local_valid_candidates"] + totals["needs_review"]
    )
    summary = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "source_root": str(root),
        "audit_dir": str(audit_dir),
        "files_discovered": len(discovered),
        "files_with_records": len(records),
        "files_failed_or_missing": files_failed,
        "totals": totals,
        "source_issue_rows_count": totals["source_issue_count"],
        "unresolved_candidate_count": review_candidates,
        "candidate_reconciliation_ok": candidate_reconciliation,
        "database_imported": 0,
        "server_reconciliation_ok": None,
        "potential_duplicate_group_count": len(duplicate_groups),
        "potential_answer_conflict_group_count": sum("conflict" in item["kind"] for item in duplicate_groups),
        "media": {
            "unique_objects": len(media),
            "known_bytes": sum(size or 0 for size in media.values()),
            "objects_with_unknown_size": sum(size is None for size in media.values()),
            "question_media_references": question_media_refs,
            "review_media_references": review_media_refs,
        },
        "taxonomy": [
            {"class_level": key[0], "group_name": key[1] or None, "subject": key[2], "part": key[3] or None, **counts}
            for key, counts in sorted(taxonomy.items())
        ],
        "unresolved_files": [row["source_path"] for row in rows if row.get("processing_status") in {"FAILED", "UPLOAD_FAILED", "REVIEW_REQUIRED"}],
        "note": "Offline extraction audit only. Questions have not been imported into a database; review candidates and potential duplicates remain unresolved.",
    }
    atomic_json(audit_dir / "summary.json", summary)
    csv_write(audit_dir / "taxonomy.csv", summary["taxonomy"])
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0 if candidate_reconciliation else 2


if __name__ == "__main__":
    raise SystemExit(main())
