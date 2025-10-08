import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import no_video from "./assets/no-video.webp";
import "./App.css";

function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [recording, setRecording] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        if (videoRef.current) {
          (videoRef.current as HTMLVideoElement).srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
      }
    }
    startCamera();
  }, []);

  const handleRecord = () => {
    if (!recording) {
      const stream = videoRef.current?.srcObject as MediaStream | null;
      if (!stream) return;

      // Use the browser's preferred format
      const options: MediaRecorderOptions = {};
      if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
        options.mimeType = 'video/webm;codecs=vp9';
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
        options.mimeType = 'video/webm;codecs=vp8';
      } else if (MediaRecorder.isTypeSupported('video/webm')) {
        options.mimeType = 'video/webm';
      }

      const recorder = new MediaRecorder(stream, options);
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (e: BlobEvent) => chunks.push(e.data);
      recorder.onstop = () => {
        // Use the actual recorded mime type
        const mimeType = recorder.mimeType || 'video/webm';
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        console.log("Recorded video type:", mimeType);
        console.log("Blob size:", blob.size);
        navigate("/cutting", { state: { videoUrl: url } });
      };

      // Request data every second to help with seekability
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } else {
      mediaRecorderRef.current?.stop();
      setRecording(false);
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      navigate("/cutting", { state: { videoUrl: url } });
    }
  };

  return (
    <div className="main-container">
      <div className="video-section">
        <div className="video-box">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="video"
          ></video>
        </div>

        <div className="buttons">
          <label className="upload-btn">
            UPLOAD
            <input
              type="file"
              accept="video/*"
              style={{ display: "none" }}
              onChange={handleUpload}
            />
          </label>
          <button className="record-btn" onClick={handleRecord}>
            {recording ? "STOP" : "RECORD"}
          </button>
        </div>
      </div>

      <div className="existing-videos">
        <h2>Existing videos</h2>
        <div className="video-grid">
          <div className="video-item">
            <img src={no_video} alt="Video 1" />
            <p>Video 1</p>
          </div>
          <div className="video-item">
            <img src={no_video} alt="Video 2" />
            <p>Video 2</p>
          </div>
          <div className="video-item">
            <img src={no_video} alt="Video 3" />
            <p>Video 3</p>
          </div>
          <div className="video-item">
            <img src={no_video} alt="Video 4" />
            <p>Video 4</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;