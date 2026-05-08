export interface AIAnalysisResponse {
  suggested_name: string;
  category: string;
  color: string;
  confidence_score: number;
  imagePublicUrl?: string;
  /** Danh sách đặc điểm ngoại hình AI nhận diện được (VD: ["Titan Đen", "Ốp lưng silicon", "Vết trầy nhẹ"]) */
  ai_visual_tags?: string[];
  /** Mô tả tổng hợp dùng cho trường secondary trong Selection Details */
  description?: string;
}
