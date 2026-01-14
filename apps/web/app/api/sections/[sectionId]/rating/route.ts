import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// GET: Fetch current user's rating and section average
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ sectionId: string }> }
) {
    try {
        const { sectionId } = await params;
        const session = await getServerSession(authOptions);

        // Get all ratings for this section
        const ratings = await prisma.sectionRating.findMany({
            where: { sectionId },
            select: { rating: true, userId: true }
        });

        // Calculate average
        const totalRatings = ratings.length;
        const averageRating = totalRatings > 0
            ? ratings.reduce((sum, r) => sum + r.rating, 0) / totalRatings
            : 0;

        // Get user's rating if logged in
        let userRating = null;
        if (session?.user?.id) {
            const userRatingRecord = ratings.find(r => r.userId === session.user.id);
            userRating = userRatingRecord?.rating || null;
        }

        return NextResponse.json({
            userRating,
            averageRating,
            totalRatings
        });
    } catch (error) {
        console.error("Error fetching rating:", error);
        return NextResponse.json(
            { error: "Erreur lors de la récupération de la note" },
            { status: 500 }
        );
    }
}

// POST: Submit or update rating
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ sectionId: string }> }
) {
    try {
        const { sectionId } = await params;
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Vous devez être connecté pour noter" },
                { status: 401 }
            );
        }

        const { rating } = await request.json();

        // Validate rating
        if (!rating || rating < 1 || rating > 5) {
            return NextResponse.json(
                { error: "La note doit être entre 1 et 5" },
                { status: 400 }
            );
        }

        // Upsert the rating (create or update)
        await prisma.sectionRating.upsert({
            where: {
                sectionId_userId: {
                    sectionId,
                    userId: session.user.id
                }
            },
            update: { rating },
            create: {
                sectionId,
                userId: session.user.id,
                rating
            }
        });

        // Get updated stats
        const ratings = await prisma.sectionRating.findMany({
            where: { sectionId },
            select: { rating: true }
        });

        const totalRatings = ratings.length;
        const averageRating = ratings.reduce((sum, r) => sum + r.rating, 0) / totalRatings;

        return NextResponse.json({
            success: true,
            averageRating,
            totalRatings
        });
    } catch (error) {
        console.error("Error submitting rating:", error);
        return NextResponse.json(
            { error: "Erreur lors de la soumission de la note" },
            { status: 500 }
        );
    }
}
