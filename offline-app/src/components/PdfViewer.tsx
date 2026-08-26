import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.js?url";
import { 
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2, 
  Minimize2, Loader2, FileText, AlertCircle, RefreshCw, Eye
} from "lucide-react";

// Configure local offline worker
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

interface PdfViewerProps {
  blobUrl?: string;
  title?: string;
}

interface SinglePageProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  pageNum: number;
  scale: number;
  containerWidth: number;
}

const SinglePdfPage: React.FC<SinglePageProps> = React.memo(({ pdfDoc, pageNum, scale, containerWidth }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    const renderPage = async () => {
      try {
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch (e) {}
        }

        const page = await pdfDoc.getPage(pageNum);
        if (isCancelled) return;

        const defaultViewport = page.getViewport({ scale: 1.0 });
        
        // Auto-scale to fit container on small screens if scale === 1
        let effectiveScale = scale;
        if (containerWidth > 0 && containerWidth < defaultViewport.width) {
          const fitScale = (containerWidth - 24) / defaultViewport.width;
          effectiveScale = scale * fitScale;
        }

        const viewport = page.getViewport({ scale: effectiveScale });
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2.5); // Cap at 2.5 for mobile memory safety

        setDimensions({
          width: Math.floor(viewport.width),
          height: Math.floor(viewport.height)
        });

        if (!canvasRef.current || isCancelled) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) return;

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
        if (!isCancelled) setRendered(true);
      } catch (err: any) {
        if (err?.name !== "RenderingCancelledException") {
          console.error(`Page ${pageNum} Render Error:`, err);
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
  }, [pdfDoc, pageNum, scale, containerWidth]);

  return (
    <div 
      id={`pdf-page-${pageNum}`}
      className="my-3 sm:my-5 shadow-2xl rounded-lg sm:rounded-xl overflow-hidden bg-white border border-slate-700/60 relative transition-transform"
      style={{
        width: dimensions ? `${dimensions.width}px` : "100%",
        minHeight: dimensions ? `${dimensions.height}px` : "300px",
      }}
    >
      <canvas ref={canvasRef} className="block mx-auto max-w-none" />
      
      {/* Page Number Watermark Indicator */}
      <div className="absolute bottom-2 right-2 bg-slate-900/60 backdrop-blur-xs text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-md pointer-events-none opacity-60">
        p. {pageNum}
      </div>
    </div>
  );
});

