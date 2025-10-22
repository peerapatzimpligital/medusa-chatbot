import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const backendUrl = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

        // Get cart ID from cookie if not provided
        const cookieStore = await cookies()
        const cartIdFromCookie = cookieStore.get("_medusa_cart_id")?.value

        // Use cart ID from body or cookie
        const cartId = body.cartId || cartIdFromCookie

        const response = await fetch(`${backendUrl}/chatbot/cart`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                ...body,
                cartId
            }),
        })

        const data = await response.json()

        // Set cart ID in cookie if successful
        if (data.success && data.cartId) {
            cookieStore.set("_medusa_cart_id", data.cartId, {
                maxAge: 60 * 60 * 24 * 7, // 7 days
                httpOnly: true,
                sameSite: "strict",
                secure: process.env.NODE_ENV === "production",
                path: "/"
            })
        }

        return NextResponse.json(data)
    } catch (error) {
        console.error("Cart API error:", error)
        return NextResponse.json(
            { error: "Failed to add to cart" },
            { status: 500 }
        )
    }
}
