"use client"

import { useState, useRef, useEffect } from "react"
import { ChatMessage } from "./chat-message"
import { 
    getDeliveryOptionsFromChatbot, 
    selectDeliveryMethodFromChatbot, 
    getDeliveryRecommendationFromChatbot,
    getPaymentOptionsFromChatbot,
    selectPaymentMethodFromChatbot,
    getPaymentRecommendationFromChatbot,
    completeOrderFromChatbot
} from "../actions"

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
}

export function ChatWidget() {
    const [isOpen, setIsOpen] = useState(false)
    const [input, setInput] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [conversationId, setConversationId] = useState<string | null>(null)
    const [cartItemCount, setCartItemCount] = useState(0)
    const [collectingAddress, setCollectingAddress] = useState(false)
    const [partialAddress, setPartialAddress] = useState<AddressData>({})
    const messagesEndRef = useRef<HTMLDivElement>(null)

    // Determine welcome message based on current page
    const getWelcomeMessage = () => {
        if (typeof window !== "undefined") {
            const path = window.location.pathname
            const searchParams = new URLSearchParams(window.location.search)
            const step = searchParams.get("step")
            
            if (path.includes("/checkout")) {
                if (step === "delivery") {
                    return {
                        content: "Hi! I can help you choose the best delivery option for your order. Would you like to see all options or get a recommendation?",
                        suggestions: ["Show delivery options", "Recommend fastest delivery", "What's the cheapest option?"]
                    }
                }
                return {
                    content: "Hi! Need help with checkout? I can answer questions about shipping, payment, or products.",
                    suggestions: ["What payment methods do you accept?", "How long is shipping?", "Help me choose delivery"]
                }
            }
            if (path.includes("/cart")) {
                return {
                    content: "Hi! Ready to checkout? I can help you find more products or answer any questions.",
                    suggestions: ["Show me similar products", "Do you have any deals?"]
                }
            }
        }
        return {
            content: "Hi! I'm your shopping assistant. How can I help you today?",
            suggestions: ["Show me popular products"]
        }
    }

    // Load messages from sessionStorage on mount
    const loadMessages = () => {
        if (typeof window !== "undefined") {
            const saved = sessionStorage.getItem("chatbot_messages")
            if (saved) {
                try {
                    const parsed = JSON.parse(saved)
                    return parsed.map((msg: any) => ({
                        ...msg,
                        timestamp: new Date(msg.timestamp)
                    }))
                } catch (e) {
                    console.error("Failed to parse saved messages:", e)
                }
            }
        }
        return [
            {
                id: "welcome",
                type: "bot",
                ...getWelcomeMessage(),
                timestamp: new Date()
            }
        ]
    }

    const [messages, setMessages] = useState<Message[]>(loadMessages())

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    // Save messages to sessionStorage whenever they change
    useEffect(() => {
        if (typeof window !== "undefined" && messages.length > 0) {
            sessionStorage.setItem("chatbot_messages", JSON.stringify(messages))
        }
    }, [messages])

    // Load conversation ID from sessionStorage
    useEffect(() => {
        if (typeof window !== "undefined") {
            const savedConvId = sessionStorage.getItem("chatbot_conversation_id")
            if (savedConvId) {
                setConversationId(savedConvId)
            }

            const savedPartialAddress = sessionStorage.getItem("chatbot_partial_address")
            if (savedPartialAddress) {
                try {
                    setPartialAddress(JSON.parse(savedPartialAddress))
                } catch (e) {
                    console.error("Failed to parse partial address:", e)
                }
            }

            const savedCollecting = sessionStorage.getItem("chatbot_collecting_address")
            if (savedCollecting === "true") {
                setCollectingAddress(true)
            }
        }
    }, [])

    // Save conversation ID to sessionStorage
    useEffect(() => {
        if (conversationId && typeof window !== "undefined") {
            sessionStorage.setItem("chatbot_conversation_id", conversationId)
        }
    }, [conversationId])

    // Save partial address to sessionStorage
    useEffect(() => {
        if (typeof window !== "undefined") {
            sessionStorage.setItem("chatbot_partial_address", JSON.stringify(partialAddress))
        }
    }, [partialAddress])

    // Save collecting state to sessionStorage
    useEffect(() => {
        if (typeof window !== "undefined") {
            sessionStorage.setItem("chatbot_collecting_address", String(collectingAddress))
        }
    }, [collectingAddress])

    const sendMessage = async (text: string) => {
        if (!text.trim()) return

        const userMessage: Message = {
            id: Date.now().toString(),
            type: "user",
            content: text,
            timestamp: new Date()
        }

        setMessages(prev => [...prev, userMessage])
        setInput("")
        setIsLoading(true)

        try {
            const response = await fetch("/api/chatbot", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    query: text,
                    conversationId,
                    cartItemCount
                })
            })

            const data = await response.json()

            if (!conversationId) {
                setConversationId(data.conversationId)
            }

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
                timestamp: new Date()
            }

            setMessages(prev => [...prev, botMessage])

            // Handle address extraction and follow-up
            if (data.hasAddress && data.addressData) {
                // Merge with existing partial address
                const mergedAddress = { ...partialAddress, ...data.addressData }
                setPartialAddress(mergedAddress)

                if (data.needsFollowup && data.followupMessage) {
                    // Ask for missing fields
                    setCollectingAddress(true)
                    const followupMsg: Message = {
                        id: (Date.now() + 2).toString(),
                        type: "bot",
                        content: data.followupMessage,
                        suggestions: data.followupSuggestions,
                        timestamp: new Date()
                    }
                    setTimeout(() => {
                        setMessages(prev => [...prev, followupMsg])
                    }, 500)
                } else {
                    // All fields collected, offer to fill form
                    setCollectingAddress(false)
                    handleAddressExtraction(mergedAddress, data.missingFields || [])
                }
            } else if (collectingAddress && data.addressData) {
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
                        setMessages(prev => [...prev, followupMsg])
                    }, 500)
                } else {
                    // All fields collected
                    setCollectingAddress(false)
                    handleAddressExtraction(mergedAddress, [])
                }
            }
        } catch (error) {
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                type: "bot",
                content: "Sorry, I encountered an error. Please try again.",
                timestamp: new Date()
            }
            setMessages(prev => [...prev, errorMessage])
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
                    content: `✅ "${product.title}" has been added to your cart!`,
                    actions: [
                        {
                            id: "proceed_to_checkout",
                            label: "Proceed to Checkout",
                            action: "proceed_to_checkout",
                            variant: "primary"
                        },
                        {
                            id: "view_cart",
                            label: "View Cart",
                            action: "view_cart",
                            variant: "outline"
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
                setMessages(prev => [...prev, successMessage])
                
                // Update cart count
                setCartItemCount(prev => prev + 1)
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
            setMessages(prev => [...prev, errorMessage])
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
   ${option.description ? `   ${option.description}` : ''}
   Estimated delivery: ${option.estimated_delivery}`
).join('\n\n')}

Which delivery method would you prefer?`,
                    actions: result.deliveryOptions.map((option, index) => ({
                        id: `select_delivery_${option.id}`,
                        label: `${option.name} - ${formatPrice(option.amount, option.currency_code)}`,
                        action: `select_delivery_${option.id}`,
                        variant: index === 0 ? "primary" : "outline"
                    })).concat([
                        {
                            id: "get_recommendation",
                            label: "Get Recommendation",
                            action: "get_delivery_recommendation",
                            variant: "secondary"
                        }
                    ]),
                    showActions: true,
                    timestamp: new Date()
                }
                setMessages(prev => [...prev, optionsMessage])
            } else {
                const errorMessage: Message = {
                    id: Date.now().toString(),
                    type: "bot",
                    content: result.error || "Sorry, I couldn't retrieve delivery options. Please try again.",
                    timestamp: new Date()
                }
                setMessages(prev => [...prev, errorMessage])
            }
        } catch (error) {
            console.error("Error getting delivery options:", error)
            const errorMessage: Message = {
                id: Date.now().toString(),
                type: "bot",
                content: "Sorry, there was an error getting delivery options. Please try again.",
                timestamp: new Date()
            }
            setMessages(prev => [...prev, errorMessage])
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
                        },
                        {
                            id: "view_cart",
                            label: "View Cart",
                            action: "view_cart",
                            variant: "outline"
                        }
                    ],
                    showActions: true,
                    timestamp: new Date()
                }
                setMessages(prev => [...prev, successMessage])
            } else {
                const errorMessage: Message = {
                    id: Date.now().toString(),
                    type: "bot",
                    content: `❌ ${result.error}`,
                    timestamp: new Date()
                }
                setMessages(prev => [...prev, errorMessage])
            }
        } catch (error) {
            console.error("Error selecting delivery method:", error)
            const errorMessage: Message = {
                id: Date.now().toString(),
                type: "bot",
                content: "Sorry, there was an error selecting the delivery method. Please try again.",
                timestamp: new Date()
            }
            setMessages(prev => [...prev, errorMessage])
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
Delivery: ${result.recommendation.estimated_delivery}
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
                setMessages(prev => [...prev, recommendationMessage])
            } else {
                const errorMessage: Message = {
                    id: Date.now().toString(),
                    type: "bot",
                    content: result.error || "Sorry, I couldn't get a delivery recommendation. Please try again.",
                    timestamp: new Date()
                }
                setMessages(prev => [...prev, errorMessage])
            }
        } catch (error) {
            console.error("Error getting delivery recommendation:", error)
            const errorMessage: Message = {
                id: Date.now().toString(),
                type: "bot",
                content: "Sorry, there was an error getting a delivery recommendation. Please try again.",
                timestamp: new Date()
            }
            setMessages(prev => [...prev, errorMessage])
        }
    }

    const formatPrice = (amount: number, currency: string): string => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency.toUpperCase()
        }).format(amount / 100)
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
   Security: ${option.security}
   Processing: ${option.processing_time}
   ${option.fee ? `Fee: ${option.fee}` : 'No additional fees'}`
).join('\n\n')}

Which payment method would you prefer?`,
                    actions: result.paymentOptions.map((option, index) => ({
                        id: `select_payment_${option.id}`,
                        label: option.name,
                        action: `select_payment_${option.id}`,
                        variant: index === 0 ? "primary" : "outline"
                    })).concat([
                        {
                            id: "get_payment_recommendation",
                            label: "Get Recommendation",
                            action: "get_payment_recommendation",
                            variant: "secondary"
                        }
                    ]),
                    showActions: true,
                    timestamp: new Date()
                }
                setMessages(prev => [...prev, optionsMessage])
            } else {
                const errorMessage: Message = {
                    id: Date.now().toString(),
                    type: "bot",
                    content: result.error || "Sorry, I couldn't retrieve payment options. Please try again.",
                    timestamp: new Date()
                }
                setMessages(prev => [...prev, errorMessage])
            }
        } catch (error) {
            console.error("Error getting payment options:", error)
            const errorMessage: Message = {
                id: Date.now().toString(),
                type: "bot",
                content: "Sorry, there was an error getting payment options. Please try again.",
                timestamp: new Date()
            }
            setMessages(prev => [...prev, errorMessage])
        }
    }

    const handlePaymentRecommendation = async (preference: "secure" | "fast" | "popular" | "simple" = "secure") => {
        try {
            const result = await getPaymentRecommendationFromChatbot({ preference })
            
            if (result.success && result.recommendation) {
                const recommendationMessage: Message = {
                    id: Date.now().toString(),
                    type: "bot",
                    content: `🎯 ${result.reasoning}

**${result.recommendation.name}**
${result.recommendation.description}
Security: ${result.recommendation.security}
Processing: ${result.recommendation.processing_time}
${result.recommendation.fee ? `Fee: ${result.recommendation.fee}` : 'No additional fees'}

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
                setMessages(prev => [...prev, recommendationMessage])
            } else {
                const errorMessage: Message = {
                    id: Date.now().toString(),
                    type: "bot",
                    content: result.error || "Sorry, I couldn't get a payment recommendation. Please try again.",
                    timestamp: new Date()
                }
                setMessages(prev => [...prev, errorMessage])
            }
        } catch (error) {
            console.error("Error getting payment recommendation:", error)
            const errorMessage: Message = {
                id: Date.now().toString(),
                type: "bot",
                content: "Sorry, there was an error getting a payment recommendation. Please try again.",
                timestamp: new Date()
            }
            setMessages(prev => [...prev, errorMessage])
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
                setMessages(prev => [...prev, selectionMessage])
            } else {
                const errorMessage: Message = {
                    id: Date.now().toString(),
                    type: "bot",
                    content: result.error || "Sorry, I couldn't retrieve payment options. Please try again.",
                    timestamp: new Date()
                }
                setMessages(prev => [...prev, errorMessage])
            }
        } catch (error) {
            console.error("Error getting payment options:", error)
            const errorMessage: Message = {
                id: Date.now().toString(),
                type: "bot",
                content: "Sorry, there was an error getting payment options. Please try again.",
                timestamp: new Date()
            }
            setMessages(prev => [...prev, errorMessage])
        }
    }

    const handleSelectPaymentMethod = async (paymentProviderId: string) => {
        try {
            const result = await selectPaymentMethodFromChatbot(paymentProviderId)
            
            if (result.success) {
                const successMessage: Message = {
                    id: Date.now().toString(),
                    type: "bot",
                    content: `✅ ${result.message}`,
                    actions: [
                        {
                            id: "proceed_to_payment",
                            label: "Complete Payment",
                            action: "proceed_to_payment",
                            variant: "primary"
                        },
                        {
                            id: "view_cart",
                            label: "View Cart",
                            action: "view_cart",
                            variant: "outline"
                        }
                    ],
                    showActions: true,
                    timestamp: new Date()
                }
                setMessages(prev => [...prev, successMessage])
            } else {
                const errorMessage: Message = {
                    id: Date.now().toString(),
                    type: "bot",
                    content: `❌ ${result.error}`,
                    timestamp: new Date()
                }
                setMessages(prev => [...prev, errorMessage])
            }
        } catch (error) {
            console.error("Error selecting payment method:", error)
            const errorMessage: Message = {
                id: Date.now().toString(),
                type: "bot",
                content: "Sorry, there was an error selecting the payment method. Please try again.",
                timestamp: new Date()
            }
            setMessages(prev => [...prev, errorMessage])
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
                setMessages(prev => [...prev, successMessage])
                
                // Store the confirmation URL for the view order action
                if (result.confirmationUrl) {
                    localStorage.setItem(`order_confirmation_${result.orderId}`, result.confirmationUrl)
                }
            } else {
                const errorMessage: Message = {
                    id: Date.now().toString(),
                    type: "bot",
                    content: `❌ ${result.error}`,
                    actions: [
                        {
                            id: "review_cart",
                            label: "Review Cart",
                            action: "review_order_details",
                            variant: "primary"
                        },
                        {
                            id: "continue_checkout",
                            label: "Continue Checkout",
                            action: "continue_to_payment",
                            variant: "outline"
                        }
                    ],
                    showActions: true,
                    timestamp: new Date()
                }
                setMessages(prev => [...prev, errorMessage])
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
            setMessages(prev => [...prev, errorMessage])
        }
    }

    const handleAddressExtraction = (addressData: AddressData, missingFields: string[]) => {
        // Store address data in localStorage for form auto-fill
        localStorage.setItem("chatbot_address_data", JSON.stringify(addressData))

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
            setMessages(prev => [...prev, followUpMessage])
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
                window.location.href = "/checkout"
                break
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
                    setMessages(prev => [...prev, addressPrompt])
                } else {
                    // Already have address, proceed to checkout
                    window.location.href = "/checkout?step=address"
                }
                break
            case "provide_address":
                setCollectingAddress(true)
                const addressQuestion: Message = {
                    id: Date.now().toString(),
                    type: "bot",
                    content: "Perfect! Please provide your shipping address. You can include your name, street address, city, postal code, and country.",
                    suggestions: [
                        "John Doe, 123 Main St, New York, NY 10001, USA",
                        "My address is..."
                    ],
                    timestamp: new Date()
                }
                setMessages(prev => [...prev, addressQuestion])
                break
            case "skip_address":
                window.location.href = "/checkout?step=address"
                break
            case "browse_products":
                window.location.href = "/store"
                break
            case "fill_form":
                const addressDataStr = localStorage.getItem("chatbot_address_data")
                if (addressDataStr) {
                    const addressData = JSON.parse(addressDataStr)
                    console.log("Address data to fill:", addressData)

                    // Small delay to ensure page is fully loaded
                    setTimeout(() => {
                        fillCheckoutForm(addressData)
                    }, 100)

                    localStorage.removeItem("chatbot_address_data")
                } else {
                    const errorMsg: Message = {
                        id: Date.now().toString(),
                        type: "bot",
                        content: "⚠️ No address data found. Please provide your address first.",
                        timestamp: new Date()
                    }
                    setMessages(prev => [...prev, errorMsg])
                }
                break
            case "manual_entry":
                localStorage.removeItem("chatbot_address_data")
                sessionStorage.removeItem("chatbot_partial_address")
                sessionStorage.setItem("chatbot_collecting_address", "false")
                setPartialAddress({})
                setCollectingAddress(false)
                const message: Message = {
                    id: Date.now().toString(),
                    type: "bot",
                    content: "No problem! Let me know if you need any help.",
                    timestamp: new Date()
                }
                setMessages(prev => [...prev, message])
                break
            case "clear_chat":
                // Clear all chat data
                sessionStorage.removeItem("chatbot_messages")
                sessionStorage.removeItem("chatbot_conversation_id")
                sessionStorage.removeItem("chatbot_partial_address")
                sessionStorage.removeItem("chatbot_collecting_address")
                localStorage.removeItem("chatbot_address_data")
                setMessages([
                    {
                        id: "welcome",
                        type: "bot",
                        ...getWelcomeMessage(),
                        timestamp: new Date()
                    }
                ])
                setConversationId(null)
                setPartialAddress({})
                setCollectingAddress(false)
                break
            case "view_delivery_options":
                handleDeliveryOptions()
                break
            case "get_delivery_recommendation":
                handleDeliveryRecommendation("cost")
                break
            case "proceed_to_payment":
                window.location.href = "/checkout?step=payment"
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
                    const confirmationUrl = localStorage.getItem(`order_confirmation_${orderId}`)
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
            return
        }

        // Fallback to DOM manipulation if API fails
        console.log("API approach failed, falling back to DOM manipulation")
        fillViaDOMManipulation(addressData)
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

            // Use the existing /api/chatbot/cart route which handles cart ID from cookies
            const response = await fetch("/api/chatbot/cart", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    action: "update_address",
                    shipping_address: formattedAddress,
                    billing_address: formattedAddress, // Use same address for billing
                    email: addressData.email || ""
                })
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                console.error("API Error:", response.status, errorData)
                
                let errorMessage = "Failed to update shipping address."
                if (response.status === 400) {
                    errorMessage = "Invalid address information provided."
                } else if (response.status === 404) {
                    errorMessage = "Cart not found. Please refresh the page and try again."
                } else if (response.status === 500) {
                    errorMessage = "Server error. Please try again later."
                }
                
                const botErrorMessage: Message = {
                    id: Date.now().toString(),
                    type: "bot",
                    content: `⚠️ ${errorMessage}`,
                    timestamp: new Date()
                }
                setMessages(prev => [...prev, botErrorMessage])
                return false
            }

            const result = await response.json()
            console.log("Cart updated successfully:", result)

            if (result.success) {
                // Show success message
                const successMessage: Message = {
                    id: Date.now().toString(),
                    type: "bot",
                    content: "✅ Address saved successfully! The page will refresh to show your updated information.",
                    timestamp: new Date()
                }
                setMessages(prev => [...prev, successMessage])

                // Refresh the page to show updated address
                setTimeout(() => {
                    window.location.reload()
                }, 1500)

                return true
            } else {
                const errorMessage: Message = {
                    id: Date.now().toString(),
                    type: "bot",
                    content: `⚠️ ${result.error || "Failed to update shipping address. Please try again."}`,
                    timestamp: new Date()
                }
                setMessages(prev => [...prev, errorMessage])
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
            setMessages(prev => [...prev, errorMessage])
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
        setMessages(prev => [...prev, successMessage])

        console.log(`Filled ${filledCount} fields`)
    }

    // Load cart count from localStorage or API
    useEffect(() => {
        const loadCartCount = () => {
            const count = parseInt(localStorage.getItem("cart_count") || "0")
            setCartItemCount(count)
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
                                message={message} 
                                onSuggestionClick={handleSuggestionClick}
                                onActionClick={(action) => handleActionClick(action.action)}
                                onAddToCart={handleAddToCart}
                            />
                        ))}
                        {isLoading && (
                            <div className="flex items-center space-x-2 text-gray-500">
                                <div className="animate-bounce">●</div>
                                <div className="animate-bounce delay-100">●</div>
                                <div className="animate-bounce delay-200">●</div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="p-4 border-t">
                        <form
                            onSubmit={(e) => {
                                e.preventDefault()
                                sendMessage(input)
                            }}
                            className="flex space-x-2"
                        >
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Type your message..."
                                className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                disabled={isLoading}
                            />
                            <button
                                type="submit"
                                disabled={isLoading || !input.trim()}
                                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                            >
                                Send
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </>
    )
}

// ...
