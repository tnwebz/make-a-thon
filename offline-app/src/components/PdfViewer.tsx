import React, { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.js?url";
import { 
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw, 
  Maximize2, Minimize2, Loader2, FileText, AlertCircle, RefreshCw 
} from "lucide-react";

// Configure local offline worker
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

interface PdfViewerProps {
  blobUrl?: string;
  title?: string;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ blobUrl, title }) => {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = useState<number>(1);
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.2);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const renderTaskRef = useRef<any>(null);

  // Load PDF Document when blobUrl changes
  useEffect(() => {
    let isCancelled = false;

    if (!blobUrl) {
      setError("No PDF document source provided.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setPageNum(1);

    const loadPdf = async () => {
      try {
        const loadingTask = pdfjsLib.getDocument({
          url: blobUrl,
          cMapUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/",
          cMapPacked: true,
        });

        const doc = await loadingTask.promise;
        if (!isCancelled) {
          setPdfDoc(doc);
          setNumPages(doc.numPages);
          setLoading(false);
        }
      } catch (err: any) {
        console.error("PDF Load Error:", err);
        if (!isCancelled) {
          setError(err.message || "Failed to load PDF document.");
          setLoading(false);
        }
      }
    };

    loadPdf();

    return () => {
      isCancelled = true;
    };
  }, [blobUrl]);

  // Render current page onto canvas
  useEffect(() => {
    if (!pdfDoc || pageNum < 1 || pageNum > numPages) return;

    let isCancelled = false;

    const renderPage = async () => {
      try {
        // Cancel any ongoing render task before starting a new one
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch (e) {}
        }

        const page = await pdfDoc.getPage(pageNum);
        if (isCancelled || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const viewport = page.getViewport({ scale });
        const pixelRatio = window.devicePixelRatio || 1;

        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

        const renderContext = {
          canvasContext: ctx,
          viewport: viewport,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;

        await renderTask.promise;
      } catch (err: any) {
        if (err?.name !== "RenderingCancelledException") {
          console.error("Page Render Error:", err);
        }
      }
    };

    renderPage();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch (e) {}
      }
    };
  }, [pdfDoc, pageNum, scale, numPages]);

  const handlePrevPage = () => {
    if (pageNum > 1) {
      setPageNum(prev => prev - 1);
      containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleNextPage = () => {
    if (pageNum < numPages) {
      setPageNum(prev => prev + 1);
      containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 3.0));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.6));
  };

  const handleResetZoom = () => {
    setScale(1.2);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(prev => !prev);
  };

  return (
    <div className={`w-full h-full flex flex-col bg-slate-900 rounded-2xl sm:rounded-[2rem] overflow-hidden border border-slate-800 shadow-2xl ${
      isFullscreen ? "fixed inset-0 z-50 rounded-none" : ""
    }`}>
      {/* Top Toolbar */}
      <div className="bg-slate-950/90 backdrop-blur-md px-3 sm:px-5 py-2.5 flex items-center justify-between border-b border-slate-800 text-white shrink-0 gap-2">
        {/* Title */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <FileText size={16} className="text-amber-400 shrink-0" />
          <span className="text-xs sm:text-sm font-black truncate">{title || "PDF Document"}</span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Pagination */}
          {numPages > 0 && (
            <div className="flex items-center gap-1 bg-slate-850 bg-slate-800/80 px-2 py-1 rounded-xl border border-slate-700/50 text-xs font-bold">
              <button
                onClick={handlePrevPage}
                disabled={pageNum <= 1}
                className="p-1 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="Previous Page"
              >
                <ChevronLeft size={16} />
              </button>

              <span className="px-1 text-[11px] font-mono font-bold text-slate-200 whitespace-nowrap">
                {pageNum} / {numPages}
              </span>

              <button
                onClick={handleNextPage}
                disabled={pageNum >= numPages}
                className="p-1 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="Next Page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* Zoom */}
          <div className="hidden xs:flex items-center gap-0.5 bg-slate-800/80 px-1.5 py-1 rounded-xl border border-slate-700/50 text-xs">
            <button
              onClick={handleZoomOut}
              className="p-1 text-slate-300 hover:text-white cursor-pointer transition-colors"
              title="Zoom Out"
            >
              <ZoomOut size={14} />
            </button>
            <button
              onClick={handleResetZoom}
              className="px-1 text-[10px] font-mono font-bold text-slate-300 hover:text-white cursor-pointer"
              title="Reset Zoom"
            >
              {Math.round(scale * 100)}%
            </button>
            <button
              onClick={handleZoomIn}
              className="p-1 text-slate-300 hover:text-white cursor-pointer transition-colors"
              title="Zoom In"
            >
              <ZoomIn size={14} />
            </button>
          </div>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="p-2 bg-slate-800/80 hover:bg-slate-700 rounded-xl text-slate-300 hover:text-white cursor-pointer transition-colors"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* Main Canvas Document Stage */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto bg-slate-900/90 flex flex-col items-center justify-start p-3 sm:p-6 custom-scrollbar relative"
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full my-auto text-slate-400 space-y-3 py-16">
            <Loader2 size={32} className="animate-spin text-emerald-400" />
            <span className="text-xs font-bold tracking-wider uppercase text-slate-300">Rendering PDF Pages...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full my-auto text-slate-300 space-y-3 max-w-sm text-center py-16">
            <AlertCircle size={36} className="text-red-400" />
            <p className="text-xs font-semibold text-slate-300">{error}</p>
            {blobUrl && (
              <a
                href={blobUrl}
                download={`${title || "document"}.pdf`}
                className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
              >
                Download PDF File
              </a>
            )}
          </div>
        ) : (
          <div className="my-auto shadow-2xl rounded-lg overflow-hidden border border-slate-700/60 bg-white transition-transform duration-200">
            <canvas ref={canvasRef} className="block mx-auto max-w-full" />
          </div>
        )}
      </div>

      {/* Mobile Bottom Quick Navigation (If multi-page) */}
      {numPages > 1 && (
        <div className="bg-slate-950 px-4 py-2 flex items-center justify-between border-t border-slate-800 text-xs font-bold text-slate-400 sm:hidden">
          <button
            onClick={handlePrevPage}
            disabled={pageNum <= 1}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 text-white rounded-lg disabled:opacity-30"
          >
            <ChevronLeft size={14} />
            <span>Prev</span>
          </button>

          <span className="text-slate-300 font-mono text-[11px]">
            Page {pageNum} of {numPages}
          </span>

          <button
            onClick={handleNextPage}
            disabled={pageNum >= numPages}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 text-white rounded-lg disabled:opacity-30"
          >
            <span>Next</span>
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
};
