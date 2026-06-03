import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Radio, Copy, Check } from 'lucide-react';

const Dashboard = ({ rooms }) => {
  const navigate = useNavigate();
  const [copiedId, setCopiedId] = React.useState(null);

  const copyObsUrl = (roomId) => {
    const url = `${window.location.origin}${window.location.pathname}#/view/${roomId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(roomId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="max-w-6xl mx-auto p-8">
      <header className="mb-12 text-center">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
          Camyko Control Center
        </h1>
        <p className="text-slate-400">Manage your mobile camera streams for OBS Studio</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.entries(rooms).map(([id, room]) => (
          <div
            key={id}
            className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 transition-all hover:border-blue-500/50"
          >
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-semibold">Room {id}</h2>
              {room.isLive ? (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full bg-slate-700 text-slate-400 text-xs font-bold uppercase tracking-wider">
                  Offline
                </span>
              )}
            </div>

            <div className="space-y-3">
              <button
                onClick={() => navigate(`/broadcast/${id}`)}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-lg transition-colors"
              >
                <Camera size={18} />
                Enter Cam Room
              </button>

              {room.isLive && (
                <button
                  onClick={() => copyObsUrl(id)}
                  className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2.5 rounded-lg transition-colors"
                >
                  {copiedId === id ? (
                    <>
                      <Check size={18} className="text-emerald-400" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy size={18} />
                      Copy OBS URL
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
