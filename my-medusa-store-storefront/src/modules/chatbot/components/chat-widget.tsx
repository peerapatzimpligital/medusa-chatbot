"use client"

import React, { useRef, useEffect } from "react"
import { ChatMessage } from "./chat-message"
import { updateCart, retrieveCart } from "@lib/data/cart"
import { 
    getDeliveryOptionsFromChatbot, 
    selectDeliveryMethodFromChatbot, 
    getDeliveryRecommendationFromChatbot,
    getPaymentOptionsFromChatbot,
    selectPaymentMethodFromChatbot,
    getPaymentRecommendationFromChatbot,
    completeOrderFromChatbot
} from "../actions"
import { useChatbotStore } from "../store/chatbot-store"

interface ActionButton {
    id: string
    label: string
    action: string
    variant?: "primary" | "secondary" | "outline"
}

interface AddressData {
    firstName?: string
    lastName?: string
    address?: string
    city?: string
    postalCode?: string
    province?: string
    country?: string
    company?: string
    phone?: string
    email?: string
}

interface Message {
    id: string
    type: "user" | "bot"
    content: string
    products?: any[]
    suggestions?: string[]
    actions?: ActionButton[]
    showActions?: boolean
    addressData?: AddressData | null
    hasAddress?: boolean
    missingFields?: string[]
    timestamp: Date
    status?: "sending" | "sent" | "delivered" | "error"
    isTyping?: boolean
}

