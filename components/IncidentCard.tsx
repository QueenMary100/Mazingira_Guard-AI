
import React, { useState } from 'react';
import { IncidentReport, Severity, FieldFeedback, FieldStatus, ReasoningStructure } from '../types';

interface IncidentCardProps {
  incident: IncidentReport;
  onAction?: (id: string, action: FieldStatus) => void;
  onFeedbackSubmit?: (id: string, feedback: FieldFeedback) => void;
  onViewOnMap?: (lat: number, lng: number) => void;
}

const IncidentCard: React.FC<IncidentCardProps> = ({ incident, onAction, onFeedbackSubmit, onViewOnMap }) => {
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [showReasoningDetail, setShowReasoningDetail] = useState(false);
  const [feedback, setFeedback] = useState<Partial<FieldFeedback>>({
    confirmed: true,
    accuracyRating: 'Correct',
    groundNotes: ''
  });

  const getSeverityColor = (s: Severity) => {
    switch (s) {
      case Severity.CRITICAL: return 'bg-red-900/50 text-red-400 border-red-500/50';
      case Severity.HIGH: return 'bg-orange-900/50 text-orange-400 border-orange-500/50';
      case Severity.MEDIUM: return 'bg-yellow-900/50 text-yellow-400 border-yellow-500/50';
      default: return 'bg-blue-900/50 text-blue-400 border-blue-500/50';
    }
  };

  const getConfidenceColor = (conf: number) => {
    if (conf >= 0.8) return 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]';
    if (conf >= 0.6) return 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]';
    return 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]';
  };

  const getStatusBadge = (status: FieldStatus) => {
    const colors: Record<FieldStatus, string> = {
      'Detected': 'bg-blue-500/20 text-blue-400',
      'Alerted': 'bg-amber-500/20 text-amber-400',
      'Investigation Pending': 'bg-slate-500/20 text-slate-400',
      'Threat Confirmed': 'bg-emerald-500/20 text-emerald-400',
      'Area Secured': 'bg-blue-500/20 text-blue-400',
      'False Positive': 'bg-purple-500/20 text-purple-400'
    };
    return colors[status] || 'bg-slate-500/20 text-slate-400';
  };

  const handleSubmitFeedback = (e: React.FormEvent) => {
    e.preventDefault();
    if (onFeedbackSubmit) {
      onFeedbackSubmit(incident.id, {
        ...feedback as FieldFeedback,
        updatedBy: 'Ranger-KWS-HQ',
        timestamp: Date.now()
      });
      setShowFeedbackForm(false);
    }
  };

  const isStructuredReasoning = (rc: any): rc is ReasoningStructure => {
    return rc && typeof rc === 'object' && 'hypothesis' in rc;
  };

  return (
    <div className={`border p-6 rounded-[2.5rem] transition-all duration-500 hover:shadow-[0_0_50px_rgba(16,185,129,0.1)] bg-slate-900/40 backdrop-blur-xl ${getSeverityColor(incident.severity)}`}>
      <div className="flex justify-between items-start mb-6">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50 block mb-2">
            {new Date(incident.timestamp).toLocaleString()} • SECTOR-ID: {incident.id.substring(0, 8).toUpperCase()}
          </span>
          <h3 className="text-xl font-black flex items-center gap-3 text-white tracking-tighter">
            <i className={`fa-solid ${incident.feedback?.confirmed ? 'fa-badge-check text-emerald-500' : 'fa-satellite-dish'}`}></i>
            {incident.type}
          </h3>
        </div>
        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-current opacity-80 ${getStatusBadge(incident.status)}`}>
          {incident.status}
        </span>
      </div>

      <div className="flex flex-col md:flex-row gap-6 mb-6">
        {incident.imageUrl && (
          <div className="relative group shrink-0 w-full md:w-32">
            <img 
              src={incident.imageUrl} 
              alt="Evidence" 
              className="w-full h-32 object-cover rounded-2xl border border-white/10 shadow-xl group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"></div>
          </div>
        )}
        <div className="flex-1 space-y-4">
          <p className="text-sm text-slate-300 leading-relaxed">{incident.description}</p>
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
               <i className="fa-solid fa-location-dot text-emerald-500"></i> {incident.location.region}
            </div>
            
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-500">
                <span>Agent Confidence</span>
                <span className="text-white">{(incident.confidence * 100).toFixed(0)}%</span>
              </div>
              <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-1000 ${getConfidenceColor(incident.confidence)}`}
                  style={{ width: `${incident.confidence * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grounding Sources */}
      {incident.groundingSources && incident.groundingSources.length > 0 && (
        <div className="mb-6 pt-4 border-t border-white/5">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Grounding Context Verified</p>
          <div className="flex flex-wrap gap-2">
            {incident.groundingSources.map((source, idx) => (
              <a 
                key={idx} 
                href={source.uri} 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-emerald-500/5 hover:bg-emerald-500/15 border border-emerald-500/20 px-4 py-2 rounded-xl text-[10px] font-bold text-emerald-400 transition-all flex items-center gap-2 group"
              >
                <i className="fa-solid fa-link text-[8px] opacity-50 group-hover:opacity-100"></i>
                {source.title.length > 30 ? source.title.substring(0, 30) + '...' : source.title}
              </a>
            ))}
          </div>
        </div>
      )}

      {incident.reasoningChain && !incident.feedback && (
        <div className="mb-6">
          <button 
            onClick={() => setShowReasoningDetail(!showReasoningDetail)}
            className="flex items-center gap-2 text-[10px] font-black text-emerald-500 uppercase tracking-widest hover:text-emerald-400 transition-all py-2"
          >
            <i className={`fa-solid ${showReasoningDetail ? 'fa-chevron-down' : 'fa-chevron-right'}`}></i>
            {showReasoningDetail ? 'Hide Marathon Reasoning' : 'Reveal Agent Cognition'}
          </button>
          
          {showReasoningDetail && (
            <div className="bg-slate-950/80 p-5 rounded-2xl text-[11px] font-mono text-slate-400 border border-emerald-500/10 shadow-inner animate-fadeIn space-y-4 mt-2">
              {isStructuredReasoning(incident.reasoningChain) ? (
                <>
                  <div className="bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/10">
                    <p className="font-black text-emerald-500 uppercase text-[9px] mb-2 tracking-widest">Temporal Analysis:</p>
                    <p className="italic text-slate-300">"{incident.reasoningChain.changeDetection}"</p>
                  </div>
                  <div>
                    <p className="font-black text-slate-500 uppercase text-[9px] mb-2 tracking-widest">Cognitive Hypothesis:</p>
                    <p className="text-slate-300">"{incident.reasoningChain.hypothesis}"</p>
                  </div>
                  <div>
                    <p className="font-black text-slate-500 uppercase text-[9px] mb-2 tracking-widest">Multimodal Evidence:</p>
                    <ul className="space-y-1">
                      {incident.reasoningChain.evidencePoints.map((point, idx) => (
                        <li key={idx} className="flex gap-2"><span className="text-emerald-500 opacity-50">#</span> {point}</li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : (
                <p className="italic">"{incident.reasoningChain}"</p>
              )}
            </div>
          )}
        </div>
      )}

      {incident.feedback && (
        <div className="mb-6 bg-emerald-500/5 p-5 rounded-[1.5rem] border border-emerald-500/20">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Ranger Verification Payload</span>
            <span className="text-[9px] text-slate-500 font-bold">{new Date(incident.feedback.timestamp).toLocaleTimeString()}</span>
          </div>
          <p className="text-sm text-slate-300 font-medium italic">"{incident.feedback.groundNotes}"</p>
          <div className="mt-4 flex items-center gap-2">
            <div className={`px-2 py-1 rounded-md text-[9px] font-black uppercase ${incident.feedback.accuracyRating === 'Correct' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
              {incident.feedback.accuracyRating}
            </div>
            <span className="text-[9px] font-bold text-slate-500">Report verified by HQ Terminal</span>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <button 
          onClick={() => onViewOnMap?.(incident.location.lat, incident.location.lng)}
          className="flex-1 px-6 py-4 bg-slate-900/60 hover:bg-slate-800 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3 border border-slate-700/50"
        >
          <i className="fa-solid fa-map-location-dot text-emerald-500"></i> View on Map
        </button>

        {incident.status === 'Detected' && (
          <button 
            onClick={() => onAction?.(incident.id, 'Alerted')}
            className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3 shadow-xl shadow-emerald-900/40"
          >
            <i className="fa-solid fa-tower-broadcast"></i> Sync to Dispatch
          </button>
        )}
        
        {(incident.status === 'Alerted' || incident.status === 'Investigation Pending') && !showFeedbackForm && (
          <button 
            onClick={() => setShowFeedbackForm(true)}
            className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3"
          >
            <i className="fa-solid fa-file-signature"></i> Field Verification
          </button>
        )}

        {showFeedbackForm && (
          <div className="w-full bg-slate-950/90 p-6 rounded-[2rem] border border-emerald-500/30 animate-slideUp mt-4 shadow-2xl">
            <form onSubmit={handleSubmitFeedback} className="space-y-6">
              <div className="flex justify-between items-center">
                <h4 className="text-[10px] font-black text-white uppercase tracking-widest">Ground Intelligence Input</h4>
                <button type="button" onClick={() => setShowFeedbackForm(false)} className="text-slate-500 hover:text-white transition-colors"><i className="fa-solid fa-xmark"></i></button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'False Alarm', value: 'Incorrect' },
                  { label: 'Partial', value: 'Partial' },
                  { label: 'Accurate', value: 'Correct' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFeedback({ ...feedback, accuracyRating: opt.value as any })}
                    className={`p-3 rounded-xl border text-[9px] font-black uppercase tracking-tighter transition-all ${
                      feedback.accuracyRating === opt.value
                      ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-900/40'
                      : 'bg-slate-900 border-slate-800 text-slate-600 hover:border-slate-600'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <textarea 
                className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs text-slate-200 min-h-[120px] outline-none focus:border-emerald-500 transition-all placeholder:text-slate-700"
                placeholder="Ranger context: describe specific signatures seen on the ground..."
                value={feedback.groundNotes}
                onChange={(e) => setFeedback({ ...feedback, groundNotes: e.target.value })}
                required
              />

              <button 
                type="submit"
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-sm font-black transition-all shadow-xl shadow-emerald-900/40"
              >
                Submit Ground Intelligence
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default IncidentCard;
