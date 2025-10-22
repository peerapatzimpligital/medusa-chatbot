import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const backendUrl = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

        const response = await fetch(`${backendUrl}/chatbot`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        })

        const data = await response.json()
        return NextResponse.json(data)
    } catch (error) {
        console.error("Chatbot API error:", error)
        return NextResponse.json(
            { error: "Failed to process request" },
            { status: 500 }
        )
    }
}
