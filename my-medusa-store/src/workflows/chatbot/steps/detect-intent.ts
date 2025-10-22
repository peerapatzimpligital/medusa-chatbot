import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

export interface DetectIntentInput {
    query: string
}

export interface IntentResult {
    type: "product_search" | "clarification"
    keywords: string
}

export const detectIntentStep = createStep(
    "detect-intent-step",
    async ({ query }: DetectIntentInput) => {
        const lowerQuery = query.toLowerCase()
        const keywords = extractKeywords(query)

        // Product search patterns
        if (lowerQuery.match(/looking for|search|find|show me|need|want/)) {
            return new StepResponse({ type: "product_search", keywords })
        }

        return new StepResponse({ type: "clarification", keywords })
    }
)

function extractKeywords(query: string): string {
    const stopWords = ['looking', 'for', 'show', 'me', 'find', 'need', 'want', 'a', 'an', 'the']
    return query.toLowerCase()
        .split(' ')
        .filter(word => !stopWords.includes(word))
        .join(' ')
}
