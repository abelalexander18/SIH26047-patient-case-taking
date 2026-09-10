"""
SIH26047 — Patient Case-Taking Software (Ministry of Ayush / AIIA)
Synthetic Medical Report Fixtures for Prototype Testing

IMPORTANT: Contains ONLY synthetic, non-real test data for prototype demonstration.
"""

import io
from PIL import Image, ImageDraw

SYNTHETIC_LAB_REPORT_TEXT = """
=========================================================
ALL INDIA INSTITUTE OF AYURVEDA (AIIA) - CENTRAL CLINICAL LAB
=========================================================
SYNTHETIC DEMO REPORT - FOR PROTOTYPE TESTING ONLY
Patient ID: DEMO-PATIENT-999 (Synthetic)
Age: 52 | Gender: Male | Date: 2026-09-10

CLINICAL BIOCHEMISTRY & HEMATOLOGY:
---------------------------------------------------------
Test Name               Observed Value   Units    Reference Range
---------------------------------------------------------
Hemoglobin:             10.2             g/dL     (12.0 - 16.0)
Fasting Blood Glucose:  154.0            mg/dL    (70.0 - 100.0)
Serum Creatinine:       0.9              mg/dL    (0.6 - 1.3)
Platelet Count:         240000           /uL      (150000 - 450000)
Total Leukocyte Count:  7500             /uL      (4000 - 11000)
---------------------------------------------------------
Physician Notes: Electronic laboratory output for review.
"""

SYNTHETIC_POOR_QUALITY_TEXT = """
[ILLEGIBLE / SMUDGED SCAN TEXT]
~~~~ ????? **** ^^^^
Random noise line without clinical parameter names
Dr. Signature (Handwritten illegible smudge)
"""


def create_synthetic_pdf_bytes(report_text: str = SYNTHETIC_LAB_REPORT_TEXT) -> bytes:
    """
    Constructs a standard, valid PDF 1.4 byte stream in memory
    containing the synthetic report text for zero-dependency local testing.
    """
    lines = [line.replace("(", "").replace(")", "").replace("\\", "") for line in report_text.strip().splitlines()]
    
    # Build PDF text stream
    text_commands = ["BT", "/F1 10 Tf", "50 750 Td"]
    for i, line in enumerate(lines):
        safe_line = line[:85]
        if i == 0:
            text_commands.append(f"({safe_line}) Tj")
        else:
            text_commands.append(f"0 -14 Td ({safe_line}) Tj")
    text_commands.append("ET")
    
    stream_content = "\n".join(text_commands).encode("latin-1")
    stream_len = len(stream_content)

    pdf_template = (
        b"%PDF-1.4\n"
        b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n"
        b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n"
        b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj\n"
        b"4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Courier >> endobj\n"
        b"5 0 obj << /Length " + str(stream_len).encode("ascii") + b" >> stream\n" +
        stream_content +
        b"\nendstream endobj\n"
        b"xref\n"
        b"0 6\n"
        b"0000000000 65535 f \n"
        b"0000000009 00000 n \n"
        b"0000000058 00000 n \n"
        b"0000000115 00000 n \n"
        b"0000000244 00000 n \n"
        b"0000000318 00000 n \n"
        b"trailer << /Size 6 /Root 1 0 R >>\n"
        b"startxref\n"
        b"450\n"
        b"%%EOF\n"
    )
    return pdf_template


def create_synthetic_image_bytes() -> bytes:
    """
    Creates a small synthetic PNG image byte stream using Pillow
    representing an uploaded report thumbnail.
    """
    img = Image.new("RGB", (300, 150), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.text((10, 10), "SYNTHETIC MEDICAL REPORT", fill=(0, 0, 0))
    draw.text((10, 40), "Hemoglobin: 10.2 g/dL", fill=(0, 0, 0))
    draw.text((10, 70), "Creatinine: 0.9 mg/dL", fill=(0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()
