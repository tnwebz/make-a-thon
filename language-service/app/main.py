import os
import sys
import uuid
import json

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

from typing import List, Dict, Any, Optional
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import torch

from app.config import (
    HOST, PORT, MODEL_NAME, DEFAULT_SRC_LANG, DEFAULT_TGT_LANG, WHISPER_MODEL_SIZE,
    REF_VOICES_DIR, DUBBED_DIR, TAMIL_DUBBED_DIR, HINDI_DUBBED_DIR,
    TAMIL_SUBTITLES_DIR, HINDI_SUBTITLES_DIR
)
from app.translation.indictrans_service import IndicTransService
from app.courses.course_processor import CourseProcessor
from app.video.subtitle_processor import SubtitleProcessor
from app.video.reference_voice_extractor import auto_detect_reference_voice, manual_extract_reference_voice
from app.video.voice_dubber import dub_video_to_language, dub_video_to_tamil, dub_video_to_hindi

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

# ==========================================
# 📝 Quiz Translation Request Schemas
# ==========================================

class QuizOptionItem(BaseModel):
    id: int
    option_text: str
    option_index: Optional[int] = 0

class QuizQuestionItem(BaseModel):
    id: int
    question_text: str
    order_index: Optional[int] = 1
    options: List[QuizOptionItem]

class TranslateQuizRequest(BaseModel):
    quiz_id: int
    title: Optional[str] = None
    questions: List[QuizQuestionItem]
    target_language: str = "hi" # "hi" or "ta"

# ==========================================
# 🎙️ Voice Reference & Dubbing Schemas
# ==========================================

class ReferenceVoiceRequest(BaseModel):
    source_media_path: str
    mode: Optional[str] = "auto" # "auto" or "manual"
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    custom_transcript: Optional[str] = None
    english_segments: Optional[List[Dict[str, Any]]] = None

class GenerateVoiceDubRequest(BaseModel):
    source_video_path: str
    target_language: Optional[str] = "ta"
    subtitle_segments: Optional[List[Dict[str, Any]]] = None
    subtitles_path: Optional[str] = None
    tamil_subtitles_path: Optional[str] = None
    tamil_segments: Optional[List[Dict[str, Any]]] = None
    reference_voice_path: str
    reference_transcript: str
    course_id: Optional[int] = None
    content_item_id: Optional[int] = None
    callback_url: Optional[str] = None

class CourseVoiceDubAssetItem(BaseModel):
    content_item_id: int
    title: str
    source_url: str
    module_title: Optional[str] = "Module"
    tamil_subtitles_url: Optional[str] = None

class ProcessCourseVoiceRequest(BaseModel):
    course_id: int
    course_title: str
    video_assets: List[CourseVoiceDubAssetItem]
    target_language: Optional[str] = "ta"
    callback_url: Optional[str] = None