export const PdfViewer: React.FC<PdfViewerProps> = ({ blobUrl, title }) => {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [activePageNum, setActivePageNum] = useState<number>(1);
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [containerWidth, setContainerWidth] = useState<number>(typeof window !== "undefined" ? window.innerWidth : 800);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const pinchRef = useRef<{ initialDistance: number; initialScale: number } | null>(null);
  const lastTapRef = useRef<number>(0);

  // ResizeObserver to detect container dimensions for auto fit-to-width
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

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
    setActivePageNum(1);

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

  // Track active visible page while scrolling
  const handleScroll = useCallback(() => {
    if (!containerRef.current || numPages <= 1) return;
    const container = containerRef.current;
    const containerTop = container.scrollTop;
    const triggerOffset = containerTop + container.clientHeight / 3;

    for (let i = 1; i <= numPages; i++) {
      const pageEl = document.getElementById(`pdf-page-${i}`);
      if (pageEl) {
        const pageTop = pageEl.offsetTop;
        const pageBottom = pageTop + pageEl.offsetHeight;
        if (triggerOffset >= pageTop && triggerOffset <= pageBottom) {
          setActivePageNum(i);
          break;
        }
      }
    }
  }, [numPages]);

  // Navigate to specific page
  const scrollToPage = (page: number) => {
    if (page < 1 || page > numPages) return;
    setActivePageNum(page);
    const el = document.getElementById(`pdf-page-${page}`);
    if (el && containerRef.current) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handlePrevPage = () => {
    if (activePageNum > 1) {
      scrollToPage(activePageNum - 1);
    }
  };

  const handleNextPage = () => {
    if (activePageNum < numPages) {
      scrollToPage(activePageNum + 1);
    }
  };

  // Zoom controls
  const handleZoomIn = () => {
    setScale(prev => Math.min(+(prev + 0.2).toFixed(2), 3.0));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(+(prev - 0.2).toFixed(2), 0.5));
  };

  const handleResetZoom = () => {
    setScale(1.0);
  };

  // Touch Pinch-to-Zoom handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      pinchRef.current = { initialDistance: dist, initialScale: scale };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / pinchRef.current.initialDistance;
      const newScale = Math.min(Math.max(pinchRef.current.initialScale * factor, 0.5), 3.0);
      setScale(Number(newScale.toFixed(2)));
    }
  };

  const handleTouchEnd = () => {
    pinchRef.current = null;
  };

  // Double tap to zoom
  const handleDoubleTap = (e: React.TouchEvent | React.MouseEvent) => {
    const now = Date.now();
    if (now - lastTapRef.current < 350) {
      setScale(prev => (prev > 1.2 ? 1.0 : 1.7));
    }
    lastTapRef.current = now;
  };

  const toggleFullscreen = () => {
    setIsFullscreen(prev => !prev);
  };

  // Generate page numbers array
  const pageNumbers = useMemo(() => {
    return Array.from({ length: numPages }, (_, i) => i + 1);
  }, [numPages]);

  return (
    <div className={`w-full h-full flex flex-col bg-slate-900 rounded-2xl sm:rounded-[2rem] overflow-hidden border border-slate-800 shadow-2xl ${
      isFullscreen ? "fixed inset-0 z-50 rounded-none" : ""
    }`}>
      {/* Top PDF Toolbar */}
      <div className="bg-slate-950/95 backdrop-blur-md px-2.5 sm:px-5 py-2 flex items-center justify-between border-b border-slate-800 text-white shrink-0 gap-1.5 sm:gap-2 z-20">
        {/* Title */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-1">
          <FileText size={15} className="text-amber-400 shrink-0" />
          <span className="text-xs font-black truncate">{title || "PDF Document"}</span>
        </div>

        {/* Controls: Zoom & Pagination & Fullscreen */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          
          {/* Zoom Controls (Always Visible on Mobile & Desktop) */}
          <div className="flex items-center gap-0.5 bg-slate-800/90 px-1 py-0.5 rounded-xl border border-slate-700/60 text-xs">
            <button
              onClick={handleZoomOut}
              disabled={scale <= 0.5}
              className="p-1 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors active:scale-90"
              title="Zoom Out (-)"
            >
              <ZoomOut size={13} />
            </button>
            <button
              onClick={handleResetZoom}
              className="px-1 text-[10px] sm:text-[11px] font-mono font-black text-emerald-400 hover:text-emerald-300 cursor-pointer min-w-[34px] text-center"
              title="Reset Zoom (100%)"
            >
              {Math.round(scale * 100)}%
            </button>
            <button
              onClick={handleZoomIn}
              disabled={scale >= 3.0}
              className="p-1 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors active:scale-90"
              title="Zoom In (+)"
            >
              <ZoomIn size={13} />
            </button>
          </div>

          {/* Quick Page Indicator / Navigation */}
          {numPages > 0 && (
            <div className="flex items-center gap-0.5 bg-slate-800/90 px-1.5 py-0.5 rounded-xl border border-slate-700/60 text-xs font-bold">
              <button
                onClick={handlePrevPage}
                disabled={activePageNum <= 1}
                className="p-1 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="Previous Page"
              >
                <ChevronLeft size={14} />
              </button>

              <span className="px-1 text-[10px] sm:text-[11px] font-mono font-bold text-slate-200 whitespace-nowrap">
                {activePageNum}/{numPages}
              </span>

              <button
                onClick={handleNextPage}
                disabled={activePageNum >= numPages}
                className="p-1 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="Next Page"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 sm:p-2 bg-slate-800/90 hover:bg-slate-700 rounded-xl text-slate-300 hover:text-white cursor-pointer transition-colors"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>
      </div>

      {/* Main Scrollable Canvas Document Stage */}
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleDoubleTap}
        className="flex-1 overflow-y-auto overflow-x-auto bg-slate-900/95 flex flex-col items-center justify-start p-2 sm:p-6 custom-scrollbar relative select-none"
        style={{
          WebkitOverflowScrolling: "touch",
          touchAction: "pan-x pan-y pinch-zoom",
        }}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full my-auto text-slate-400 space-y-3 py-16">
            <Loader2 size={32} className="animate-spin text-emerald-400" />
            <span className="text-xs font-bold tracking-wider uppercase text-slate-300">Rendering PDF Document...</span>
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
          <div className="flex flex-col items-center justify-center w-full min-h-full py-2">
            {pdfDoc && pageNumbers.map(pNum => (
              <SinglePdfPage
                key={`${blobUrl}-page-${pNum}`}
                pdfDoc={pdfDoc}
                pageNum={pNum}
                scale={scale}
                containerWidth={containerWidth}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bottom Sticky Page Bar for Fast Touch Navigation */}
      {numPages > 1 && (
        <div className="bg-slate-950/95 backdrop-blur-md px-4 py-2 flex items-center justify-between border-t border-slate-800/80 text-xs font-bold text-slate-400 shrink-0 z-20">
          <button
            onClick={handlePrevPage}
            disabled={activePageNum <= 1}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-colors active:scale-95 cursor-pointer shadow-xs"
          >
            <ChevronLeft size={14} />
            <span>Prev</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-slate-200 font-mono text-xs font-black bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/50">
              Page {activePageNum} of {numPages}
            </span>
            <span className="text-[10px] text-slate-500 hidden xs:inline font-medium">
              (Scroll to read)
            </span>
          </div>

          <button
            onClick={handleNextPage}
            disabled={activePageNum >= numPages}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-colors active:scale-95 cursor-pointer shadow-xs"
          >
            <span>Next</span>
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
};
