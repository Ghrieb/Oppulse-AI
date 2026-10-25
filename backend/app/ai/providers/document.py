"""The document extractor.

**The file never leaves our server.** It is read here, on our own machine,
and only the *text* of the pages we could read is ever sent to a model
provider — which is what the consent says, and what the consent screen must
say.

**The OCR behaviour**, defined rather than hoped for:

- a page is *scanned* when its text layer yields fewer than 20 non-space
  characters;
- only scanned pages reach an OCR engine, and only through the
  :class:`OcrEngine` protocol;
- the OCR output is accepted only when it clears both gates — 40 non-space
  characters *and* at least three words — and below them it is discarded
  rather than presented as the document's content;
- a page that could not be read is **never sent to the model**, and the
  model is never asked to infer it;
- the failed pages are recorded, the document's state says "partly read",
  and the student is told exactly which pages were missed and what to do
  about it.
"""

from __future__ import annotations

import io
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any, Literal, Protocol

from ..types import DocumentExtractionResult, ExtractedPage


@dataclass
class OcrResult:
    """What an OCR engine could read from one page."""

    text: str
    #: False when the engine is not available, or when the text failed the
    #: quality gate. The text is then meaningless and is discarded.
    usable: bool
    reason: str = ""


class OcrEngine(Protocol):
    """Reads a page image."""

    name: str

    def available(self) -> bool:
        """Whether this engine can run at all."""
        ...

    def read(self, image: bytes) -> OcrResult:
        """Reads one page image."""
        ...


class UnavailableOcrEngine:
    """The engine that is there until one is installed.

    It reports *unavailable*, never an empty string that would look like an
    empty page.
    """

    name = "unavailable"

    def available(self) -> bool:
        return False

    def read(self, image: bytes) -> OcrResult:
        return OcrResult(
            text="",
            usable=False,
            reason="no OCR engine is available in this deployment",
        )


class LocalOcrEngine:
    """A local OCR engine.

    It is only used when the deployment actually has one: the page image is
    rasterised on our own machine and read here, so the image never leaves
    our server. When the engine is not installed, the caller falls back to
    the honest "we could not read this page" outcome.
    """

    name = "local"

    def __init__(self) -> None:
        self._reader: Any = None

    def available(self) -> bool:
        if self._reader is not None:
            return True
        try:
            from rapidocr import RapidOCR
        except ImportError:
            return False
        self._reader = RapidOCR()
        return True

    def read(self, image: bytes) -> OcrResult:
        if not self.available():
            return OcrResult(text="", usable=False, reason="no OCR engine is available")

        try:
            import numpy as np
            from PIL import Image
        except ImportError:
            return OcrResult(text="", usable=False, reason="the image libraries are not installed")

        try:
            picture = Image.open(io.BytesIO(image)).convert("RGB")
            result, _ = self._reader(np.array(picture))
        except Exception as error:
            return OcrResult(text="", usable=False, reason=f"the page could not be read: {error}")

        lines = [str(line[1]) for line in (result or []) if isinstance(line, (list, tuple))]
        text = " ".join(lines)
        return OcrResult(text=text, usable=passes_quality_gate(text))


#: A page with fewer than this many non-space characters has no text layer.
SCANNED_PAGE_THRESHOLD = 20

#: The OCR output must clear both of these to be believed.
MIN_OCR_CHARACTERS = 40
MIN_OCR_WORDS = 3


def passes_quality_gate(text: str) -> bool:
    """Whether an OCR result is good enough to believe.

    Below the gate the text is discarded, not softened: a page that was
    half-read is a page we did not read.
    """
    compact = "".join(text.split())
    if len(compact) < MIN_OCR_CHARACTERS:
        return False
    return len(text.split()) >= MIN_OCR_WORDS


def _render_page(page: Any) -> bytes | None:
    """A page image, rendered on our own machine.

    The image is never sent anywhere: it is rendered, read by the local OCR
    engine and discarded.
    """
    try:
        import pypdfium2
    except ImportError:
        return None

    try:
        document = pypdfium2.PdfDocument(page.get_parent())
        picture = document[page.page_number].render(scale=2).to_pil()
        buffer = io.BytesIO()
        picture.save(buffer, format="PNG")
        return buffer.getvalue()
    except Exception:
        return None


