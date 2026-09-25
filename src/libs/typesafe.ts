import { choice, TypeSafeClient } from "@typesafe-ai/sdk";
import { ENV } from "../config/env";
import { AppError } from "../middlewares/error.middleware";
import { logger } from "./logger";
import { ITEM_CATEGORIES, type ItemCategory } from "../modules/item/item.types";
import type { TypeSafeClassificationResult } from "../modules/ai/ai.types";

/**
 * TypeSafe AI Client
 *
 * Reusable client for the TypeSafe System One API (Jev model).
 * Used for structured AI judgments such as item classification.
 *
 * Security:
 * - API key is read from ENV, never logged or exposed.
 * - Requests are server-side only; mobile clients never touch TypeSafe directly.
 */

const TIMEOUT_MS = 15_000;

/** Category descriptions for the Choice question criteria. */
const CATEGORY_CRITERIA: Record<ItemCategory, string> = {
  electronics:
    "Electronic devices such as laptops, tablets, headphones, chargers, cameras, or USB drives",
  wallet:
    "Wallets, purses, cardholders, money clips, or similar items that hold cash or cards",
  keys: "Keys, keychains, key fobs, car keys, or access cards",
  bag: "Backpacks, handbags, tote bags, suitcases, luggage, or pouches",
  documents:
    "Paper documents, ID cards, passports, certificates, books, notebooks, or folders",
  jewelry:
    "Rings, necklaces, bracelets, earrings, watches, or other jewelry and accessories",
  phone: "Mobile phones, smartphones, or phone cases with a phone inside",
  other:
    "Any item that does not clearly fit into the categories above",
};

let clientInstance: TypeSafeClient | null = null;

function getClient(): TypeSafeClient {
  if (!ENV.TYPESAFE_API_KEY) {
    throw new AppError(
      "TypeSafe AI service is not configured. Set the TYPESAFE_API_KEY environment variable.",
      503
    );
  }

  if (!clientInstance) {
    clientInstance = new TypeSafeClient({
      apiKey: ENV.TYPESAFE_API_KEY,
      baseURL: ENV.TYPESAFE_API_URL,
      timeout: TIMEOUT_MS,
    });
  }

  return clientInstance;
}

/**
 * Classify a lost/found item description into one of the project's
 * existing ITEM_CATEGORIES using a TypeSafe Choice question.
 *
 * @returns Normalized result with category, confidence, and probabilities.
 * @throws AppError with appropriate status codes for configuration, network,
 *         authentication, and validation errors.
 */
export async function classifyItemCategory(
  description: string
): Promise<TypeSafeClassificationResult> {
  const client = getClient();

  try {
    const response = await client.systemOne({
      model: ENV.TYPESAFE_MODEL,
      state: { item_description: description },
      questions: {
        category: choice(
          "Which category does this lost or found item belong to? " +
            "Classify based on the item description provided in `item_description`.",
          CATEGORY_CRITERIA
        ),
      },
    });

    const answer = response.answers.category;
    const selectedCategory = answer.choice as string;

    // Validate the returned category is one of our known categories
    if (
      !ITEM_CATEGORIES.includes(selectedCategory as ItemCategory)
    ) {
      logger.warn(
        `TypeSafe returned unexpected category: ${selectedCategory}, falling back to "other"`
      );
      return {
        category: "other",
        confidence: 0,
        probabilities: answer.probabilities as Record<string, number>,
        source: "typesafe",
      };
    }

    return {
      category: selectedCategory as ItemCategory,
      confidence: answer.confidence,
      probabilities: answer.probabilities as Record<string, number>,
      source: "typesafe",
    };
  } catch (error: any) {
    // Re-throw our own AppErrors (e.g. 503 from missing API key)
    if (error instanceof AppError) throw error;

    // SDK error classes
    const statusCode: number | undefined = error?.status ?? error?.statusCode;

    if (statusCode === 401) {
      logger.error("TypeSafe authentication failed (invalid API key)");
      throw new AppError("AI service authentication failed", 502);
    }

    if (statusCode === 429) {
      logger.warn("TypeSafe rate limit exceeded");
      throw new AppError(
        "AI service is temporarily busy. Please try again later.",
        429
      );
    }

    if (statusCode === 422) {
      logger.error("TypeSafe validation error:", error.message);
      throw new AppError("AI service rejected the request", 502);
    }

    // Connection / timeout / overloaded / unknown
    logger.error("TypeSafe API request failed:", error.message);
    throw new AppError("AI classification service is unavailable", 502);
  }
}

/**
 * Reset the client singleton (for testing purposes only).
 * @internal
 */
export function _resetClient(): void {
  clientInstance = null;
}
