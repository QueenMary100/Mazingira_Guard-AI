
import React, { useState, useEffect, useRef } from 'react';
import { MazingiraAgent } from './services/geminiService';
import { IncidentReport, FieldFeedback, FieldStatus, CrimeType, Severity } from './types';
import IncidentCard from './components/IncidentCard';
import Chatbot from './components/Chatbot';

const REGIONAL_VITALS = [
  { name: 'Mau Forest', crimes: 12, health: 85, threats: 4, type: 'Tropical Montane', status: 'High Risk' },
  { name: 'Mt Kenya', crimes: 4, health: 92, threats: 1, type: 'Alpine/Forest', status: 'Stable' },
  { name: 'Maasai Mara', crimes: 18, health: 78, threats: 7, type: 'Savannah/Riparian', status: 'Critical' },
  { name: 'Tsavo East', crimes: 15, health: 72, threats: 6, type: 'Semi-Arid Bushland', status: 'Critical' },
  { name: 'Tana River', crimes: 7, health: 65, threats: 3, type: 'Riverine/Wetland', status: 'At Risk' },
  { name: 'Aberdares', crimes: 2, health: 95, threats: 0, type: 'Cloud Forest', status: 'Pristine' },
  { name: 'Arabuko Sokoke', crimes: 5, health: 88, threats: 2, type: 'Coastal Forest', status: 'Monitored' },
];

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authLoading, setAuthLoading] = useState(false);
  const [incidents, setIncidents] = useState<IncidentReport[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'monitor' | 'reports'>('dashboard');
  const [selectedRegion, setSelectedRegion] = useState('Mau Forest');
  const [agentLog, setAgentLog] = useState<string[]>(["System initialized.", "Waiting for satellite uplink..."]);
  const [focusedLocation, setFocusedLocation] = useState<{lat: number, lng: number} | null>(null);
  
  const [filterType, setFilterType] = useState<string>('All');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const agentRef = useRef<MazingiraAgent | null>(null);
  const mapSectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    agentRef.current = new MazingiraAgent();
  }, []);

  const addLog = (msg: string) => {
    setAgentLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 19)]);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setTimeout(() => {
      setIsAuthenticated(true);
      setAuthLoading(false);
      addLog(authMode === 'login' ? "Authentication Successful: Ranger ID KWS-Alpha-9 verified." : "New Account Provisioned: Ranger ID KWS-Alpha-10 verified.");
    }, 1200);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !agentRef.current) return;

    setIsAnalyzing(true);
    addLog(`Ingesting satellite sector imagery for ${selectedRegion}...`);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = (reader.result as string).split(',')[1];
      
      try {
        addLog("Analyzing change signatures & grounding facts...");
        const history = incidents.filter(i => i.location.region === selectedRegion);
        const result = await agentRef.current!.analyzeImagery(base64String, selectedRegion, history);
        
        if (result) {
          setIncidents(prev => [result, ...prev]);
          addLog(`ALERT: ${result.type} detected. Priority: ${result.severity}.`);
          setActiveTab('reports');
        } else {
          addLog("Sector scan complete. No critical threats identified.");
        }
      } catch (err) {
        addLog("ERROR: Satellite uplink interrupted. Check vision module.");
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const updateIncidentStatus = (id: string, status: FieldStatus) => {
    setIncidents(prev => prev.map(inc => 
      inc.id === id ? { ...inc, status: status } : inc
    ));
    addLog(`Incident ${id.substring(0, 5)} status changed to ${status}.`);
  };

  const handleFeedbackSubmit = (id: string, feedback: FieldFeedback) => {
    setIncidents(prev => prev.map(inc => 
      inc.id === id ? { 
        ...inc, 
        feedback, 
        status: feedback.accuracyRating === 'Incorrect' ? 'False Positive' : 'Threat Confirmed' 
      } : inc
    ));
    addLog(`Feedback received for ${id.substring(0, 5)}. Agent thought signatures updating.`);
  };

  const handleViewOnMap = (lat: number, lng: number) => {
    setFocusedLocation({ lat, lng });
    setActiveTab('dashboard');
    setTimeout(() => {
      mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const handleExportCSV = () => {
    if (incidents.length === 0) return;
    const headers = ['ID', 'Timestamp', 'Type', 'Severity', 'Region', 'Status', 'Confidence', 'Description'];
    const rows = incidents.map(inc => [
      inc.id,
      new Date(inc.timestamp).toISOString(),
      inc.type,
      inc.severity,
      inc.location.region,
      inc.status,
      inc.confidence,
      `"${inc.description.replace(/"/g, '""')}"`
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `mazingira_reports_${new Date().toISOString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addLog("Active reports exported to CSV.");
  };

  const mapUrl = focusedLocation 
    ? `https://www.google.com/maps?q=${focusedLocation.lat},${focusedLocation.lng}&hl=en&z=14&t=k&output=embed`
    : `https://www.google.com/maps?q=-1.286389,36.817223&hl=en&z=7&t=k&output=embed`;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-0 -left-24 w-96 h-96 bg-emerald-600/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-0 -right-24 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px]"></div>
        
        <div className="w-full max-w-md space-y-8 animate-fadeIn relative z-10">
          <div className="text-center">
            <div className="w-20 h-20 bg-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-emerald-500/20">
              <i className="fa-solid fa-leaf text-white text-4xl"></i>
            </div>
            <h1 className="text-4xl font-black text-white tracking-tighter uppercase">MAZINGIRA <span className="text-emerald-500">AI</span></h1>
            <p className="mt-2 text-slate-400 font-medium tracking-wide">Conservation Intelligence Gateway</p>
          </div>

          <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 p-8 rounded-[2.5rem] shadow-2xl space-y-6">
            <div className="flex bg-slate-950/50 p-1.5 rounded-2xl border border-slate-800">
              <button 
                onClick={() => setAuthMode('login')}
                className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${authMode === 'login' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Sign In
              </button>
              <button 
                onClick={() => setAuthMode('register')}
                className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${authMode === 'register' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40' : 'text-slate-500 hover:text-slate-300'}`}
              >
                New Ranger
              </button>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">Access Credentials</label>
                  <div className="relative group">
                    <i className="fa-solid fa-user-shield absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-500 transition-colors"></i>
                    <input 
                      type="text" 
                      required
                      placeholder="Ranger ID or Email"
                      className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-slate-700 focus:outline-none focus:border-emerald-500 transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">Command Passcode</label>
                  <div className="relative group">
                    <i className="fa-solid fa-fingerprint absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-500 transition-colors"></i>
                    <input 
                      type="password" 
                      required
                      placeholder="Enter Passcode"
                      className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-slate-700 focus:outline-none focus:border-emerald-500 transition-all"
                    />
                  </div>
                </div>
              </div>

              <button 
                type="submit"
                disabled={authLoading}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-emerald-900/40 flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
              >
                {authLoading ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-shield-check"></i>}
                {authLoading ? 'Verifying...' : authMode === 'login' ? 'Authorize Session' : 'Provision Ranger Node'}
              </button>
            </form>
            
            <p className="text-center text-[10px] text-slate-600 leading-relaxed uppercase tracking-[0.2em] font-bold">
              Secure Terminal • IP Locked • End-to-End Encrypted
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 flex flex-col selection:bg-emerald-500/30">
      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-900/20">
            <i className="fa-solid fa-leaf text-white text-xl"></i>
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white">MAZINGIRA <span className="text-emerald-500">AI</span></h1>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Marathon Surveillance Agent</p>
          </div>
        </div>
        <nav className="hidden md:flex items-center gap-1 bg-slate-800/50 p-1 rounded-xl border border-slate-700">
          {[
            { id: 'dashboard', icon: 'fa-chart-line', label: 'Dashboard' },
            { id: 'monitor', icon: 'fa-satellite', label: 'Monitor' },
            { id: 'reports', icon: 'fa-folder-open', label: 'Reports' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === tab.id 
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40' 
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              <i className={`fa-solid ${tab.icon}`}></i>
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsAuthenticated(false)}
            className="w-10 h-10 rounded-full border border-slate-700 bg-slate-800 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all group"
            title="Disconnect Terminal"
          >
            <i className="fa-solid fa-power-off text-slate-400 group-hover:text-white"></i>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-[1600px] mx-auto w-full p-6 space-y-16">
        {activeTab === 'dashboard' && (
          <div className="space-y-16 animate-fadeIn pb-20">
            {/* Top Stats */}
            <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { label: 'System Uptime', val: '99.9%', icon: 'fa-clock', color: 'text-blue-500' },
                { label: 'Active Reports', val: incidents.length, icon: 'fa-file-shield', color: 'text-emerald-500' },
                { label: 'Verified Alerts', val: incidents.filter(i => i.status === 'Threat Confirmed').length, icon: 'fa-shield-check', color: 'text-orange-500' },
                { label: 'Forest Health', val: '84%', icon: 'fa-seedling', color: 'text-emerald-400' }
              ].map((stat, i) => (
                <div key={i} className="bg-slate-800/30 p-6 rounded-[2.5rem] border border-slate-800 hover:border-emerald-500/20 transition-all group shadow-xl">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{stat.label}</span>
                    <i className={`fa-solid ${stat.icon} ${stat.color} opacity-20 group-hover:opacity-100 transition-opacity`}></i>
                  </div>
                  <h4 className="text-3xl font-black text-white">{stat.val}</h4>
                </div>
              ))}
            </section>

            {/* About Us Section */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center py-8">
              <div className="space-y-6">
                <span className="px-4 py-1.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-full text-[10px] font-black uppercase tracking-widest">About Us</span>
                <h2 className="text-5xl font-black text-white tracking-tighter leading-none">Protecting Nature with <span className="text-emerald-500 underline decoration-emerald-500/30">Intelligence.</span></h2>
                <p className="text-slate-400 text-lg leading-relaxed">
                  Mazingira AI is a collaborative network protecting Kenya's "Water Towers" and biodiversity hotspots. By leveraging Gemini's multimodal vision and Marathon agent architecture, we empower rangers with persistent surveillance to combat illegal logging and poaching in real-time.
                </p>
                <div className="flex gap-8">
                  <div className="space-y-1 text-center sm:text-left">
                    <p className="text-2xl font-black text-white">1.2M+</p>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Hectares Protected</p>
                  </div>
                  <div className="space-y-1 text-center sm:text-left">
                    <p className="text-2xl font-black text-white">24/7</p>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Autonomous Guard</p>
                  </div>
                </div>
              </div>
              <div className="relative group overflow-hidden rounded-[2.5rem] bg-slate-900 aspect-video shadow-2xl">
                <img 
                  src="https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&q=80&w=1200" 
                  className="relative rounded-[2.5rem] border border-slate-800 object-cover h-full w-full transform group-hover:scale-105 transition-transform duration-1000"
                  alt="Kenyan Forest Coverage"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent flex items-end p-8">
                    <p className="text-white text-xs font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Sector Alpha Aerial Feed</p>
                </div>
              </div>
            </section>

            {/* Why We Monitor - Sympathizing Images */}
            <section className="space-y-12">
              <div className="text-center max-w-2xl mx-auto space-y-4">
                <h2 className="text-4xl font-black text-white tracking-tighter uppercase">The Need for <span className="text-emerald-500">Action.</span></h2>
                <p className="text-slate-400">Environmental crime operates in silence. Without persistent eyes, our natural heritage is being eroded hour by hour.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="group relative rounded-[3rem] overflow-hidden border border-slate-800 aspect-[4/5] shadow-2xl">
                  <img src="https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&q=80&w=800" className="w-full h-full object-cover grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-1000" alt="Deforestation Impact" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-slate-950/20 to-transparent p-10 flex flex-col justify-end">
                    <h3 className="text-2xl font-black text-white mb-3">Habitat Destruction</h3>
                    <p className="text-sm text-slate-300 opacity-0 group-hover:opacity-100 transition-all duration-700 transform translate-y-6 group-hover:translate-y-0 leading-relaxed font-medium">Silent illegal logging is erasing secondary forests before they can recover.</p>
                  </div>
                </div>
                <div className="group relative rounded-[3rem] overflow-hidden border border-slate-800 aspect-[4/5] shadow-2xl">
                  <img src="https://images.unsplash.com/photo-1597047084993-bf337e09ede0?auto=format&fit=crop&q=80&w=800" className="w-full h-full object-cover grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-1000" alt="River Pollution" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-slate-950/20 to-transparent p-10 flex flex-col justify-end">
                    <h3 className="text-2xl font-black text-white mb-3">River Contamination</h3>
                    <p className="text-sm text-slate-300 opacity-0 group-hover:opacity-100 transition-all duration-700 transform translate-y-6 group-hover:translate-y-0 leading-relaxed font-medium">Toxic plumes from unauthorized mining destroys downstream ecosystems.</p>
                  </div>
                </div>
                <div className="group relative rounded-[3rem] overflow-hidden border border-slate-800 aspect-[4/5] shadow-2xl">
                  <img src="https://images.unsplash.com/photo-1541414779316-956a5084c0d4?auto=format&fit=crop&q=80&w=800" className="w-full h-full object-cover grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-1000" alt="Wildlife Crisis" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-slate-950/20 to-transparent p-10 flex flex-col justify-end">
                    <h3 className="text-2xl font-black text-white mb-3">Encroachment</h3>
                    <p className="text-sm text-slate-300 opacity-0 group-hover:opacity-100 transition-all duration-700 transform translate-y-6 group-hover:translate-y-0 leading-relaxed font-medium">Poaching camps and motorized vehicles disrupting sensitive wildlife corridors.</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Protected Ecosystems */}
            <section className="space-y-8">
              <div className="text-center max-w-2xl mx-auto space-y-4">
                <h2 className="text-4xl font-black text-white tracking-tighter uppercase">Monitored <span className="text-emerald-500">Sectors.</span></h2>
                <p className="text-slate-400">Our network covers primary biodiversity hotspots across the region.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {REGIONAL_VITALS.map((forest) => (
                  <div 
                    key={forest.name} 
                    className="bg-slate-800/30 border border-slate-800 p-8 rounded-[2.5rem] hover:border-emerald-500/40 transition-all cursor-pointer group shadow-lg flex flex-col justify-between"
                    onClick={() => { setSelectedRegion(forest.name); setActiveTab('monitor'); }}
                  >
                    <div>
                      <div className="flex justify-between items-start mb-6">
                        <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-emerald-500 group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-lg">
                          <i className={`fa-solid ${forest.name === 'Maasai Mara' || forest.name === 'Tsavo East' ? 'fa-elephant' : 'fa-tree'} text-2xl`}></i>
                        </div>
                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.1em] ${
                          forest.status === 'Critical' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 
                          forest.status === 'Pristine' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                          'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        }`}>
                          {forest.status}
                        </span>
                      </div>
                      <h3 className="text-xl font-black text-white mb-1 group-hover:text-emerald-400 transition-colors">{forest.name}</h3>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-6">{forest.type}</p>
                    </div>
                    <div className="pt-6 border-t border-slate-700/50 flex justify-between items-center">
                       <span className="text-xs text-slate-400 font-medium">Eco Health</span>
                       <span className="text-xs font-black text-emerald-500">{forest.health}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Technology & Mental Model - Section before map/footer */}
            <section className="bg-slate-900 border border-slate-800 rounded-[3.5rem] p-12 lg:p-16 relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 w-1/3 h-full bg-emerald-500/5 blur-[120px] pointer-events-none"></div>
              <div className="max-w-5xl mx-auto space-y-16">
                <div className="space-y-4 text-center">
                  <span className="px-4 py-1.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-full text-[10px] font-black uppercase tracking-[0.2em]">Agent Architecture</span>
                  <h2 className="text-4xl font-black text-white tracking-tighter uppercase">Technology & <span className="text-emerald-500">Mental Model.</span></h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                  <div className="space-y-8">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-emerald-600/20 rounded-2xl flex items-center justify-center text-emerald-500 shadow-lg">
                        <i className="fa-solid fa-brain text-xl"></i>
                      </div>
                      <h4 className="text-xl font-black text-white tracking-tight">Marathon Agents</h4>
                    </div>
                    <p className="text-slate-400 leading-relaxed text-lg font-medium">
                      Our system utilizes **Marathon Agent** architecture. Unlike standard AI that processes tasks in isolation, Marathon Agents maintain **Thought Signatures**—persistent memory of regional data that allows for complex **Temporal Change Detection** and long-term situational awareness.
                    </p>
                  </div>

                  <div className="space-y-8">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-blue-600/20 rounded-2xl flex items-center justify-center text-blue-500 shadow-lg">
                        <i className="fa-solid fa-microchip text-xl"></i>
                      </div>
                      <h4 className="text-xl font-black text-white tracking-tight">Gemini Reasoning</h4>
                    </div>
                    <p className="text-slate-400 leading-relaxed text-lg font-medium">
                      Powered by **Gemini 3 Pro**, the agent performs high-budget thinking to cross-verify vision data with real-time web grounding via **Google Search**. Every alert is grounded in environmental laws and protected area databases to minimize false positives.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Satellite Map Section */}
            <section ref={mapSectionRef} className="bg-slate-900 border border-slate-800 rounded-[3.5rem] overflow-hidden relative min-h-[600px] shadow-2xl p-2">
              <div className="absolute top-8 left-8 z-10 bg-slate-950/90 backdrop-blur-md p-6 rounded-3xl border border-slate-800 shadow-2xl pointer-events-none border-l-4 border-l-emerald-500 max-w-xs sm:max-w-none">
                 <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1 flex items-center gap-2">
                   <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                   Satellite Command Link
                 </h4>
                 <p className="text-sm text-white font-black mb-4 uppercase">
                  {focusedLocation ? `Sector: ${focusedLocation.lat.toFixed(6)}, ${focusedLocation.lng.toFixed(6)}` : 'SCANNING PRIMARY: Rift Valley Sector'}
                 </p>
                 <div className="flex gap-6 items-center">
                    <div className="text-center">
                       <p className="text-[9px] text-slate-500 uppercase font-bold mb-1 tracking-widest">Uplink Status</p>
                       <p className="text-xs text-emerald-400 font-bold uppercase">Active</p>
                    </div>
                    <div className="text-center">
                       <p className="text-[9px] text-slate-500 uppercase font-bold mb-1 tracking-widest">Bandwidth</p>
                       <p className="text-xs text-blue-400 font-bold uppercase">Optimized</p>
                    </div>
                    {focusedLocation && (
                      <button 
                        onClick={() => setFocusedLocation(null)}
                        className="pointer-events-auto bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-xl text-[10px] text-white font-black transition-all uppercase tracking-widest border border-slate-700 ml-4 shadow-xl"
                      >
                        Reset Sector
                      </button>
                    )}
                 </div>
              </div>
              <div className="h-[600px] w-full rounded-[3rem] overflow-hidden bg-slate-950">
                <iframe 
                  src={mapUrl} 
                  width="100%" 
                  height="100%" 
                  style={{ border: 0 }} 
                  allowFullScreen 
                  loading="lazy" 
                  referrerPolicy="no-referrer-when-downgrade"
                  className="w-full h-full"
                ></iframe>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'monitor' && (
          <div className="space-y-6 animate-fadeIn h-full flex flex-col min-h-[70vh] justify-center">
            <div className="bg-slate-800/40 p-16 rounded-[3.5rem] border-2 border-dashed border-slate-700 flex flex-col items-center justify-center text-center group transition-all hover:border-emerald-500/40 relative overflow-hidden shadow-2xl">
              {isAnalyzing ? (
                <div className="flex flex-col items-center">
                  <div className="w-24 h-24 border-8 border-emerald-500/10 border-t-emerald-500 rounded-full animate-spin mb-10"></div>
                  <h3 className="text-3xl font-black text-white mb-3 tracking-tighter uppercase tracking-[0.2em]">Engaging Neural Vision...</h3>
                  <p className="text-slate-400 max-w-sm font-medium">Comparing current telemetry signatures with historical sector persistence.</p>
                </div>
              ) : (
                <>
                  <div className="w-36 h-36 bg-emerald-600/10 rounded-[3rem] flex items-center justify-center mb-10 border border-emerald-500/20 group-hover:scale-110 transition-transform duration-700 shadow-2xl shadow-emerald-900/10">
                    <i className="fa-solid fa-satellite-dish text-7xl text-emerald-500"></i>
                  </div>
                  <h3 className="text-4xl font-black text-white mb-4 tracking-tighter uppercase">Initialize Surveillance Patrolling</h3>
                  <p className="text-slate-400 max-w-xl mb-12 text-xl leading-relaxed font-medium">
                    Upload multispectral imagery for Marathon analysis in <span className="text-emerald-500 font-black">{selectedRegion}</span>.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-5 w-full max-w-2xl">
                    <select 
                      value={selectedRegion}
                      onChange={(e) => setSelectedRegion(e.target.value)}
                      className="bg-slate-950 border border-slate-700 rounded-[1.5rem] px-8 py-5 text-slate-300 outline-none focus:border-emerald-500 transition-all font-black text-sm uppercase tracking-widest shadow-xl"
                    >
                      {REGIONAL_VITALS.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                    </select>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-5 px-12 rounded-[1.5rem] transition-all shadow-2xl shadow-emerald-900/40 flex items-center justify-center gap-3 uppercase tracking-widest text-sm"
                    >
                      <i className="fa-solid fa-cloud-arrow-up"></i> Start Analysis
                    </button>
                    <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" />
                  </div>
                </>
              )}
            </div>
            
            <div className="bg-slate-900/50 p-8 rounded-[2.5rem] border border-slate-800 shadow-xl mt-10">
               <h4 className="text-[10px] font-black text-slate-500 mb-6 uppercase tracking-[0.3em] flex items-center gap-2">
                 <i className="fa-solid fa-microchip text-emerald-500"></i>
                 Agent Intelligence Log
               </h4>
               <div className="space-y-2 max-h-48 overflow-y-auto custom-scroll pr-4">
                 {agentLog.map((log, i) => (
                   <div key={i} className={`text-[11px] font-mono p-3 rounded-xl border border-slate-800/50 ${i === 0 ? 'bg-emerald-500/10 text-emerald-400 border-l-4 border-emerald-500' : 'text-slate-500 bg-slate-950/20'}`}>
                     {log}
                   </div>
                 ))}
               </div>
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="space-y-8 animate-fadeIn">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-slate-800/40 p-12 rounded-[3.5rem] border border-slate-700 shadow-xl">
              <div>
                <h3 className="text-4xl font-black text-white tracking-tighter uppercase">Incident Registry</h3>
                <p className="text-slate-500 text-lg mt-1 font-medium">Autonomous detections requiring ground-truth verification.</p>
              </div>
              <div className="flex flex-wrap gap-4 w-full md:w-auto">
                <button 
                  onClick={handleExportCSV}
                  className="flex-1 md:flex-none px-10 py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-[10px] font-black transition-all flex items-center justify-center gap-3 shadow-xl shadow-emerald-900/20 uppercase tracking-widest"
                >
                  <i className="fa-solid fa-file-csv text-lg"></i> Export CSV
                </button>
                <select 
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="flex-1 md:flex-none bg-slate-950 border border-slate-700 rounded-2xl px-8 py-5 text-[10px] font-black text-white outline-none focus:border-emerald-500 uppercase tracking-widest shadow-xl"
                >
                  <option value="All">All Categories</option>
                  {Object.values(CrimeType).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            {incidents.filter(i => filterType === 'All' || i.type === filterType).length === 0 ? (
              <div className="py-48 text-center text-slate-700 bg-slate-800/10 border-2 border-dashed border-slate-800 rounded-[3.5rem] shadow-inner">
                <i className="fa-solid fa-layer-group text-8xl mb-10 opacity-10"></i>
                <p className="text-3xl font-black text-slate-600 tracking-tighter uppercase">Registry Empty</p>
                <p className="text-sm opacity-40 uppercase tracking-widest mt-3 font-bold">Initialize monitoring to start autonomous patrolling.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
                {incidents
                  .filter(i => filterType === 'All' || i.type === filterType)
                  .map(inc => (
                    <IncidentCard 
                      key={inc.id} 
                      incident={inc} 
                      onAction={(id, status) => updateIncidentStatus(id, status)} 
                      onFeedbackSubmit={handleFeedbackSubmit}
                      onViewOnMap={(lat, lng) => handleViewOnMap(lat, lng)}
                    />
                  ))
                }
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-900 pt-24 pb-12 px-6 relative overflow-hidden mt-10">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent"></div>
        <div className="max-w-[1600px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-20 mb-20">
            <div className="col-span-1 md:col-span-2 space-y-12">
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <i className="fa-solid fa-leaf text-white text-4xl"></i>
                </div>
                <h2 className="text-5xl font-black text-white tracking-tighter">MAZINGIRA <span className="text-emerald-500">AI</span></h2>
              </div>
              <p className="text-slate-500 max-w-lg leading-relaxed text-xl font-medium">
                Pioneering autonomous marathon intelligence for the next generation of environmental protection. Safeguarding biodiversity through persistent surveillance.
              </p>
              <div className="flex gap-8">
                {['twitter', 'github', 'linkedin', 'discord'].map(social => (
                  <a key={social} href="#" className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 hover:text-emerald-500 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all text-3xl shadow-2xl">
                    <i className={`fa-brands fa-${social}`}></i>
                  </a>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-white font-black mb-10 text-[11px] uppercase tracking-[0.4em]">Core Technology</h4>
              <ul className="text-sm text-slate-500 space-y-6 font-bold uppercase tracking-widest">
                <li className="hover:text-emerald-500 transition-colors cursor-pointer flex items-center gap-4"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></span> Marathon Agents</li>
                <li className="hover:text-emerald-500 transition-colors cursor-pointer flex items-center gap-4"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></span> Thought Signatures</li>
                <li className="hover:text-emerald-500 transition-colors cursor-pointer flex items-center gap-4"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></span> Temporal Variance</li>
                <li className="hover:text-emerald-500 transition-colors cursor-pointer flex items-center gap-4"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></span> Grounded Vision</li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-black mb-10 text-[11px] uppercase tracking-[0.4em]">Network Terminal</h4>
              <ul className="text-sm text-slate-500 space-y-7 font-bold">
                <li className="flex items-center gap-5 hover:text-slate-300 transition-colors cursor-default"><i className="fa-solid fa-location-dot text-emerald-500 text-2xl w-8"></i> KWS Nairobi Headquarters</li>
                <li className="flex items-center gap-5 hover:text-slate-300 transition-colors cursor-default"><i className="fa-solid fa-tower-broadcast text-emerald-500 text-2xl w-8"></i> Alpha Dispatch Mobile Unit</li>
                <li className="flex items-center gap-5 hover:text-slate-300 transition-colors cursor-default"><i className="fa-solid fa-envelope text-emerald-500 text-2xl w-8"></i> liaison@mazingira.ai</li>
                <li className="flex items-center gap-5 hover:text-slate-300 transition-colors cursor-default"><i className="fa-solid fa-phone text-emerald-500 text-2xl w-8"></i> +254 800-SURVIVE</li>
              </ul>
            </div>
          </div>
          <div className="pt-12 border-t border-slate-900 flex flex-col md:flex-row justify-between items-center gap-10 text-[11px] font-black text-slate-700 uppercase tracking-[0.3em]">
            <p>© {new Date().getFullYear()} Mazingira AI Autonomous Intelligence. Kenyan Wildlife Protocol.</p>
            <div className="flex gap-16">
              <a href="#" className="hover:text-emerald-500 transition-colors">Privacy</a>
              <a href="#" className="hover:text-emerald-500 transition-colors">Audit</a>
              <a href="#" className="hover:text-emerald-500 transition-colors">Terms</a>
            </div>
          </div>
        </div>
      </footer>

      <Chatbot />
    </div>
  );
};

export default App;
