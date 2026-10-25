"""The document reader.

The rules it keeps, and the corrections that shaped them:

- **the file never leaves our server** — only the text of the pages we could
  read is ever sent to a model provider;
- a page that could not be read is **never sent**, and the model is never
  asked to infer it;
- the OCR output must clear a quality gate, and below the gate it is
  discarded rather than softened;
- the pages that could not be read are **named**, with their numbers, and
  the student is told what to do about them.
"""

from __future__ import annotations

from app.ai.providers.document import (
    SCANNED_PAGE_THRESHOLD,
    DocumentReader,
    OcrResult,
    UnavailableOcrEngine,
    passes_quality_gate,
)


class FakeOcr:
    """An OCR engine that returns whatever the test tells it to."""

    name = "fake"

    def __init__(self, text: str = "", usable: bool = True) -> None:
        self.text = text
        self.usable = usable
        self.calls = 0

    def available(self) -> bool:
        return True

    def read(self, image: bytes) -> OcrResult:
        self.calls += 1
        return OcrResult(text=self.text, usable=self.usable)


def _pdf_with_pages(pages: list[str]) -> bytes:
    """A tiny PDF with one text layer per page.

    It is a real PDF, written by hand, so the reader is exercised against
    the format rather than against a mock of it.
    """
    objects: list[bytes] = []

    page_object_numbers = []
    content_object_numbers = []

    # 1: the catalogue, 2: the pages, 3: the page tree, 4: the font.
    page_count = len(pages)
    first_page = 5
    for index in range(page_count):
        page_object_numbers.append(first_page + index * 2)
        content_object_numbers.append(first_page + index * 2 + 1)

    kids = " ".join(f"{number} 0 R" for number in page_object_numbers)
    objects.append(b"<< /Type /Catalog /Pages 3 0 R >>")
    objects.append(
        b"<< /Type /Pages /Kids ["
        + kids.encode()
        + b"] /Count "
        + str(page_count).encode()
        + b" >>"
    )
    objects.append(
        b"<< /Type /Pages /Kids ["
        + kids.encode()
        + b"] /Count "
        + str(page_count).encode()
        + b" >>"
    )
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

    for index, text in enumerate(pages):
        stream = f"BT /F1 12 Tf 72 720 Td ({text}) Tj ET".encode()
        objects.append(
            b"<< /Type /Page /Parent 3 0 R /MediaBox [0 0 612 792] "
            b"/Resources << /Font << /F1 4 0 R >> >> /Contents "
            + str(content_object_numbers[index]).encode()
            + b" 0 R >>"
        )
        objects.append(
            b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream"
        )

    out = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for number, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += str(number).encode() + b" 0 obj\n" + body + b"\nendobj\n"

    xref_offset = len(out)
    out += b"xref\n0 " + str(len(objects) + 1).encode() + b"\n"
    out += b"0000000000 65535 f \n"
    for offset in offsets[1:]:
        out += f"{offset:010d} 00000 n \n".encode()
    out += b"trailer\n<< /Size " + str(len(objects) + 1).encode() + b" /Root 1 0 R >>\n"
    out += b"startxref\n" + str(xref_offset).encode() + b"\n%%EOF\n"

    return bytes(out)


def test_a_text_pdf_is_read_page_by_page() -> None:
    reader = DocumentReader(ocr=UnavailableOcrEngine())

    result = reader.read(
        _pdf_with_pages(
            [
                "SARA BENALI. Master of Science in Computational Biology, 2026.",
                "Experience: research assistant, genome analysis laboratory, 2025.",
            ]
        ),
        filename="cv.pdf",
        mime_type="application/pdf",
    )

    assert result.method == "text_layer"
    assert [page.number for page in result.pages] == [1, 2]
    assert "SARA BENALI" in result.pages[0].text
    assert result.unread_sections == []
    assert result.scanned_pages == []


