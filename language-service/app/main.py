import os
import sys
import uuid

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

from typing import List, Dict, Any, Optional
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import torch

from app.config import HOST, PORT, MODEL_NAME, DEFAULT_SRC_LANG, DEFAULT_TGT_LANG, WHISPER_MODEL_SIZE
from app.translation.indictrans_service import IndicTransService
from app.courses.course_processor import CourseProcessor
from app.video.subtitle_processor import SubtitleProcessor

app = FastAPI(
    title="SkillForge Indic Language Service",
    description="English to Indic AI Course Document Translation and Video Subtitle Engine powered by IndicTrans2 and Faster-Whisper",
    version="1.1.0"
)

# CORS Setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory background jobs registry
jobs_db: Dict[str, Dict[str, Any]] = {}

# Lazy loaded processor instances
_processor: Optional[CourseProcessor] = None
_subtitle_processor: Optional[SubtitleProcessor] = None

def get_processor() -> CourseProcessor:
    global _processor
    if _processor is None:
        _processor = CourseProcessor()
    return _processor

def get_subtitle_processor() -> SubtitleProcessor:
    global _subtitle_processor
    if _subtitle_processor is None:
        _subtitle_processor = SubtitleProcessor()
    return _subtitle_processor

# Schemas
class TranslateTextRequest(BaseModel):
    text: Optional[str] = None
    texts: Optional[List[str]] = None
    src_lang: str = DEFAULT_SRC_LANG
    tgt_lang: str = DEFAULT_TGT_LANG

class TranslatePdfRequest(BaseModel):
    source_pdf_path: str
    output_filename: Optional[str] = None
    target_language: Optional[str] = "hi"
    document_title: Optional[str] = None

class CourseAssetItem(BaseModel):
    content_item_id: int
    title: str
    source_url: str
    module_title: Optional[str] = "Module"

class ProcessCourseRequest(BaseModel):
    course_id: int
    course_title: str
    pdf_assets: List[CourseAssetItem]
    target_language: Optional[str] = "hi"
    callback_url: Optional[str] = None

class TranslateVideoSubtitleRequest(BaseModel):
    source_video_path: str
    output_vtt_name: Optional[str] = None
    target_language: Optional[str] = "hi"
    document_title: Optional[str] = None
    content_item_id: Optional[int] = None
    course_id: Optional[int] = None

class CourseVideoAssetItem(BaseModel):
    content_item_id: int
    title: str
    source_url: str
    module_title: Optional[str] = "Module"

class ProcessCourseVideosRequest(BaseModel):
    course_id: int
    course_title: str
    video_assets: List[CourseVideoAssetItem]
    target_language: Optional[str] = "hi"
    callback_url: Optional[str] = None

@app.get("/health")
def health():
    device = "cuda" if torch.cuda.is_available() else "cpu"
    gpu_name = torch.cuda.get_device_name(0) if torch.cuda.is_available() else None
    return {
        "status": "online",
        "service": "SkillForge Language & Video Subtitle Service",
        "translation_model": MODEL_NAME,
        "asr_model": WHISPER_MODEL_SIZE,
        "device": device,
        "gpu_name": gpu_name,
        "cuda_available": torch.cuda.is_available(),
        "supported_languages": ["en", "hi", "ta"],
        "video_subtitles_supported": True
    }

@app.post("/api/translate/text")
def translate_text(req: TranslateTextRequest):
    service = IndicTransService.get_instance()
    if req.texts:
        translations = service.translate_batch(req.texts, src_lang=req.src_lang, tgt_lang=req.tgt_lang)
        return {"translations": translations}
    elif req.text:
        translation = service.translate(req.text, src_lang=req.src_lang, tgt_lang=req.tgt_lang)
        return {"translation": translation}
    else:
        raise HTTPException(status_code=400, detail="Either 'text' or 'texts' must be provided.")

