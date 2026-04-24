import { GoogleGenerativeAI } from "@google/generative-ai";
import * as fs from "fs";
import { AppError } from "../../middlewares/error.middleware";
import { AIAnalysisResponse } from "./ai.types";

export class AIService {
  private genAI: GoogleGenerativeAI;
  
  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in environment variables");
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  /**
   * Sử dụng Gemini API phân tích ảnh tải lên có thêm cơ chế Fallback chống sập.
   */
  async analyzeImage(file: Express.Multer.File): Promise<AIAnalysisResponse> {
    const modelsToTry = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"];
    let lastError: any;

    try {
      const imageBuffer = fs.readFileSync(file.path);
      const mimeType = file.mimetype;
      const prompt = `Phân tích đồ vật chính trong ảnh và trả về JSON object (không bọc trong \`\`\`json). Cấu trúc: 
{
  "suggested_name": "Tên chi tiết đồ (VD: iPhone 15 Pro Max)",
  "category": "Thuộc vào: electronics, wallet, keys, bag, documents, jewelry, phone, other",
  "color": "Màu chủ đạo (VD: Đen)",
  "confidence_score": 0.95
}
Lưu ý: Nếu không nhận diện được rõ đồ vật, set confidence_score = 0.`;

      for (const modelName of modelsToTry) {
        try {
          const model = this.genAI.getGenerativeModel({ model: modelName });
          const result = await model.generateContent([
            prompt,
            {
              inlineData: {
                data: imageBuffer.toString("base64"),
                mimeType: mimeType,
              },
            },
          ]);

          const text = result.response.text().trim();
          
          // Tìm chuỗi JSON từ kết quả trả về bằng Regex an toàn
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
             console.error(`Gemini AI (${modelName}) did not return JSON:`, text);
             throw new Error("Invalid output format from Gemini");
          }
          
          const parsed = JSON.parse(jsonMatch[0]);

          return {
            suggested_name: parsed.suggested_name || "Unknown item",
            category: parsed.category || "other",
            color: parsed.color || "",
            confidence_score: parsed.confidence_score || 0,
          };
        } catch (err: any) {
          console.warn(`[AIService] Model ${modelName} failed:`, err?.message || err);
          lastError = err;
          // Thử tiếp model khác trong danh sách
        }
      }

      // Nếu tất cả model đều fail
      throw lastError;

    } catch (error: any) {
      console.error("[AIService] Analyze image totally failed after fallbacks:", error?.message || error);
      throw new AppError("Lỗi hệ thống khi phân tích hình ảnh với AI (Quá tải server)", 503);
    } finally {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    }
  }
}

export const aiService = new AIService();
