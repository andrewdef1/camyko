import React, { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";
import { socket } from "./socket";
import Dashboard from "./components/Dashboard";
import Broadcaster from "./components/Broadcaster";
import Viewer from "./components/Viewer";

function App() {
  const [rooms, setRooms] = useState(() => {
    const initial = {};
    for (let i = 1; i <= 10; i++) {
      initial[i.toString()] = { isLive: false };
    }
    return initial;
  });

  useEffect(() => {
    socket.on("connect", () => {
      console.log("Connected to signaling server");
    });

    socket.on("room-update", (updatedRooms) => {
      setRooms(updatedRooms);
    });

    return () => {
      socket.off("connect");
      socket.off("room-update");
    };
  }, []);

  return (
    <div className="min-h-screen font-sans">
      <Routes>
        <Route path="/" element={<Dashboard rooms={rooms} />} />
        <Route path="/broadcast/:roomId" element={<Broadcaster />} />
        <Route path="/view/:roomId" element={<Viewer />} />
      </Routes>
    </div>
  );
}

export default App;
