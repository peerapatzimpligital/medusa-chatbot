interface ChatMessageProps {
    message: {
        type: "user" | "bot"
        content: string
        timestamp: Date
    }
}

export function ChatMessage({ message }: ChatMessageProps) {
    const isUser = message.type === "user"

    return (
        <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
            <div
                className={`max-w-[80%] rounded-lg p-3 ${isUser
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-800"
                    }`}
            >
                <p className="text-sm">{message.content}</p>
                <span className="text-xs opacity-70 mt-1 block">
                    {message.timestamp.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                    })}
                </span>
            </div>
        </div>
    )
}
