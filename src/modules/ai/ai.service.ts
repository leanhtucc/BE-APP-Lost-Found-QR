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
    const modelsToTry = [
      "gemini-2.5-flash-lite", 
      "gemini-2.5-flash", 
      "gemini-2.0-flash-lite",
      "gemini-flash-lite-latest"
    ];
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
          // Nghỉ 1 giây cho server Google load lại trước khi thử model tiếp theo (chống 503)
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // NẾU TẤT CẢ MODEL ĐỀU SẬP DO GOOGLE QUÁ TẢI (503) HOẶC HẾT QUOTA (429)
      // => Graceful Degradation: Không quăng lỗi Crash App nữa! Trả về kết quả rỗng 
      // để giao diện Mobile có thể bỏ qua AI và cho phép User tự gõ tay (Manual Data Entry)
      console.warn("[AIService] Mọi AI đều sập lúc này. Trả về format rỗng cho UI!");
      return {
        suggested_name: "",
        category: "other",
        color: "",
        confidence_score: 0,
      };

    } catch (error: any) {
      console.error("[AIService] Có lỗi lạ lúc đọc file:", error?.message || error);
      // Giữ nguyên UX tốt, nếu file rác v.v... cũng trả về rỗng để tự nhập
      return {
        suggested_name: "",
        category: "other",
        color: "",
        confidence_score: 0,
      };
    } finally {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    }
  }
}

export const aiService = new AIService();