@dataclass
class DocumentReader:
    """Reads a document into the pages we could actually read.

    Both the OCR engine and the rasteriser are seams, so a deployment
    without them still reads what it can — and the tests can exercise the
    OCR path without a renderer installed.
    """

    #: The name of this reader, so a run can record how a document was read.
    name: str = "document"

    ocr: OcrEngine = field(default_factory=UnavailableOcrEngine)
    render: Callable[[Any], bytes | None] = field(default_factory=lambda: _render_page)

    def read(self, content: bytes, *, filename: str, mime_type: str) -> DocumentExtractionResult:
        """The pages, the unread ones, and how the reading was done."""
        if mime_type == "application/pdf" or filename.lower().endswith(".pdf"):
            return self._read_pdf(content)
        if "word" in mime_type or filename.lower().endswith((".docx", ".doc")):
            return self._read_docx(content)
        return self._read_text(content)

    # -- PDF ------------------------------------------------------------

    def _read_pdf(self, content: bytes) -> DocumentExtractionResult:
        try:
            from pypdf import PdfReader
        except ImportError:
            return DocumentExtractionResult(
                pages=[],
                unread_sections=["the PDF library is not installed in this deployment"],
                method="none",
                scanned_pages=[],
            )

        try:
            reader = PdfReader(io.BytesIO(content))
        except Exception as error:
            return DocumentExtractionResult(
                pages=[],
                unread_sections=[f"the document could not be opened: {error}"],
                method="none",
                scanned_pages=[],
            )

        pages: list[ExtractedPage] = []
        unread: list[str] = []
        scanned: list[int] = []
        method: Literal["text_layer", "ocr", "none"] = "text_layer"

        for number, page in enumerate(reader.pages, start=1):
            try:
                text = (page.extract_text() or "").strip()
            except Exception:
                text = ""

            if len("".join(text.split())) >= SCANNED_PAGE_THRESHOLD:
                pages.append(ExtractedPage(number=number, text=text))
                continue

            scanned.append(number)
            ocr_text = self._ocr_page(page)
            if ocr_text is not None:
                pages.append(ExtractedPage(number=number, text=ocr_text, ocr=True))
                method = "ocr"
            else:
                unread.append(f"page {number} — no text layer, and no OCR engine is available")

        if not pages:
            method = "none"

        return DocumentExtractionResult(
            pages=pages,
            unread_sections=unread,
            method=method,
            scanned_pages=scanned,
        )

    def _ocr_page(self, page: Any) -> str | None:
        """One page, read by the OCR engine when there is one."""
        if not self.ocr.available():
            return None

        image = self.render(page)
        if image is None:
            return None

        result = self.ocr.read(image)
        return result.text if result.usable else None

    # -- DOCX and text --------------------------------------------------

    def _read_docx(self, content: bytes) -> DocumentExtractionResult:
        try:
            import docx
        except ImportError:
            return DocumentExtractionResult(
                pages=[],
                unread_sections=["the Word library is not installed in this deployment"],
                method="none",
                scanned_pages=[],
            )

        try:
            document = docx.Document(io.BytesIO(content))
        except Exception as error:
            return DocumentExtractionResult(
                pages=[],
                unread_sections=[f"the document could not be opened: {error}"],
                method="none",
                scanned_pages=[],
            )

        paragraphs = [paragraph.text for paragraph in document.paragraphs if paragraph.text.strip()]
        return DocumentExtractionResult(
            pages=[ExtractedPage(number=1, text="\n".join(paragraphs))] if paragraphs else [],
            unread_sections=[] if paragraphs else ["the document has no readable text"],
            method="text_layer",
            scanned_pages=[],
        )

    def _read_text(self, content: bytes) -> DocumentExtractionResult:
        text = content.decode("utf-8", errors="replace")
        if not text.strip():
            return DocumentExtractionResult(
                pages=[],
                unread_sections=["the file has no readable text"],
                method="none",
                scanned_pages=[],
            )
        return DocumentExtractionResult(
            pages=[ExtractedPage(number=1, text=text)],
            unread_sections=[],
            method="text_layer",
            scanned_pages=[],
        )
