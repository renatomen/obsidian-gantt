// Phase 2 stub: Field mapping interface aligning with PRD
export interface FieldMappings {
  id: string;       // Required
  text: string;     // Required
  start?: string;   // Optional
  end?: string;     // Optional
  duration?: string;
  progress?: string;
  parent?: string;
  parents?: string;
  type?: string;
}

