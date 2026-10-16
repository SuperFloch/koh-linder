import { Card } from "src/model/Card";

/**
 * Lecture / écriture du dossier de contenu (public/content) depuis l'éditeur, sans backend ni Electron.
 * Utilise la File System Access API (Chrome / Edge) : l'utilisateur choisit le dossier `content`,
 * le navigateur lit et écrit directement dedans.
 * Repli pour les autres navigateurs : export des fichiers par téléchargement.
 */

function isSupported() {
    return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

/**
 * Demande à l'utilisateur de choisir le dossier `content` (celui qui contient manifest.json).
 */
async function openContentFolder() {
    const handle = await window.showDirectoryPicker({ mode: "readwrite" });
    try {
        await handle.getFileHandle("manifest.json");
    } catch (e) {
        throw new Error("Ce dossier ne contient pas de manifest.json : choisissez le dossier public/content.");
    }
    return handle;
}

async function getDir(root, parts, create) {
    var dir = root;
    for (const part of parts) {
        dir = await dir.getDirectoryHandle(part, { create });
    }
    return dir;
}

async function readJson(root, path) {
    const parts = path.split("/");
    const name = parts.pop();
    const dir = await getDir(root, parts, false);
    const file = await (await dir.getFileHandle(name)).getFile();
    return JSON.parse(await file.text());
}

async function writeJson(root, path, data) {
    const parts = path.split("/");
    const name = parts.pop();
    const dir = await getDir(root, parts, true);
    const writable = await (await dir.getFileHandle(name, { create: true })).createWritable();
    await writable.write(JSON.stringify(data, null, 4));
    await writable.close();
}

function themeFileName(theme) {
    return "cards/" + theme.toLowerCase() + ".json";
}

// Fichier d'où vient chaque thème (ex: EPREUVE_NAGE -> cards/challenges/epreuve_nage.json), pour réécrire au même endroit
const themePaths = {};

async function readCards(root) {
    const manifest = await readJson(root, "manifest.json");
    const files = await Promise.all((manifest.cards || []).map((f) => readJson(root, f)));
    const cards = [];
    files.forEach((file, i) => file.cards.forEach((c) => {
        cards.push(Card.deserialize(c));
        if (!themePaths[c.theme]) {
            themePaths[c.theme] = manifest.cards[i];
        }
    }));
    return cards;
}

function themePath(theme) {
    return themePaths[theme] || themeFileName(theme);
}

/**
 * Écrit un fichier par thème (au même endroit que lu : cards/ ou cards/challenges/) et met à jour la liste `cards` du manifest,
 * en conservant ses autres clés (catalogue des épreuves, personnages, ressources...).
 * @param grouped { THEME: [Card] }
 */
async function saveCards(root, grouped) {
    const manifest = await readJson(root, "manifest.json");
    const themes = Object.keys(grouped);
    // Plusieurs thèmes peuvent partager un fichier : on regroupe par fichier avant d'écrire
    const byPath = {};
    themes.forEach((theme) => {
        const path = themePath(theme);
        byPath[path] = (byPath[path] || []).concat(grouped[theme]);
    });
    for (const path of Object.keys(byPath)) {
        await writeJson(root, path, { cards: byPath[path] });
    }
    manifest.cards = Object.keys(byPath);
    await writeJson(root, "manifest.json", manifest);
}

/**
 * Repli sans File System Access API : télécharge un fichier JSON par thème.
 * À copier à la main dans public/content/cards (et à déclarer dans manifest.json).
 */
function downloadCards(grouped) {
    Object.keys(grouped).forEach((theme) => {
        const blob = new Blob([JSON.stringify({ cards: grouped[theme] }, null, 4)], { type: "application/json" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = theme.toLowerCase() + ".json";
        link.click();
        URL.revokeObjectURL(link.href);
    });
}

function groupByTheme(cards) {
    var ret = {};
    cards.forEach((c) => {
        if (ret[c.theme] == undefined) {
            ret[c.theme] = [];
        }
        ret[c.theme].push(c);
    });
    return ret;
}

export { isSupported, openContentFolder, readCards, saveCards, downloadCards, groupByTheme }
