// Teintes du paysage de fond (design « Braise · Planche », voir Maquette/README.md)

/** Ciel des épreuves (et de l'introduction) : toujours bleu clair. */
const CHALLENGE_SKY = '#8fd3e8';

/** Ciel du camp selon la période de la journée. */
const CAMP_SKY = {
    WAKE: '#f2b07e',
    MORNING: '#9ad6ea',
    NOON: '#74c6ec',
    AFTERNOON: '#8cc7e0',
    EVENING: '#e98a5c',
    NIGHT: '#1b2f55'
};

const CAMP_SUN = {
    WAKE: '#ffe2a8',
    MORNING: '#fff4cf',
    NOON: '#ffffff',
    AFTERNOON: '#fff4cf',
    EVENING: '#ffcf7a',
    NIGHT: '#e8e4d0'
};

/** Voile assombrissant le paysage (lisibilité le soir et la nuit). */
const CAMP_SHADE = {
    EVENING: 'rgba(60, 20, 10, 0.12)',
    NIGHT: 'rgba(10, 20, 40, 0.35)'
};

/**
 * Teintes d'une scène : `variant` = 'beach' (épreuve, intro) ou 'camp' ; `period` = période en cours (camp uniquement).
 */
function sceneColors(variant, period) {
    if (variant != 'camp') {
        return { sky: CHALLENGE_SKY, sun: '#fff4cf', shade: 'transparent' };
    }
    const p = CAMP_SKY[period] ? period : 'MORNING';
    return { sky: CAMP_SKY[p], sun: CAMP_SUN[p], shade: CAMP_SHADE[p] || 'transparent' };
}

export { sceneColors, CHALLENGE_SKY };