@app.post("/api/translate/pdf")
def translate_pdf(req: TranslatePdfRequest):
    processor = get_processor()
    try:
        res = processor.process_single_pdf(
            source_pdf_path=req.source_pdf_path,
            output_filename=req.output_filename,
            target_language=req.target_language or "hi",
            document_title=req.document_title
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def run_course_job(job_id: str, req: ProcessCourseRequest):
    jobs_db[job_id]["status"] = "GENERATING"
    jobs_db[job_id]["progress"] = 5
    try:
        processor = get_processor()
        res = processor.process_course_assets(
            course_id=req.course_id,
            course_title=req.course_title,
            pdf_assets=[item.model_dump() for item in req.pdf_assets],
            target_language=req.target_language or "hi",
            callback_url=req.callback_url
        )
        jobs_db[job_id]["status"] = res.get("status", "READY")
        jobs_db[job_id]["progress"] = 100
        jobs_db[job_id]["results"] = res.get("results", [])
    except Exception as e:
        jobs_db[job_id]["status"] = "FAILED"
        jobs_db[job_id]["error"] = str(e)

@app.post("/api/courses/{course_id}/process")
def process_course(course_id: int, req: ProcessCourseRequest, background_tasks: BackgroundTasks):
    target_lang = req.target_language or "hi"
    job_id = f"job-{course_id}-{target_lang}-{uuid.uuid4().hex[:8]}"
    jobs_db[job_id] = {
        "job_id": job_id,
        "course_id": course_id,
        "target_language": target_lang,
        "status": "QUEUED",
        "progress": 0,
        "total_files": len(req.pdf_assets),
        "completed_files": 0
    }
    background_tasks.add_task(run_course_job, job_id, req)
    return {"job_id": job_id, "status": "QUEUED", "course_id": course_id, "target_language": target_lang}

# ==========================================
# Video Subtitle Pipeline Endpoints
# ==========================================

@app.post("/api/subtitles/generate")
def generate_single_video_subtitle(req: TranslateVideoSubtitleRequest):
    """
    Direct synchronous generation of timestamped subtitles for a single video.
    """
    sub_processor = get_subtitle_processor()
    try:
        res = sub_processor.process_single_video(
            source_video_path=req.source_video_path,
            output_vtt_name=req.output_vtt_name,
            target_language=req.target_language or "hi",
            document_title=req.document_title,
            content_item_id=req.content_item_id,
            course_id=req.course_id
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def run_course_video_subtitles_job(job_id: str, req: ProcessCourseVideosRequest):
    jobs_db[job_id]["status"] = "GENERATING"
    jobs_db[job_id]["progress"] = 5
    try:
        sub_processor = get_subtitle_processor()
        res = sub_processor.process_course_video_assets(
            course_id=req.course_id,
            course_title=req.course_title,
            video_assets=[item.model_dump() for item in req.video_assets],
            target_language=req.target_language or "hi",
            callback_url=req.callback_url
        )
        jobs_db[job_id]["status"] = res.get("status", "READY")
        jobs_db[job_id]["progress"] = 100
        jobs_db[job_id]["results"] = res.get("results", [])
    except Exception as e:
        jobs_db[job_id]["status"] = "FAILED"
        jobs_db[job_id]["error"] = str(e)

@app.post("/api/courses/{course_id}/subtitles/process")
def process_course_subtitles(course_id: int, req: ProcessCourseVideosRequest, background_tasks: BackgroundTasks):
    """
    Background batch processing of subtitles for all video lessons in a course.
    """
    target_lang = req.target_language or "hi"
    job_id = f"sub-job-{course_id}-{target_lang}-{uuid.uuid4().hex[:8]}"
    jobs_db[job_id] = {
        "job_id": job_id,
        "course_id": course_id,
        "target_language": target_lang,
        "status": "QUEUED",
        "progress": 0,
        "total_videos": len(req.video_assets),
        "completed_videos": 0
    }
    background_tasks.add_task(run_course_video_subtitles_job, job_id, req)
    return {"job_id": job_id, "status": "QUEUED", "course_id": course_id, "target_language": target_lang}

@app.get("/api/jobs/{job_id}")
def get_job_status(job_id: str):
    if job_id not in jobs_db:
        raise HTTPException(status_code=404, detail="Job not found")
    return jobs_db[job_id]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=HOST, port=PORT, reload=False)

