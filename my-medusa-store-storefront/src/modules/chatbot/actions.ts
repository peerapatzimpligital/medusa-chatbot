"use server"

import { addToCart, retrieveCart, setShippingMethod, initiatePaymentSession, placeOrder, completeOrderWithoutRedirect } from "@lib/data/cart"
import { listCartShippingMethods, calculatePriceForShippingOption } from "@lib/data/fulfillment"
import { listCartPaymentMethods } from "@lib/data/payment"
import { paymentInfoMap, isStripe, isPaypal, isManual } from "@lib/constants"
import { revalidateTag } from "next/cache"
import { cookies } from "next/headers"
import { HttpTypes } from "@medusajs/types"

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

export async function getDeliveryOptionsFromChatbot() {
    try {
        const cookieStore = await cookies()
        const cartId = cookieStore.get("_medusa_cart_id")?.value

        if (!cartId) {
            return {
                success: false,
                error: "No cart found. Please add items to cart first."
            }
        }

        // Get cart and shipping methods
        const cart = await retrieveCart(cartId)
        const shippingMethods = await listCartShippingMethods(cartId)

        if (!cart) {
            return {
                success: false,
                error: "Cart not found"
            }
        }

        if (!cart.shipping_address?.address_1) {
            return {
                success: false,
                error: "Please provide your shipping address first to see delivery options."
            }
        }

        if (!shippingMethods || shippingMethods.length === 0) {
            return {
                success: false,
                error: "No delivery options available for your location."
            }
        }

        // Calculate prices for shipping methods
        const methodsWithPrices = await Promise.all(
            shippingMethods.map(async (method) => {
                let calculatedPrice = method.amount

                if (method.price_type === "calculated") {
                    const calculated = await calculatePriceForShippingOption(method.id, cartId)
                    calculatedPrice = calculated?.amount || method.amount
                }

                return {
                    id: method.id,
                    name: method.name,
                    description: method.description || "",
                    amount: calculatedPrice,
                    currency_code: cart.currency_code,
                    type: method.service_zone?.fulfillment_set?.type || "shipping"
                }
            })
        )

        return {
            success: true,
            deliveryOptions: methodsWithPrices,
            cartTotal: cart.total,
            currency: cart.currency_code
        }
    } catch (error: any) {
        console.error("Get delivery options error:", error)
        return {
            success: false,
            error: error.message || "Failed to get delivery options"
        }
    }
}

export async function selectDeliveryMethodFromChatbot(shippingMethodId: string) {
    try {
        const cookieStore = await cookies()
        const cartId = cookieStore.get("_medusa_cart_id")?.value

        if (!cartId) {
            return {
                success: false,
                error: "No cart found"
            }
        }

        await setShippingMethod({ cartId, shippingMethodId })

        // Revalidate cart cache
        revalidateTag("carts")

        return {
            success: true,
            message: "Delivery method selected successfully! You can now proceed to payment."
        }
    } catch (error: any) {
        console.error("Select delivery method error:", error)
        return {
            success: false,
            error: error.message || "Failed to select delivery method"
        }
    }
}

export async function getDeliveryRecommendationFromChatbot(preferences: {
    priority?: "speed" | "cost" | "eco"
    budget?: number
}) {
    try {
        const deliveryResult = await getDeliveryOptionsFromChatbot()

        if (!deliveryResult.success || !deliveryResult.deliveryOptions) {
            return deliveryResult
        }

        const options = deliveryResult.deliveryOptions
        let recommendation

        switch (preferences.priority) {
            case "speed":
                recommendation = options.find(opt =>
                    opt.name.toLowerCase().includes("express") ||
                    opt.name.toLowerCase().includes("fast") ||
                    opt.name.toLowerCase().includes("next day")
                ) || options[0]
                break

            case "cost":
                recommendation = options.reduce((cheapest, current) =>
                    current.amount < cheapest.amount ? current : cheapest
                )
                break

            case "eco":
                recommendation = options.find(opt =>
                    opt.name.toLowerCase().includes("eco") ||
                    opt.name.toLowerCase().includes("green") ||
                    opt.name.toLowerCase().includes("standard")
                ) || options[0]
                break

            default:
                // Default to balanced option (middle price range)
                const sortedByPrice = [...options].sort((a, b) => a.amount - b.amount)
                recommendation = sortedByPrice[Math.floor(sortedByPrice.length / 2)]
        }

        return {
            success: true,
            recommendation,
            allOptions: options,
            reasoning: getRecommendationReasoning(recommendation, preferences.priority)
        }
    } catch (error: any) {
        console.error("Get delivery recommendation error:", error)
        return {
            success: false,
            error: error.message || "Failed to get delivery recommendation"
        }
    }
}

