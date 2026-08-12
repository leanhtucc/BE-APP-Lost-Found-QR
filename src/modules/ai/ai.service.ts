import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { ChatGoogle } from "@langchain/google/node";
import { z } from "zod";
import { ENV } from "../../config/env";
import { AiMessageRole } from "../../generated/prisma/client";
import { prisma } from "../../libs/prisma";
import { AppError } from "../../middlewares/error.middleware";
import { AIAnalysisResponse } from "./ai.types";

const itemAnalysisSchema = z.object({
  suggested_name: z.string(),
  category: z.enum([
    "electronics",
    "wallet",
    "keys",
    "bag",
    "documents",
    "jewelry",
    "phone",
    "other",
  ]),
  color: z.string(),
  confidence_score: z.number().min(0).max(1),
  ai_visual_tags: z.array(z.string()).max(12),
  description: z.string(),
});

function extractText(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";

  return content
    .map((block) => {
      if (typeof block === "string") return block;
      if (
        block &&
        typeof block === "object" &&
        "text" in block &&
        typeof block.text === "string"
      ) {
        return block.text;
      }
      return "";
    })
    .join("")
    .trim();
}

export class AIService {
  private model: ChatGoogle | null = null;

  private getModel(): ChatGoogle {
    if (!ENV.GOOGLE_API_KEY) {
      throw new AppError("AI service is not configured", 503);
    }

    if (!this.model) {
      this.model = new ChatGoogle(ENV.AI_MODEL, {
        apiKey: ENV.GOOGLE_API_KEY,
        temperature: 0.2,
        maxRetries: 2,
      });
    }

    return this.model;
  }

  async analyzeImage(
    file: Express.Multer.File,
    imagePublicUrl?: string
  ): Promise<AIAnalysisResponse> {
    if (!file.buffer) {
      throw new AppError("Image buffer is unavailable", 400);
    }

    try {
      const structuredModel =
        this.getModel().withStructuredOutput(itemAnalysisSchema);
      const result = await structuredModel.invoke([
        new HumanMessage({
          contentBlocks: [
            {
              type: "text",
              text: [
                "Phân tích đồ vật chính trong ảnh để hỗ trợ đăng tin thất lạc.",
                "Trả lời bằng tiếng Việt; không suy đoán dữ liệu cá nhân hoặc thương hiệu khi ảnh không đủ rõ.",
                "Nếu không nhận diện được, đặt confidence_score bằng 0 và category là other.",
              ].join(" "),
            },
            {
              type: "image",
              mimeType: file.mimetype,
              data: file.buffer.toString("base64"),
            },
          ],
        }),
      ]);

      return { ...result, imagePublicUrl };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("AI image analysis failed", 502);
    }
  }

  async createConversation(userId: string, title?: string) {
    return prisma.aiConversation.create({
      data: { userId, title: title?.trim() || null },
    });
  }

  async listConversations(userId: string) {
    return prisma.aiConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: { _count: { select: { messages: true } } },
    });
  }

  async getMessages(userId: string, conversationId: string) {
    await this.requireConversation(userId, conversationId);
    return prisma.aiMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
  }

  async deleteConversation(userId: string, conversationId: string) {
    await this.requireConversation(userId, conversationId);
    await prisma.aiConversation.delete({ where: { id: conversationId } });
  }

  async sendMessage(userId: string, conversationId: string, content: string) {
    const conversation = await this.requireConversation(userId, conversationId);
    const recentMessages = await prisma.aiMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    const langChainHistory = recentMessages
      .reverse()
      .map((message) =>
        message.role === AiMessageRole.USER
          ? new HumanMessage(message.content)
          : new AIMessage(message.content)
      );

    const response = await this.getModel().invoke([
      new SystemMessage(
        [
          "Bạn là trợ lý Guardian cho ứng dụng tìm đồ thất lạc.",
          "Trả lời ngắn gọn, hữu ích và bằng tiếng Việt.",
          "Không yêu cầu người dùng công khai OTP, mật khẩu, số thẻ hoặc địa chỉ nhà đầy đủ.",
          "Không khẳng định đã tìm thấy đồ nếu hệ thống chưa cung cấp bằng chứng.",
        ].join(" ")
      ),
      ...langChainHistory,
      new HumanMessage(content),
    ]);

    const reply = extractText(response.content);
    if (!reply) {
      throw new AppError("AI returned an empty response", 502);
    }

    const usage = response.usage_metadata;
    const [, assistantMessage] = await prisma.$transaction([
      prisma.aiMessage.create({
        data: {
          conversationId,
          role: AiMessageRole.USER,
          content,
        },
      }),
      prisma.aiMessage.create({
        data: {
          conversationId,
          role: AiMessageRole.ASSISTANT,
          content: reply,
          inputTokens: usage?.input_tokens,
          outputTokens: usage?.output_tokens,
        },
      }),
      prisma.aiConversation.update({
        where: { id: conversationId },
        data: {
          title: conversation.title || content.slice(0, 80),
          updatedAt: new Date(),
        },
      }),
    ]);

    return assistantMessage;
  }

  private async requireConversation(userId: string, conversationId: string) {
    const conversation = await prisma.aiConversation.findFirst({
      where: { id: conversationId, userId },
    });
    if (!conversation) {
      throw new AppError("AI conversation not found", 404);
    }
    return conversation;
  }
}

export const aiService = new AIService();
