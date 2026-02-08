
import React, { useState, useRef, useEffect } from 'react';
import { MazingiraAgent } from '../services/geminiService';
import { GenerateContentResponse } from "@google/genai";

interface Message {
  role: 'user' | 'model';
  text: string;
  videoUrl?: string;
}

const REASSURING_MESSAGES = [
  "Connecting to multispectral satellite array...",
  "Rendering environmental variance signatures...",
  "Processing cinematic forest telemetry...",
  "Encoding surveillance simulation for terminal...",
  "Uplink almost complete, stabilizing signal..."
];

const Chatbot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'MazingiraGuard AI Liaison active. How can I assist your conservation efforts today?' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState<number | null>(null);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState<number | null>(null);
  const [videoProgressMsg, setVideoProgressMsg] = useState(REASSURING_MESSAGES[0]);
  
  const chatRef = useRef<any>(null);
  const agentRef = useRef<MazingiraAgent | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const videoProgressInterval = useRef<number | null>(null);

  useEffect(() => {
    agentRef.current = new MazingiraAgent();
    chatRef.current = agentRef.current.createChatSession();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Audio Utilities
  function decode(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  async function decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
  ): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  }

  const handleSpeech = async (text: string, index: number) => {
    if (!agentRef.current || isSpeaking !== null) return;
    
    setIsSpeaking(index);
    try {
      const base64Audio = await agentRef.current.generateSpeech(text);
      if (base64Audio) {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        
        const audioBuffer = await decodeAudioData(
          decode(base64Audio),
          audioContextRef.current,
          24000,
          1
        );
        
        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContextRef.current.destination);
        source.onended = () => setIsSpeaking(null);
        source.start();
      } else {
        setIsSpeaking(null);
      }
    } catch (error) {
      console.error("Playback error:", error);
      setIsSpeaking(null);
    }
  };

  const handleGenerateVideo = async (prompt: string, index: number) => {
    if (!agentRef.current || isGeneratingVideo !== null) return;

    // Veo check: must have selected a key
    const aistudio = (window as any).aistudio;
    if (aistudio && !(await aistudio.hasSelectedApiKey())) {
      const confirm = window.confirm("Premium video simulation requires a paid API key. Would you like to select one now? (Visit ai.google.dev/gemini-api/docs/billing for setup)");
      if (confirm) {
        await aistudio.openSelectKey();
      } else {
        return;
      }
    }

    setIsGeneratingVideo(index);
    let msgIndex = 0;
    videoProgressInterval.current = window.setInterval(() => {
      msgIndex = (msgIndex + 1) % REASSURING_MESSAGES.length;
      setVideoProgressMsg(REASSURING_MESSAGES[msgIndex]);
    }, 4000);

    try {
      const videoUrl = await agentRef.current.generateVideo(prompt);
      if (videoUrl) {
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[index].videoUrl = videoUrl;
          return newMessages;
        });
      }
    } catch (error) {
      console.error("Video error:", error);
    } finally {
      if (videoProgressInterval.current) clearInterval(videoProgressInterval.current);
      setIsGeneratingVideo(null);
    }
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputValue(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech error:", event.error);
      setIsListening(false);
    };

    recognition.start();
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userText = inputValue.trim();
    setInputValue('');
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setIsLoading(true);

    try {
      const response = await chatRef.current.sendMessageStream({ message: userText });
      let fullText = '';
      
      setMessages(prev => [...prev, { role: 'model', text: '' }]);

      for await (const chunk of response) {
        const c = chunk as GenerateContentResponse;
        fullText += c.text;
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1].text = fullText;
          return newMessages;
        });
      }
    } catch (error) {
      console.error("Chat Error:", error);
      setMessages(prev => [...prev, { role: 'model', text: 'Error connecting to satellite link. Please try again.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end">
      {isOpen && (
        <div 
          className="w-80 md:w-96 h-[600px] bg-slate-900/95 backdrop-blur-xl border border-slate-700 rounded-2xl shadow-2xl flex flex-col mb-4 overflow-hidden animate-slideUp"
          role="dialog"
          aria-label="MazingiraGuard AI Chatbot"
        >
          <div className="p-4 bg-emerald-600 flex justify-between items-center shadow-lg">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <i className="fa-solid fa-robot text-white"></i>
              </div>
              <span className="font-black text-white uppercase tracking-widest text-xs">MazingiraGuard HQ</span>
            </div>
            <button 
              onClick={() => setIsOpen(false)} 
              className="text-white/80 hover:text-white transition-colors"
              aria-label="Close Chat"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scroll bg-slate-950/20">
            {messages.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[90%] p-4 rounded-2xl text-sm leading-relaxed shadow-lg ${
                  msg.role === 'user' 
                  ? 'bg-emerald-600 text-white rounded-tr-none' 
                  : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
                }`}>
                  {msg.text || (isLoading && i === messages.length - 1 ? (
                    <div className="flex gap-1 py-1">
                      <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                      <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    </div>
                  ) : '')}
                  
                  {msg.videoUrl && (
                    <div className="mt-4 rounded-xl overflow-hidden border border-slate-700 shadow-2xl bg-black">
                      <video src={msg.videoUrl} controls className="w-full aspect-video" />
                    </div>
                  )}
                </div>
                
                {msg.role === 'model' && msg.text && (
                  <div className="flex gap-4 items-center">
                    <button 
                      onClick={() => handleSpeech(msg.text, i)}
                      disabled={isSpeaking !== null}
                      className={`mt-2 flex items-center gap-2 text-[9px] font-black uppercase tracking-widest transition-all ${
                        isSpeaking === i ? 'text-emerald-500' : 'text-slate-500 hover:text-emerald-400'
                      }`}
                      aria-label="Listen to response"
                    >
                      <i className={`fa-solid ${isSpeaking === i ? 'fa-volume-high animate-pulse' : 'fa-volume-low'}`}></i>
                      {isSpeaking === i ? 'Speaking...' : 'Listen'}
                    </button>

                    <button 
                      onClick={() => handleGenerateVideo(msg.text, i)}
                      disabled={isGeneratingVideo !== null || !!msg.videoUrl}
                      className={`mt-2 flex items-center gap-2 text-[9px] font-black uppercase tracking-widest transition-all ${
                        isGeneratingVideo === i ? 'text-blue-500' : msg.videoUrl ? 'text-emerald-500 cursor-default' : 'text-slate-500 hover:text-blue-400'
                      }`}
                      aria-label="Visualize report"
                    >
                      <i className={`fa-solid ${isGeneratingVideo === i ? 'fa-clapperboard animate-spin' : msg.videoUrl ? 'fa-check' : 'fa-video'}`}></i>
                      {isGeneratingVideo === i ? 'Rendering...' : msg.videoUrl ? 'Simulated' : 'Visualize'}
                    </button>
                  </div>
                )}

                {isGeneratingVideo === i && (
                  <div className="mt-3 w-full bg-slate-900 border border-slate-800 p-3 rounded-xl animate-pulse">
                     <p className="text-[9px] text-blue-400 font-black uppercase tracking-[0.2em] mb-1">Veo Generation Active</p>
                     <p className="text-[10px] text-slate-500 font-medium italic">{videoProgressMsg}</p>
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-slate-800 bg-slate-900 shadow-inner">
            <div className="flex gap-2">
              <button 
                onClick={startListening}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                  isListening ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
                aria-label="Start Voice Input"
                title="Voice Input"
              >
                <i className="fa-solid fa-microphone"></i>
              </button>
              
              <input 
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Query HQ or request simulation..."
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-emerald-500 placeholder:text-slate-600 transition-all shadow-inner"
                aria-label="Message Input"
              />
              
              <button 
                onClick={handleSend}
                disabled={isLoading || !inputValue.trim()}
                className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 transition-all shadow-lg shadow-emerald-900/20"
                aria-label="Send Message"
              >
                <i className={`fa-solid ${isLoading ? 'fa-spinner animate-spin' : 'fa-paper-plane'}`}></i>
              </button>
            </div>
            {isListening && (
              <p className="text-[9px] text-emerald-500 font-black uppercase tracking-widest text-center mt-2 animate-pulse">
                Terminal listening... state your request
              </p>
            )}
          </div>
        </div>
      )}

      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 transform hover:scale-110 group ${
          isOpen ? 'bg-slate-700' : 'bg-emerald-600 shadow-emerald-500/20'
        }`}
        aria-label={isOpen ? "Close Terminal" : "Open HQ Terminal"}
      >
        <i className={`fa-solid ${isOpen ? 'fa-xmark' : 'fa-headset'} text-2xl text-white`}></i>
        {!isOpen && (
           <span className="absolute right-full mr-4 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl">
             Autonomous HQ Liaison
           </span>
        )}
      </button>
    </div>
  );
};

export default Chatbot;
