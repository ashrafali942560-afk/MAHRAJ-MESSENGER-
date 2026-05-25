import React, { useState, useEffect, useRef } from "react";
import { 
  X, 
  Zap, 
  ZapOff, 
  RotateCw, 
  Image as ImageIcon, 
  Send, 
  Video, 
  Camera, 
  AlertTriangle,
  Play,
  Pause,
  RefreshCw
} from "lucide-react";

interface WhatsAppCameraProps {
  onClose: () => void;
  onSendMedia: (base64Data: string, type: "image" | "video", caption?: string) => void;
  onTriggerGallery: () => void;
}

export function WhatsAppCamera({ onClose, onSendMedia, onTriggerGallery }: WhatsAppCameraProps) {
  const [mode, setMode] = useState<"Photo" | "Video">("Photo");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [flash, setFlash] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Recording & capturing states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingTimer = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);

  // Preview / Send confirmation state
  const [capturedMedia, setCapturedMedia] = useState<{
    url: string;
    type: "image" | "video";
    base64: string;
  } | null>(null);
  const [captionText, setCaptionText] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Initialize and request camera
  const startCamera = async () => {
    setErrorMessage(null);
    // Stop any existing tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    const constraintAttempts: MediaStreamConstraints[] = [
      // 1. Specific facing mode & audio
      {
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: true
      },
      // 2. Specific facing mode only (no audio)
      {
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      },
      // 3. Any available camera with audio
      {
        video: true,
        audio: true
      },
      // 4. Any available camera only
      {
        video: true,
        audio: false
      }
    ];

    let success = false;
    let lastError: any = null;

    for (const constraints of constraintAttempts) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setHasPermission(true);
        success = true;
        break; // Break loop on successful stream acquisition
      } catch (err: any) {
        lastError = err;
        console.warn("Camera fallback step failed for constraints:", constraints, err);
      }
    }

    if (!success) {
      setHasPermission(false);
      if (lastError?.name === "NotAllowedError" || lastError?.name === "PermissionDeniedError") {
        setErrorMessage("Camera permission denied. Please allow camera Access.");
      } else {
        setErrorMessage("No active camera found. If you are on a desktop/simulator, please ensure a camera is connected.");
      }
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
      }
    };
  }, [facingMode]);

  // Flip Front/Back lens
  const toggleCameraFacing = () => {
    setFacingMode(prev => prev === "user" ? "environment" : "user");
  };

  // Capture Photo
  const capturePhoto = () => {
    if (!videoRef.current) return;
    try {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Draw the current video frame into the canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert canvas image to Base64 String
        const base64Image = canvas.toDataURL("image/jpeg", 0.85);
        
        setCapturedMedia({
          url: base64Image,
          type: "image",
          base64: base64Image
        });
      }
    } catch (err) {
      console.error("Failed to capture image: ", err);
      setErrorMessage("Photo snapshot processing failed.");
    }
  };

  // Start Video Recording
  const startRecording = () => {
    if (!streamRef.current) return;
    try {
      recordedChunks.current = [];
      const options = { mimeType: "video/webm;codecs=vp9" };
      let recorder: MediaRecorder;
      
      try {
        recorder = new MediaRecorder(streamRef.current, options);
      } catch (e) {
        try {
          recorder = new MediaRecorder(streamRef.current, { mimeType: "video/webm" });
        } catch (e2) {
          recorder = new MediaRecorder(streamRef.current);
        }
      }

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunks.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const videoBlob = new Blob(recordedChunks.current, { type: "video/mp4" });
        const videoUrl = URL.createObjectURL(videoBlob);
        
        // Convert Blob to Base64 standard strings for messenger persistence
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Data = reader.result as string;
          setCapturedMedia({
            url: videoUrl,
            type: "video",
            base64: base64Data
          });
        };
        reader.readAsDataURL(videoBlob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      
      recordingTimer.current = window.setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Recording initialization failed: ", err);
      setErrorMessage("Could not initialize video recording engine.");
    }
  };

  // Stop Video Recording
  const stopRecording = () => {
    if (recordingTimer.current) {
      clearInterval(recordingTimer.current);
      recordingTimer.current = null;
    }
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Click handler on WhatsApp style main trigger button
  const handleShutterClick = () => {
    if (mode === "Photo") {
      capturePhoto();
    } else {
      if (isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
    }
  };

  const handleSendPayload = async () => {
    if (!capturedMedia) return;
    setIsSending(true);
    try {
      // Execute upload proxy callback back to ChatWindow
      await onSendMedia(capturedMedia.base64, capturedMedia.type, captionText.trim());
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSending(false);
    }
  };

  const formatVideoTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${remaining.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between text-white select-none overflow-hidden animate-fade-in">
      
      {/* simulated flash burst exposure screen */}
      {flash && (
        <div className="absolute inset-0 bg-white/95 z-40 pointer-events-none animate-flash duration-300" />
      )}

      {/* STATE 1: VIEW/SEND MEDIA SCREEN ON SUCCESSFUL CAPTURE */}
      {capturedMedia ? (
        <div className="absolute inset-0 bg-[#0B0D0F] z-40 flex flex-col justify-between">
          {/* Header */}
          <div className="p-4 flex items-center justify-between bg-gradient-to-b from-black/50 to-transparent relative z-10 w-full">
            <button 
              onClick={() => {
                setCapturedMedia(null);
                setCaptionText("");
              }}
              className="p-2 rounded-full bg-black/40 text-white hover:bg-neutral-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <span className="text-xxs font-mono tracking-widest text-[#00FF9C] uppercase bg-[#00FF9C]/10 border border-[#00FF9C]/30 px-3.5 py-1 rounded-full">
              Preview Payload Matrix
            </span>
            <div className="w-9" /> {/* Spacer */}
          </div>

          {/* Visual Canvas Display preview */}
          <div className="flex-1 flex items-center justify-center p-4 relative bg-black/40 overflow-hidden">
            {capturedMedia.type === "image" ? (
              <img 
                src={capturedMedia.url} 
                alt="Captured visual snapshot" 
                className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl border border-white/5"
                referrerPolicy="no-referrer"
              />
            ) : (
              <video 
                src={capturedMedia.url} 
                controls 
                autoPlay 
                loop 
                className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl border border-white/5"
              />
            )}
          </div>

          {/* Bottom Caption and Send bar formatted like WhatsApp */}
          <div className="bg-[#12161A] border-t border-white/5 pb-8 pt-4 px-4 space-y-3 relative z-10">
            {/* Caption Input Field */}
            <div className="flex items-center gap-2 bg-black/50 border border-white/10 rounded-2xl px-4 py-3 shadow-inner">
              <input 
                type="text" 
                placeholder="Add a capture caption..."
                value={captionText}
                onChange={(e) => setCaptionText(e.target.value)}
                className="flex-1 text-sm bg-transparent border-none outline-none focus:ring-0 placeholder-gray-500 text-white"
                autoFocus
              />
            </div>

            {/* Actions list */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  setCapturedMedia(null);
                  setCaptionText("");
                }}
                className="px-4 py-2 text-xs font-mono font-bold text-gray-400 hover:text-white transition uppercase"
              >
                Discard Snap
              </button>

              <button
                onClick={handleSendPayload}
                disabled={isSending}
                className="px-5 py-2.5 rounded-2xl bg-[#00FF9C]/95 text-black hover:bg-[#00FF9C] font-mono text-xs font-bold tracking-widest uppercase shadow-lg flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>ENCRYPTING...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 text-black stroke-[3]" />
                    <span>SEND SNAP</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* STATE 2: LIVE VIEWFINDER SCREEN */
        <>
          {/* Header Row */}
          <div className="p-4 flex items-center justify-between z-20 bg-gradient-to-b from-black/80 to-transparent relative shrink-0">
            <button 
              onClick={onClose}
              className="p-2.5 rounded-full bg-black/40 text-white hover:bg-neutral-900 transition cursor-pointer"
            >
              <X className="w-5 h-5 stroke-[2.5]" />
            </button>

            {/* Simulation text of video recording */}
            {isRecording && (
              <div className="flex items-center gap-2 bg-red-600/20 border border-red-500/40 text-red-500 px-4 py-1.5 rounded-full font-mono text-xs animate-pulse font-bold uppercase tracking-wider">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 block animate-ping" />
                <span>REC {formatVideoTimer(recordingSeconds)}</span>
              </div>
            )}

            <button 
              onClick={() => {
                setFlash(p => !p);
                // Trigger quick visual simulation popup
              }}
              className={`p-2.5 rounded-full transition cursor-pointer ${
                flash ? "bg-amber-500/25 text-amber-500 border border-amber-500/40" : "bg-black/40 text-white hover:bg-neutral-900"
              }`}
            >
              {flash ? <Zap className="w-5 h-5" /> : <ZapOff className="w-5 h-5 text-gray-400" />}
            </button>
          </div>

          {/* Viewfinder Content Container */}
          <div className="flex-1 relative bg-neutral-950 flex items-center justify-center overflow-hidden w-full">
            
            {hasPermission === false ? (
              <div className="text-center p-6 space-y-4 max-w-xs relative z-10 font-sans">
                <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto animate-bounce" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-white">Camera Link Error</h3>
                <p className="text-xs text-gray-400 leading-relaxed">{errorMessage}</p>
                <button
                  onClick={startCamera}
                  className="px-4 py-2 text-xxs font-mono font-bold uppercase tracking-widest text-[#00FF9C] border border-[#00FF9C]/30 bg-[#00FF9C]/5 rounded-xl hover:bg-[#00FF9C]/10 transition"
                >
                  RE-TRY DIRECT HANDSHAKE
                </button>
                <div className="pt-2">
                  <span className="text-[10px] text-gray-500 uppercase font-mono tracking-wide block">Or capture using media uploads:</span>
                  <button
                    onClick={onTriggerGallery}
                    className="mt-2 w-full py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-mono text-xxs uppercase rounded-xl tracking-wider transition"
                  >
                    SELECT FROM MOBILE GALLERY
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Background active video preview */}
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted
                  className="absolute inset-0 w-full h-full object-cover z-0"
                />

                {/* Subtle grids or targets mimicking a high-fidelity camera */}
                <div className="absolute inset-0 border border-white/5 pointer-events-none z-1" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border border-white/10 rounded-3xl pointer-events-none z-1 flex items-center justify-center">
                  <div className="w-4 h-4 border-t border-l border-[#00FF9C]/35 absolute top-0 left-0 rounded-tl-lg" />
                  <div className="w-4 h-4 border-t border-r border-[#00FF9C]/35 absolute top-0 right-0 rounded-tr-lg" />
                  <div className="w-4 h-4 border-b border-l border-[#00FF9C]/35 absolute bottom-0 left-0 rounded-bl-lg" />
                  <div className="w-4 h-4 border-b border-r border-[#00FF9C]/35 absolute bottom-0 right-0 rounded-br-lg" />
                </div>
              </>
            )}

            {/* Custom brand tag logo shown in the prompt image */}
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
              <span className="bg-white text-black font-sans font-extrabold text-2xl tracking-widest py-1.5 px-6 rounded-lg uppercase shadow-xl select-none opacity-80 scale-100 hover:scale-[1.03] transition-all">
                NEW
              </span>
            </div>
          </div>

          {/* Bottom Dock Control tray */}
          <div className="bg-[#0C0F12] border-t border-white/5 pb-8 pt-5 px-6 shrink-0 relative z-20 w-full">
            
            {/* Row of Action Buttons */}
            <div className="flex items-center justify-between max-w-xs mx-auto mb-6">
              
              {/* Left Button: Gallery Launcher directly from mobile */}
              <button
                onClick={onTriggerGallery}
                className="w-11 h-11 rounded-full bg-neutral-900 border border-white/10 flex items-center justify-center hover:bg-neutral-800 hover:scale-105 transition duration-150 cursor-pointer text-gray-300 hover:text-white"
                title="Launch mobile device gallery uploads"
              >
                <ImageIcon className="w-5 h-5 stroke-[2]" />
              </button>

              {/* Middle Button: Big Shutter trigger button */}
              <button
                onClick={handleShutterClick}
                className="w-18 h-18 rounded-full border-4 border-white flex items-center justify-center bg-transparent focus:outline-none transition-all active:scale-95 duration-100 cursor-pointer"
                title={mode === "Photo" ? "Capture Snap" : (isRecording ? "Stop Video" : "Start Video")}
              >
                {mode === "Photo" ? (
                  <div className="w-13 h-13 rounded-full bg-white block" />
                ) : (
                  <div className={`transition-all rounded-md bg-red-600 ${
                    isRecording ? "w-6 h-6 rounded-xs" : "w-13 h-13 rounded-full"
                  }`} />
                )}
              </button>

              {/* Right Button: Rotate Switch lens */}
              <button
                onClick={toggleCameraFacing}
                className="w-11 h-11 rounded-full bg-neutral-900 border border-white/10 flex items-center justify-center hover:bg-neutral-800 hover:scale-105 transition duration-150 cursor-pointer text-gray-300 hover:text-white"
                title="Rotate to user front camera"
              >
                <RotateCw className="w-5 h-5" />
              </button>

            </div>

            {/* Toggles Tab Slider for Photo & Video */}
            <div className="flex items-center justify-center gap-1.5 max-w-[170px] mx-auto bg-black/40 rounded-full p-1 border border-white/5 shadow-inner">
              <button
                onClick={() => {
                  if (isRecording) stopRecording();
                  setMode("Video");
                }}
                className={`flex-1 py-1.5 rounded-full text-[10px] font-mono uppercase tracking-wider font-bold transition duration-150 ${
                  mode === "Video" 
                    ? "bg-white/10 text-[#00FF9C]" 
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Video
              </button>
              <button
                onClick={() => {
                  setMode("Photo");
                }}
                className={`flex-1 py-1.5 rounded-full text-[10px] font-mono uppercase tracking-wider font-bold transition duration-150 ${
                  mode === "Photo" 
                    ? "bg-white/10 text-[#00FF9C]" 
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Photo
              </button>
            </div>

          </div>
        </>
      )}

    </div>
  );
}