def test_a_scanned_page_is_named_and_never_guessed_at() -> None:
    """The floor: with no OCR engine, a scanned page is unread, not empty."""
    reader = DocumentReader(ocr=UnavailableOcrEngine())

    result = reader.read(
        _pdf_with_pages(
            [
                "SARA BENALI. Master of Science in Computational Biology, 2026.",
                "x",
            ]
        ),
        filename="cv.pdf",
        mime_type="application/pdf",
    )

    # The readable page is read.
    assert len(result.pages) == 1
    assert result.pages[0].number == 1

    # The scanned page is named, with its number, and not sent.
    assert result.scanned_pages == [2]
    assert result.unread_sections == ["page 2 — no text layer, and no OCR engine is available"]
    assert all(page.number != 2 for page in result.pages)
    assert result.method == "text_layer"


def test_a_mixed_document_reads_what_it_can_and_names_what_it_cannot() -> None:
    reader = DocumentReader(ocr=UnavailableOcrEngine())

    result = reader.read(
        _pdf_with_pages(
            [
                "SARA BENALI. Master of Science in Computational Biology, 2026.",
                "x",
                "Experience: research assistant, genome analysis laboratory, 2025.",
            ]
        ),
        filename="cv.pdf",
        mime_type="application/pdf",
    )

    assert [page.number for page in result.pages] == [1, 3]
    assert result.scanned_pages == [2]
    assert len(result.unread_sections) == 1
    assert "page 2" in result.unread_sections[0]


def test_ocr_output_below_the_quality_gate_is_discarded() -> None:
    """Half a page is not a page. The output is dropped, not softened."""
    reader = DocumentReader(ocr=FakeOcr(text="a b c", usable=True))

    result = reader.read(
        _pdf_with_pages(["SARA BENALI, computational biology.", "x"]),
        filename="cv.pdf",
        mime_type="application/pdf",
    )

    # The OCR text failed the gate, so the page is still unread.
    assert result.scanned_pages == [2]
    assert all(page.number != 2 for page in result.pages)
    assert len(result.unread_sections) == 1


def test_ocr_output_that_clears_the_gate_is_believed() -> None:
    reader = DocumentReader(
        ocr=FakeOcr(text="SARA BENALI, Master of Science in Computational Biology, 2026."),
        render=lambda page: b"a rendered page",
    )

    result = reader.read(
        _pdf_with_pages(["SARA BENALI, computational biology.", "x"]),
        filename="cv.pdf",
        mime_type="application/pdf",
    )

    assert [page.number for page in result.pages] == [1, 2]
    assert result.pages[1].ocr is True
    assert result.method == "ocr"
    assert result.unread_sections == []


def test_a_page_that_cannot_be_rasterised_stays_unread() -> None:
    """Without a renderer there is no image, so there is nothing to OCR."""
    reader = DocumentReader(
        ocr=FakeOcr(text="SARA BENALI, Master of Science in Computational Biology, 2026."),
        render=lambda page: None,
    )

    result = reader.read(
        _pdf_with_pages(["SARA BENALI, computational biology.", "x"]),
        filename="cv.pdf",
        mime_type="application/pdf",
    )

    assert result.scanned_pages == [2]
    assert all(page.number != 2 for page in result.pages)


def test_the_quality_gate_needs_both_characters_and_words() -> None:
    # Enough words, but not enough characters.
    assert passes_quality_gate("one two three four") is False
    # Enough characters, but not enough words.
    assert passes_quality_gate("x" * 100) is False
    # Both.
    assert (
        passes_quality_gate("SARA BENALI, Master of Science in Computational Biology, 2026.")
        is True
    )


def test_the_scanned_page_threshold_is_what_it_says() -> None:
    assert SCANNED_PAGE_THRESHOLD == 20


def test_a_document_with_no_text_at_all_is_failed_not_empty() -> None:
    reader = DocumentReader(ocr=UnavailableOcrEngine())

    result = reader.read(b"", filename="empty.pdf", mime_type="application/pdf")

    assert result.method == "none"
    assert result.pages == []
    assert result.unread_sections


def test_the_file_bytes_never_reach_the_model() -> None:
    """The promise, checked.

    The reader returns *text*. Nothing it returns contains the file's
    bytes, so a model request built from its output cannot carry the file.
    """
    reader = DocumentReader(ocr=UnavailableOcrEngine())
    content = _pdf_with_pages(["SARA BENALI, computational biology, 2026."])

    result = reader.read(content, filename="cv.pdf", mime_type="application/pdf")

    for page in result.pages:
        assert "%PDF" not in page.text
        assert "endobj" not in page.text
