import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { socket } from "../socket";
import { ArrowLeft, Video, VideoOff, LogOut } from "lucide-react";

const Broadcaster = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const localVideoRef = useRef(null);
  const peerConnection = useRef(null);
  const streamRef = useRef(null);
  const [streamActive, setStreamActive] = useState(false);
  const [error, setError] = useState(null);

  const stopEverything = () => {
    console.log("Cleanup: Stopping all media and connections");

    // 0. Notify server
    socket.emit("leave-room", { roomId });

    // 1. Stop all tracks in the stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.enabled = false; // Disable first
        track.stop(); // Then stop
        console.log(`Stopped track: ${track.kind}`);
      });
      streamRef.current = null;
    }

    // 2. Clear the video element
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
      localVideoRef.current.load(); // Force reset
    }

    // 3. Close PeerConnection
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }

    setStreamActive(false);
  };

  const handleLeave = () => {
    stopEverything();
    navigate("/");
  };

  useEffect(() => {
    let isMounted = true;

    const startBroadcasting = async () => {
      try {
        console.log("Initializing camera access...");
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: true,
        });

        if (!isMounted) {
          console.log(
            "Component unmounted during initialization, stopping tracks",
          );
          mediaStream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = mediaStream;
        setStreamActive(true);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = mediaStream;
        }

        socket.emit("join-room", { roomId, role: "broadcaster" });

        const pc = new RTCPeerConnection({
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        });
        peerConnection.current = pc;

        mediaStream.getTracks().forEach((track) => {
          pc.addTrack(track, mediaStream);
        });

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit("ice-candidate", {
              roomId,
              candidate: event.candidate,
            });
          }
        };

        pc.onnegotiationneeded = async () => {
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit("webrtc-offer", { roomId, offer });
          } catch (err) {
            console.error("Negotiation error:", err);
          }
        };

        socket.on("webrtc-answer", async ({ answer }) => {
          if (pc.signalingState !== "closed") {
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(answer));
            } catch (err) {
              console.error("Error setting remote description:", err);
            }
          }
        });

        socket.on("ice-candidate", async ({ candidate }) => {
          if (pc.signalingState !== "closed") {
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
      socket.off("webrtc-answer");
      socket.off("ice-candidate");
    };
  }, [roomId]);

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
            <div className="w-full max-w-2xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-700">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover mirror"
              />
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

      <div className="pb-8 text-center text-slate-500 text-sm">
        Stay on this page to keep the stream alive for OBS
      </div>

      <style>{`
        .mirror {
          transform: scaleX(-1);
        }
      `}</style>
    </div>
  );
};

export default Broadcaster;
