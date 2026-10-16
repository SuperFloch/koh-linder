import { Card } from "src/model/Card";
import { Character } from "src/model/Character";

/**
 * Chemin du dossier de contenu, servi tel quel (non compilé) depuis public/content.
 */
const CONTENT_URL = (import.meta.env.BASE_URL || "/") + "content/";

async function fetchJson(relativePath) {
    const response = await fetch(CONTENT_URL + relativePath);
    if (!response.ok) {
        throw new Error("Impossible de charger " + relativePath + " (" + response.status + ")");
    }
    return response.json();
}

/**
 * Charge le contenu du jeu à partir de manifest.json :
 * { start, cards: [fichiers], challenges: [catalogue des épreuves], characters: [dossiers], resources: [noms] }
 * Les cartes des épreuves vivent dans cards/challenges/.
 * @returns {{start: string, cards: Card[], characters: Character[], resources: Object}}
 */
async function loadContent() {
    const manifest = await fetchJson("manifest.json");

    const cardFiles = await Promise.all((manifest.cards || []).map((f) => fetchJson(f)));
    const cards = [];
    cardFiles.forEach((file) => file.cards.forEach((c) => cards.push(Card.deserialize(c))));
    warnDuplicateIds(cards);

    const charInfos = await Promise.all((manifest.characters || []).map((dir) => fetchJson("characters/" + dir + "/infos.json")));
    const characters = charInfos.map((c) => new Character(c));

    const resources = {};
    await Promise.all((manifest.resources || []).map(async (name) => {
        resources[name] = await fetchJson("resources/" + name + ".json");
    }));

    // Catalogue des épreuves { id, name, description, context: TEAM | INDIVIDUAL, random, start, end }
    const challenges = manifest.challenges || [];
    challenges.forEach((ch) => {
        if (!cards.some((c) => c.id == ch.start)) {
            console.warn("Épreuve " + ch.id + " : carte de départ introuvable (" + ch.start + ")");
        }
    });

    return { start: manifest.start, cards, characters, resources, challenges };
}

function warnDuplicateIds(cards) {
    const seen = {};
    cards.forEach((c) => {
        if (seen[c.id]) {
            console.warn("Id de carte en double :", c.id);
        }
        seen[c.id] = true;
    });
}

export { loadContent, CONTENT_URL }