@app.get("/health")
def health():
    device = "cuda" if torch.cuda.is_available() else "cpu"
    gpu_name = torch.cuda.get_device_name(0) if torch.cuda.is_available() else None
    return {
        "status": "online",
        "service": "SkillForge Language, Subtitle & Natural Voice Dubbing Service",
        "translation_model": MODEL_NAME,
        "asr_model": WHISPER_MODEL_SIZE,
        "tts_model": "ai4bharat/IndicF5 (Dhee-Indic-F5)",
        "device": device,
        "gpu_name": gpu_name,
        "cuda_available": torch.cuda.is_available(),
        "supported_languages": ["en", "hi", "ta"],
        "video_subtitles_supported": True,
        "quiz_translation_supported": True,
        "voice_dubbing_supported": True
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

@app.post("/api/quizzes/translate")
def translate_quiz(req: TranslateQuizRequest):
    service = IndicTransService.get_instance()
    tgt_lang = "hin_Deva" if req.target_language == "hi" else ("tam_Taml" if req.target_language == "ta" else req.target_language)
    src_lang = "eng_Latn"

    texts_to_translate: List[str] = []
    
    has_title = bool(req.title and req.title.strip())
    if has_title:
        texts_to_translate.append(req.title.strip())

    question_maps = []
    for q in req.questions:
        q_idx = len(texts_to_translate)
        texts_to_translate.append(q.question_text)
        
        opt_maps = []
        for opt in q.options:
            opt_idx = len(texts_to_translate)
            texts_to_translate.append(opt.option_text)
            opt_maps.append({
                "id": opt.id,
                "option_index": opt.option_index,
                "text_idx": opt_idx
            })
        
        question_maps.append({
            "id": q.id,
            "order_index": q.order_index,
            "q_text_idx": q_idx,
            "options": opt_maps
        })

    try:
        translated_all = service.translate_batch(texts_to_translate, src_lang=src_lang, tgt_lang=tgt_lang) if texts_to_translate else []
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Translation inference error: {str(e)}")

    translated_title = translated_all[0] if has_title and len(translated_all) > 0 else req.title

    result_questions = []
    for qm in question_maps:
        trans_q_text = translated_all[qm["q_text_idx"]] if qm["q_text_idx"] < len(translated_all) else ""
        trans_options = []
        for om in qm["options"]:
            trans_opt_text = translated_all[om["text_idx"]] if om["text_idx"] < len(translated_all) else ""
            trans_options.append({
                "id": om["id"],
                "option_index": om["option_index"],
                "translated_option_text": trans_opt_text
            })
        result_questions.append({
            "id": qm["id"],
            "order_index": qm["order_index"],
            "translated_question_text": trans_q_text,
            "options": trans_options
        })

    return {
        "success": True,
        "quiz_id": req.quiz_id,
        "target_language": req.target_language,
        "translated_title": translated_title,
        "questions": result_questions
    }

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

# ==========================================
# 🎙️ Voice Reference & Dubbing Endpoints
# ==========================================

@app.post("/api/voice/reference")
def get_or_extract_reference_voice(req: ReferenceVoiceRequest):
    """
    Extracts a reference voice sample from source media.
    Supports 'auto' (VAD/continuous speech heuristic) and 'manual' (timestamp slice).
    """
    try:
        # Resolve full path
        source_path = req.source_media_path
        if not os.path.isabs(source_path):
            source_path = os.path.abspath(source_path)

        if not os.path.exists(source_path):
            # Try checking relative to backend root
            alt_path = os.path.abspath(os.path.join(str(REF_VOICES_DIR.parent.parent), source_path.lstrip("/\\")))
            if os.path.exists(alt_path):
                source_path = alt_path
            else:
                raise HTTPException(status_code=404, detail=f"Source media file not found: {req.source_media_path}")

        out_dir = str(REF_VOICES_DIR)

        if req.mode == "manual":
            if req.start_time is None or req.end_time is None:
                raise HTTPException(status_code=400, detail="start_time and end_time are required for manual mode")
            res = manual_extract_reference_voice(
                source_media_path=source_path,
                output_dir=out_dir,
                start_time=float(req.start_time),
                end_time=float(req.end_time),
                english_segments=req.english_segments,
                custom_transcript=req.custom_transcript
            )
        else:
            res = auto_detect_reference_voice(
                source_media_path=source_path,
                output_dir=out_dir,
                english_segments=req.english_segments or []
            )

        # Convert paths to relative URLs
        stem = os.path.splitext(os.path.basename(source_path))[0]
        res["reference_audio_url"] = f"/uploads/media/ref_voices/{stem}_ref.wav"
        return {"success": True, **res}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def run_single_voice_dub_job(job_id: str, req: GenerateVoiceDubRequest):
    jobs_db[job_id]["status"] = "GENERATING"
    jobs_db[job_id]["progress"] = 5
    
    def on_progress(curr, total, pct, msg):
        jobs_db[job_id]["progress"] = round(pct, 1)
        jobs_db[job_id]["message"] = msg

    try:
        source_path = req.source_video_path
        if not os.path.isabs(source_path):
            source_path = os.path.abspath(source_path)

        ref_path = req.reference_voice_path
        if not os.path.isabs(ref_path):
            ref_path = os.path.abspath(ref_path)

        target_lang = (req.target_language or "ta").lower()
        sub_dir = HINDI_SUBTITLES_DIR if target_lang == "hi" else TAMIL_SUBTITLES_DIR
        out_dir = HINDI_DUBBED_DIR if target_lang == "hi" else TAMIL_DUBBED_DIR

        # Load segments from JSON or request
        segments = req.subtitle_segments or req.tamil_segments or []
        sub_path = req.subtitles_path or req.tamil_subtitles_path
        if not segments and sub_path:
            json_path = sub_path.replace(".vtt", ".json")
            if os.path.exists(json_path):
                with open(json_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    segments = data.get("segments", [])

        if not segments:
            # Try locating JSON in subtitles directory
            stem = os.path.splitext(os.path.basename(source_path))[0]
            cand_json = os.path.join(str(sub_dir), f"{stem}_{target_lang}.json")
            if os.path.exists(cand_json):
                with open(cand_json, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    segments = data.get("segments", [])

        if not segments:
            raise RuntimeError(f"No {target_lang.upper()} subtitle segments found to dub.")

        res = dub_video_to_language(
            source_video_path=source_path,
            subtitle_segments=segments,
            reference_voice_path=ref_path,
            reference_transcript=req.reference_transcript,
            output_dir=str(out_dir),
            target_language=target_lang,
            progress_callback=on_progress
        )

        stem = os.path.splitext(os.path.basename(source_path))[0]
        dubbed_url = f"/uploads/media/dubbed/{target_lang}/{stem}_{target_lang}.mp4"
        voice_url = f"/uploads/media/dubbed/{target_lang}/{stem}_{target_lang}_voice.wav"

        jobs_db[job_id]["status"] = "READY"
        jobs_db[job_id]["progress"] = 100
        jobs_db[job_id]["target_language"] = target_lang
        jobs_db[job_id]["dubbed_video_path"] = res["dubbed_video_path"]
        jobs_db[job_id]["dubbed_video_url"] = dubbed_url
        jobs_db[job_id]["voice_audio_url"] = voice_url

        # Dispatch webhook callback if provided
        if req.callback_url:
            import requests
            payload = {
                "course_id": req.course_id,
                "content_item_id": req.content_item_id,
                "target_language": target_lang,
                "dubbed_video_url": dubbed_url,
                "voice_audio_url": voice_url,
                "status": "COMPLETED"
            }
            try:
                requests.post(req.callback_url, json=payload, timeout=10)
            except Exception as ex:
                print(f"Webhook callback dispatch warning: {ex}")

    except Exception as e:
        jobs_db[job_id]["status"] = "FAILED"
        jobs_db[job_id]["error"] = str(e)

@app.post("/api/voice/preview")
def preview_voice_dub(req: GenerateVoiceDubRequest):
    """
    Synchronously generates a 20-30s preview of the natural Hindi/Tamil dubbed video.
    """
    try:
        source_path = req.source_video_path
        if not os.path.isabs(source_path):
            source_path = os.path.abspath(source_path)

        ref_path = req.reference_voice_path
        if not os.path.isabs(ref_path):
            ref_path = os.path.abspath(ref_path)

        target_lang = (req.target_language or "ta").lower()
        sub_dir = HINDI_SUBTITLES_DIR if target_lang == "hi" else TAMIL_SUBTITLES_DIR
        out_dir = HINDI_DUBBED_DIR if target_lang == "hi" else TAMIL_DUBBED_DIR

        segments = req.subtitle_segments or req.tamil_segments or []
        if not segments:
            stem = os.path.splitext(os.path.basename(source_path))[0]
            cand_json = os.path.join(str(sub_dir), f"{stem}_{target_lang}.json")
            if os.path.exists(cand_json):
                with open(cand_json, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    segments = data.get("segments", [])

        if not segments:
            raise HTTPException(status_code=404, detail=f"No {target_lang.upper()} subtitle segments found.")

        res = dub_video_to_language(
            source_video_path=source_path,
            subtitle_segments=segments,
            reference_voice_path=ref_path,
            reference_transcript=req.reference_transcript,
            output_dir=str(out_dir),
            target_language=target_lang,
            preview_mode=True,
            preview_duration=30.0
        )

        stem = os.path.splitext(os.path.basename(source_path))[0]
        return {
            "success": True,
            "target_language": target_lang,
            "preview_video_url": f"/uploads/media/dubbed/{target_lang}/{stem}_{target_lang}_preview.mp4",
            "preview_voice_url": f"/uploads/media/dubbed/{target_lang}/{stem}_{target_lang}_preview_voice.wav",
            **res
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/voice/generate")
def generate_voice_dub(req: GenerateVoiceDubRequest, background_tasks: BackgroundTasks):
    """
    Generates a natural Hindi or Tamil dubbed video using intelligent audio alignment.
    """
    target_lang = (req.target_language or "ta").lower()
    job_id = f"voice-job-{target_lang}-{req.course_id or 0}-{uuid.uuid4().hex[:8]}"
    jobs_db[job_id] = {
        "job_id": job_id,
        "course_id": req.course_id,
        "content_item_id": req.content_item_id,
        "target_language": target_lang,
        "status": "QUEUED",
        "progress": 0,
        "message": f"Queued for {target_lang.upper()} voice synthesis"
    }
    background_tasks.add_task(run_single_voice_dub_job, job_id, req)
    return {"job_id": job_id, "status": "QUEUED", "target_language": target_lang}

@app.get("/api/jobs/{job_id}")
def get_job_status(job_id: str):
    if job_id not in jobs_db:
        raise HTTPException(status_code=404, detail="Job not found")
    return jobs_db[job_id]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=HOST, port=PORT, reload=False)

