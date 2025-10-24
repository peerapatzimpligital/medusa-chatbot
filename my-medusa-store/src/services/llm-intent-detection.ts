import OpenAI from "openai"

export interface IntentDetectionContext {
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

export interface LLMIntentResult {
    type: "product_search" | "clarification" | "delivery_options" | "delivery_recommendation" | "payment_options" | "payment_recommendation" | "payment_selection" | "order_completion" | "order_review" | "address_response"
    confidence: number
    keywords: string
    reasoning?: string
}

export class LLMIntentDetectionService {
    private openai: OpenAI | null = null

    constructor() {
        const apiKey = process.env.OPENAI_API_KEY
        if (apiKey) {
            this.openai = new OpenAI({ apiKey })
        }
    }

    async detectIntent(query: string, context?: IntentDetectionContext): Promise<LLMIntentResult> {
        if (!this.openai) {
            // Fallback to simple keyword-based detection if OpenAI is not configured
            return this.fallbackDetection(query, context)
        }

        try {
            const systemPrompt = this.buildSystemPrompt()
            const userPrompt = this.buildUserPrompt(query, context)

            const response = await this.openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                temperature: 0.1, // Low temperature for consistent classification
                max_tokens: 200
            })
            console.log(response.choices[0]?.message, 'responseeee')

            const result = response.choices[0]?.message?.content
            if (!result) {
                throw new Error("No response from OpenAI")
            }

