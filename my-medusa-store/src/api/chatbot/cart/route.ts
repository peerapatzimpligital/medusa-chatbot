import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
    addToCartWorkflow,
    createCartWorkflow
} from "@medusajs/medusa/core-flows"

export const POST = async (
    req: MedusaRequest,
    res: MedusaResponse
) => {
    const body = req.body as { cartId?: string; variantId: string; quantity?: number; regionId?: string }
    const { cartId, variantId, quantity = 1 } = body

    try {
        let currentCartId = cartId

        // Create cart if doesn't exist
        if (!currentCartId) {
            const { result: newCart } = await createCartWorkflow(req.scope).run({
                input: {
                    region_id: body.regionId,
                    currency_code: "usd"
                }
            })
            currentCartId = newCart.id
        }

        // Add item to cart using workflow
        const { result: updatedCart } = await addToCartWorkflow(req.scope).run({
            input: {
                items: [{
                    variant_id: variantId,
                    quantity
                }],
                cart_id: currentCartId
            }
        })

        res.json({
            success: true,
            cartId: currentCartId,
            message: "Item added to cart successfully",
            cart: updatedCart
        })
    } catch (error: any) {
        console.error("Cart error:", error)
        res.status(500).json({
            success: false,
            error: 'Failed to add item to cart',
            details: error.message
        })
    }
}
