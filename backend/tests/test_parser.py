import pytest
from file_processor import process_file


def test_txt_basic():
    text = process_file("test.txt", b"Hello world")
    assert text == "Hello world"


def test_txt_utf8():
    content = "日本語テスト".encode("utf-8")
    text = process_file("file.txt", content)
    assert "日本語" in text


def test_txt_empty_whitespace():
    text = process_file("blank.txt", b"   \n\n  ")
    assert text == ""


def test_csv_basic():
    csv_bytes = b"name,age\nAlice,30\nBob,25\n"
    text = process_file("data.csv", csv_bytes)
    assert "2 data rows" in text
    assert "name" in text
    assert "Alice" in text


def test_csv_empty():
    text = process_file("empty.csv", b"")
    assert "Empty" in text


def test_csv_header_only():
    text = process_file("h.csv", b"col1,col2\n")
    assert "0 data rows" in text


def test_unsupported_type():
    with pytest.raises(ValueError, match="Unsupported"):
        process_file("image.png", b"\x89PNG")


def test_pdf_no_text():
    minimal_pdf = (
        b"%PDF-1.0\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
        b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
        b"3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\n"
        b"xref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n"
        b"0000000058 00000 n \n0000000115 00000 n \n"
        b"trailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF"
    )
    text = process_file("blank.pdf", minimal_pdf)
    assert "Could not extract" in text
