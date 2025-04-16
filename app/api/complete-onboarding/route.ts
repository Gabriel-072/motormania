import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

    const clerkSecretKey = process.env.CLERK_SECRET_KEY;
    if (!clerkSecretKey) {
      return NextResponse.json({ error: "Clerk secret key not configured" }, { status: 500 });
    }

    const response = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${clerkSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        public_metadata: { onboardingComplete: true },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update Clerk metadata: ${errorText}`);
    }

    return NextResponse.json({ message: "Onboarding metadata updated" });
  } catch (error) {
    console.error("Error updating Clerk metadata:", error);
    return NextResponse.json({ error: "Failed to update metadata" }, { status: 500 });
  }
}