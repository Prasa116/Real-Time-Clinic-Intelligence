import React, { useState, useEffect } from "react";
import { 
  UserPlus, 
  Clock, 
  ArrowRight, 
  Users, 
  CheckCircle2, 
  RotateCcw, 
  Play, 
  Tv, 
  Layout, 
  AlertCircle,
  HelpCircle,
  Sparkles,
  ChevronRight,
  ListOrdered
} from "lucide-react";
import { Patient, QueueState } from "./types";

export default function App() {
  // Simple reactive navigation State
  const [path, setPath] = useState(window.location.pathname);
  
  // App state
  const [queueState, setQueueState] = useState<QueueState>({
    queue: [],
    currentActiveToken: 0,
    avgConsultationTime: 5
  });
  const [syncStatus, setSyncStatus] = useState<"connecting" | "connected" | "error">("connecting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync state over Server-Sent Events (SSE)
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let fallbackInterval: NodeJS.Timeout | null = null;

    const connectSSE = () => {
      setSyncStatus("connecting");
      if (eventSource) {
        eventSource.close();
      }

      eventSource = new EventSource("/api/queue/stream");

      eventSource.onopen = () => {
        setSyncStatus("connected");
        setErrorMessage(null);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setQueueState(data);
          setSyncStatus("connected");
        } catch (err) {
          console.error("Error parsing real-time queue stream payload:", err);
        }
      };

      eventSource.onerror = (err) => {
        console.error("SSE connection failed, attempting fallback polling", err);
        setSyncStatus("error");
        
        // If SSE fails (e.g. proxy constraints), fallback to HTTP polling
        if (!fallbackInterval) {
          fallbackInterval = setInterval(fetchQueueState, 3000);
        }
      };
    };

    const fetchQueueState = async () => {
      try {
        const res = await fetch("/api/queue");
        if (res.ok) {
          const data = await res.json();
          setQueueState(data);
          setErrorMessage(null);
        }
      } catch (err) {
        console.error("HTTP fallback poll failed:", err);
      }
    };

    connectSSE();

    // Regular full initial fetch
    fetchQueueState();

    return () => {
      if (eventSource) eventSource.close();
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  }, []);

  // Listen to popstate changes (browser back/forward)
  useEffect(() => {
    const handleLocationChange = () => {
      setPath(window.location.pathname);
    };
    window.addEventListener("popstate", handleLocationChange);
    return () => window.removeEventListener("popstate", handleLocationChange);
  }, []);

  const navigate = (newPath: string) => {
    window.history.pushState({}, "", newPath);
    setPath(newPath);
  };

  // State manipulation triggers (POST commands to server)
  const addPatient = async (name: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/patient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to add patient");
      }
      return true;
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Error adding patient");
      return false;
    }
  };

  const callNext = async () => {
    try {
      const res = await fetch("/api/call-next", { method: "POST" });
      if (!res.ok) throw new Error("Failed to call next token");
    } catch (err) {
      console.error(err);
    }
  };

  const updateAvgTime = async (minutes: number) => {
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avgConsultationTime: minutes })
      });
      if (!res.ok) throw new Error("Failed to update average time");
    } catch (err) {
      console.error(err);
    }
  };

  const resetQueue = async () => {
    if (confirm("Are you sure you want to reset queue stats to sample data?")) {
      try {
        const res = await fetch("/api/reset", { method: "POST" });
        if (!res.ok) throw new Error("Failed to reset queue");
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Sub-views routing
  if (path === "/receptionist") {
    return (
      <ReceptionistView 
        queueState={queueState} 
        onAddPatient={addPatient}
        onCallNext={callNext}
        onUpdateAvgTime={updateAvgTime}
        onReset={resetQueue}
        syncStatus={syncStatus}
        onNavigate={navigate}
      />
    );
  }

  if (path === "/patient") {
    return (
      <PatientView 
        queueState={queueState} 
        syncStatus={syncStatus}
        onNavigate={navigate}
      />
    );
  }

  // Fallback portal selection view
  return (
    <PortalView 
      queueState={queueState}
      syncStatus={syncStatus}
      onNavigate={navigate}
      onAddPatient={addPatient}
      onCallNext={callNext}
      onUpdateAvgTime={updateAvgTime}
      onReset={resetQueue}
    />
  );
}

/* ==========================================================================
   PORTAL VIEW (Split screen simulation plus launch controls)
   ========================================================================== */
interface PortalViewProps {
  queueState: QueueState;
  syncStatus: "connecting" | "connected" | "error";
  onNavigate: (path: string) => void;
  onAddPatient: (name: string) => Promise<boolean>;
  onCallNext: () => void;
  onUpdateAvgTime: (mins: number) => void;
  onReset: () => void;
}

function PortalView({ 
  queueState, 
  syncStatus, 
  onNavigate,
  onAddPatient,
  onCallNext,
  onUpdateAvgTime,
  onReset
}: PortalViewProps) {
  const [activeTab, setActiveTab] = useState<"home" | "split">("home");

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900 overflow-x-hidden">
      {/* Top Navigation Bar - High Density Theme style */}
      <nav className="h-14 bg-slate-900 text-white flex items-center justify-between px-6 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-lg text-white">Q</div>
          <h1 className="text-lg font-semibold tracking-tight">
            HealthSync <span className="text-slate-400 font-normal">Queue Management</span>
          </h1>
        </div>
        
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${
              syncStatus === "connected" ? "bg-emerald-500 animate-pulse" : 
              syncStatus === "connecting" ? "bg-amber-400 animate-bounce" : "bg-rose-500"
            }`}></span>
            <span className={`${
              syncStatus === "connected" ? "text-emerald-400" : "text-amber-400"
            } uppercase tracking-widest text-[10px] font-bold`}>
              {syncStatus === "connected" ? "Live Sync Active" : "Connecting Sync"}
            </span>
          </div>
          <div className="hidden sm:block bg-slate-800 px-3 py-1 rounded border border-slate-700 font-mono text-xs text-slate-300">
            Node / Express / SSE Server
          </div>
        </div>
      </nav>

      {/* Mode selectors */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Interface Terminal:</span>
          <div className="inline-flex bg-slate-100 p-1 rounded-lg">
            <button 
              onClick={() => setActiveTab("home")}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                activeTab === "home" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Portal Cards
            </button>
            <button 
              onClick={() => setActiveTab("split")}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                activeTab === "split" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Split Live Workspace
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate("/receptionist")}
            className="text-xs bg-slate-900 text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 font-semibold transition"
          >
            Go to Receptionist Terminal
          </button>
          <button
            onClick={() => onNavigate("/patient")}
            className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 font-semibold transition"
          >
            Go to Patient Monitor
          </button>
        </div>
      </div>

      {activeTab === "home" ? (
        <main className="flex-1 max-w-5xl mx-auto px-4 py-12 flex flex-col justify-center items-center">
          <div className="text-center max-w-2xl mb-12">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold mb-4 border border-blue-100">
              <Sparkles className="w-3.5 h-3.5" />
              High Density layout optimized for clinical workflows
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold font-heading text-slate-900 tracking-tight mb-4">
              Real-Time Clinic Intelligence
            </h2>
            <p className="text-slate-500 text-base sm:text-lg">
              Manage patient throughput with dynamic token delegation, instant screen updates, and computed Estimated Turnaround Times.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 w-full max-w-4xl">
            {/* Receptionist Portal Card */}
            <div className="group bg-white border border-slate-200 rounded-2xl p-8 hover:shadow-xl hover:border-blue-200 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between">
              <div>
                <div className="bg-slate-100 text-slate-800 w-12 h-12 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Layout className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-950 mb-2">1. Receptionist Terminal</h3>
                <p className="text-slate-500 text-sm leading-relaxed mb-6">
                  Add incoming clients, manage token flows, call the next patient, and edit consultation rates to dynamically update predicted wait timers.
                </p>
              </div>

              <button 
                onClick={() => onNavigate("/receptionist")}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-3.5 px-4 rounded-xl transition flex items-center justify-center gap-2"
              >
                Launch Receptionist Panel
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            {/* Patient Portal Card */}
            <div className="group bg-white border border-slate-200 rounded-2xl p-8 hover:shadow-xl hover:border-blue-200 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between">
              <div>
                <div className="bg-blue-50 text-blue-600 w-12 h-12 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Tv className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-950 mb-2">2. Patient Monitor</h3>
                <p className="text-slate-500 text-sm leading-relaxed mb-6">
                  A beautiful display page for patients. Shows current live token, claimed tokens ahead, and estimated wait minutes in high readability.
                </p>
              </div>

              <button 
                onClick={() => onNavigate("/patient")}
                className="w-full bg-slate-900 hover:bg-slate-850 text-white text-sm font-semibold py-3.5 px-4 rounded-xl transition flex items-center justify-center gap-2"
              >
                Launch Patient Monitor
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

          <div className="mt-16 bg-blue-50/60 border border-blue-100 p-6 rounded-2xl max-w-2xl flex items-start gap-4">
            <div className="bg-blue-100 text-blue-700 p-2 rounded-lg shrink-0">
              <span className="text-xl">💡</span>
            </div>
            <div className="text-left">
              <h4 className="text-sm font-bold text-slate-800 mb-1">Split View Synchronized Demo</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Click the <span className="font-semibold text-slate-800">"Split Live Workspace"</span> tab above. It shows the receptionist dashboard and the patient display side-by-side. Witness queue updates and estimates respond immediately as you add or call patients!
              </p>
            </div>
          </div>
        </main>
      ) : (
        /* Split view simulation matching High Density block layout */
        <div className="flex-1 grid lg:grid-cols-12 overflow-hidden bg-slate-150">
          <div className="lg:col-span-7 bg-white border-r border-slate-200 flex flex-col overflow-y-auto">
            <div className="p-3 bg-slate-900 text-white flex items-center justify-between text-xs font-semibold px-6 sticky top-0 z-10">
              <span className="tracking-wider text-blue-400 uppercase">RECEPTIONIST VIEW</span>
              <span className="text-emerald-400 font-mono text-[10px]">● SIMULATED FEED</span>
            </div>
            <ReceptionistView 
              queueState={queueState}
              onAddPatient={onAddPatient}
              onCallNext={onCallNext}
              onUpdateAvgTime={onUpdateAvgTime}
              onReset={onReset}
              syncStatus={syncStatus}
              embeddedMode
            />
          </div>

          <div className="lg:col-span-5 bg-slate-50 flex flex-col p-6 overflow-y-auto">
            <div className="p-3 bg-blue-700 text-white rounded-t-xl flex items-center justify-between text-xs font-semibold px-4">
              <span className="tracking-wider uppercase">PATIENT PUBLIC TV VIEW</span>
              <span className="text-blue-200 font-mono text-[10px]">● BROADCAST SYNCED</span>
            </div>
            <div className="bg-white rounded-b-xl border border-t-0 border-slate-200 shadow-sm p-4">
              <PatientView 
                queueState={queueState} 
                syncStatus={syncStatus}
                embeddedMode
              />
            </div>
          </div>
        </div>
      )}

      {/* Footer / Tech stack tags inside high density */}
      <footer className="bg-slate-900 border-t border-slate-800 py-6 text-center text-xs mt-auto px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-slate-400">© 2026 HealthSync System Inc. All patient records synced in local-memory state.</p>
          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] font-bold text-slate-400">REACT 19</span>
            <span className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] font-bold text-slate-400">NODE.JS</span>
            <span className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] font-bold text-slate-400">EXPRESS & SSE</span>
            <span className="px-2 py-0.5 bg-blue-900/40 border border-blue-800/40 rounded text-[10px] font-bold text-blue-400">HIGH-DENSITY COMPACT</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ==========================================================================
   RECEPTIONIST TERMINAL VIEW
   ========================================================================== */
interface ReceptionistViewProps {
  queueState: QueueState;
  onAddPatient: (name: string) => Promise<boolean>;
  onCallNext: () => void;
  onUpdateAvgTime: (mins: number) => void;
  onReset: () => void;
  syncStatus: "connecting" | "connected" | "error";
  onNavigate?: (path: string) => void;
  embeddedMode?: boolean;
}

function ReceptionistView({
  queueState,
  onAddPatient,
  onCallNext,
  onUpdateAvgTime,
  onReset,
  syncStatus,
  onNavigate,
  embeddedMode = false
}: ReceptionistViewProps) {
  const [patientInput, setPatientInput] = useState("");
  const [addingState, setAddingState] = useState(false);
  const [consultationTime, setConsultationTime] = useState(queueState.avgConsultationTime);

  useEffect(() => {
    setConsultationTime(queueState.avgConsultationTime);
  }, [queueState.avgConsultationTime]);

  const handleSubmitPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientInput.trim()) return;
    setAddingState(true);
    const success = await onAddPatient(patientInput);
    if (success) {
      setPatientInput("");
    }
    setAddingState(false);
  };

  const handleConsultationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 0;
    setConsultationTime(value);
  };

  const handleApplyConsultation = () => {
    if (consultationTime > 0) {
      onUpdateAvgTime(consultationTime);
    }
  };

  const currentServing = queueState.queue.find(p => p.token === queueState.currentActiveToken);
  const waitingList = queueState.queue.filter(p => p.status === "waiting");

  return (
    <div className={`flex flex-col bg-white ${embeddedMode ? "p-4" : "min-h-screen bg-slate-50"}`}>
      {/* Upper bar with back trigger if standalone */}
      {!embeddedMode && onNavigate && (
        <div className="bg-slate-900 text-white h-14 flex items-center justify-between px-6 border-b border-slate-800">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => onNavigate("/")}
              className="flex items-center gap-1 text-xs text-slate-300 hover:text-white font-semibold"
            >
              ← Back to Launcher
            </button>
            <h1 className="text-sm font-bold tracking-tight">HealthSync Clinic Console</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-emerald-400 text-xxs uppercase font-bold">Online</span>
          </div>
        </div>
      )}

      <div className={`p-6 max-w-6xl mx-auto w-full flex-1 flex flex-col`}>
        {/* Header Block of Receptionist Terminal */}
        <header className="p-6 border border-slate-200 rounded-xl bg-slate-50/50 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Receptionist Terminal</h2>
              <p className="text-2xl font-bold text-slate-900 font-heading">Clinic Control Board</p>
            </div>
            
            <div className="flex gap-2">
              <div className="bg-white border border-slate-200 p-2 px-3 rounded shadow-xs text-center min-w-[120px]">
                <div className="text-[10px] uppercase text-slate-400 font-semibold">Avg Consultation</div>
                <div className="text-lg font-mono font-bold text-slate-800">
                  {queueState.avgConsultationTime.toString().padStart(2, "0")}:00 Mins
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-4">
            {/* The main high density action call next token */}
            <button 
              onClick={onCallNext}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-4 px-6 rounded-xl shadow-lg shadow-blue-200 flex flex-col items-center justify-center transition-all cursor-pointer active:scale-98"
            >
              <span className="text-xs font-bold uppercase opacity-80 tracking-widest mb-0.5">ACTION TRIGGER</span>
              <span className="text-xl font-bold font-heading flex items-center gap-2">
                <Play className="w-4.5 h-4.5 fill-current" /> CALL NEXT TOKEN
              </span>
            </button>
            
            <div className="sm:w-1/3 bg-slate-800 text-white p-4 rounded-xl flex flex-col items-center justify-center text-center">
              <span className="text-xs uppercase opacity-60 text-slate-300">Currently Serving Token</span>
              <span className="text-3xl font-mono font-bold text-blue-400 leading-none mt-1">
                {queueState.currentActiveToken > 0 ? `#${queueState.currentActiveToken.toString().padStart(3, "0")}` : "None"}
              </span>
              {currentServing && <span className="text-xxs text-slate-400 mt-1 truncate max-w-full">({currentServing.name})</span>}
            </div>
          </div>
        </header>

        {/* Bottom double deck: form on left, table on right */}
        <div className="grid lg:grid-cols-12 gap-6 items-start">
          {/* Form & configurations */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <h3 className="text-sm font-bold text-slate-700 mb-3 border-b border-slate-100 pb-2">Register New Patient</h3>
              
              <form onSubmit={handleSubmitPatient} className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">PATIENT NAME</label>
                  <input 
                    type="text" 
                    value={patientInput}
                    onChange={(e) => setPatientInput(e.target.value)}
                    placeholder="Enter Patient Name..."
                    disabled={addingState}
                    required
                    className="w-full border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-lg px-3.5 py-2.5 text-sm outline-hidden font-medium transition-all"
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={addingState}
                  className="w-full bg-slate-900 text-white px-5 py-2.5 rounded-lg font-bold text-sm hover:bg-slate-800 transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  {addingState ? "Registering..." : "Add to Queue"}
                </button>
              </form>
            </div>

            {/* Set Consultation Timing config */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <h3 className="text-sm font-bold text-slate-700 mb-3 border-b border-slate-100 pb-2 flex justify-between items-center">
                <span>Set Consultation Time</span>
                <span className="text-xs text-blue-600 font-mono font-semibold">{queueState.avgConsultationTime} mins/patient</span>
              </h3>

              <div className="space-y-3">
                <div className="flex gap-2">
                  <input 
                    type="number" 
                    min="1"
                    max="60"
                    value={consultationTime}
                    onChange={handleConsultationChange}
                    className="flex-1 border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 rounded-lg p-2 text-center text-sm font-bold outline-hidden"
                  />
                  <button
                    onClick={handleApplyConsultation}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-lg transition"
                  >
                    Apply
                  </button>
                </div>

                {/* Preset shortcuts */}
                <div className="grid grid-cols-4 gap-1">
                  {[3, 5, 10, 15].map(mins => (
                    <button
                      key={mins}
                      onClick={() => {
                        setConsultationTime(mins);
                        onUpdateAvgTime(mins);
                      }}
                      className={`py-1 text-center font-mono text-[11px] font-bold border rounded-md transition ${
                        queueState.avgConsultationTime === mins 
                          ? "bg-slate-800 border-slate-800 text-white" 
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Reset button inside compact column */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex justify-between items-center text-xs">
              <span className="text-slate-500">Restore default demo data:</span>
              <button 
                onClick={onReset}
                className="text-rose-600 hover:text-rose-800 underline font-semibold cursor-pointer"
              >
                Clear/Reset DB Setup
              </button>
            </div>
          </div>

          {/* Table List on Right */}
          <div className="lg:col-span-8 flex flex-col">
            <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center justify-between">
              <span>Patient Queue Feed</span>
              <span className="bg-slate-100 border border-slate-200 text-slate-600 px-2 py-0.5 rounded text-xs font-mono">
                {waitingList.length} waiting list
              </span>
            </h3>

            <div className="border border-slate-200 rounded-lg overflow-hidden flex-1 shadow-xs bg-white">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 text-[11px] uppercase font-bold text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Token</th>
                    <th className="px-4 py-3">Patient Name</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Consultation Tracker</th>
                  </tr>
                </thead>
                <tbody className="text-sm font-mono divide-y divide-slate-100">
                  {queueState.queue.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-400 font-sans text-xs">
                        No patient recorded in system database. Use the "Register Patient" panel.
                      </td>
                    </tr>
                  ) : (
                    queueState.queue.map((item) => {
                      const isServing = item.token === queueState.currentActiveToken;
                      const isCompleted = item.status === "completed";
                      return (
                        <tr 
                          key={item.token}
                          className={`transition-colors ${
                            isServing ? "bg-blue-50/50 hover:bg-blue-50" : "hover:bg-slate-50"
                          }`}
                        >
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                              isServing ? "bg-blue-600 text-white" :
                              isCompleted ? "bg-slate-100 text-slate-400" : "bg-slate-100 text-slate-700"
                            }`}>
                              #{item.token.toString().padStart(3, "0")}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-sans font-medium text-slate-900">
                            <div className="flex items-center gap-2">
                              <span className={isCompleted ? "text-slate-400 line-through" : ""}>
                                {item.name}
                              </span>
                              {isServing && (
                                <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-emerald-200">
                                  Current Active
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs font-sans">
                            {isServing ? (
                              <span className="text-blue-600 font-bold">Currently consulting</span>
                            ) : isCompleted ? (
                              <span className="text-slate-400">Completed Visit</span>
                            ) : (
                              <span className="text-amber-600 font-medium">Waiting turns</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-xs">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              isServing ? "bg-blue-100 text-blue-700 border border-blue-200" :
                              isCompleted ? "bg-slate-100 text-slate-400 border border-slate-200" :
                              "bg-amber-100 text-amber-700 border border-amber-200"
                            }`}>
                              {isServing ? "serving" : isCompleted ? "concluded" : "in queue"}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   PATIENT DISPLAY VIEW
   ========================================================================== */
interface PatientViewProps {
  queueState: QueueState;
  syncStatus: "connecting" | "connected" | "error";
  onNavigate?: (path: string) => void;
  embeddedMode?: boolean;
}

function PatientView({
  queueState,
  syncStatus,
  onNavigate,
  embeddedMode = false
}: PatientViewProps) {
  const [yourToken, setYourToken] = useState<number | "">("");
  const [selectedName, setSelectedName] = useState<string>("");

  useEffect(() => {
    if (yourToken === "" && queueState.queue.length > 0) {
      const firstWaiting = queueState.queue.find(p => p.status === "waiting");
      if (firstWaiting) {
        setYourToken(firstWaiting.token);
        setSelectedName(firstWaiting.name);
      }
    }
  }, [queueState.queue, yourToken]);

  const handleSelectToken = (token: number, name: string) => {
    setYourToken(token);
    setSelectedName(name);
  };

  const handleManualTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "") {
      setYourToken("");
      setSelectedName("");
    } else {
      const parsed = parseInt(val) || 0;
      setYourToken(parsed);
      const found = queueState.queue.find(p => p.token === parsed);
      setSelectedName(found ? found.name : "Custom Token");
    }
  };

  const activeServingNumber = queueState.currentActiveToken;
  const targetTokenNumber = Number(yourToken) || 0;

  let tokensAhead = 0;
  let patientStatus: "waiting" | "serving" | "completed" | "unknown" = "unknown";

  if (targetTokenNumber > 0) {
    const matchingPatient = queueState.queue.find(p => p.token === targetTokenNumber);
    if (matchingPatient) {
      patientStatus = matchingPatient.status;
    }

    if (patientStatus === "completed") {
      tokensAhead = 0;
    } else if (patientStatus === "serving" || targetTokenNumber === activeServingNumber) {
      tokensAhead = 0;
      patientStatus = "serving";
    } else {
      tokensAhead = Math.max(0, targetTokenNumber - activeServingNumber);
    }
  }

  const estimatedWait = tokensAhead * queueState.avgConsultationTime;
  const activeServingPatient = queueState.queue.find(p => p.token === queueState.currentActiveToken);

  return (
    <div className={`flex flex-col bg-slate-50 ${embeddedMode ? "" : "min-h-screen p-6"}`}>
      {/* Standalone navigation header */}
      {!embeddedMode && onNavigate && (
        <div className="max-w-md mx-auto w-full mb-6 flex items-center justify-between">
          <button 
            onClick={() => onNavigate("/")}
            className="text-xs text-slate-500 hover:text-slate-800 transition font-semibold"
          >
            ← Back to Portal Choices
          </button>
          
          <div className="flex items-center gap-1.5 text-xxs uppercase tracking-wider font-bold text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Live Client Feed
          </div>
        </div>
      )}

      <div className="max-w-md mx-auto w-full space-y-6">
        <div className="text-left">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Patient Display Preview</h2>
          
          {/* Main Patient Monitor Card styled exactly like the High Density reference mock */}
          <div className="bg-white rounded-3xl shadow-xl shadow-slate-200 border border-white overflow-hidden flex flex-col">
            {/* Dark Blue Header Section with extreme numbers */}
            <div className="bg-blue-600 p-8 text-center text-white">
              <div className="text-blue-100 uppercase text-xs font-bold tracking-widest mb-1">Now Serving</div>
              <div className="text-white text-8xl font-mono font-black tracking-tighter leading-none">
                {activeServingNumber > 0 ? activeServingNumber.toString().padStart(2, "0") : "--"}
              </div>
              <div className="mt-2 text-blue-100 font-semibold tracking-tight text-sm truncate">
                {activeServingPatient ? activeServingPatient.name : "Consultation in break"}
              </div>
            </div>

            {/* Middle statistics readout */}
            <div className="p-6 flex flex-col gap-6">
              <div className="flex justify-between items-end border-b border-slate-100 pb-4">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wide">Your Token</div>
                  <div className="text-3xl font-mono font-bold text-slate-900">
                    #{targetTokenNumber > 0 ? targetTokenNumber.toString().padStart(3, "0") : "---"}
                  </div>
                  {selectedName && <span className="text-[10px] text-slate-400 block -mt-1 font-medium italic truncate max-w-[120px]">{selectedName}</span>}
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wide">Tokens Ahead</div>
                  <div className="text-3xl font-mono font-bold text-blue-600">
                    {targetTokenNumber > 0 ? tokensAhead.toString().padStart(2, "0") : "--"}
                  </div>
                </div>
              </div>

              {/* Dynamic Estimated Wait box segment */}
              <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100 text-left">
                <div className="text-blue-500 uppercase text-[10px] font-bold tracking-widest mb-1">Estimated Wait</div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-4xl font-mono font-bold text-blue-900">
                    {targetTokenNumber > 0 ? estimatedWait : "0"}
                  </span>
                  <span className="text-blue-700 font-bold text-sm">Minutes</span>
                </div>
                <div className="mt-2 text-[10px] text-blue-500/80 italic flex items-center gap-1">
                  💡 Based on {queueState.avgConsultationTime} min average per patient
                </div>
              </div>

              {/* Clinic alert warning layout */}
              <div className="flex items-center gap-3 p-4 bg-slate-100 rounded-xl text-left">
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center border border-slate-200 shrink-0 text-lg">
                  🔔
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-slate-800">Mobile Alert</div>
                  <div className="text-[10px] text-slate-500 leading-tight">
                    {patientStatus === "serving" ? "Proceed! You are being called now." : "We'll notify you 2 tokens before your turn."}
                  </div>
                </div>
              </div>
            </div>

            {/* Dark bottom status line */}
            <div className="bg-slate-900 py-3 px-6 flex justify-between items-center text-slate-400 text-[10px] font-mono">
              <div>REF: CLINIC-RX-{queueState.avgConsultationTime}-LIVE</div>
              <div className="flex gap-1.5">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                <div className="w-1.5 h-1.5 bg-blue-500/40 rounded-full"></div>
                <div className="w-1.5 h-1.5 bg-blue-500/40 rounded-full"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Claim ticket selectors */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm text-left">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-xs font-bold text-slate-800">Track and Claim Ticket</h3>
              <p className="text-[10px] text-slate-400">Type ticket ID or select your registration card below.</p>
            </div>
            
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">TICKET ID:</span>
              <input 
                type="number"
                value={yourToken}
                onChange={handleManualTokenChange}
                placeholder="No."
                className="w-16 bg-slate-100 border border-slate-200 text-center font-bold text-xs p-1 text-slate-700 rounded focus:ring-2 focus:ring-blue-500/30 font-mono outline-hidden"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Available patient board tickets</div>
            
            {queueState.queue.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-400 italic">
                No active patients registered yet.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {queueState.queue.map(p => (
                  <button
                    key={p.token}
                    onClick={() => handleSelectToken(p.token, p.name)}
                    className={`p-2.5 rounded-lg border text-left transition text-xs shrink-0 ${
                      yourToken === p.token 
                        ? "bg-blue-600 text-white border-blue-600" 
                        : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
                    }`}
                  >
                    <div className="flex justify-between items-center text-[9px] opacity-75 mb-0.5">
                      <span>Token #{p.token}</span>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        p.status === "serving" ? "bg-emerald-400" :
                        p.status === "completed" ? "bg-slate-300" : "bg-amber-400"
                      }`} />
                    </div>
                    <div className="font-bold truncate">{p.name}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
