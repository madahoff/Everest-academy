import MasterclassRegistration from "@/components/masterclass-registration";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Prochaine Masterclass — Everest Academy",
    description: "Inscrivez-vous à la Masterclass du mois : date, formateur, tarif et inscription en ligne.",
};

/**
 * Destination unique du parcours d'inscription : la navbar, l'accueil et le
 * catalogue y renvoient tous. Un seul écran encaisse, un seul écran confirme.
 */
export default function MasterclassPage() {
    return <MasterclassRegistration />;
}
