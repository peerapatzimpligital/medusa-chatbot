import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { getLLMIntentDetectionService, IntentDetectionContext } from "../../../services/llm-intent-detection"

export interface DetectIntentInput {
    query: string
    context?: {
        isCollectingAddress?: boolean
        partialAddress?: any
        recentMessages?: Array<{
            type: string
            content: string
            hasAddress?: boolean
            addressData?: any
        }>
        cartItemCount?: number
        hasActiveOrder?: boolean
    }
}

export interface IntentResult {
    type: "product_search" | "clarification" | "delivery_options" | "delivery_recommendation" | "payment_options" | "payment_recommendation" | "payment_selection" | "order_completion" | "order_review" | "address_response"
    keywords: string
    confidence?: number
    reasoning?: string
}

export const detectIntentStep = createStep(
    "detect-intent-step",
    async ({ query, context }: DetectIntentInput) => {
        try {
            // Use LLM-based intent detection
            const llmService = getLLMIntentDetectionService()
            
            // Convert context to the format expected by LLM service
            const llmContext: IntentDetectionContext = {
                isCollectingAddress: context?.isCollectingAddress,
                partialAddress: context?.partialAddress,
                recentMessages: context?.recentMessages,
                cartItemCount: context?.cartItemCount,
                hasActiveOrder: context?.hasActiveOrder
            }

            const result = await llmService.detectIntent(query, llmContext)
            
            console.log(`Intent detected: ${result.type} (confidence: ${result.confidence})${result.reasoning ? ` - ${result.reasoning}` : ''}`)
            
            return new StepResponse({
                type: result.type,
                keywords: result.keywords,
                confidence: result.confidence,
                reasoning: result.reasoning
            })
        } catch (error) {
            console.error("Error in LLM intent detection:", error)
            
            // Fallback to simple keyword extraction
            const keywords = extractKeywords(query)
            return new StepResponse({
                type: "clarification",
                keywords,
                confidence: 0.5
            })
        }
    }
)

function extractKeywords(query: string): string {
    const stopWords = ['looking', 'for', 'show', 'me', 'find', 'need', 'want', 'a', 'an', 'the', 'to', 'i', 'some', 'get', 'have']
    return query.toLowerCase()
        .split(' ')
        .filter(word => !stopWords.includes(word) && word.length > 1)
        .join(' ')
}
