import { STAT_ICONS } from "./Character";
/**
 * Personnalisation des textes d'action du joueur : dans les comptes rendus générés par les épreuves (« Vous nagez jusqu'au poids »),
 * « Vous » est remplacé par le prénom du candidat joueur, avec le verbe mis à la 3e personne (« Laurent nage jusqu'au poids »).
 * Le prénom est encadré de marqueurs invisibles (ME_OPEN / ME_CLOSE) que l'interface surligne (`InGamePage`, `splitMe`).
 */
const ME_OPEN = "⁣";
const ME_CLOSE = "⁤";

/** Prénom du joueur marqué pour le surlignage. */
// Marqueurs invisibles d'un label de jet de dé : ROLL_OPEN + (1 réussite / 0 échec) + stats en minuscules séparées par des virgules + ROLL_CLOSE
const ROLL_OPEN = "\u2060";
const ROLL_CLOSE = "\u2061";
// Marqueurs invisibles d'un symbole de stat (rendu en SVG par l'interface, `StatIcon.vue`) : STAT_OPEN + code + STAT_CLOSE
const STAT_OPEN = "\u206a";
const STAT_CLOSE = "\u206b";

function mark(name) {
    return ME_OPEN + name + ME_CLOSE;
}

// Verbes à la 2e personne du pluriel dont la 3e personne du singulier n'est pas obtenue par la règle générale « -ez -> -e »
const IRREGULAR = {
    "êtes": "est", "avez": "a", "faites": "fait", "dites": "dit", "allez": "va", "venez": "vient", "prenez": "prend",
    "tenez": "tient", "voulez": "veut", "pouvez": "peut", "devez": "doit", "savez": "sait", "voyez": "voit", "levez": "lève",
    "mettez": "met", "attendez": "attend", "perdez": "perd", "rendez": "rend", "entendez": "entend", "répondez": "répond",
    "aurez": "aura", "serez": "sera", "pourrez": "pourra", "ferez": "fera", "irez": "ira", "viendrez": "viendra", "verrez": "verra"
};

/** 2e personne du pluriel -> 3e personne du singulier. */
function conjugate(verb) {
    if (IRREGULAR[verb]) {
        return IRREGULAR[verb];
    }
    if (/issez$/.test(verb)) {
        return verb.replace(/issez$/, "it");
    }
    if (/[ei]rez$/.test(verb)) {
        return verb.replace(/ez$/, "a"); // futur : formerez -> formera
    }
    return verb.replace(/ez$/, "e");
}

/**
 * Remplace « Vous » (sujet) par le prénom marqué et conjugue le verbe à la 3e personne ; un « vous » restant (complément, ex.
 * « Prochain nageur : vous. ») devient simplement le prénom. Les textes qui ne parlent pas du joueur sont inchangés.
 * @param {string} text texte généré par le jeu
 * @param {string} name prénom du joueur
 */
function personalize(text, name) {
    if (!text || typeof text != "string" || !/vous/i.test(text)) {
        return text;
    }
    const me = mark(name);
    return text
        // sujet + (vous pronominal) + (particules) + verbe : « Vous vous levez », « vous n'avancez pas », « vous l'attendez »
        .replace(/\b[Vv]ous (vous )?(ne |n'|l'|y |en )?([a-zàâçéèêëîïôûùü]+)/g, (match, reflexive, clitic, verb) => {
            if (!IRREGULAR[verb] && !/(ez|tes)$/.test(verb)) {
                return match;
            }
            const conjugated = conjugate(verb);
            const particle = clitic || "";
            const vowel = /^[aeiouyâêîôûéèh]/i.test(particle ? "" : conjugated);
            const refl = reflexive ? (vowel ? "s'" : "se ") : "";
            return me + " " + refl + particle + conjugated;
        })
        .replace(/\b[Vv]ous\b/g, me);
}

/** Découpe un texte en segments { text, me } : `me` marque le prénom du joueur à surligner. */
function splitMe(text) {
    const parts = [];
    const re = new RegExp(ME_OPEN + "([^" + ME_CLOSE + "]*)" + ME_CLOSE, "g");
    var last = 0;
    var m;
    while ((m = re.exec(text)) !== null) {
        if (m.index > last) {
            parts.push({ text: text.slice(last, m.index), me: false });
        }
        parts.push({ text: m[1], me: true });
        last = m.index + m[0].length;
    }
    if (last < text.length) {
        parts.push({ text: text.slice(last), me: false });
    }
    return parts;
}

/** Retire les marqueurs (pour les textes affichés sans surlignage). */
// --- Jets de dé : le détail chiffré révèle les stats des candidats, il est remplacé par un label ---

const STAT = "(STR|INT|SWI|AGI|OBS|SOC)";
function rollToken(total, threshold, stats) {
    return ROLL_OPEN + (Number(total) >= Number(threshold) ? "1" : "0") + stats.map((s) => s.toLowerCase()).join(",") + ROLL_CLOSE;
}

