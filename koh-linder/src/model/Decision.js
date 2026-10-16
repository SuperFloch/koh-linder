import { shuffle } from "./CandidateGenerator";

/**
 * Décisions des candidats non-joueurs. Un candidat qui doit en choisir un autre ne connaît ni ses stats ni ses jets :
 * seules comptent ses relations (AFF + REP ; la REP tient lieu de score perçu de ses stats : un candidat qui rate tous ses
 * jets est perçu comme mauvais, même avec 10 en STR).
 *
 * - Contexte POSITIVE (choix de coéquipier, récompense à octroyer, déclaration du vainqueur) : le MEILLEUR score gagne.
 * - Contexte NEGATIVE (vote d'élimination au conseil) : le PIRE score gagne.
 * - Décision individuelle : un seul décideur. Décision collective : les scores relationnels de tous les décideurs
 *   s'additionnent (choix de coéquipiers = décision collective de l'équipe ; vote au conseil = individuel).
 * - Un d6 est ajouté au calcul de chaque option : 1 → -3, 2 → -2, 3 → -1, 4 → +1, 5 → +2, 6 → +3.
 */
const DecisionContext = {
    POSITIVE: "POSITIVE",
    NEGATIVE: "NEGATIVE",
};

const D6_MODIFIERS = [-3, -2, -1, 1, 2, 3];

/** Lance un d6 et renvoie son modificateur (-3, -2, -1, +1, +2, +3). */
function rollD6Modifier() {
    return D6_MODIFIERS[Math.floor(Math.random() * 6)];
}

/** Score total (AFF + REP) que `decider` accorde à `target`. */
function relationScore(decider, target) {
    return decider.relationScore(target.name);
}

/** Total des AFF que les décideurs accordent à `target` (sert à départager). */
function affectionScore(deciders, target) {
    return deciders.reduce((sum, d) => sum + d.affection(target.name), 0);
}

/**
 * Choisit une option parmi `options`.
 * @param {Object} params
 * @param {Candidate[]} params.deciders un décideur (décision individuelle) ou plusieurs (collective : scores additionnés)
 * @param {Candidate[]} params.options candidats parmi lesquels choisir (le décideur lui-même est ignoré)
 * @param {string} params.context DecisionContext.POSITIVE (meilleur score) ou NEGATIVE (pire score)
 * @returns {Candidate|null}
 */
function decide({ deciders, options, context }) {
    // Comparaison par nom (les noms sont uniques) : fiable même si les objets sont enveloppés par le système réactif de Vue
    const candidates = options.filter((o) => !deciders.some((d) => d.name == o.name));
    if (!candidates.length) {
        return null;
    }
    const sign = context == DecisionContext.NEGATIVE ? -1 : 1;
    // Mélange préalable : les égalités complètes sont tranchées au hasard
    const scored = shuffle(candidates).map((option) => ({
        option,
        // Score relationnel cumulé + jet de d6 propre à cette option ; négatif = on cherche le plus bas
        score: sign * (deciders.reduce((sum, d) => sum + relationScore(d, option), 0) + rollD6Modifier()),
        affection: sign * affectionScore(deciders, option)
    }));
    scored.sort((a, b) => (b.score - a.score) || (b.affection - a.affection));
    return scored[0].option;
}

/**
 * Ordre d'affichage des candidats pour le joueur : meilleur score de relation (du point de vue du joueur) en haut ;
 * à égalité l'AFF départage, puis le sexe (priorité au sexe du joueur), puis l'ordre alphabétique. Le joueur est en tête.
 * Aucune valeur n'est exposée : seul l'ordre est visible.
 */
function sortForPlayer(player, candidates) {
    return candidates.slice().sort((a, b) => {
        if (a.name == player.name || b.name == player.name) {
            return a.name == player.name ? -1 : 1;
        }
        return (player.relationScore(b.name) - player.relationScore(a.name))
            || (player.affection(b.name) - player.affection(a.name))
            || ((b.sex == player.sex ? 1 : 0) - (a.sex == player.sex ? 1 : 0))
            || a.name.localeCompare(b.name, "fr");
    });
}

export { DecisionContext, decide, rollD6Modifier, sortForPlayer, D6_MODIFIERS }