            return this.parseResponse(result, query)
        } catch (error) {
            console.warn("LLM intent detection failed, falling back to keyword-based:", error)
            return this.fallbackDetection(query, context)
        }
    }

    private buildSystemPrompt(): string {
        return `You are an intent classifier for an e-commerce chatbot. Your job is to classify user messages into one of these intent types:

INTENT TYPES:
1. product_search - User is looking for products to buy (e.g., "I need a red dress", "show me laptops", "looking for shoes")
2. clarification - User needs more information or is asking general questions
3. delivery_options - User asking about shipping/delivery methods available
4. delivery_recommendation - User wants recommendations for best delivery option
5. payment_options - User asking about available payment methods
6. payment_recommendation - User wants recommendations for best payment method
7. payment_selection - User is choosing/selecting a specific payment method
8. order_completion - User wants to finalize/complete their order
9. order_review - User wants to review their cart or order details
10. address_response - User is providing address information

CLASSIFICATION RULES:
- If user mentions specific products, brands, or shopping needs → product_search
- If user asks "what can you help with" or general questions → clarification
- If user asks about shipping options → delivery_options
- If user asks "which delivery is best" → delivery_recommendation
- If user asks about payment methods → payment_options
- If user asks "which payment is best" → payment_recommendation
- If user says "I'll pay with card" → payment_selection
- If user says "complete my order" or "checkout" → order_completion
- If user says "show my cart" or "review order" → order_review
- If user provides address details → address_response

Respond in this exact JSON format:
{
  "type": "intent_type",
  "confidence": 0.95,
  "keywords": "extracted keywords",
  "reasoning": "brief explanation"
}`
    }

    private buildUserPrompt(query: string, context?: IntentDetectionContext): string {
        let prompt = `Classify this user message: "${query}"`

        if (context) {
            prompt += "\n\nCONTEXT:"

            if (context.isCollectingAddress) {
                prompt += "\n- Currently collecting address information from user"
            }

            if (context.cartItemCount && context.cartItemCount > 0) {
                prompt += `\n- User has ${context.cartItemCount} items in cart`
            }

            if (context.hasActiveOrder) {
                prompt += "\n- User has an active order in progress"
            }

            if (context.recentMessages && context.recentMessages.length > 0) {
                prompt += "\n- Recent conversation:"
                context.recentMessages.slice(-3).forEach((msg, i) => {
                    prompt += `\n  ${i + 1}. ${msg.type}: "${msg.content}"`
                })
            }
        }

        return prompt
    }

    private parseResponse(response: string, originalQuery: string): LLMIntentResult {
        try {
            const parsed = JSON.parse(response)

            // Validate the response
            const validTypes = [
                "product_search", "clarification", "delivery_options", "delivery_recommendation",
                "payment_options", "payment_recommendation", "payment_selection",
                "order_completion", "order_review", "address_response"
            ]

            if (!validTypes.includes(parsed.type)) {
                throw new Error(`Invalid intent type: ${parsed.type}`)
            }

            return {
                type: parsed.type,
                confidence: Math.min(Math.max(parsed.confidence || 0.5, 0), 1),
                keywords: parsed.keywords || this.extractKeywords(originalQuery),
                reasoning: parsed.reasoning
            }
        } catch (error) {
            console.warn("Failed to parse LLM response:", error)
            return this.fallbackDetection(originalQuery)
        }
    }

    private fallbackDetection(query: string, context?: IntentDetectionContext): LLMIntentResult {
        const lowerQuery = query.toLowerCase()
        const keywords = this.extractKeywords(query)

        // Check if we're in address collection mode
        if (context?.isCollectingAddress) {
            const hasAddressInfo = lowerQuery.match(/\d+.*(?:street|st|avenue|ave|road|rd|lane|ln|drive|dr|boulevard|blvd|way|place|pl|court|ct|circle|cir)|[a-z]+.*(?:street|st|avenue|ave|road|rd|lane|ln|drive|dr|boulevard|blvd|way|place|pl|court|ct|circle|cir)|\d{5}|\d{4}.*\d{3}|[a-z]\d[a-z].*\d[a-z]\d|(?:apartment|apt|unit|suite|ste).*\d+|\d+.*(?:apartment|apt|unit|suite|ste)|(?:city|town|village)|(?:province|state|county)|(?:country|nation)|(?:postal|zip).*code|\d{5}-\d{4}|[a-z]\d[a-z].*\d[a-z]\d/)

            if (hasAddressInfo || lowerQuery.length > 5) {
                return { type: "address_response", confidence: 0.8, keywords }
            }
        }

        // Product search patterns
        if (lowerQuery.match(/looking for|search|find|show me|need|want.*(?:to\s+)?(?:buy|purchase|get|have)\s+\w+|want\s+(?:some|a|an)\s+\w+|i.*want.*\w+|looking.*\w+|searching.*\w+|find.*\w+|show.*\w+|need.*\w+|get.*\w+|buy.*\w+|purchase.*\w+/)) {
            return { type: "product_search", confidence: 0.9, keywords }
        }

        // Order completion patterns
        if (lowerQuery.match(/complete.*order|finish.*order|finalize.*order|submit.*order|place.*order|confirm.*order|proceed.*order|continue.*checkout|finish.*checkout|complete.*checkout|ready.*order|done.*shopping|finish.*shopping|complete.*purchase|finalize.*purchase|submit.*purchase|place.*my.*order|confirm.*my.*order|ready.*to.*order|ready.*to.*buy|let.*go|let.*proceed|continue.*review|proceed.*review|review.*order|check.*order|order.*summary|order.*details|what.*in.*cart|cart.*summary|review.*cart|check.*cart|ready.*checkout|go.*checkout|proceed.*checkout|continue.*payment|next.*step|move.*forward|keep.*going|let.*continue/)) {
            if (lowerQuery.match(/review|check|summary|details|what.*in|show.*order|show.*cart|order.*summary|cart.*summary/)) {
                return { type: "order_review", confidence: 0.85, keywords }
            }
            return { type: "order_completion", confidence: 0.9, keywords }
        }

        // Payment patterns
        if (lowerQuery.match(/payment.*method|payment.*option|how.*pay|can.*pay|want.*pay.*method|need.*pay.*method|pay.*with|accept.*payment|payment|checkout.*payment|card|credit|debit|paypal|stripe|visa|mastercard|billing|transaction/)) {
            if (lowerQuery.match(/recommend|suggest|best|which|what.*should|help.*choose|advice|secure|safe|fast|quick|popular|simple|easy/)) {
                return { type: "payment_recommendation", confidence: 0.85, keywords }
            }
            if (lowerQuery.match(/select|choose|use|want.*use|prefer|go.*with|pick|decide/)) {
                return { type: "payment_selection", confidence: 0.85, keywords }
            }
            return { type: "payment_options", confidence: 0.8, keywords }
        }

        // Delivery options patterns
        if (lowerQuery.match(/delivery|shipping|ship|deliver|send|mail|post|courier|express|fast|slow|cheap|expensive|cost|price.*delivery|delivery.*option|shipping.*option|how.*deliver|when.*arrive|how.*long|delivery.*method|shipping.*method/)) {
            if (lowerQuery.match(/recommend|suggest|best|which|what.*should|help.*choose|advice|fastest|cheapest|eco|green|environment/)) {
                return { type: "delivery_recommendation", confidence: 0.85, keywords }
            }
            return { type: "delivery_options", confidence: 0.8, keywords }
        }

        return { type: "clarification", confidence: 0.6, keywords }
    }

    private extractKeywords(query: string): string {
        const stopWords = ['looking', 'for', 'show', 'me', 'find', 'need', 'want', 'a', 'an', 'the', 'to', 'i', 'some', 'get', 'have']
        return query.toLowerCase()
            .split(' ')
            .filter(word => !stopWords.includes(word) && word.length > 1)
            .join(' ')
    }

    isConfigured(): boolean {
        return this.openai !== null
    }
}

// Singleton instance
let llmIntentDetectionInstance: LLMIntentDetectionService | null = null

export function getLLMIntentDetectionService(): LLMIntentDetectionService {
    if (!llmIntentDetectionInstance) {
        llmIntentDetectionInstance = new LLMIntentDetectionService()
    }
    return llmIntentDetectionInstance
}