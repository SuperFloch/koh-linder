/**
 * Étapes de transport d'une lourde charge par toute une équipe, communes aux épreuves « Les flambeaux » et « La bobine ».
 * Une étape est jouée par une épreuve d'équipe (`TeamRace`) : `race` fournit `positions`, `params`, `teamRoll`, `jointRoll`,
 * `teamSegment` et `teamLabel`.
 */
const CarryStep = {
    CARRY: "CARRY",       // course avec charge commune : jet joint de STR de toute l'équipe
    DOOR: "DOOR",         // porte nouée : jet d'INT des 2 meilleurs en INT
    OBSTACLE: "OBSTACLE"  // obstacle avec charge : jet joint d'AGI de toute l'équipe
};
const { CARRY, DOOR, OBSTACLE } = CarryStep;

const CARRY_ICONS = { CARRY: "@crate", DOOR: "@door", OBSTACLE: "@hurdle" };

/** Paramètres (fusionnés sous ceux de chaque épreuve). */
const CARRY_PARAMS = {
    carryPerMember: 15,     // jet joint de STR de toute l'équipe : seuil par membre
    obstaclePerMember: 14,  // jet joint d'AGI de toute l'équipe : seuil par membre
    doorThreshold: 30       // jet joint d'INT des deux meilleurs en INT
};

/**
 * Joue l'étape `step` pour l'équipe `color` portée par `members` (tous les porteurs).
 * - Course avec charge : réussite +2 cases (dans la série), échec +1.
 * - Porte nouée : réussite = passée, sinon l'équipe reste devant.
 * - Obstacle avec charge : réussite = passé, sinon l'équipe reste devant.
 * @returns {string} compte rendu
 */
function actCarryStep(race, step, color, members) {
    const p = race.params;
    const n = members.length;
    const who = race.teamLabel(color);
    switch (step) {
        case CARRY: {
            const roll = race.teamRoll(members, "STR", Math.round(n * p.carryPerMember));
            const gain = roll.ok ? Math.min(2, race.teamSegment(color)) : 1;
            race.positions[color] += gain;
            return who + " porte la caisse " + roll.text + " : " + (roll.ok ? "elle avance de " + gain + (gain > 1 ? " cases !" : " case.") : "la charge est lourde, une case seulement.");
        }
        case DOOR: {
            const two = [...members].sort((a, b) => b.attributes.INT - a.attributes.INT).slice(0, 2);
            const roll = race.jointRoll(two, "INT", p.doorThreshold);
            if (roll.ok) {
                race.positions[color]++;
            }
            return who + " s'attaque à la porte nouée " + roll.text + " : " + (roll.ok ? "le nœud cède, le passage est libre !" : "le nœud résiste, l'équipe reste devant la porte.");
        }
        case OBSTACLE: {
            const roll = race.teamRoll(members, "AGI", Math.round(n * p.obstaclePerMember));
            if (roll.ok) {
                race.positions[color]++;
            }
            return who + " franchit l'obstacle avec la charge " + roll.text + " : " + (roll.ok ? "passé !" : "raté, l'équipe reste devant.");
        }
    }
    return "";
}

/** Textes du joueur pour une étape de transport : { next, left, right } (`prefix` = « Case 3/18 : »). */
function carryStepTexts(step, prefix) {
    switch (step) {
        case CARRY:
            return { next: prefix + "course avec la lourde charge (jet joint de STR de toute l'équipe).", left: "Porter ensemble", right: "Porter ensemble" };
        case DOOR:
            return { next: prefix + "une porte nouée : les deux meilleurs en INT défont la corde.", left: "Défaire le nœud", right: "Défaire le nœud" };
        case OBSTACLE:
            return { next: prefix + "un obstacle à franchir avec la charge (jet joint d'AGI de toute l'équipe).", left: "Franchir ensemble", right: "Franchir ensemble" };
    }
    return null;
}

export { CarryStep, CARRY_ICONS, CARRY_PARAMS, actCarryStep, carryStepTexts }
