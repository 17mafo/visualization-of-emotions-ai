import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import "./CuttingPage.css";

function CuttingPage() {
  const { state } = useLocation();
  const videoUrl = state?.videoUrl as string | undefined;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);

  const [duration, setDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [chunks, setChunks] = useState<{ start: number; end: number }[]>([]);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [loadingThumbs, setLoadingThumbs] = useState(false);

  const minChunk = 2;
  const maxChunk = 10;
  const thumbCount = 15;

  // when video loads
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;

    const processThumbnails = async () => {
      if (isFinite(video.duration) && video.duration > 0) {
        console.log("Valid duration detected:", video.duration);
        setDuration(video.duration);
        setLoadingThumbs(true);
        try {
          const thumbs = await generateThumbnails(video, thumbCount);
          console.log("Generated thumbnails:", thumbs.length);
          setThumbnails(thumbs);
        } catch (error) {
          console.error("Error generating thumbnails:", error);
        } finally {
          setLoadingThumbs(false);
        }
      }
    };

    const onLoadedMetadata = () => {
      console.log("Video metadata loaded, duration:", video.duration);
      console.log("Video readyState:", video.readyState);
      processThumbnails();
    };

    const onDurationChange = () => {
      console.log("Duration changed to:", video.duration);
      processThumbnails();
    };

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      // For videos with Infinity duration, use currentTime as approximate duration
      if (!isFinite(duration) || duration === 0) {
        if (video.currentTime > 0 && video.seekable.length > 0) {
          const seekableDuration = video.seekable.end(0);
          console.log("Using seekable duration:", seekableDuration);
          setDuration(seekableDuration);
        }
      }
    };

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("durationchange", onDurationChange);
    video.addEventListener("timeupdate", onTimeUpdate);

    // Trigger if already loaded
    if (video.readyState >= 1) {
      processThumbnails();
    }

    return () => {
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("durationchange", onDurationChange);
      video.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, [videoUrl]);

  // === Generate thumbnails using the SAME video element ===
  const generateThumbnails = async (video: HTMLVideoElement, count: number) => {
    const thumbs: string[] = [];
    const duration = video.duration;
    const interval = duration / count;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    
    if (!ctx) {
      console.error("Could not get canvas context");
      return thumbs;
    }

    canvas.width = 160;
    canvas.height = 90;

    const originalTime = video.currentTime;

    for (let i = 0; i < count; i++) {
      const time = i * interval;
      try {
        await seekTo(video, time);
        // Small delay to ensure frame is ready
        await new Promise(resolve => setTimeout(resolve, 100));
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        thumbs.push(canvas.toDataURL("image/jpeg", 0.7));
      } catch (error) {
        console.error(`Error generating thumbnail at ${time}s:`, error);
      }
    }

    // Restore original time
    video.currentTime = originalTime;
    
    return thumbs;
  };

  // === helper: safe seek that waits until ready ===
  const seekTo = (video: HTMLVideoElement, time: number) => {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        video.removeEventListener("seeked", onSeeked);
        reject(new Error("Seek timeout"));
      }, 5000);

      const onSeeked = () => {
        clearTimeout(timeout);
        video.removeEventListener("seeked", onSeeked);
        resolve();
      };
      
      video.addEventListener("seeked", onSeeked);
      video.currentTime = time;
    });
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!timelineRef.current || !video || duration <= 0) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = percent * duration;
    if (isFinite(newTime)) video.currentTime = newTime;
  };

  const handleAddChunk = () => {
    const video = videoRef.current;
    if (!video || duration <= 0) return;
    const start = video.currentTime;
    const end = Math.min(start + maxChunk, duration);
    const overlaps = chunks.some((c) => !(end <= c.start || start >= c.end));
    if (overlaps) return alert("Chunk overlaps another!");
    if (end - start < minChunk) return alert("Chunk too short!");
    setChunks((prev) => [...prev, { start, end }]);
  };

  const formatTime = (s: number) =>
    new Date(s * 1000).toISOString().substr(14, 5);

  return (
    <div className="cutting-container">
      <h2>Video Editor</h2>
      {videoUrl ? (
        <>
          <video 
            ref={videoRef} 
            src={videoUrl} 
            controls 
            className="cutting-video"
            crossOrigin="anonymous"
          />

          <div className="timeline-wrapper">
            <div className="timeline" ref={timelineRef} onClick={handleTimelineClick}>
              {loadingThumbs ? (
                <div className="timeline-placeholder">Loading previews…</div>
              ) : thumbnails.length > 0 ? (
                <div className="timeline-thumbs">
                  {thumbnails.map((t, i) => (
                    <img key={i} src={t} alt={`thumb-${i}`} />
                  ))}
                </div>
              ) : (
                <div className="timeline-placeholder">No previews</div>
              )}

              {chunks.map((chunk, i) => {
                const left = (chunk.start / duration) * 100;
                const width = ((chunk.end - chunk.start) / duration) * 100;
                return (
                  <div
                    key={i}
                    className="chunk"
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`${formatTime(chunk.start)} - ${formatTime(chunk.end)}`}
                  />
                );
              })}

              <div
                className="playhead"
                style={{ left: `${(currentTime / duration) * 100}%` }}
              />
            </div>
          </div>

          <button className="add-chunk-btn" onClick={handleAddChunk}>
            Add Chunk
          </button>

          <ul className="chunk-list">
            {chunks.map((c, i) => (
              <li key={i}>
                Chunk {i + 1}: {formatTime(c.start)} → {formatTime(c.end)}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p>No video found.</p>
      )}
    </div>
  );
}

export default CuttingPage;