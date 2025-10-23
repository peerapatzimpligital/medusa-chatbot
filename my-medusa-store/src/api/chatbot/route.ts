import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { chatbotQueryWorkflow } from "../../workflows/chatbot/chatbot-query-workflow"

export const POST = async (
    req: MedusaRequest,
    res: MedusaResponse
) => {
    const body = req.body as {
        query: string
        conversationId?: string
        cartItemCount?: number
    }
    const { query, conversationId, cartItemCount = 0 } = body

    try {
        // Execute the chatbot workflow
        const { result } = await chatbotQueryWorkflow(req.scope).run({
            input: {
                query,
                cartItemCount
            }
        })

        res.json({
            conversationId: conversationId || generateConversationId(),
            message: result.message,
            products: result.products || [],
            intent: result.intent,
            suggestions: result.suggestions || [],
            actions: result.actions || [],
            showActions: result.showActions || false,
            addressData: result.addressData || null,
            hasAddress: result.hasAddress || false,
            missingFields: result.missingFields || [],
            needsFollowup: result.needsFollowup || false,
            followupMessage: result.followupMessage || "",
            followupSuggestions: result.followupSuggestions || []
        })
    } catch (error) {
        console.error("Chatbot error:", error)
        res.status(500).json({ error: 'Failed to process query' })
    }
}

function generateConversationId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
}
