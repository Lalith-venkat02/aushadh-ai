"""
AushadhAI – FastAPI Backend
Prescription image analyzer using Google Gemini Vision + medicines.json catalog.
"""

import json
import os
import io
import re
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image
import google.genai as genai
from google.genai import types

# ── Environment & Config ──────────────────────────────────────────────────────
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# ── Load Medicine Catalog ─────────────────────────────────────────────────────
DATA_PATH = Path(__file__).parent / "data" / "medicines.json"
with open(DATA_PATH, "r", encoding="utf-8") as f:
    MEDICINES: list[dict] = json.load(f)

# ── FastAPI App ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="AushadhAI API",
    description="AI-powered prescription analyzer for affordable Indian medicines",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Pydantic Models ───────────────────────────────────────────────────────────
class BrandInfo(BaseModel):
    name: str
    company: str
    price_inr: float
    pack: str

class AlternativeInfo(BaseModel):
    name: str
    company: str
    price_inr: float
    pack: str
    who_gmp_certified: bool
    savings_percent: float

class JanAushadhiInfo(BaseModel):
    name: str
    outlet: str
    price_inr: float
    pack: str
    savings_percent: float

class MedicineResult(BaseModel):
    generic_name: str
    strength: str
    use_case: str
    active_salt: str
    benchmark_brand: BrandInfo
    best_alternative: AlternativeInfo
    jan_aushadhi: JanAushadhiInfo

class AnalyzeResponse(BaseModel):
    success: bool
    prescription_text: str
    medicines_detected: list[str]
    results: list[MedicineResult]
    unmatched: list[str]
    message: str

# ── Helper: Match extracted drugs to catalog ──────────────────────────────────
def normalize(text: str) -> str:
    return re.sub(r"[^a-z0-9]", "", text.lower())

def find_medicine(drug_name: str) -> Optional[dict]:
    """Fuzzy match a drug name against the medicines catalog."""
    n = normalize(drug_name)
    for med in MEDICINES:
        # Check aliases, generic_name, and brand names
        targets = [med["generic_name"]] + med.get("aliases", [])
        targets += [med["benchmark_brand"]["name"]]
        targets += [med["best_alternative"]["name"]]
        for t in targets:
            if normalize(t) in n or n in normalize(t):
                return med
    return None

# ── Gemini Vision Extraction ──────────────────────────────────────────────────
EXTRACTION_PROMPT = """You are a clinical pharmacist AI assistant. Analyze this prescription image carefully.

Extract ALL medicine names, drug names, or active pharmaceutical ingredients mentioned.
Also extract their dosage/strength if visible.

Return ONLY a valid JSON object in this exact format:
{
  "prescription_text": "<brief description of what you see in the prescription>",
  "drugs_detected": ["drug name 1", "drug name 2", "drug name 3"]
}

Rules:
- Include brand names AND generic names as separate entries if both appear
- Include dosage info with the name e.g. "Metformin 500mg"
- If no prescription is detected, return drugs_detected as an empty array
- Do NOT include any explanation outside the JSON
"""

def extract_drugs_from_image(image_bytes: bytes, mime_type: str) -> dict:
    """Use Gemini Vision to extract drug names from prescription image."""
    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="GEMINI_API_KEY not configured. Please add it to backend/.env"
        )

    client = genai.Client(api_key=GEMINI_API_KEY)

    image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)

    response = client.models.generate_content(
        model="gemini-1.5-flash",
        contents=[image_part, EXTRACTION_PROMPT],
    )

    raw = response.text.strip()

    # Strip markdown fences if present
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\n?", "", raw)
        raw = re.sub(r"\n?```$", "", raw)

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Attempt to extract JSON substring
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if match:
            return json.loads(match.group())
        return {"prescription_text": raw, "drugs_detected": []}

# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/", tags=["Health"])
async def health_check():
    return {"status": "online", "system": "AushadhAI Core"}

@app.post("/api/analyze", response_model=AnalyzeResponse, tags=["Analysis"])
async def analyze_prescription(file: UploadFile = File(...)):
    """
    Accepts a prescription image, extracts drug names via Gemini Vision,
    and returns benchmark brand, best WHO-GMP alternative, and cheapest
    Jan Aushadhi substitute for each detected medicine.
    """
    # Validate file type
    allowed_types = {"image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"}
    content_type = file.content_type or "image/jpeg"
    if content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {content_type}. Please upload JPEG, PNG, or WebP."
        )

    image_bytes = await file.read()

    # Validate it's a real image via Pillow
    try:
        img = Image.open(io.BytesIO(image_bytes))
        img.verify()
    except Exception:
        raise HTTPException(status_code=400, detail="Uploaded file is not a valid image.")

    # Re-read bytes after verify() closes the stream
    image_bytes_fresh = await file.seek(0) or image_bytes

    # Extract drugs via Gemini
    extraction = extract_drugs_from_image(image_bytes, content_type)
    prescription_text = extraction.get("prescription_text", "")
    drugs_detected = extraction.get("drugs_detected", [])

    # Match drugs to catalog
    results: list[MedicineResult] = []
    unmatched: list[str] = []
    matched_ids: set[str] = set()

    for drug in drugs_detected:
        med = find_medicine(drug)
        if med and med["id"] not in matched_ids:
            matched_ids.add(med["id"])
            results.append(MedicineResult(
                generic_name=med["generic_name"],
                strength=med["strength"],
                use_case=med["use_case"],
                active_salt=med["active_salt"],
                benchmark_brand=BrandInfo(**med["benchmark_brand"]),
                best_alternative=AlternativeInfo(**med["best_alternative"]),
                jan_aushadhi=JanAushadhiInfo(**med["jan_aushadhi"]),
            ))
        elif not med:
            if drug not in unmatched:
                unmatched.append(drug)

    medicines_names = [r.generic_name + " " + r.strength for r in results]

    message = (
        f"Successfully analyzed prescription. Found {len(results)} medicine(s) in our catalog."
        if results
        else "No medicines from our catalog were detected. Try a clearer prescription image."
    )

    return AnalyzeResponse(
        success=True,
        prescription_text=prescription_text,
        medicines_detected=medicines_names,
        results=results,
        unmatched=unmatched,
        message=message,
    )
