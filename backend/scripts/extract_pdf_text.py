"""
Arogya AI - PDF Text Extraction Helper
Extracts digital text streams from PDF files using pypdf.
"""
import sys
import io
import json

def extract_pdf():
    try:
        # Read from file path argument or stdin
        if len(sys.argv) > 1:
            with open(sys.argv[1], "rb") as f:
                pdf_bytes = f.read()
        else:
            pdf_bytes = sys.stdin.buffer.read()

        if not pdf_bytes:
            sys.stdout.write(json.dumps({"success": False, "error": "Empty input buffer", "text": "", "page_count": 0}))
            return

        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        pages_text = []
        for page in reader.pages:
            t = page.extract_text() or ""
            if t.strip():
                pages_text.append(t.strip())

        full_text = "\n".join(pages_text)
        sys.stdout.write(json.dumps({
            "success": True,
            "text": full_text,
            "page_count": len(reader.pages),
            "notes": [f"Extracted digital text across {len(reader.pages)} PDF page(s) via pypdf."]
        }))
    except Exception as e:
        sys.stdout.write(json.dumps({
            "success": False,
            "error": str(e),
            "text": "",
            "page_count": 0,
            "notes": [f"PDF extraction error: {str(e)}"]
        }))

if __name__ == "__main__":
    extract_pdf()
