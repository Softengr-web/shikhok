import unittest

from mcq_importer import PageText, infer_metadata, parse_mcqs


class McqParserTests(unittest.TestCase):
    def test_bengali_numbering_options_and_answer_preserve_unicode(self):
        page = PageText(None, "১। বাংলাদেশের রাজধানী কোনটি?\nক. ঢাকা\nখ. চট্টগ্রাম\nগ. খুলনা\nঘ. রাজশাহী\nউত্তর: ক")
        questions, issues = parse_mcqs(page)
        self.assertEqual(issues, [])
        self.assertEqual(len(questions), 1)
        self.assertEqual(questions[0]["question"], "বাংলাদেশের রাজধানী কোনটি?")
        self.assertEqual([option["text"] for option in questions[0]["options"]], ["ঢাকা", "চট্টগ্রাম", "খুলনা", "রাজশাহী"])
        self.assertEqual(questions[0]["correct_option"], 0)

    def test_ascii_option_labels_and_separate_answer_key(self):
        page = PageText(None, "1. Water freezes at what temperature?\nA. 0 °C\nB. 10 °C\nC. 50 °C\nD. 100 °C\n\nAnswer Key\n1. A")
        questions, issues = parse_mcqs(page)
        self.assertEqual(issues, [])
        self.assertEqual(questions[0]["correct_option"], 0)
        self.assertIn("0 °C", questions[0]["options"][0]["text"])

    def test_single_answer_key_page_maps_questions_on_other_pages(self):
        from mcq_importer import _document_answer_key

        question_page = PageText(1, "1. Water freezes at what temperature?\nA. 0 °C\nB. 10 °C\nC. 50 °C\nD. 100 °C")
        key_page = PageText(2, "Answer Key\n1. A")
        shared_key, from_ocr = _document_answer_key([question_page, key_page])
        questions, issues = parse_mcqs(question_page, shared_key)
        self.assertEqual(issues, [])
        self.assertEqual(questions[0]["correct_option"], 0)
        self.assertFalse(from_ocr)

    def test_conflicting_duplicate_answer_key_stays_unmapped(self):
        from mcq_importer import _document_answer_key

        question_page = PageText(1, "1. Water freezes at what temperature?\nA. 0 °C\nB. 10 °C\nC. 50 °C\nD. 100 °C")
        key_page = PageText(2, "Answer Key\n1. A\n1. B")
        shared_key, from_ocr = _document_answer_key([question_page, key_page])
        questions, issues = parse_mcqs(question_page, shared_key, from_ocr)
        self.assertEqual(questions, [])
        self.assertIn("সঠিক উত্তরের key পাওয়া যায়নি", issues[0]["problem"])

    def test_answer_key_read_by_ocr_requires_manual_review(self):
        from mcq_importer import _document_answer_key

        question_page = PageText(1, "1. Water freezes at what temperature?\nA. 0 °C\nB. 10 °C\nC. 50 °C\nD. 100 °C")
        key_page = PageText(2, "Answer Key\n1. A", confidence=92)
        shared_key, from_ocr = _document_answer_key([question_page, key_page])
        questions, issues = parse_mcqs(question_page, shared_key, from_ocr)
        self.assertEqual(questions, [])
        self.assertIn("OCR", issues[0]["problem"])
        self.assertEqual(issues[0]["interpretation"]["answer_label"], "A")

    def test_malformed_candidate_is_quarantined_instead_of_dropped(self):
        page = PageText(3, "২। কোনটি সঠিক?\nক. প্রথম\nখ. দ্বিতীয়", confidence=92)
        questions, issues = parse_mcqs(page)
        self.assertEqual(questions, [])
        self.assertEqual(len(issues), 1)
        self.assertIn("সঠিক উত্তরের key", issues[0]["problem"])
        self.assertEqual(issues[0]["source_page"], 3)

    def test_low_confidence_bengali_ocr_is_always_sent_to_review(self):
        page = PageText(1, "1. প্রশ্ন\nA. এক\nB. দুই\nC. তিন\nD. চার\nAnswer: A", confidence=42)
        questions, issues = parse_mcqs(page)
        self.assertEqual(questions, [])
        self.assertEqual(len(issues), 1)
        self.assertIn("OCR confidence কম", issues[0]["problem"])

    def test_high_confidence_ocr_still_requires_human_source_check(self):
        page = PageText(1, "1. প্রশ্ন\nA. এক\nB. দুই\nC. তিন\nD. চার\nAnswer: A", confidence=92)
        questions, issues = parse_mcqs(page)
        self.assertEqual(questions, [])
        self.assertEqual(len(issues), 1)
        self.assertIn("হাতে যাচাই করতে হবে", issues[0]["problem"])

    def test_inline_options_and_image_reference_are_preserved_as_media_link(self):
        digest = "a" * 64
        page = PageText(None, f"১. চিত্রে কী দেখা যায়? [ছবি {digest}] ক. নদী খ. পাহাড় গ. সাগর ঘ. বন\nউত্তর: খ")
        questions, issues = parse_mcqs(page)
        self.assertEqual(issues, [])
        self.assertEqual(questions[0]["correct_option"], 1)
        self.assertEqual(questions[0]["media_sha256"], [digest])
        self.assertEqual(questions[0]["question"], "চিত্রে কী দেখা যায়?")

    def test_marked_correct_option_can_replace_its_label_in_a_two_column_answer_grid(self):
        page = PageText(None, "1. প্রশ্ন\nক. প্রথম ● দ্বিতীয় ঘ. চতুর্থ\nগ. তৃতীয়")
        questions, issues = parse_mcqs(page)
        self.assertEqual(issues, [])
        self.assertEqual([option["text"] for option in questions[0]["options"]], ["প্রথম", "দ্বিতীয়", "তৃতীয়", "চতুর্থ"])
        self.assertEqual(questions[0]["correct_option"], 1)

    def test_class_subject_part_and_chapter_are_inferred_from_folder_path(self):
        from pathlib import Path

        root = Path("C:/Exam")
        source = root / "Class 6" / "3. Class 6 Math" / "Bangla 1st Paper" / "Chapter 03 MCQ.docx"
        info = infer_metadata(source, root)
        self.assertEqual(info["class_level"], "Class 6")
        self.assertEqual(info["subject"], "Class 6 Math")
        self.assertEqual(info["part"], "1st Paper")
        self.assertEqual(info["chapter"], "Chapter 3")
        class_root = Path("C:/Exam/Class 6")
        class_source = class_root / "3. Class 6 Math" / "3. MCQ" / "chapter-03.docx"
        class_info = infer_metadata(class_source, class_root)
        self.assertEqual(class_info["class_level"], "Class 6")
        self.assertEqual(class_info["subject"], "Class 6 Math")
        self.assertEqual(class_info["part"], "MCQ")

        lesson_source = root / "Class 6" / "1. Class 6 Bangla" / "Bangla 1st Paper" / "1. Goddo" / "2. MCQ" / "৪. Tolpar.pdf"
        lesson_info = infer_metadata(lesson_source, root)
        self.assertEqual(lesson_info["part"], "1st Paper")
        self.assertEqual(lesson_info["chapter"], "Tolpar")

        typo_source = root / "Class 8" / "1. Class 8 Science" / "3. MCQ" / "Chpater-03.pdf"
        typo_info = infer_metadata(typo_source, root)
        self.assertEqual(typo_info["chapter"], "Chapter 3")

        tenth_paper = root / "Class 10" / "10. Subject" / "10th Paper" / "MCQ" / "chapter-1.pdf"
        tenth_info = infer_metadata(tenth_paper, root)
        self.assertEqual(tenth_info["part"], "10th Paper")


if __name__ == "__main__":
    unittest.main()
