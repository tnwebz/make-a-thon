import os
import sys
import time
import requests
from pathlib import Path

# Configure UTF-8 encoding for Windows terminals
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    try:
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

from typing import Dict, Any, List, Optional
from app.config import (
    HINDI_UPLOADS_DIR,
    TAMIL_UPLOADS_DIR,
    BACKEND_UPLOADS_DIR,
    BACKEND_API_URL,
    LANGUAGES
)
from app.pdf.layout_translator import LayoutPreservingPdfTranslator
from app.translation.indictrans_service import IndicTransService

class CourseProcessor:
    """
    Orchestrates the conversion of English course PDF notes into localized course PDF notes (Hindi, Tamil, etc.).
    Preserves 100% of original visual styles, dark blue sidebars, backgrounds, and layout boxes.
    """

    def __init__(self):
        self.layout_translator = LayoutPreservingPdfTranslator()
        self.translation_service = IndicTransService.get_instance()

    def process_single_pdf(
        self,
        source_pdf_path: str,
        output_filename: Optional[str] = None,
        target_language: str = "hi",
        document_title: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Translates a single English PDF to a localized PDF (Hindi, Tamil) preserving full layout and color themes.
        """
        src_path = Path(source_pdf_path)
        if not src_path.exists():
            # Try resolving relative to BACKEND_UPLOADS_DIR
            relative_clean = source_pdf_path.replace("/uploads/media/", "").replace("uploads/media/", "").lstrip("/\\")
            candidate = BACKEND_UPLOADS_DIR / relative_clean
            if candidate.exists():
                src_path = candidate
            else:
                raise FileNotFoundError(f"Source PDF not found at {source_pdf_path}")

        lang_meta = LANGUAGES.get(target_language, LANGUAGES["hi"])
        tgt_indic_code = lang_meta.get("indicCode", "hin_Deva")
        target_uploads_dir = lang_meta.get("uploads_dir", HINDI_UPLOADS_DIR)

        if not output_filename:
            output_filename = src_path.name

        out_file_path = target_uploads_dir / output_filename

        print(f"[CourseProcessor] Performing layout-preserving in-place {lang_meta.get('name', '')} translation on {src_path.name}...")
        res = self.layout_translator.translate_pdf(
            source_pdf_path=str(src_path),
            output_pdf_path=str(out_file_path),
            src_lang="eng_Latn",
            tgt_lang=tgt_indic_code
        )

        relative_web_path = f"/uploads/media/{target_language}/{out_file_path.name}"
        file_size = out_file_path.stat().st_size

        print(f"[CourseProcessor] [OK] Generated {lang_meta.get('name', '')} PDF successfully ({file_size} bytes): {relative_web_path}")

        return {
            "success": True,
            "language_code": target_language,
            "relative_path": relative_web_path,
            "absolute_path": str(out_file_path),
            "file_size": file_size,
            "total_pages": res.get("total_pages", 1),
            "translated_blocks": res.get("translated_blocks", 0)
        }

    def process_course_assets(
        self,
        course_id: int,
        course_title: str,
        pdf_assets: List[Dict[str, Any]],
        target_language: str = "hi",
        callback_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Translates all PDF assets belonging to a course sequentially into the target language and reports progress.
        pdf_assets is a list of:
        [
            { "content_item_id": 12, "title": "Lecture Notes", "source_url": "/uploads/media/xxx.pdf", "module_title": "Module 1" },
            ...
        ]
        """
        lang_meta = LANGUAGES.get(target_language, LANGUAGES["hi"])
        tgt_indic_code = lang_meta.get("indicCode", "hin_Deva")
        lang_name = lang_meta.get("name", "Localized")

        total_files = len(pdf_assets)
        print(f"[CourseProcessor] Starting {lang_name} generation for Course {course_id} ('{course_title}') with {total_files} PDF assets.")

        if total_files == 0:
            self._notify_backend(callback_url, target_language, {
                "course_id": course_id,
                "language_code": target_language,
                "status": "READY",
                "progress": 100,
                "total_files": 0,
                "completed_files": 0,
                "results": []
            })
            return {
                "course_id": course_id,
                "language_code": target_language,
                "status": "READY",
                "completed_files": 0,
                "results": []
            }

        completed_files = 0
        results = []
        failed_assets = []

        # Translate Course Title
        translated_course_title = self.translation_service.translate(
            course_title,
            src_lang="eng_Latn",
            tgt_lang=tgt_indic_code
        )

        for idx, asset in enumerate(pdf_assets):
            item_id = asset.get("content_item_id")
            source_url = asset.get("source_url")
            asset_title = asset.get("title", "Notes")
            module_title = asset.get("module_title", "Module")

            current_progress = int((completed_files / total_files) * 100)
            self._notify_backend(callback_url, target_language, {
                "course_id": course_id,
                "language_code": target_language,
                "status": "GENERATING",
                "progress": current_progress,
                "total_files": total_files,
                "completed_files": completed_files,
                "current_file": f"{module_title} / {asset_title}"
            })

            try:
                translated_doc_title = self.translation_service.translate(
                    asset_title,
                    src_lang="eng_Latn",
                    tgt_lang=tgt_indic_code
                )

                res = self.process_single_pdf(
                    source_pdf_path=source_url,
                    target_language=target_language,
                    document_title=translated_doc_title
                )

                # Translate lesson title
                translated_item_title = self.translation_service.translate(
                    asset_title,
                    src_lang="eng_Latn",
                    tgt_lang=tgt_indic_code
                )

                item_result = {
                    "content_item_id": item_id,
                    "title": translated_item_title,
                    "content": res["relative_path"],
                    "status": "READY",
                    "file_size": res["file_size"]
                }
                results.append(item_result)
                completed_files += 1

                # Send live incremental progress and save results after each completed file
                step_progress = int((completed_files / total_files) * 100)
                self._notify_backend(callback_url, target_language, {
                    "course_id": course_id,
                    "language_code": target_language,
                    "status": "GENERATING" if completed_files < total_files else "READY",
                    "progress": step_progress,
                    "total_files": total_files,
                    "completed_files": completed_files,
                    "current_file": f"{module_title} / {asset_title}",
                    "results": results
                })

            except Exception as err:
                print(f"[CourseProcessor] [ERROR] Failed to translate asset {item_id} ({source_url}): {err}")
                failed_assets.append({
                    "content_item_id": item_id,
                    "error": str(err),
                    "status": "FAILED"
                })
                results.append({
                    "content_item_id": item_id,
                    "status": "FAILED",
                    "error": str(err)
                })

        final_status = "READY" if completed_files > 0 and len(failed_assets) == 0 else ("FAILED" if completed_files == 0 else "PARTIAL")
        
        final_payload = {
            "course_id": course_id,
            "language_code": target_language,
            "translated_title": translated_course_title,
            "status": "READY" if final_status in ["READY", "PARTIAL"] else "FAILED",
            "progress": 100 if final_status == "READY" else int((completed_files / total_files) * 100),
            "total_files": total_files,
            "completed_files": completed_files,
            "failed_files": len(failed_assets),
            "results": results
        }

        self._notify_backend(callback_url, target_language, final_payload)
        return final_payload

    def _notify_backend(self, callback_url: Optional[str], target_language: str, payload: Dict[str, Any]):
        """
        Sends status updates to the Node.js backend.
        """
        url = callback_url or f"{BACKEND_API_URL}/courses/{payload.get('course_id')}/languages/{target_language}/progress"
        try:
            requests.post(url, json=payload, timeout=5)
        except Exception as e:
            # Backend might be processing asynchronously or polling
            pass
