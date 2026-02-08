
export enum CrimeType {
  ILLEGAL_LOGGING = 'Illegal Logging',
  POACHING_CAMP = 'Poaching Camp',
  CHARCOAL_BURNING = 'Charcoal Burning',
  RIVER_POLLUTION = 'River Pollution',
  UNAUTHORIZED_ENCROACHMENT = 'Unauthorized Encroachment',
  SUSPICIOUS_VEHICLE = 'Suspicious Vehicle'
}

export enum Severity {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  CRITICAL = 'Critical'
}

export type FieldStatus = 'Detected' | 'Alerted' | 'Investigation Pending' | 'Threat Confirmed' | 'Area Secured' | 'False Positive';

export interface ReasoningStructure {
  hypothesis: string;
  evidencePoints: string[];
  alternatives: string[];
  changeDetection: string;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface FieldFeedback {
  confirmed: boolean | null;
  accuracyRating: 'Correct' | 'Partial' | 'Incorrect';
  groundNotes: string;
  updatedBy: string;
  timestamp: number;
}

export interface IncidentReport {
  id: string;
  timestamp: number;
  type: CrimeType;
  severity: Severity;
  location: {
    lat: number;
    lng: number;
    region: string;
  };
  description: string;
  confidence: number;
  imageUrl?: string;
  status: FieldStatus;
  reasoningChain?: string | ReasoningStructure;
  groundingSources?: GroundingSource[];
  feedback?: FieldFeedback;
}

export interface EnvironmentalStats {
  region: string;
  incidents: number;
  forestCoverChange: number;
}
