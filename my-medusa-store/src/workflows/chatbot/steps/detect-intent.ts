import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

export interface DetectIntentInput {
    query: string
}

export interface IntentResult {
    type: "product_search" | "clarification" | "delivery_options" | "delivery_recommendation" | "payment_options" | "payment_recommendation" | "payment_selection" | "order_completion" | "order_review"
    keywords: string
}

export const detectIntentStep = createStep(
    "detect-intent-step",
    async ({ query }: DetectIntentInput) => {
        const lowerQuery = query.toLowerCase()
        const keywords = extractKeywords(query)

        // Order completion patterns
        if (lowerQuery.match(/complete.*order|finish.*order|finalize.*order|submit.*order|place.*order|confirm.*order|proceed.*order|continue.*checkout|finish.*checkout|complete.*checkout|ready.*order|done.*shopping|finish.*shopping|complete.*purchase|finalize.*purchase|submit.*purchase|place.*my.*order|confirm.*my.*order|ready.*to.*order|ready.*to.*buy|let.*go|let.*proceed|continue.*review|proceed.*review|review.*order|check.*order|order.*summary|order.*details|what.*in.*cart|cart.*summary|review.*cart|check.*cart|ready.*checkout|go.*checkout|proceed.*checkout|continue.*payment|next.*step|move.*forward|keep.*going|let.*continue/)) {
            if (lowerQuery.match(/review|check|summary|details|what.*in|show.*order|show.*cart|order.*summary|cart.*summary/)) {
                return new StepResponse({ type: "order_review", keywords })
            }
            return new StepResponse({ type: "order_completion", keywords })
        }

        // Payment patterns
        if (lowerQuery.match(/payment|pay|checkout|card|credit|debit|paypal|stripe|visa|mastercard|billing|transaction|purchase|buy|order|payment.*method|payment.*option|how.*pay|can.*pay|want.*pay|need.*pay|pay.*with|accept.*payment/)) {
            if (lowerQuery.match(/recommend|suggest|best|which|what.*should|help.*choose|advice|secure|safe|fast|quick|popular|simple|easy/)) {
                return new StepResponse({ type: "payment_recommendation", keywords })
            }
            if (lowerQuery.match(/select|choose|use|want.*use|prefer|go.*with|pick|decide/)) {
                return new StepResponse({ type: "payment_selection", keywords })
            }
            return new StepResponse({ type: "payment_options", keywords })
        }

        // Delivery options patterns
        if (lowerQuery.match(/delivery|shipping|ship|deliver|send|mail|post|courier|express|fast|slow|cheap|expensive|cost|price.*delivery|delivery.*option|shipping.*option|how.*deliver|when.*arrive|how.*long|delivery.*method|shipping.*method/)) {
            if (lowerQuery.match(/recommend|suggest|best|which|what.*should|help.*choose|advice|fastest|cheapest|eco|green|environment/)) {
                return new StepResponse({ type: "delivery_recommendation", keywords })
            }
            return new StepResponse({ type: "delivery_options", keywords })
        }

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