export function ChatWidget() {
    // Zustand store
    const {
        // UI State
        isOpen,
        input,
        isLoading,
        isTyping,
        quickReplies,
        
        // Chat State
        messages,
        conversationId,
        
        // Cart State
        cartItemCount,
        
        // Address Collection State
        isCollectingAddress,
        partialAddress,
        
        // Actions
        setIsOpen,
        setInput,
        setIsLoading,
        setIsTyping,
        setQuickReplies,
        addMessage,
        updateMessage,
        clearMessages,
        setConversationId,
        setCartItemCount,
        setIsCollectingAddress,
        setPartialAddress,
        updatePartialAddress,
        clearPartialAddress,
        
        // Order Confirmation Actions
        setOrderConfirmation,
        getOrderConfirmation,
        
        // Address Data Actions
        setSavedAddressData,
        getSavedAddressData,
        clearSavedAddressData,
    } = useChatbotStore()
    
    const messagesEndRef = useRef<HTMLDivElement>(null)

    // Determine welcome message based on current page
    const getWelcomeMessage = () => {
        return {
            content: "Hi! I'm your AI shopping assistant. I'm here to help you find products, answer questions, and make your shopping experience amazing! ✨",
            suggestions: [
                "🔥 Show me popular products",
                "✅ Complete My Order"
            ]
        }
    }

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])



    const sendMessage = async (text: string) => {
        if (!text.trim()) return

        // Check for "Complete My Order" pattern
        const completeOrderPatterns = [
            /complete\s+my\s+order/i,
            /complete\s+order/i,
            /finish\s+my\s+order/i,
            /finalize\s+order/i,
            /place\s+my\s+order/i,
            /submit\s+order/i
        ]

        const isCompleteOrderRequest = completeOrderPatterns.some(pattern => pattern.test(text.trim()))

        if (isCompleteOrderRequest) {
            // Add user message
            const userMessage: Message = {
                id: Date.now().toString(),
                type: "user",
                content: text,
                timestamp: new Date(),
                status: "delivered"
            }
            addMessage(userMessage)
            setInput("")
            setQuickReplies([])

            // Trigger order completion directly
            handleCompleteOrder()
            return
        }

        const userMessage: Message = {
            id: Date.now().toString(),
            type: "user",
            content: text,
            timestamp: new Date(),
            status: "sending"
        }

        addMessage(userMessage)
        setInput("")
        setQuickReplies([]) // Clear quick replies when user sends a message
        setIsLoading(true)
        
        // Show typing indicator after a short delay
        setTimeout(() => {
            setIsTyping(true)
        }, 300)

        // Update message status to sent
        setTimeout(() => {
            updateMessage(userMessage.id, { status: "sent" })
        }, 100)

        try {
            const response = await fetch("/api/chatbot", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    query: text,
                    conversationId,
                    cartItemCount,
                    // Add conversation context
                    context: {
                        isCollectingAddress,
                        partialAddress,
                        recentMessages: messages.slice(-5).map(msg => ({
                            type: msg.type,
                            content: msg.content,
                            hasAddress: msg.hasAddress,
                            addressData: msg.addressData
                        }))
                    }
                })
            })

            const data = await response.json()

            if (!conversationId) {
                setConversationId(data.conversationId)
            }

            // Stop typing indicator
            setIsTyping(false)
            
            // Update user message status to delivered
            updateMessage(userMessage.id, { status: "delivered" })

            // Add bot message with a slight delay for natural feel
            setTimeout(() => {
                const botMessage: Message = {
                    id: (Date.now() + 1).toString(),
                    type: "bot",
                    content: data.message,
                    products: data.products,
                    suggestions: data.suggestions,
                    actions: data.actions,
                    showActions: data.showActions,
                    addressData: data.addressData,
                    hasAddress: data.hasAddress,
                    missingFields: data.missingFields,
                    timestamp: new Date(),
                    status: "delivered"
                }

                addMessage(botMessage)
                
                // Set smart quick replies based on context
                if (data.suggestions && data.suggestions.length > 0) {
                    setQuickReplies(data.suggestions.slice(0, 3)) // Show max 3 quick replies
                } else {
                    setQuickReplies([])
                }
            }, 500)

            // Handle address extraction and follow-up
            if (data.hasAddress && data.addressData) {
                // Merge with existing partial address
                const mergedAddress = { ...partialAddress, ...data.addressData }
                setPartialAddress(mergedAddress)

                if (data.needsFollowup && data.followupMessage) {
                    // Ask for missing fields
                    setIsCollectingAddress(true)
                    const followupMsg: Message = {
                        id: (Date.now() + 2).toString(),
                        type: "bot",
                        content: data.followupMessage,
                        suggestions: data.followupSuggestions,
                        timestamp: new Date()
                    }
                    setTimeout(() => {
                        addMessage(followupMsg)
                    }, 500)
                } else {
                    // All fields collected, offer to fill form
                    setIsCollectingAddress(false)
                    handleAddressExtraction(mergedAddress, data.missingFields || [])
                }
            } else if (isCollectingAddress && data.addressData) {
                // Continue collecting missing fields
                const mergedAddress = { ...partialAddress, ...data.addressData }
                setPartialAddress(mergedAddress)

                if (data.needsFollowup && data.followupMessage) {
                    const followupMsg: Message = {
                        id: (Date.now() + 2).toString(),
                        type: "bot",
                        content: data.followupMessage,
                        suggestions: data.followupSuggestions,
                        timestamp: new Date()
                    }
                    setTimeout(() => {
                        addMessage(followupMsg)
                    }, 500)
                } else {
                    // All fields collected
                    setIsCollectingAddress(false)
                    handleAddressExtraction(mergedAddress, [])
                }
            }
        } catch (error) {
            setIsTyping(false)
            
            // Update user message status to error
            updateMessage(userMessage.id, { status: "error" })
            
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                type: "bot",
                content: "Sorry, I encountered an error. Please try again.",
                timestamp: new Date(),
                status: "delivered"
            }
            addMessage(errorMessage)
            
            // Set retry quick replies
            setQuickReplies(["Try again", "Help", "Start over"])
        } finally {
            setIsLoading(false)
        }
    }



    const handleSuggestionClick = (suggestion: string) => {
        sendMessage(suggestion)
    }

    const handleAddToCart = async (product: any) => {
        try {
            // Import the server action
            const { addToCartFromChatbot } = await import("../actions")
            
            // Add product to cart via server action
            const result = await addToCartFromChatbot(product.variantId, 1)

            if (result.success) {
                // Show success message
                const successMessage: Message = {
                    id: Date.now().toString(),
                    type: "bot",
                    content: `🎉 Great choice! "${product.title}" has been added to your cart successfully!\n\nWhat would you like to do next?`,
                    actions: [
                        {
                            id: "complete_order_now",
                            label: "Complete Order Now",
                            action: "complete_order_now",
                            variant: "primary"
                        },
                        {
                            id: "continue_shopping",
                            label: "Continue Shopping",
                            action: "continue_shopping",
                            variant: "outline"
                        }
                    ],
                    showActions: true,
                    timestamp: new Date()
                }
                addMessage(successMessage)
                
                // Update cart count
                setCartItemCount(cartItemCount + 1)
            } else {
                throw new Error(result.error || "Failed to add to cart")
            }
        } catch (error) {
            // Show error message
            const errorMessage: Message = {
                id: Date.now().toString(),
                type: "bot",
                content: `❌ Sorry, I couldn't add "${product.title}" to your cart. Please try again.`,
                timestamp: new Date()
            }
            addMessage(errorMessage)
        }
    }

    const handleDeliveryOptions = async () => {
        try {
            const result = await getDeliveryOptionsFromChatbot()
            
            if (result.success && result.deliveryOptions) {
                const optionsMessage: Message = {
                    id: Date.now().toString(),
                    type: "bot",
                    content: `Here are your available delivery options:

${result.deliveryOptions.map((option, index) => 
    `${index + 1}. **${option.name}** - ${formatPrice(option.amount, option.currency_code)}
   ${option.description ? `   ${option.description}` : ''}`
).join('\n\n')}

Which delivery method would you prefer?`,
                    actions: result.deliveryOptions.map((option, index) => ({
                        id: `select_delivery_${option.id}`,
                        label: `${option.name} - ${formatPrice(option.amount, option.currency_code)}`,
                        action: `select_delivery_${option.id}`,
                        variant: index === 0 ? "primary" : "outline"
                    })),
                    showActions: true,
                    timestamp: new Date()
                }
                addMessage(optionsMessage)
            } else {
                const errorMessage: Message = {
                    id: Date.now().toString(),
                    type: "bot",
                    content: result.error || "Sorry, I couldn't retrieve delivery options. Please try again.",
                    timestamp: new Date()
                }
                addMessage(errorMessage)
            }
        } catch (error) {
            console.error("Error getting delivery options:", error)
            const errorMessage: Message = {
                id: Date.now().toString(),
                type: "bot",
                content: "Sorry, there was an error getting delivery options. Please try again.",
                timestamp: new Date()
            }
            addMessage(errorMessage)
        }
    }

    const handleSelectDeliveryMethod = async (shippingMethodId: string) => {
        try {
            const result = await selectDeliveryMethodFromChatbot(shippingMethodId)
            
            if (result.success) {
                const successMessage: Message = {
                    id: Date.now().toString(),
                    type: "bot",
                    content: `✅ ${result.message}`,
                    actions: [
                        {
                            id: "proceed_to_payment",
                            label: "Proceed to Payment",
                            action: "proceed_to_payment",
                            variant: "primary"
                        }
                    ],
                    showActions: true,
                    timestamp: new Date()
                }
                addMessage(successMessage)
            } else {
                const errorMessage: Message = {
                    id: Date.now().toString(),
                    type: "bot",
                    content: `❌ ${result.error}`,
                    timestamp: new Date()
                }
                addMessage(errorMessage)
            }
        } catch (error) {
            console.error("Error selecting delivery method:", error)
            const errorMessage: Message = {
                id: Date.now().toString(),
                type: "bot",
                content: "Sorry, there was an error selecting the delivery method. Please try again.",
                timestamp: new Date()
            }
            addMessage(errorMessage)
        }
    }

    const handleDeliveryRecommendation = async (priority: "speed" | "cost" | "eco" = "cost") => {
        try {
            const result = await getDeliveryRecommendationFromChatbot({ priority })
            
            if (result.success && result.recommendation) {
                const recommendationMessage: Message = {
                    id: Date.now().toString(),
                    type: "bot",
                    content: `🎯 ${result.reasoning}

**${result.recommendation.name}**
Price: ${formatPrice(result.recommendation.amount, result.recommendation.currency_code)}
${result.recommendation.description ? `\n${result.recommendation.description}` : ''}

Would you like to select this option?`,
                    actions: [
                        {
                            id: `select_delivery_${result.recommendation.id}`,
                            label: `Select ${result.recommendation.name}`,
                            action: `select_delivery_${result.recommendation.id}`,
                            variant: "primary"
                        },
                        {
                            id: "view_all_options",
                            label: "View All Options",
                            action: "view_delivery_options",
                            variant: "outline"
                        }
                    ],
                    showActions: true,
                    timestamp: new Date()
                }
                addMessage(recommendationMessage)
            } else {
                const errorMessage: Message = {
                    id: Date.now().toString(),
                    type: "bot",
                    content: result.error || "Sorry, I couldn't get a delivery recommendation. Please try again.",
                    timestamp: new Date()
                }
                addMessage(errorMessage)
            }
        } catch (error) {
            console.error("Error getting delivery recommendation:", error)
            const errorMessage: Message = {
                id: Date.now().toString(),
                type: "bot",
                content: "Sorry, there was an error getting a delivery recommendation. Please try again.",
                timestamp: new Date()
            }
            addMessage(errorMessage)
        }
    }

    const formatPrice = (amount: number, currency: string): string => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency.toUpperCase()
        }).format(amount)
    }

    const formatCartSummary = (cart: any): string => {
        if (!cart || !cart.items || cart.items.length === 0) {
            return "Your cart is empty."
        }

        let summary = "🛒 **Cart Summary**\n\n"
        
        // Add items
        cart.items.forEach((item: any, index: number) => {
            const itemTotal = item.unit_price * item.quantity
            summary += `${index + 1}. **${item.product_title}**\n`
            if (item.variant_title && item.variant_title !== "Default Variant") {
                summary += `   Variant: ${item.variant_title}\n`
            }
            summary += `   Quantity: ${item.quantity} × ${formatPrice(item.unit_price, cart.currency_code)}\n`
            summary += `   Subtotal: ${formatPrice(itemTotal, cart.currency_code)}\n\n`
        })

        // Add totals
        summary += "---\n"
        summary += `**Subtotal:** ${formatPrice(cart.subtotal || 0, cart.currency_code)}\n`
        
        if (cart.shipping_total && cart.shipping_total > 0) {
            summary += `**Shipping:** ${formatPrice(cart.shipping_total, cart.currency_code)}\n`
        }
        
        if (cart.tax_total && cart.tax_total > 0) {
            summary += `**Tax:** ${formatPrice(cart.tax_total, cart.currency_code)}\n`
        }
        
        if (cart.discount_total && cart.discount_total > 0) {
            summary += `**Discount:** -${formatPrice(cart.discount_total, cart.currency_code)}\n`
        }
        
        summary += `**Total:** ${formatPrice(cart.total || 0, cart.currency_code)}\n`
        
        return summary
    }

    const handlePaymentOptions = async () => {
        try {
            const result = await getPaymentOptionsFromChatbot()
            
            if (result.success && result.paymentOptions) {
                const optionsMessage: Message = {
                    id: Date.now().toString(),
                    type: "bot",
                    content: `Here are your available payment methods:

${result.paymentOptions.map((option, index) => 
    `${index + 1}. **${option.name}**
   ${option.description}
   Security: ${option.security_level}
   Processing: ${option.processing_time}
   ${option.fees ? `Fee: ${option.fees}` : 'No additional fees'}`
).join('\n\n')}

Which payment method would you prefer?`,
                    actions: result.paymentOptions.map((option, index) => ({
                        id: `select_payment_${option.id}`,
                        label: option.name,
                        action: `select_payment_${option.id}`,
                        variant: index === 0 ? "primary" : "outline"
                    })),
                    showActions: true,
                    timestamp: new Date()
                }
                addMessage(optionsMessage)
            } else {
                const errorMessage: Message = {
                    id: Date.now().toString(),
                    type: "bot",
                    content: result.error || "Sorry, I couldn't retrieve payment options. Please try again.",
                    timestamp: new Date()
                }
                addMessage(errorMessage)
            }
        } catch (error) {
            console.error("Error getting payment options:", error)
            const errorMessage: Message = {
                id: Date.now().toString(),
                type: "bot",
                content: "Sorry, there was an error getting payment options. Please try again.",
                timestamp: new Date()
            }
            addMessage(errorMessage)
        }
    }

    const handlePaymentRecommendation = async (preference : string) => {
        try {
            const result = await getPaymentRecommendationFromChatbot(preference)
            
            if (result.success && result.recommendation) {
                const recommendationMessage: Message = {
                    id: Date.now().toString(),
                    type: "bot",
                    content: `🎯 ${result.reasoning}

**${result.recommendation.name}**
${result.recommendation.description}
Security: ${result.recommendation.security_level}
Processing: ${result.recommendation.processing_time}
${result.recommendation.fees ? `Fee: ${result.recommendation.fees}` : 'No additional fees'}

Would you like to select this payment method?`,
                    actions: [
                        {
                            id: `select_payment_${result.recommendation.id}`,
                            label: `Select ${result.recommendation.name}`,
                            action: `select_payment_${result.recommendation.id}`,
                            variant: "primary"
                        },
                        {
                            id: "view_all_payment_options",
                            label: "View All Options",
                            action: "view_payment_options",
                            variant: "outline"
                        }
                    ],
                    showActions: true,
                    timestamp: new Date()
                }
                addMessage(recommendationMessage)
            } else {
                const errorMessage: Message = {
                    id: Date.now().toString(),
                    type: "bot",
                    content: result.error || "Sorry, I couldn't get a payment recommendation. Please try again.",
                    timestamp: new Date()
                }
                addMessage(errorMessage)
            }
        } catch (error) {
            console.error("Error getting payment recommendation:", error)
            const errorMessage: Message = {
                id: Date.now().toString(),
                type: "bot",
                content: "Sorry, there was an error getting a payment recommendation. Please try again.",
                timestamp: new Date()
            }
            addMessage(errorMessage)
        }
    }

    const handlePaymentSelection = async () => {
        try {
            const result = await getPaymentOptionsFromChatbot()
            
            if (result.success && result.paymentOptions) {
                const selectionMessage: Message = {
                    id: Date.now().toString(),
                    type: "bot",
                    content: "Please select your preferred payment method:",
                    actions: result.paymentOptions.map((option, index) => ({
                        id: `select_payment_${option.id}`,
                        label: option.name,
                        action: `select_payment_${option.id}`,
                        variant: index === 0 ? "primary" : "outline"
                    })),
                    showActions: true,
                    timestamp: new Date()
                }
                addMessage(selectionMessage)
            } else {
                const errorMessage: Message = {
                    id: Date.now().toString(),
                    type: "bot",
                    content: result.error || "Sorry, I couldn't retrieve payment options. Please try again.",
                    timestamp: new Date()
                }
                addMessage(errorMessage)
            }
        } catch (error) {
            console.error("Error getting payment options:", error)
            const errorMessage: Message = {
                id: Date.now().toString(),
                type: "bot",
                content: "Sorry, there was an error getting payment options. Please try again.",
                timestamp: new Date()
            }
            addMessage(errorMessage)
        }
    }

    const handleSelectPaymentMethod = async (paymentProviderId: string) => {
        try {
            const result = await selectPaymentMethodFromChatbot(paymentProviderId)
            
            if (result.success) {
                // First, show payment method selection success
                const successMessage: Message = {
                    id: Date.now().toString(),
                    type: "bot",
                    content: `✅ ${result.message}`,
                    timestamp: new Date()
                }
                addMessage(successMessage)

                // Then, retrieve and display cart summary
                try {
                    const cart = await retrieveCart()
                    if (cart) {
                        const cartSummary = formatCartSummary(cart)
                        const cartSummaryMessage: Message = {
                            id: Date.now().toString(),
                            type: "bot",
                            content: cartSummary,
                            actions: [
                                {
                                    id: "complete_order_now",
                                    label: "Complete Payment",
                                    action: "complete_order_now",
                                    variant: "primary"
                                }
                            ],
                            showActions: true,
                            timestamp: new Date()
                        }
                        addMessage(cartSummaryMessage)
                    } else {
                        // Fallback if cart can't be retrieved
                        const fallbackMessage: Message = {
                            id: Date.now().toString(),
                            type: "bot",
                            content: "Ready to complete your order!",
                            actions: [
                                {
                                    id: "complete_order_now",
                                    label: "Complete Payment",
                                    action: "complete_order_now",
                                    variant: "primary"
                                }
                            ],
                            showActions: true,
                            timestamp: new Date()
                        }
                        addMessage(fallbackMessage)
                    }
                } catch (cartError) {
                    console.error("Error retrieving cart for summary:", cartError)
                    // Fallback message if cart retrieval fails
                    const fallbackMessage: Message = {
                        id: Date.now().toString(),
                        type: "bot",
                        content: "Ready to complete your order!",
                        actions: [
                            {
                                id: "complete_order_now",
                                label: "Complete Payment",
                                action: "complete_order_now",
                                variant: "primary"
                            }
                        ],
                        showActions: true,
                        timestamp: new Date()
                    }
                    addMessage(fallbackMessage)
                }
            } else {
                const errorMessage: Message = {
                    id: Date.now().toString(),
                    type: "bot",
                    content: `❌ ${result.error}`,
                    timestamp: new Date()
                }
                addMessage(errorMessage)
            }
        } catch (error) {
            console.error("Error selecting payment method:", error)
            const errorMessage: Message = {
                id: Date.now().toString(),
                type: "bot",
                content: "Sorry, there was an error selecting the payment method. Please try again.",
                timestamp: new Date()
            }
            addMessage(errorMessage)
        }
    }

    const handleCompleteOrder = async () => {
        try {
            console.log("🎯 Chat widget: handleCompleteOrder called")
            const result = await completeOrderFromChatbot()
            console.log("📨 Chat widget: received result:", result)
            
            if (result.success) {
                const successMessage: Message = {
                    id: Date.now().toString(),
                    type: "bot",
                    content: `🎉 ${result.message}`,
                    actions: [
                        {
                            id: "view_order",
                            label: "View Order Details",
                            action: `view_order_${result.orderId}`,
                            variant: "primary"
                        },
                        {
                            id: "continue_shopping",
                            label: "Continue Shopping",
                            action: "continue_shopping",
                            variant: "outline"
                        }
                    ],
                    showActions: true,
                    timestamp: new Date()
                }
                addMessage(successMessage)
                
                // Store the confirmation URL for the view order action
                if (result.confirmationUrl) {
                    setOrderConfirmation(result.orderId, result.confirmationUrl)
                }
            } else {
                // Provide specific actions based on the error type
                let actions = []
                
                if (result.error?.includes("shipping address")) {
                    actions = [
                        {
                            id: "provide_address",
                            label: "Provide Address",
                            action: "provide_address",
                            variant: "primary"
                        },
                        // {
                        //     id: "go_to_checkout",
                        //     label: "Go to Checkout",
                        //     action: "proceed_to_checkout",
                        //     variant: "outline"
                        // }
                    ]
                } else if (result.error?.includes("delivery method")) {
                    actions = [
                        {
                            id: "view_delivery_options",
                            label: "View Delivery Options",
                            action: "view_delivery_options",
                            variant: "primary"
                        },
                        // {
                        //     id: "go_to_checkout",
                        //     label: "Go to Checkout",
                        //     action: "proceed_to_checkout",
                        //     variant: "outline"
                        // }
                    ]
                } else if (result.error?.includes("payment method")) {
                    actions = [
                        {
                            id: "view_payment_options",
                            label: "View Payment Options",
                            action: "view_payment_options",
                            variant: "primary"
                        },
                        // {
                        //     id: "go_to_checkout",
                        //     label: "Go to Checkout",
                        //     action: "proceed_to_checkout",
                        //     variant: "outline"
                        // }
                    ]
                } else {
                    actions = [
                        {
                            id: "review_cart",
                            label: "Review Cart",
                            action: "review_order_details",
                            variant: "primary"
                        },
                        {
                            id: "continue_checkout",
                            label: "Continue Checkout",
                            action: "proceed_to_checkout",
                            variant: "outline"
                        }
                    ]
                }

                const errorMessage: Message = {
                    id: Date.now().toString(),
                    type: "bot",
                    content: `${result.error}`,
                    actions: actions as ActionButton[],
                    showActions: true,
                    timestamp: new Date()
                }
                addMessage(errorMessage)
            }
        } catch (error) {
            console.error("Error completing order:", error)
            const errorMessage: Message = {
                id: Date.now().toString(),
                type: "bot",
                content: "Sorry, there was an error completing your order. Please try again or complete the checkout manually.",
                actions: [
                    {
                        id: "retry_complete",
                        label: "Try Again",
                        action: "complete_order_now",
                        variant: "primary"
                    },
                    {
                        id: "manual_checkout",
                        label: "Manual Checkout",
                        action: "continue_to_payment",
                        variant: "outline"
                    }
                ],
                showActions: true,
                timestamp: new Date()
            }
            addMessage(errorMessage)
        }
    }

    const handleAddressExtraction = (addressData: AddressData, missingFields: string[]) => {
        // Store address data in Zustand store for form auto-fill
        setSavedAddressData(addressData)

        // Trigger event to notify checkout form
        window.dispatchEvent(new CustomEvent("address-extracted", {
            detail: { addressData, missingFields }
        }))

        // Add a follow-up message
        const followUpMessage: Message = {
            id: (Date.now() + 2).toString(),
            type: "bot",
            content: "Perfect! I've collected your address information. Would you like me to fill the checkout form?",
            actions: [
                {
                    id: "fill_form",
                    label: "Yes, Fill the Form",
                    action: "fill_form",
                    variant: "primary"
                },
                {
                    id: "manual_entry",
                    label: "No, I'll Enter Manually",
                    action: "manual_entry",
                    variant: "outline"
                }
            ],
            showActions: true,
            timestamp: new Date()
        }

        setTimeout(() => {
            addMessage(followUpMessage)
        }, 500)
    }

    const handleActionClick = (action: string) => {
        switch (action) {
            case "continue_shopping":
                setIsOpen(false)
                break
            case "view_cart":
                window.location.href = "/cart"
                break
            case "proceed_to_checkout":
            case "checkout":
                // Check if we already have address data
                const hasAddressData = Object.keys(partialAddress).length > 0

                if (!hasAddressData) {
                    // Ask for address before proceeding
                    const addressPrompt: Message = {
                        id: Date.now().toString(),
                        type: "bot",
                        content: "Great! Before we proceed to checkout, I can help you fill in your shipping address. Would you like to provide it now?",
                        actions: [
                            {
                                id: "provide_address",
                                label: "Yes, I'll Provide My Address",
                                action: "provide_address",
                                variant: "primary"
                            },
                            {
                                id: "skip_address",
                                label: "Skip, I'll Enter It Manually",
                                action: "skip_address",
                                variant: "outline"
                            }
                        ],
                        showActions: true,
                        timestamp: new Date()
                    }
                    addMessage(addressPrompt)
                } else {
                    // Already have address, proceed to checkout
                    window.location.href = "/checkout?step=address"
                }
                break
            case "provide_address":
                setIsCollectingAddress(true)
                const addressQuestion: Message = {
                    id: Date.now().toString(),
                    type: "bot",
                    content: "Perfect! Please provide your shipping address. You can include your name, street address, city, postal code, and country.",
                    suggestions: [
                        "John Doe, john_doe@example.com , ABC Company, 123 Main St, New York, NY 10001, US",
                    ],
                    timestamp: new Date()
                }
                addMessage(addressQuestion)
                break
            case "skip_address":
                window.location.href = "/checkout?step=address"
                break
            case "browse_products":
                window.location.href = "/store"
                break
            case "fill_form":
                const addressData = getSavedAddressData()
                if (addressData) {
                    console.log("Address data to fill:", addressData)

                    // Small delay to ensure page is fully loaded
                    setTimeout(() => {
                        fillCheckoutForm(addressData)
                    }, 100)

                    clearSavedAddressData()
                } else {
                    const errorMsg: Message = {
                        id: Date.now().toString(),
                        type: "bot",
                        content: "⚠️ No address data found. Please provide your address first.",
                        timestamp: new Date()
                    }
                    addMessage(errorMsg)
                }
                break
            case "manual_entry":
                clearSavedAddressData()
                sessionStorage.removeItem("chatbot_partial_address")
                sessionStorage.setItem("chatbot_collecting_address", "false")
                setPartialAddress({})
                setIsCollectingAddress(false)
                const message: Message = {
                    id: Date.now().toString(),
                    type: "bot",
                    content: "No problem! Let me know if you need any help.",
                    timestamp: new Date()
                }
                addMessage(message)
                break
            case "clear_chat":
                // Clear all chat data
                sessionStorage.removeItem("chatbot_messages")
                sessionStorage.removeItem("chatbot_conversation_id")
                sessionStorage.removeItem("chatbot_partial_address")
                sessionStorage.removeItem("chatbot_collecting_address")
                clearSavedAddressData()
                clearMessages()
                addMessage({
                    id: "welcome",
                    type: "bot",
                    ...getWelcomeMessage(),
                    timestamp: new Date()
                })
                setConversationId(null)
                setPartialAddress({})
                setIsCollectingAddress(false)
                break
            case "view_delivery_options":
                handleDeliveryOptions()
                break
            case "get_delivery_recommendation":
                handleDeliveryRecommendation("cost")
                break
            case "proceed_to_payment":
                handlePaymentSelection()
                break
            case "view_payment_options":
                handlePaymentOptions()
                break
            case "get_payment_recommendation":
                handlePaymentRecommendation("secure")
                break
            case "select_payment_method":
                handlePaymentSelection()
                break
            case "continue_to_review":
                window.location.href = "/checkout?step=review"
                break
            case "complete_order_now":
                handleCompleteOrder()
                break
            case "review_order_details":
                window.location.href = "/checkout?step=review"
                break
            case "continue_to_payment":
                window.location.href = "/checkout?step=payment"
                break
            case "edit_cart":
                window.location.href = "/cart"
                break
            default:
                // Check if it's a delivery method selection
                if (action.startsWith("select_delivery_")) {
                    const shippingMethodId = action.replace("select_delivery_", "")
                    handleSelectDeliveryMethod(shippingMethodId)
                }
                // Check if it's a payment method selection
                else if (action.startsWith("select_payment_")) {
                    const paymentProviderId = action.replace("select_payment_", "")
                    handleSelectPaymentMethod(paymentProviderId)
                }
                // Check if it's a view order action
                else if (action.startsWith("view_order_")) {
                    const orderId = action.replace("view_order_", "")
                    const confirmationUrl = getOrderConfirmation(orderId)
                    if (confirmationUrl) {
                        window.location.href = confirmationUrl
                    } else {
                        // Fallback to orders page
                        window.location.href = `/account/orders/${orderId}`
                    }
                } else {
                    console.log("Unknown action:", action)
                }
        }
    }

    const fillCheckoutForm = async (addressData: AddressData) => {
        console.log("Filling form with data:", addressData)

        // Try API approach first (better for Medusa)
        const apiSuccess = await fillViaAPI(addressData)
        if (apiSuccess) {
            // Show delivery options message after successful address update
            const deliveryMessage: Message = {
                id: Date.now().toString(),
                type: "bot",
                content: "✅ Your address has been updated successfully! Now let's choose your delivery method.",
                actions: [
                    {
                        id: "view_delivery_options",
                        label: "View Delivery Options",
                        action: "view_delivery_options",
                        variant: "primary"
                    },
                    {
                        id: "continue_to_payment",
                        label: "Skip to Payment",
                        action: "continue_to_payment",
                        variant: "outline"
                    }
                ],
                showActions: true,
                timestamp: new Date()
            }
            addMessage(deliveryMessage)
            return
        }

        // Fallback to DOM manipulation if API fails
        console.log("API approach failed, falling back to DOM manipulation")
        fillViaDOMManipulation(addressData)
        
        // Show delivery options message after DOM manipulation as well
        const deliveryMessage: Message = {
            id: Date.now().toString(),
            type: "bot",
            content: "✅ Your address has been filled! Now let's choose your delivery method.",
            actions: [
                {
                    id: "view_delivery_options",
                    label: "View Delivery Options",
                    action: "view_delivery_options",
                    variant: "primary"
                },
                {
                    id: "continue_to_payment",
                    label: "Skip to Payment",
                    action: "continue_to_payment",
                    variant: "outline"
                }
            ],
            showActions: true,
            timestamp: new Date()
        }
        addMessage(deliveryMessage)
    }

    const fillViaAPI = async (addressData: AddressData): Promise<boolean> => {
        try {
            console.log("Updating cart via API:", { addressData })

            // Get country code
            const getCountryCode = (country: string): string => {
                const countryMap: Record<string, string> = {
                    "united states": "us", "usa": "us", "us": "us", "america": "us",
                    "united kingdom": "gb", "uk": "gb", "england": "gb",
                    "canada": "ca", "australia": "au", "germany": "de",
                    "france": "fr", "italy": "it", "spain": "es",
                    "netherlands": "nl", "thailand": "th", "ไทย": "th",
                    "japan": "jp", "china": "cn", "india": "in",
                    "singapore": "sg", "malaysia": "my", "indonesia": "id"
                }

                const normalized = country.toLowerCase().trim()
                if (countryMap[normalized]) {
                    return countryMap[normalized]
                }

                // Check partial match
                for (const [name, code] of Object.entries(countryMap)) {
                    if (normalized.includes(name) || name.includes(normalized)) {
                        return code
                    }
                }

                // If already 2-letter code
                if (normalized.length === 2) {
                    return normalized
                }

                return "us" // Default
            }

            // Format address according to Medusa v2 API requirements
            const formattedAddress = {
                first_name: addressData.firstName || "",
                last_name: addressData.lastName || "",
                address_1: addressData.address || "",
                company: addressData.company || "",
                city: addressData.city || "",
                postal_code: addressData.postalCode || "",
                country_code: addressData.country ? getCountryCode(addressData.country) : "us",
                province: addressData.province || "",
                phone: addressData.phone || ""
            }

            // Use the existing updateCart utility function from lib/data/cart.ts
            try {
                const updatedCart = await updateCart({
                    shipping_address: formattedAddress,
                    billing_address: formattedAddress, // Use same address for billing
                    email: addressData.email || ""
                })

                console.log("Cart updated successfully:", updatedCart)

                return true
            } catch (error: any) {
                console.error("Cart update error:", error)
                
                let errorMessage = "Failed to update shipping address."
                if (error.message?.includes("No existing cart found")) {
                    errorMessage = "No cart found. Please add items to your cart first."
                } else if (error.message?.includes("Invalid")) {
                    errorMessage = "Invalid address information provided."
                }
                
                const botErrorMessage: Message = {
                    id: Date.now().toString(),
                    type: "bot",
                    content: `⚠️ ${errorMessage}`,
                    timestamp: new Date()
                }
                addMessage(botErrorMessage)
                return false
            }



        } catch (error) {
            console.error("Error updating cart:", error)
            const errorMessage: Message = {
                id: Date.now().toString(),
                type: "bot",
                content: "⚠️ Network error occurred. Please check your connection and try again.",
                timestamp: new Date()
            }
            addMessage(errorMessage)
            return false
        }
    }

    const fillViaDOMManipulation = (addressData: AddressData) => {
        console.log("Using DOM manipulation fallback")

        // Fill form fields by dispatching input events
        const fillField = (selectors: string[], value: string) => {
            for (const selector of selectors) {
                const input = document.querySelector(selector) as HTMLInputElement
                if (input && value) {
                    console.log(`Filling ${selector} with:`, value)

                    // Set value using multiple methods to ensure React picks it up
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                        window.HTMLInputElement.prototype,
                        "value"
                    )?.set

                    if (nativeInputValueSetter) {
                        nativeInputValueSetter.call(input, value)
                    }

                    input.value = value

                    // Trigger multiple events to ensure React state updates
                    input.dispatchEvent(new Event("input", { bubbles: true }))
                    input.dispatchEvent(new Event("change", { bubbles: true }))
                    input.dispatchEvent(new Event("blur", { bubbles: true }))

                    return true
                }
            }
            console.warn(`Could not find input for selectors:`, selectors)
            return false
        }

        // Try multiple possible field name patterns
        const fieldMappings = [
            {
                data: addressData.firstName,
                selectors: [
                    'input[name="shipping_address.first_name"]',
                    'input[name="first_name"]',
                    'input[placeholder*="First name" i]',
                    'input[id*="first" i][id*="name" i]'
                ]
            },
            {
                data: addressData.lastName,
                selectors: [
                    'input[name="shipping_address.last_name"]',
                    'input[name="last_name"]',
                    'input[placeholder*="Last name" i]',
                    'input[id*="last" i][id*="name" i]'
                ]
            },
            {
                data: addressData.address,
                selectors: [
                    'input[name="shipping_address.address_1"]',
                    'input[name="address"]',
                    'input[name="address_1"]',
                    'input[placeholder*="Address" i]',
                    'input[id*="address" i]'
                ]
            },
            {
                data: addressData.city,
                selectors: [
                    'input[name="shipping_address.city"]',
                    'input[name="city"]',
                    'input[placeholder*="City" i]',
                    'input[id*="city" i]'
                ]
            },
            {
                data: addressData.postalCode,
                selectors: [
                    'input[name="shipping_address.postal_code"]',
                    'input[name="postal_code"]',
                    'input[name="zip"]',
                    'input[placeholder*="Postal" i]',
                    'input[placeholder*="Zip" i]',
                    'input[id*="postal" i]'
                ]
            },
            {
                data: addressData.province,
                selectors: [
                    'input[name="shipping_address.province"]',
                    'input[name="province"]',
                    'input[name="state"]',
                    'input[placeholder*="State" i]',
                    'input[placeholder*="Province" i]'
                ]
            },
            {
                data: addressData.company,
                selectors: [
                    'input[name="shipping_address.company"]',
                    'input[name="company"]',
                    'input[placeholder*="Company" i]'
                ]
            },
            {
                data: addressData.phone,
                selectors: [
                    'input[name="shipping_address.phone"]',
                    'input[name="phone"]',
                    'input[type="tel"]',
                    'input[placeholder*="Phone" i]'
                ]
            },
            {
                data: addressData.email,
                selectors: [
                    'input[name="email"]',
                    'input[type="email"]',
                    'input[placeholder*="Email" i]'
                ]
            }
        ]

        let filledCount = 0
        fieldMappings.forEach(({ data, selectors }) => {
            if (data && fillField(selectors, data)) {
                filledCount++
            }
        })

        // Handle country dropdown
        if (addressData.country) {
            const countrySelectors = [
                'select[name="shipping_address.country_code"]',
                'select[name="country"]',
                'select[name="country_code"]'
            ]

            for (const selector of countrySelectors) {
                const countrySelect = document.querySelector(selector) as HTMLSelectElement
                if (countrySelect) {
                    console.log("Found country select:", selector)
                    const options = Array.from(countrySelect.options)
                    const matchingOption = options.find(opt =>
                        opt.text.toLowerCase().includes(addressData.country!.toLowerCase()) ||
                        opt.value.toLowerCase() === addressData.country!.toLowerCase() ||
                        opt.value.toLowerCase().includes(addressData.country!.toLowerCase().substring(0, 2))
                    )
                    if (matchingOption) {
                        console.log("Setting country to:", matchingOption.value)
                        countrySelect.value = matchingOption.value
                        countrySelect.dispatchEvent(new Event("change", { bubbles: true }))
                        countrySelect.dispatchEvent(new Event("blur", { bubbles: true }))
                        filledCount++
                    }
                    break
                }
            }
        }

        // Show success message
        const successMessage: Message = {
            id: Date.now().toString(),
            type: "bot",
            content: filledCount > 0
                ? `✓ Form filled! I filled ${filledCount} field(s). Please review and complete any missing information.`
                : "⚠️ I couldn't find the form fields. Please make sure you're on the checkout page and try again.",
            timestamp: new Date()
        }
        addMessage(successMessage)

        console.log(`Filled ${filledCount} fields`)
    }

    // Load cart count from API if not already set in store
    useEffect(() => {
        const loadCartCount = () => {
            // If cart count is 0, try to load from API or initialize
            if (cartItemCount === 0) {
                // You could fetch from API here if needed
                // For now, we'll keep the current store value
            }
        }

        loadCartCount()

        // Listen for cart updates
        const handleCartUpdate = () => {
            loadCartCount()
        }

        window.addEventListener("cart-updated", handleCartUpdate)

        return () => {
            window.removeEventListener("cart-updated", handleCartUpdate)
        }
    }, [])

    return (
        <>
            {/* Chat Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-6 right-6 z-50 bg-blue-600 text-white rounded-full p-4 shadow-lg hover:bg-blue-700 transition-all"
                aria-label="Open chat"
            >
                {isOpen ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                )}
            </button>

            {/* Chat Window */}
            {isOpen && (
                <div className="fixed bottom-24 right-6 z-50 w-96 h-[600px] bg-white rounded-lg shadow-2xl flex flex-col">
                    {/* Header */}
                    <div className="bg-blue-600 text-white p-4 rounded-t-lg">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-semibold">Shopping Assistant</h3>
                                <p className="text-sm text-blue-100">Ask me anything about our products</p>
                            </div>
                            <button
                                onClick={() => handleActionClick("clear_chat")}
                                className="text-blue-100 hover:text-white transition-colors"
                                title="Clear chat history"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {messages.map((message) => (
                            <ChatMessage 
                                key={message.id} 
                                message={{ ...message, addressData: message.addressData ?? undefined }}
                                onSuggestionClick={handleSuggestionClick}
                                onActionClick={(action) => handleActionClick(action.action)}
                                onAddToCart={handleAddToCart}
                            />
                        ))}
                        
                        {/* Typing Indicator */}
                        {isTyping && (
                            <div className="flex justify-start">
                                <div className="bg-gray-100 rounded-lg p-3 max-w-[80%]">
                                    <div className="flex items-center space-x-1">
                                        <div className="flex space-x-1">
                                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                                        </div>
                                        <span className="text-xs text-gray-500 ml-2">Assistant is typing...</span>
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        {/* Quick Replies */}
                        {quickReplies.length > 0 && !isLoading && !isTyping && (
                            <div className="flex flex-wrap gap-2 px-2">
                                {quickReplies.map((reply, index) => (
                                    <button
                                        key={index}
                                        onClick={() => {
                                            handleSuggestionClick(reply)
                                            setQuickReplies([])
                                        }}
                                        className="bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm px-3 py-2 rounded-full border border-blue-200 transition-all duration-200 hover:scale-105"
                                    >
                                        {reply}
                                    </button>
                                ))}
                            </div>
                        )}
                        
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="p-4 border-t bg-gray-50">
                        <form
                            onSubmit={(e) => {
                                e.preventDefault()
                                if (input.trim()) {
                                    sendMessage(input)
                                }
                            }}
                            className="space-y-2"
                        >
                            <div className="flex space-x-2">
                                <div className="flex-1 relative">
                                    <input
                                        type="text"
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault()
                                                if (input.trim()) {
                                                    sendMessage(input)
                                                }
                                            }
                                        }}
                                        placeholder={isTyping ? "Assistant is typing..." : "Type your message..."}
                                        className="w-full border rounded-lg px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 disabled:bg-gray-100 disabled:text-gray-500"
                                        disabled={isLoading || isTyping}
                                        maxLength={500}
                                    />
                                    {input.length > 400 && (
                                        <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-400">
                                            {500 - input.length}
                                        </span>
                                    )}
                                </div>
                                <button
                                    type="submit"
                                    disabled={isLoading || isTyping || !input.trim()}
                                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center min-w-[80px] hover:scale-105 active:scale-95"
                                >
                                    {isLoading || isTyping ? (
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <span>Send</span>
                                    )}
                                </button>
                            </div>
                            {input.length > 0 && (
                                <div className="flex justify-between items-center text-xs text-gray-500">
                                    <span>Press Enter to send, Shift+Enter for new line</span>
                                    <span className={input.length > 450 ? "text-orange-500" : ""}>{input.length}/500</span>
                                </div>
                            )}
                        </form>
                    </div>
                </div>
            )}
        </>
    )
}

// ...
