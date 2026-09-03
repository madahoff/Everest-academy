import MasterclassRegistration from "@/components/masterclass-registration";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Masterclass — Everest Academy",
};

/**
 * Détail d'une Masterclass précise — celle qu'un membre ouvre depuis son profil,
 * séances passées comprises.
 *
 * Même écran que `/masterclass`, qui présente la prochaine séance : c'est le même
 * composant, à qui l'on désigne ici la séance à afficher.
 */
export default async function MasterclassDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <MasterclassRegistration masterclassId={id} />;
}