/**
 * Remplace le détail chiffré des jets de dé d'un texte par un label : le symbole de la stat testée (un label par jet d'un jet joint
 * ou combiné, côte à côte), sur fond vert pour une réussite, rouge pour un échec. Formats reconnus : « (SWI 4 + d20 12 = 16 / 14) »,
 * « (jet joint de STR : vous 12 + Camille 14 = 26 / 25) », « (jet joint : A (AGI) 12 + B (STR) 14 = 26 / 27) »,
 * « (jet d'équipe de STR : 150 / 135) », « (STR + AGI : 33 / 30) », « (OBS 21 / 22) », et le détail nu de {lastRoll}.
 */
function rollLabels(text) {
    if (!text || typeof text != "string") {
        return text;
    }
    return text
        .replace(new RegExp("\\(jet joint(?: de " + STAT + ")? : (.*?) = (-?\\d+) / (-?\\d+)\\)", "g"), (m, stat, expr, total, threshold) => {
            const stats = expr.split(" + ").map((part) => {
                const own = part.match(new RegExp("\\(" + STAT + "\\)"));
                return own ? own[1] : stat;
            }).filter((s) => !!s);
            return rollToken(total, threshold, stats);
        })
        .replace(new RegExp("\\(jet d'équipe de " + STAT + " : (-?\\d+) / (-?\\d+)\\)", "g"), (m, stat, total, threshold) => rollToken(total, threshold, [stat]))
        .replace(new RegExp("\\(" + STAT + " \\+ " + STAT + " : (-?\\d+) / (-?\\d+)\\)", "g"), (m, a, b, total, threshold) => rollToken(total, threshold, [a, b]))
        .replace(new RegExp("\\(?" + STAT + " -?\\d+ \\+ d20 \\d+ = (-?\\d+) / (-?\\d+)\\)?", "g"), (m, stat, total, threshold) => rollToken(total, threshold, [stat]))
        .replace(new RegExp("\\(" + STAT + " (-?\\d+) / (-?\\d+)\\)", "g"), (m, stat, total, threshold) => rollToken(total, threshold, [stat]));
}

/** Remplace les codes de stats (STR, INT, SWI, AGI, OBS, SOC) restants par un marqueur de symbole (rendu en SVG, voir `splitRich`). */
function statSymbols(text) {
    return typeof text == "string" ? text.replace(new RegExp("\\b" + STAT + "\\b", "g"), (m, stat) => STAT_OPEN + stat + STAT_CLOSE) : text;
}
/** Texte brut sans marqueurs de symboles : le code de la stat reste lisible (pour un affichage sans SVG). */
function stripStats(text) {
    return typeof text == "string" ? text.replace(new RegExp(STAT_OPEN + STAT + STAT_CLOSE, "g"), (m, stat) => stat) : text;
}

/** Texte prêt à afficher : détail des jets remplacé par des labels, codes de stats remplacés par leurs symboles. */
function display(text) {
    return statSymbols(rollLabels(text));
}

/**
 * Découpe un texte affiché en segments : { kind: "text" | "me" | "roll" | "stat", text, ok, stats, icons, stat } (prénom du joueur à
 * surligner, labels de jets avec les stats testées et la réussite, symboles de stats).
 */
function splitRich(text) {
    const parts = [];
    const re = new RegExp("(" + ME_OPEN + "([^" + ME_CLOSE + "]*)" + ME_CLOSE + ")|(" + ROLL_OPEN + "([01])([^" + ROLL_CLOSE + "]*)" + ROLL_CLOSE + ")|" + STAT_OPEN + STAT + STAT_CLOSE, "g");
    var last = 0;
    var m;
    while ((m = re.exec(text)) !== null) {
        if (m.index > last) {
            parts.push({ kind: "text", text: text.slice(last, m.index) });
        }
        if (m[1] !== undefined) {
            parts.push({ kind: "me", text: m[2] });
        } else if (m[6] !== undefined) {
            parts.push({ kind: "stat", stat: m[6] });
        } else {
            const stats = m[5].split(",").filter((s) => s).map((s) => s.toUpperCase());
            parts.push({ kind: "roll", ok: m[4] == "1", stats, icons: stats.map((s) => STAT_ICONS[s]) });
        }
        last = m.index + m[0].length;
    }
    if (last < text.length) {
        parts.push({ kind: "text", text: text.slice(last) });
    }
    return parts;
}
function stripMarks(text) {
    return typeof text == "string" ? text.split(ME_OPEN).join("").split(ME_CLOSE).join("") : text;
}

/** Pronom sujet d'un candidat : « il » ou « elle » (`capital` : « Il » / « Elle »). */
function il(candidate, capital) {
    const word = candidate && candidate.sex == "F" ? "elle" : "il";
    return capital ? word.charAt(0).toUpperCase() + word.slice(1) : word;
}
/** Accorde un participe / adjectif masculin (« désigné », « suspendu ») au sexe du candidat. */
function accord(candidate, masculine) {
    return candidate && candidate.sex == "F" ? masculine + "e" : masculine;
}

export { personalize, mark, splitMe, splitRich, rollLabels, statSymbols, stripStats, display, stripMarks, il, accord, ME_OPEN, ME_CLOSE, ROLL_OPEN, ROLL_CLOSE, STAT_OPEN, STAT_CLOSE }
