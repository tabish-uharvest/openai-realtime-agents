import { useState, useRef, useEffect } from "react";

export function FullscreenButton() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const infoTimeout = useRef<NodeJS.Timeout | null>(null);

  // Enter fullscreen
  const handleFullscreen = () => {
    const elem = document.documentElement;
    if (elem.requestFullscreen) elem.requestFullscreen();
    else if ((elem as any).webkitRequestFullscreen) (elem as any).webkitRequestFullscreen();
    else if ((elem as any).msRequestFullscreen) (elem as any).msRequestFullscreen();
  };

  // Exit fullscreen
  const handleExitFullscreen = () => {
    if (document.exitFullscreen) document.exitFullscreen();
    else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
    else if ((document as any).mozCancelFullScreen) (document as any).mozCancelFullScreen();
    else if ((document as any).msExitFullscreen) (document as any).msExitFullscreen();
  };

  // Toggle fullscreen
  const handleToggleFullscreen = () => {
    if (isFullscreen) {
      handleExitFullscreen();
    } else {
      handleFullscreen();
    }
  };

  // Listen for fullscreen change
  useEffect(() => {
    const onFullscreenChange = () => {
      const fs = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullscreen(fs);
      if (fs) {
        setShowInfo(true);
        if (infoTimeout.current) clearTimeout(infoTimeout.current);
        infoTimeout.current = setTimeout(() => setShowInfo(false), 2000);
      }
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onFullscreenChange);
    document.addEventListener("mozfullscreenchange", onFullscreenChange);
    document.addEventListener("MSFullscreenChange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
      document.removeEventListener("mozfullscreenchange", onFullscreenChange);
      document.removeEventListener("MSFullscreenChange", onFullscreenChange);
      if (infoTimeout.current) clearTimeout(infoTimeout.current);
    };
  }, []);

  return (
    <>
      <button
        onClick={handleToggleFullscreen}
        className="corner-btn touch-friendly"
        style={{
          position: "relative",
          width: 64,
          height: 64,
          background: "#1e40af",
          border: "none",
          borderRadius: "16px",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          margin: 0,
          overflow: "visible",
          userSelect: "none",
          WebkitUserSelect: "none",
          MozUserSelect: "none",
          msUserSelect: "none",
          WebkitTouchCallout: "none",
          WebkitTapHighlightColor: "transparent"
        }}
        aria-label={isFullscreen ? "Exit Full Screen" : "Enter Full Screen"}
        title={isFullscreen ? "Exit Full Screen" : "Enter Full Screen"}
      >
        <span style={{
          position: "relative",
          width: 28,
          height: 28,
          display: "inline-block"
        }}>
          {isFullscreen ? (
            // Exit fullscreen icon (corners pointing inward)
            <>
              <span className="corner exit-top-left" />
              <span className="corner exit-top-right" />
              <span className="corner exit-bottom-left" />
              <span className="corner exit-bottom-right" />
            </>
          ) : (
            // Enter fullscreen icon (corners pointing outward)
            <>
              <span className="corner top-left" />
              <span className="corner top-right" />
              <span className="corner bottom-left" />
              <span className="corner bottom-right" />
            </>
          )}
        </span>
        <style>{`
          .corner-btn {
            overflow: visible;
          }
          .touch-friendly {
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
            user-select: none;
            -webkit-touch-callout: none;
            -webkit-tap-highlight-color: transparent;
            touch-action: manipulation;
          }
          .touch-friendly:active {
            transform: scale(0.95);
            transition: transform 0.1s ease;
          }
          .corner {
            position: absolute;
            width: 12px;
            height: 12px;
            border: 2px solid #60a5fa;
            pointer-events: none;
            user-select: none;
          }
          
          /* Enter fullscreen - corners pointing outward */
          .top-left {
            top: -2px; left: -2px;
            border-right: none; border-bottom: none;
            border-top-left-radius: 4px;
          }
          .top-right {
            top: -2px; right: -2px;
            border-left: none; border-bottom: none;
            border-top-right-radius: 4px;
          }
          .bottom-left {
            bottom: -2px; left: -2px;
            border-right: none; border-top: none;
            border-bottom-left-radius: 4px;
          }
          .bottom-right {
            bottom: -2px; right: -2px;
            border-left: none; border-top: none;
            border-bottom-right-radius: 4px;
          }
          
          /* Exit fullscreen - corners pointing inward */
          .exit-top-left {
            top: 6px; left: 6px;
            border-right: none; border-bottom: none;
            border-top-left-radius: 4px;
          }
          .exit-top-right {
            top: 6px; right: 6px;
            border-left: none; border-bottom: none;
            border-top-right-radius: 4px;
          }
          .exit-bottom-left {
            bottom: 6px; left: 6px;
            border-right: none; border-top: none;
            border-bottom-left-radius: 4px;
          }
          .exit-bottom-right {
            bottom: 6px; right: 6px;
            border-left: none; border-top: none;
            border-bottom-right-radius: 4px;
          }
        `}</style>
      </button>
      {isFullscreen && showInfo && (
        <div
          style={{
            position: "fixed",
            top: 20,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.8)",
            color: "#fff",
            padding: "10px 24px",
            borderRadius: "8px",
            zIndex: 9999,
            fontSize: "1rem"
          }}
        >
          Press ESC or click fullscreen button to exit full screen mode
        </div>
      )}
    </>
  );
}
