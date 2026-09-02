import { NextResponse } from "next/server"
import { auth } from "@/auth"

/**
 * Garde d'accès des routes API de la console d'administration.
 *
 * Les PAGES sont protégées par `app/(dashboard)/layout.tsx`, qui redirige vers la
 * connexion. Les routes API, elles, ne traversent aucun layout : sans garde explicite
 * elles répondent à n'importe qui sur Internet — la console est exposée publiquement
 * sur admin.academy.pro-everest.com.
 *
 * Le contrôle de rôle est redondant avec `authorize` d'auth.ts, qui refuse déjà toute
 * session non-ADMIN. Il est conservé : une session ne doit pas devenir un blanc-seing
 * si un second fournisseur est ajouté un jour.
 *
 * Retourne `null` quand l'appel est autorisé, sinon la réponse d'erreur à renvoyer
 * telle quelle — le point d'appel reste ainsi une seule ligne.
 */
export async function requireAdmin(): Promise<NextResponse | null> {
    const session = await auth()

    if (!session?.user) {
        return NextResponse.json(
            { error: "unauthorized", message: "Connexion requise" },
            { status: 401 },
        )
    }

    if ((session.user as { role?: string }).role !== "ADMIN") {
        return NextResponse.json(
            { error: "forbidden", message: "Accès réservé aux administrateurs" },
            { status: 403 },
        )
    }

    return null
}
