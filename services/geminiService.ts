
import { GoogleGenAI, Type, Chat, Modality } from "@google/genai";
import { CrimeType, Severity, IncidentReport, GroundingSource } from "../types";

const API_KEY = process.env.API_KEY || "";

export class MazingiraAgent {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: API_KEY });
  }

  createChatSession(): Chat {
    return this.ai.chats.create({
      model: 'gemini-3-flash-preview',
      config: {
        systemInstruction: `You are the Mazingira AI Liaison. Your role is to assist rangers and conservationists in Kenya. 
        You have access to incident reports regarding illegal logging, poaching, and pollution.
        Be professional, concise, and focused on environmental protection. 
        You know about Kenyan geography including the Mau Forest, Maasai Mara, Mt. Kenya, and major rivers like Tana and Athi.`,
      },
    });
  }

  async generateSpeech(text: string): Promise<string | null> {
    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Say professionally and clearly: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      return base64Audio || null;
    } catch (error) {
      console.error("TTS Error:", error);
      return null;
    }
  }

  async generateVideo(prompt: string): Promise<string | null> {
    // Veo requires a fresh instance to ensure correct API key from dialog if needed
    const veoAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      let operation = await veoAi.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: `A cinematic aerial drone simulation of: ${prompt}. Highly realistic, 4k, environmental surveillance style.`,
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: '16:9'
        }
      });

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        operation = await veoAi.operations.getVideosOperation({ operation: operation });
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (!downloadLink) return null;

      const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error("Video Generation Error:", error);
      return null;
    }
  }

  async analyzeImagery(
    base64Image: string, 
    region: string, 
    previousReports: IncidentReport[] = []
  ): Promise<IncidentReport | null> {
    try {
      const historicalContext = previousReports.length > 0 
        ? `HISTORICAL CONTEXT FOR THIS REGION: ${JSON.stringify(previousReports.map(r => ({ type: r.type, status: r.status, date: new Date(r.timestamp).toLocaleDateString() })))}`
        : "No previous reports for this region.";

      const response = await this.ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: base64Image,
              },
            },
            {
              text: `You are the Mazingira AI Autonomous Agent.
              
              TASK:
              1. Analyze this satellite/drone imagery for environmental crimes in ${region}.
              2. Compare this imagery with the ${historicalContext}. 
              3. Detect "Change Signatures": Is the crime new, expanding, or has the area been secured?
              4. Use Google Search to check for any specific protected status or recent environmental news in ${region} to provide context.

              OUTPUT: 
              Return JSON matching the schema. The reasoningChain MUST include a "changeDetection" field describing the temporal evolution.`
            },
          ],
        },
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING, enum: Object.values(CrimeType) },
              severity: { type: Type.STRING, enum: Object.values(Severity) },
              description: { type: Type.STRING },
              confidence: { type: Type.NUMBER },
              reasoningChain: {
                type: Type.OBJECT,
                properties: {
                  hypothesis: { type: Type.STRING },
                  evidencePoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                  alternatives: { type: Type.ARRAY, items: { type: Type.STRING } },
                  changeDetection: { type: Type.STRING, description: "Analysis of how this situation has changed over time." }
                },
                required: ["hypothesis", "evidencePoints", "alternatives", "changeDetection"]
              }
            },
            required: ["type", "severity", "description", "confidence", "reasoningChain"]
          },
          thinkingConfig: { thinkingBudget: 12000 }
        }
      });

      const text = response.text || "{}";
      const data = JSON.parse(text);
      if (!data.type || data.confidence < 0.4) return null;

      // Extract grounding sources
      const groundingSources: GroundingSource[] = [];
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks) {
        chunks.forEach((chunk: any) => {
          if (chunk.web) {
            groundingSources.push({
              title: chunk.web.title || 'Source Verified',
              uri: chunk.web.uri
            });
          }
        });
      }

      return {
        id: Math.random().toString(36).substring(7),
        timestamp: Date.now(),
        type: data.type as CrimeType,
        severity: data.severity as Severity,
        location: {
          lat: -1.286389 + (Math.random() - 0.5) * 0.1, 
          lng: 36.817223 + (Math.random() - 0.5) * 0.1,
          region: region
        },
        description: data.description,
        confidence: data.confidence,
        imageUrl: `data:image/jpeg;base64,${base64Image}`,
        status: 'Detected',
        reasoningChain: data.reasoningChain,
        groundingSources
      };
    } catch (error) {
      console.error("Gemini Analysis Error:", error);
      return null;
    }
  }
}
