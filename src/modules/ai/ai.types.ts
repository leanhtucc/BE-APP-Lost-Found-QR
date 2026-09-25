import type { ItemCategory } from "../item/item.types";

export interface AIAnalysisResponse {
  suggested_name: string;
  category: string;
  color: string;
  confidence_score: number;
  imagePublicUrl?: string;
  filename?: string;
  ai_visual_tags?: string[];
  description?: string;
}

/**
 * Normalized result from TypeSafe AI item classification.
 * The category is guaranteed to be a valid ItemCategory.
 */
export interface TypeSafeClassificationResult {
  category: ItemCategory;
  confidence: number;
  probabilities: Record<string, number>;
  source: "typesafe";
}
