import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const backendUrl = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
        const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY

        // Get cart ID from cookie if not provided
        const cookieStore = await cookies()
        const cartIdFromCookie = cookieStore.get("_medusa_cart_id")?.value

        // Use cart ID from body or cookie
        const cartId = body.cartId || cartIdFromCookie

        // Handle address update action
        if (body.action === "update_address") {
            if (!cartId) {
                return NextResponse.json(
                    { success: false, error: "No cart found. Please add items to your cart first." },
                    { status: 404 }
                )
            }

            if (!publishableKey) {
                return NextResponse.json(
                    { success: false, error: "API configuration error." },
                    { status: 500 }
                )
            }

            // Update cart address using Medusa Store API
            const updatePayload: any = {}
            if (body.shipping_address) {
                updatePayload.shipping_address = body.shipping_address
            }
            if (body.billing_address) {
                updatePayload.billing_address = body.billing_address
            }
            if (body.email) {
                updatePayload.email = body.email
            }

            const response = await fetch(`${backendUrl}/store/carts/${cartId}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-publishable-api-key": publishableKey
                },
                body: JSON.stringify(updatePayload)
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                console.error("Medusa API error:", response.status, errorData)
                
                let errorMessage = "Failed to update cart address."
                if (response.status === 404) {
                    errorMessage = "Cart not found. Please refresh the page and try again."
                } else if (response.status === 400) {
                    errorMessage = "Invalid address information provided."
                }

                return NextResponse.json(
                    { success: false, error: errorMessage },
                    { status: response.status }
                )
            }

            const updatedCart = await response.json()
            console.log("Cart address updated successfully:", updatedCart)

            return NextResponse.json({
                success: true,
                message: "Address updated successfully",
                cart: updatedCart
            })
        }

        // Handle other chatbot actions (existing functionality)
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
            { success: false, error: "Internal server error" },
            { status: 500 }
        )
    }
}
