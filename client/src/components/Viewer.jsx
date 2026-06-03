import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { socket } from "../socket";

const Viewer = () => {
  const { roomId } = useParams();
  const remoteVideoRef = useRef(null);
  const peerConnection = useRef(null);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    const initViewer = () => {
      socket.emit("join-room", { roomId, role: "viewer" });

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      peerConnection.current = pc;

      let broadcasterId = null;

      pc.ontrack = (event) => {
        console.log("Remote track received:", event.streams[0]);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
          setIsLive(true);
        }
      };

      pc.onconnectionstatechange = () => {
        console.log("[Viewer] PC state:", pc.connectionState);
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && broadcasterId) {
          console.log(
            "[Viewer] Sending ICE candidate to broadcaster:",
            broadcasterId,
          );
          socket.emit("ice-candidate", {
            to: broadcasterId,
            candidate: event.candidate,
          });
        }
      };

      socket.on("webrtc-offer", async ({ from, offer }) => {
        console.log("Received WebRTC offer from:", from);
        broadcasterId = from;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("webrtc-answer", { to: from, answer });
        } catch (err) {
          console.error("Error handling offer:", err);
        }
      });

      socket.on("ice-candidate", async ({ from, candidate }) => {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error("Error adding ICE candidate:", err);
        }
      });
    };

    initViewer();

    return () => {
      socket.off("webrtc-offer");
      socket.off("ice-candidate");
      if (peerConnection.current) {
        peerConnection.current.close();
      }
    };
  }, [roomId]);

  return (
    <div className="w-screen h-screen bg-transparent overflow-hidden flex items-center justify-center">
      {!isLive && (
        <div className="text-slate-500 font-mono text-sm">
          WAITING FOR BROADCASTER IN ROOM {roomId}...
        </div>
      )}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className={`w-full h-full object-cover ${isLive ? "opacity-100" : "opacity-0"}`}
        style={{ backgroundColor: "transparent" }}
      />
      <style>{`
        body { background: transparent !important; }
        #root { background: transparent !important; }
      `}</style>
    </div>
  );
};

export default Viewer;
