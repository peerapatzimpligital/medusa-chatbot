import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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

interface ChatbotState {
    // UI State
    isOpen: boolean
    input: string
    isLoading: boolean
    isTyping: boolean
    
    // Chat State
    messages: Message[]
    conversationId: string | null
    quickReplies: string[]
    
    // Cart State
    cartItemCount: number
    
    // Address Collection State
    isCollectingAddress: boolean
    partialAddress: AddressData
    
    // Order Confirmation State
    orderConfirmations: Record<string, string> // orderId -> confirmationUrl
    
    // Address Data Storage (for form auto-fill)
    savedAddressData: AddressData | null
    
    // Actions
    setIsOpen: (isOpen: boolean) => void
    setInput: (input: string) => void
    setIsLoading: (isLoading: boolean) => void
    setIsTyping: (isTyping: boolean) => void
    setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void
    addMessage: (message: Message) => void
    updateMessage: (id: string, updates: Partial<Message>) => void
    setConversationId: (id: string | null) => void
    setQuickReplies: (replies: string[]) => void
    setCartItemCount: (count: number) => void
    setIsCollectingAddress: (collecting: boolean) => void
    setPartialAddress: (address: AddressData | ((prev: AddressData) => AddressData)) => void
    updatePartialAddress: (updates: Partial<AddressData>) => void
    clearPartialAddress: () => void
    
    // Order Confirmation Actions
    setOrderConfirmation: (orderId: string, confirmationUrl: string) => void
    getOrderConfirmation: (orderId: string) => string | undefined
    clearOrderConfirmations: () => void
    
    // Address Data Actions
    setSavedAddressData: (addressData: AddressData | null) => void
    getSavedAddressData: () => AddressData | null
    clearSavedAddressData: () => void
    
    // Utility Actions
    clearMessages: () => void
    clearChat: () => void
    initializeChat: () => void
    getWelcomeMessage: () => { content: string; suggestions: string[] }
}

const getWelcomeMessage = () => ({
    content: "Hi! I'm your AI shopping assistant. I'm here to help you find products, answer questions, and make your shopping experience amazing! ✨",
    suggestions: [
        "🔥 Show me popular products",
        "✅ Complete My Order"
    ]
})

export const useChatbotStore = create<ChatbotState>()(
    persist(
        (set, get) => ({
            // Initial State
            isOpen: false,
            input: "",
            isLoading: false,
            isTyping: false,
            messages: [],
            conversationId: null,
            quickReplies: [],
            cartItemCount: 0,
            isCollectingAddress: false,
            partialAddress: {},
            orderConfirmations: {},
            savedAddressData: null,
            
            // Actions
            setIsOpen: (isOpen) => set({ isOpen }),
            setInput: (input) => set({ input }),
            setIsLoading: (isLoading) => set({ isLoading }),
            setIsTyping: (isTyping) => set({ isTyping }),
            
            setMessages: (messages) => set((state) => ({
                messages: typeof messages === 'function' ? messages(state.messages) : messages
            })),
            
            addMessage: (message) => set((state) => ({
                messages: [...state.messages, message]
            })),
            
            updateMessage: (id, updates) => set((state) => ({
                messages: state.messages.map(msg => 
                    msg.id === id ? { ...msg, ...updates } : msg
                )
            })),
            
            setConversationId: (id) => set({ conversationId: id }),
            setQuickReplies: (replies) => set({ quickReplies: replies }),
            setCartItemCount: (count) => set({ cartItemCount: count }),
            setIsCollectingAddress: (collecting) => set({ isCollectingAddress: collecting }),
            
            setPartialAddress: (address) => set((state) => ({
                partialAddress: typeof address === 'function' ? address(state.partialAddress) : address
            })),
            
            updatePartialAddress: (updates) => set((state) => ({
                partialAddress: { ...state.partialAddress, ...updates }
            })),
            
            clearPartialAddress: () => set({ partialAddress: {} }),
            
            // Utility Actions
            clearMessages: () => set({ messages: [] }),
            
            clearChat: () => set({
                messages: [],
                conversationId: null,
                quickReplies: [],
                isCollectingAddress: false,
                partialAddress: {},
                input: "",
                isLoading: false,
                isTyping: false
            }),
            
            initializeChat: () => {
                const state = get()
                if (state.messages.length === 0) {
                    const welcomeMessage: Message = {
                        id: "welcome",
                        type: "bot",
                        ...getWelcomeMessage(),
                        timestamp: new Date()
                    }
                    set({ messages: [welcomeMessage] })
                }
            },
            
            getWelcomeMessage,
            
            // Order Confirmation Actions
            setOrderConfirmation: (orderId, confirmationUrl) => set((state) => ({
                orderConfirmations: { ...state.orderConfirmations, [orderId]: confirmationUrl }
            })),
            
            getOrderConfirmation: (orderId) => {
                const state = get()
                return state.orderConfirmations[orderId]
            },
            
            clearOrderConfirmations: () => set({ orderConfirmations: {} }),
            
            // Address Data Actions
            setSavedAddressData: (addressData) => set({ savedAddressData: addressData }),
            
            getSavedAddressData: () => {
                const state = get()
                return state.savedAddressData
            },
            
            clearSavedAddressData: () => set({ savedAddressData: null })
        }),
        {
            name: 'chatbot-storage',
            partialize: (state) => ({
                messages: state.messages,
                conversationId: state.conversationId,
                partialAddress: state.partialAddress,
                isCollectingAddress: state.isCollectingAddress,
                cartItemCount: state.cartItemCount,
                orderConfirmations: state.orderConfirmations,
                savedAddressData: state.savedAddressData
            })
        }
    )
)