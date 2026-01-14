import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function POST(
    req: Request,
    { params }: { params: Promise<{ courseId: string }> }
) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || !session.user) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const { courseId } = await params;

        if (!courseId) {
            return new NextResponse("Invalid Course ID", { status: 400 });
        }

        const existingFavorite = await prisma.favorite.findUnique({
            where: {
                userId_courseId: {
                    userId: session.user.id,
                    courseId: courseId
                }
            }
        });

        if (existingFavorite) {
            await prisma.favorite.delete({
                where: {
                    id: existingFavorite.id
                }
            });
            return NextResponse.json({ isFavorited: false });
        } else {
            await prisma.favorite.create({
                data: {
                    userId: session.user.id,
                    courseId: courseId
                }
            });
            return NextResponse.json({ isFavorited: true });
        }
    } catch (error) {
        console.error("[COURSE_FAVORITE]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
