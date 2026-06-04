import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { socket } from "../socket";
import {
  ArrowLeft,
  Video,
  VideoOff,
  LogOut,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

const Broadcaster = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const localVideoRef = useRef(null);
  const peerConnections = useRef({});
  const streamRef = useRef(null);
  const [streamActive, setStreamActive] = useState(false);
  const [facingMode, setFacingMode] = useState("user");
  const [error, setError] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [zoomCapabilities, setZoomCapabilities] = useState(null);

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

  const handleZoomChange = (e) => {
    const value = parseFloat(e.target.value);
    setZoom(value);
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack && videoTrack.applyConstraints) {
        videoTrack
          .applyConstraints({ advanced: [{ zoom: value }] })
          .catch((err) => console.error("Error applying zoom:", err));
      }
    }
  };

  const stopMediaOnly = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const stopEverything = () => {
    console.log("Cleanup: Stopping all media and connections");

    // 0. Notify server
    socket.emit("leave-room", { roomId });

    // 1. Stop all tracks in the stream
    stopMediaOnly();

    // 2. Clear the video element
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
      localVideoRef.current.load();
    }

    // 3. Close all PeerConnections
    Object.values(peerConnections.current).forEach((pc) => pc.close());
    peerConnections.current = {};

    setStreamActive(false);
  };

  const handleLeave = () => {
    stopEverything();
    navigate("/");
  };

  const createPeerConnection = (viewerId, stream) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    peerConnections.current[viewerId] = pc;

    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`[Broadcaster] Sending ICE candidate to ${viewerId}`);
        socket.emit("ice-candidate", {
          to: viewerId,
          candidate: event.candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(
        `[Broadcaster] PC for ${viewerId} state: ${pc.connectionState}`,
      );
    };

    pc.onnegotiationneeded = async () => {
      try {
        console.log(`[Broadcaster] Creating offer for ${viewerId}`);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("webrtc-offer", { to: viewerId, offer });
      } catch (err) {
        console.error("Negotiation error:", err);
      }
    };

    return pc;
  };

  useEffect(() => {
    let isMounted = true;

    const startBroadcasting = async () => {
      try {
        console.log(`Initializing camera access (${facingMode})...`);
        stopMediaOnly();

        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facingMode,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: true,
        });

        if (!isMounted) {
          mediaStream.getTracks().forEach((t) => t.stop());
          return;
        }

        const videoTrack = mediaStream.getVideoTracks()[0];

        // Some browsers/devices need a moment for the track to fully initialize
        // before capabilities are reported correctly.
        setTimeout(() => {
          if (videoTrack && videoTrack.getCapabilities) {
            try {
              const capabilities = videoTrack.getCapabilities();
              console.log("Camera capabilities:", capabilities);
              if (capabilities.zoom) {
                setZoomCapabilities(capabilities.zoom);
                setZoom(capabilities.zoom.min || 1);
              } else {
                console.warn("Zoom not supported by this camera/browser");
                setZoomCapabilities(null);
              }
            } catch (e) {
              console.error("Error getting capabilities:", e);
              setZoomCapabilities(null);
            }
          } else {
            console.warn(
              "getCapabilities not supported on this device/browser",
            );
          }
        }, 500);

        streamRef.current = mediaStream;
        setStreamActive(true);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = mediaStream;
        }

        // Update tracks for all existing viewers
        Object.values(peerConnections.current).forEach((pc) => {
          const senders = pc.getSenders();
          mediaStream.getTracks().forEach((track) => {
            const sender = senders.find(
              (s) => s.track && s.track.kind === track.kind,
            );
            if (sender) {
              sender.replaceTrack(track);
            }
          });
        });

        socket.emit("join-room", { roomId, role: "broadcaster" });

        socket.on("viewer-joined", ({ viewerId }) => {
          console.log(`Viewer ${viewerId} joined. Initiating connection...`);
          createPeerConnection(viewerId, mediaStream);
        });

        socket.on("webrtc-answer", async ({ from, answer }) => {
          const pc = peerConnections.current[from];
          if (pc && pc.signalingState !== "closed") {
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(answer));
            } catch (err) {
              console.error("Error setting remote description:", err);
            }
          }
        });

        socket.on("ice-candidate", async ({ from, candidate }) => {
          const pc = peerConnections.current[from];
          if (pc && pc.signalingState !== "closed") {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (err) {
              console.error("Error adding ICE candidate:", err);
            }
          }
        });
      } catch (err) {
        console.error("Media access error:", err);
        if (isMounted) {
          setError(
            "Could not access camera/microphone. Please check permissions.",
          );
        }
      }
    };

    startBroadcasting();

    return () => {
      console.log("Effect cleanup triggered");
      isMounted = false;
      stopEverything();
      socket.off("viewer-joined");
      socket.off("webrtc-answer");
      socket.off("ice-candidate");
    };
  }, [roomId, facingMode]);

  return (
    <div className="flex flex-col h-screen bg-slate-900 overflow-hidden">
      <div className="p-4 flex items-center justify-between border-b border-slate-800 bg-slate-900/50 backdrop-blur-md">
        <button
          onClick={handleLeave}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
          Back to Dashboard
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleCamera}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-colors border border-slate-700"
          >
            <Video size={14} />
            Switch Cam
          </button>
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-semibold">Broadcasting: Room {roomId}</span>
        </div>
      </div>

      <div className="flex-1 relative flex flex-col items-center justify-center p-4 gap-8">
        {error ? (
          <div className="max-w-md text-center p-8 bg-red-500/10 border border-red-500/50 rounded-2xl">
            <VideoOff size={48} className="mx-auto mb-4 text-red-500" />
            <p className="text-red-400 font-medium">{error}</p>
          </div>
        ) : (
          <>
            <div className="w-full max-w-2xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-700 relative">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${facingMode === "user" ? "mirror" : ""}`}
              />

              {/* Zoom Control Overlay */}
              {zoomCapabilities && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 px-4 py-2 bg-slate-900/80 backdrop-blur-md rounded-full border border-slate-700 shadow-xl">
                  <ZoomOut size={16} className="text-slate-400" />
                  <input
                    type="range"
                    min={zoomCapabilities.min}
                    max={zoomCapabilities.max}
                    step={zoomCapabilities.step || 0.1}
                    value={zoom}
                    onChange={handleZoomChange}
                    className="w-32 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                  <ZoomIn size={16} className="text-slate-400" />
                  <span className="text-[10px] font-mono text-emerald-400 w-8">
                    {zoom.toFixed(1)}x
                  </span>
                </div>
              )}
            </div>

            {streamActive && (
              <div className="w-full max-w-2xl flex justify-center">
                <button
                  onClick={handleLeave}
                  className="flex items-center gap-3 px-8 py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-2xl shadow-xl transition-all active:scale-95 group"
                >
                  <LogOut
                    size={24}
                    className="group-hover:-translate-x-1 transition-transform"
                  />
                  Stop & Leave Room
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="pb-8 text-center text-slate-500 text-sm flex flex-col gap-1">
        <div>Stay on this page to keep the stream alive for OBS</div>
        <div className="text-[10px] uppercase tracking-widest opacity-50">
          1080p HD Enabled
        </div>
      </div>

      <style>{`
        .mirror {
          transform: scaleX(-1);
        }
        input[type='range']::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 12px;
          height: 12px;
          background: #10b981;
          border-radius: 50%;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
};

export default Broadcaster;