export async function getPaymentOptionsFromChatbot() {
    try {
        const cookieStore = await cookies()
        const cartId = cookieStore.get("_medusa_cart_id")?.value

        if (!cartId) {
            return {
                success: false,
                error: "No cart found. Please add items to cart first."
            }
        }

        // Get cart and payment methods
        const cart = await retrieveCart(cartId)
        if (!cart) {
            return {
                success: false,
                error: "Cart not found"
            }
        }

        const paymentMethods = await listCartPaymentMethods(cart.region?.id ?? "")
        if (!paymentMethods || paymentMethods.length === 0) {
            return {
                success: false,
                error: "No payment methods available"
            }
        }

        // Format payment options for chatbot
        const options = paymentMethods.map(method => ({
            id: method.id,
            name: paymentInfoMap[method.id]?.title || method.id,
            provider_id: method.id,
            description: getPaymentDescription(method.id),
            security_level: getSecurityLevel(method.id),
            processing_time: getProcessingTime(method.id),
            fees: getPaymentFees(method.id)
        }))

        return {
            success: true,
            paymentOptions: options,
            message: `Found ${options.length} payment methods available for your region.`
        }
    } catch (error: any) {
        console.error("Get payment options error:", error)
        return {
            success: false,
            error: error.message || "Failed to get payment options"
        }
    }
}

export async function selectPaymentMethodFromChatbot(paymentMethodId: string) {
    try {
        const cookieStore = await cookies()
        const cartId = cookieStore.get("_medusa_cart_id")?.value

        if (!cartId) {
            return {
                success: false,
                error: "No cart found. Please add items to cart first."
            }
        }

        const cart = await retrieveCart(cartId)
        if (!cart) {
            return {
                success: false,
                error: "Cart not found"
            }
        }

        // Initiate payment session for the selected method
        await initiatePaymentSession(cart, {
            provider_id: paymentMethodId
        })

        // Revalidate cart cache
        revalidateTag("carts")

        const methodName = paymentInfoMap[paymentMethodId]?.title || paymentMethodId

        return {
            success: true,
            message: `Payment method "${methodName}" selected successfully! You can now proceed to complete your order.`,
            selectedMethod: {
                id: paymentMethodId,
                name: methodName
            }
        }
    } catch (error: any) {
        console.error("Select payment method error:", error)
        return {
            success: false,
            error: error.message || "Failed to select payment method"
        }
    }
}

export async function getPaymentRecommendationFromChatbot(preference?: string) {
    try {
        const paymentOptionsResult = await getPaymentOptionsFromChatbot()

        if (!paymentOptionsResult.success || !paymentOptionsResult.paymentOptions) {
            return paymentOptionsResult
        }

        const options = paymentOptionsResult.paymentOptions
        let recommendedOption = options[0] // Default to first option

        // Find best option based on preference
        switch (preference?.toLowerCase()) {
            case "secure":
            case "security":
                recommendedOption = options.find(opt => isStripe(opt.provider_id)) ||
                    options.find(opt => isPaypal(opt.provider_id)) ||
                    options[0]
                break
            case "fast":
            case "quick":
            case "instant":
                recommendedOption = options.find(opt => isStripe(opt.provider_id)) ||
                    options.find(opt => isPaypal(opt.provider_id)) ||
                    options[0]
                break
            case "popular":
            case "common":
                recommendedOption = options.find(opt => isStripe(opt.provider_id)) || options[0]
                break
            case "simple":
            case "easy":
                recommendedOption = options.find(opt => isPaypal(opt.provider_id)) ||
                    options.find(opt => isStripe(opt.provider_id)) ||
                    options[0]
                break
            default:
                // Default recommendation logic
                recommendedOption = options.find(opt => isStripe(opt.provider_id)) || options[0]
        }

        return {
            success: true,
            recommendation: recommendedOption,
            reasoning: getPaymentRecommendationReasoning(recommendedOption, preference),
            allOptions: options
        }
    } catch (error: any) {
        console.error("Get payment recommendation error:", error)
        return {
            success: false,
            error: error.message || "Failed to get payment recommendation"
        }
    }
}

// Helper functions

function getRecommendationReasoning(option: any, priority?: string): string {
    switch (priority) {
        case "speed":
            return `I recommend "${option.name}" for fastest delivery.`
        case "cost":
            return `I recommend "${option.name}" as the most economical option at ${formatPrice(option.amount, option.currency_code)}.`
        case "eco":
            return `I recommend "${option.name}" as an environmentally friendly option.`
        default:
            return `I recommend "${option.name}" as a balanced option for ${formatPrice(option.amount, option.currency_code)}.`
    }
}

function formatPrice(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency.toUpperCase()
    }).format(amount)
}

function getPaymentDescription(providerId: string): string {
    if (isStripe(providerId)) {
        return "Secure credit/debit card payment with instant processing"
    } else if (isPaypal(providerId)) {
        return "Pay with your PayPal account or credit card"
    } else if (providerId.includes("ideal")) {
        return "iDEAL - Direct bank transfer for Netherlands"
    } else if (providerId.includes("bancontact")) {
        return "Bancontact - Belgian payment method"
    } else if (isManual(providerId)) {
        return "Manual payment processing (for testing)"
    }
    return "Secure payment processing"
}

