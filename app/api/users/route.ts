// app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { clerkClient, User } from '@clerk/nextjs/server';

export async function POST(req: NextRequest) {
  try {
    const { userIds } = await req.json();
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ error: 'Invalid userIds' }, { status: 400 });
    }

    // Await clerkClient() and access users.getUserList
    const client = await clerkClient();
    const usersResponse = await client.users.getUserList({ userId: userIds });
    const userData = usersResponse.data.map((user: User) => ({
      id: user.id,
      profileImageUrl: user.imageUrl, // Updated to match Clerk v5 User type
    }));

    return NextResponse.json(userData);
  } catch (error) {
    console.error('Error fetching users from Clerk:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}