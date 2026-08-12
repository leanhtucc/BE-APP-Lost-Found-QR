export interface AIAnalysisResponse {
  suggested_name: string;
  category: string;
  color: string;
  confidence_score: number;
  imagePublicUrl?: string;
  ai_visual_tags?: string[];
  description?: string;
}