function getSecurityLevel(providerId: string): string {
    if (isStripe(providerId)) {
        return "High - PCI DSS compliant with 3D Secure"
    } else if (isPaypal(providerId)) {
        return "High - PayPal buyer protection"
    } else if (providerId.includes("ideal") || providerId.includes("bancontact")) {
        return "High - Bank-level security"
    }
    return "Standard security"
}

function getProcessingTime(providerId: string): string {
    if (isStripe(providerId)) {
        return "Instant"
    } else if (isPaypal(providerId)) {
        return "Instant"
    } else if (providerId.includes("ideal")) {
        return "Real-time"
    } else if (providerId.includes("bancontact")) {
        return "Real-time"
    } else if (isManual(providerId)) {
        return "Manual processing required"
    }
    return "Standard processing"
}

function getPaymentFees(providerId: string): string {
    if (isStripe(providerId)) {
        return "Standard card processing fees apply"
    } else if (isPaypal(providerId)) {
        return "PayPal fees may apply"
    } else if (providerId.includes("ideal") || providerId.includes("bancontact")) {
        return "Low transaction fees"
    } else if (isManual(providerId)) {
        return "No processing fees"
    }
    return "Standard fees apply"
}

function getPaymentRecommendationReasoning(option: any, preference?: string): string {
    switch (preference?.toLowerCase()) {
        case "secure":
        case "security":
            return `I recommend "${option.name}" for maximum security. ${option.security_level} with ${option.processing_time.toLowerCase()} processing.`
        case "fast":
        case "quick":
        case "instant":
            return `I recommend "${option.name}" for fastest payment processing. ${option.processing_time} confirmation.`
        case "popular":
        case "common":
            return `I recommend "${option.name}" as it's the most widely used payment method with excellent security.`
        case "simple":
        case "easy":
            return `I recommend "${option.name}" for its ease of use and familiar interface.`
        default:
            return `I recommend "${option.name}" as a reliable payment option with ${option.security_level.toLowerCase()} and ${option.processing_time.toLowerCase()} processing.`
    }
}

export async function completeOrderFromChatbot() {
    try {
        console.log("🚀 Starting order completion from chatbot...")
        const cookieStore = await cookies()
        const cartId = cookieStore.get("_medusa_cart_id")?.value
        console.log("📦 Cart ID found:", cartId)

        if (!cartId) {
            console.log("❌ No cart ID found")
            return {
                success: false,
                error: "No cart found. Please add items to cart first."
            }
        }

        // Get cart to validate it has items and required information
        console.log("🔍 Retrieving cart for validation...")
        const cart = await retrieveCart(cartId)
        console.log("📋 Cart retrieved:", cart ? "✅ Found" : "❌ Not found")

        if (!cart) {
            console.log("❌ Cart not found")
            return {
                success: false,
                error: "Cart not found"
            }
        }

        console.log("📦 Cart items count:", cart.items?.length || 0)
        if (!cart.items || cart.items.length === 0) {
            console.log("❌ Cart is empty")
            return {
                success: false,
                error: "Your cart is empty. Please add items before completing the order."
            }
        }

        console.log("🏠 Checking shipping address:", cart.shipping_address?.address_1 ? "✅ Present" : "❌ Missing")
        if (!cart.shipping_address?.address_1) {
            console.log("❌ No shipping address")
            return {
                success: false,
                error: "📍 Please provide your shipping address first. You can ask me to help you with checkout, or go to the checkout page to enter your address."
            }
        }

        console.log("🚚 Checking shipping methods:", cart.shipping_methods?.length || 0)
        if (!cart.shipping_methods || cart.shipping_methods.length === 0) {
            console.log("❌ No shipping methods")
            return {
                success: false,
                error: "🚚 Please select a delivery method first. You can ask me to show delivery options, or complete this step in checkout."
            }
        }

        console.log("💳 Checking payment sessions:", cart.payment_collection?.payment_sessions?.length || 0)
        if (!cart.payment_collection?.payment_sessions || cart.payment_collection.payment_sessions.length === 0) {
            console.log("❌ No payment sessions")
            return {
                success: false,
                error: "💳 Please select a payment method first. You can ask me to show payment options, or complete this step in checkout."
            }
        }

        // Complete the order using the new function that doesn't redirect
        console.log("✅ All validations passed, completing order...")
        const result = await completeOrderWithoutRedirect(cartId)
        console.log("🎉 Order completion result:", result)

        return {
            success: true,
            message: `Order #${result.orderId} completed successfully! 🎉`,
            orderId: result.orderId,
            confirmationUrl: result.confirmationUrl,
            order: result.order
        }

    } catch (error: any) {
        console.error("Complete order error:", error)

        return {
            success: false,
            error: error.message || "Failed to complete order. Please try again."
        }
    }
}
