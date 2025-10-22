"use server"

import { addToCart } from "@lib/data/cart"
import { revalidateTag } from "next/cache"
import { cookies } from "next/headers"

export async function addToCartFromChatbot(variantId: string, quantity: number = 1) {
    try {
        // Get country code from cookie or default to 'us'
        const cookieStore = await cookies()
        const countryCode = cookieStore.get("_medusa_country_code")?.value || "dk"

        // Use the existing addToCart function from storefront
        await addToCart({
            variantId,
            quantity,
            countryCode
        })

        // Revalidate cart cache
        revalidateTag("carts")

        return {
            success: true,
            message: "Item added to cart successfully"
        }
    } catch (error: any) {
        console.error("Add to cart error:", error)
        return {
            success: false,
            error: error.message || "Failed to add to cart"
        }
    }
}
