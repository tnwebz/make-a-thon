import React, { useEffect, useRef, useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.js?url";
import { 
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2, 
  Minimize2, Loader2, FileText, AlertCircle, RefreshCw, Eye, Download
} from "lucide-react";

// Configure local worker
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

interface PdfViewerProps {
  blobUrl?: string;
  title?: string;
  isViewOnly?: boolean;
}

interface SinglePageProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  pageNum: number;
  scale: number;
  containerWidth: number;
  isViewOnly?: boolean;
}

const SinglePdfPage: React.FC<SinglePageProps> = React.memo(({ pdfDoc, pageNum, scale, containerWidth, isViewOnly }) => {
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
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2.5); // Cap at 2.5 for mobile performance

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
      className="my-3 sm:my-5 shadow-2xl rounded-lg sm:rounded-xl overflow-hidden bg-white border border-slate-700/60 relative transition-transform select-none"
      style={{
        width: dimensions ? `${dimensions.width}px` : "100%",
        minHeight: dimensions ? `${dimensions.height}px` : "300px",
        userSelect: "none",
        WebkitUserSelect: "none"
      }}
      onContextMenu={(e) => {
        if (isViewOnly) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      <canvas 
        ref={canvasRef} 
        className="block mx-auto max-w-none pointer-events-none select-none" 
      />
      
      {/* Page Number Watermark */}
      <div className="absolute bottom-2 right-2 bg-slate-900/60 backdrop-blur-xs text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-md pointer-events-none opacity-60">
        p. {pageNum}
      </div>
    </div>
  );
});

export const PdfViewer: React.FC<PdfViewerProps> = ({ blobUrl, title, isViewOnly = false }) => {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [activePageNum, setActivePageNum] = useState<number>(1);
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [containerWidth, setContainerWidth] = useState<number>(typeof window !== "undefined" ? window.innerWidth : 800);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerWrapperRef = useRef<HTMLDivElement | null>(null);
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

  // Global keydown protection (Ctrl+S, Ctrl+P) in view only mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isViewOnly) return;
      if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S" || e.key === "p" || e.key === "P")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [isViewOnly]);

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
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = currentDist / pinchRef.current.initialDistance;
      const newScale = Math.min(Math.max(pinchRef.current.initialScale * factor, 0.5), 3.0);
      setScale(+newScale.toFixed(2));
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      pinchRef.current = null;
    }
    // Double tap to toggle 1.0x / 1.6x zoom
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      setScale(prev => (prev > 1.2 ? 1.0 : 1.6));
    }
    lastTapRef.current = now;
  };

  const toggleFullscreen = () => {
    if (!viewerWrapperRef.current) return;
    if (!document.fullscreenElement) {
      viewerWrapperRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  return (
    <div 
      ref={viewerWrapperRef}
      className={`flex flex-col h-full w-full bg-slate-900 text-slate-100 relative overflow-hidden select-none ${
        isFullscreen ? "fixed inset-0 z-50 p-2 sm:p-4 bg-slate-950" : "rounded-2xl sm:rounded-[2rem]"
      }`}
      onContextMenu={(e) => {
        if (isViewOnly) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      style={{
        userSelect: "none",
        WebkitUserSelect: "none"
      }}
    >
      {/* Top Toolbar */}
      <div className="bg-slate-950/90 backdrop-blur-md px-3 sm:px-6 py-2.5 sm:py-3 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0 z-20">
        
        {/* Document Info */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="p-1.5 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20 shrink-0">
            <FileText size={16} />
          </div>
          <div className="truncate">
            <div className="text-xs sm:text-sm font-bold text-white truncate">
              {title || "Study Note Document"}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              {loading ? "Loading pages..." : `Page ${activePageNum} of ${numPages}`}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          
          {/* Zoom Controls */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-0.5">
            <button
              onClick={handleZoomOut}
              disabled={scale <= 0.5}
              className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut size={15} />
            </button>
            
            <button
              onClick={handleResetZoom}
              className="px-2 py-0.5 text-[11px] font-mono font-bold text-slate-300 hover:text-white transition-colors"
              title="Reset Zoom"
            >
              {Math.round(scale * 100)}%
            </button>

            <button
              onClick={handleZoomIn}
              disabled={scale >= 3.0}
              className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn size={15} />
            </button>
          </div>

          {/* View Only Badge or Download Button */}
          {isViewOnly ? (
            <div className="hidden sm:flex items-center gap-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2.5 py-1.5 rounded-xl text-xs font-bold shadow-2xs">
              <Eye size={13} />
              <span>View Only</span>
            </div>
          ) : (
            blobUrl && (
              <a
                href={blobUrl}
                download={title ? `${title}.pdf` : "document.pdf"}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs"
                title="Download PDF"
              >
                <Download size={13} />
                <span className="hidden sm:inline">Download</span>
              </a>
            )
          )}

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded-xl transition-colors cursor-pointer"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen View"}
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        </div>
      </div>

      {/* Main Multi-Page Canvas Stage */}
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="flex-1 overflow-y-auto overflow-x-auto p-2 sm:p-6 flex flex-col items-center custom-scrollbar bg-slate-950/60 relative"
      >
        {loading && (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400 my-auto">
            <Loader2 size={32} className="animate-spin text-amber-400" />
            <span className="text-xs sm:text-sm font-semibold">Rendering PDF pages...</span>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center p-8 text-center max-w-md my-auto space-y-3 bg-red-950/40 border border-red-800/60 rounded-3xl">
            <AlertCircle size={36} className="text-red-400" />
            <div className="text-sm font-bold text-red-200">Unable to Display PDF</div>
            <p className="text-xs text-red-300 leading-relaxed">{error}</p>
          </div>
        )}

        {!loading && !error && pdfDoc && (
          <div className="flex flex-col items-center w-full">
            {Array.from({ length: numPages }, (_, idx) => (
              <SinglePdfPage
                key={idx + 1}
                pdfDoc={pdfDoc}
                pageNum={idx + 1}
                scale={scale}
                containerWidth={containerWidth}
                isViewOnly={isViewOnly}
              />
            ))}
          </div>
        )}
      </div>

      {/* Floating Bottom Page Navigator */}
      {!loading && !error && numPages > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 px-3 py-1.5 rounded-full shadow-2xl flex items-center gap-3 z-30">
          <button
            onClick={handlePrevPage}
            disabled={activePageNum <= 1}
            className="p-1 text-slate-400 hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
            title="Previous Page"
          >
            <ChevronLeft size={16} />
          </button>

          <span className="text-xs font-mono font-bold text-slate-200">
            {activePageNum} / {numPages}
          </span>

          <button
            onClick={handleNextPage}
            disabled={activePageNum >= numPages}
            className="p-1 text-slate-400 hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
            title="Next Page"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
};
