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
   * Sử dụng Gemini API phân tích ảnh tải lên.
   */
  async analyzeImage(file: Express.Multer.File): Promise<AIAnalysisResponse> {
    try {
      const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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
      const cleanedText = text.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      
      const parsed = JSON.parse(cleanedText);

      return {
        suggested_name: parsed.suggested_name || "Unknown item",
        category: parsed.category || "other",
        color: parsed.color || "",
        confidence_score: parsed.confidence_score || 0,
      };
    } catch (error) {
      throw new AppError("Lỗi hệ thống khi phân tích hình ảnh với AI", 500);
    } finally {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    }
  }
}

export const aiService = new AIService();
