/**
 * Profil du joueur, conservé entre les parties dans le navigateur (localStorage) : Koh-points et personnages débloqués.
 * Un Koh-point = un jour de survie dans l'aventure ; ils se dépensent dans la galerie des aventuriers.
 * Le stockage peut être indisponible (navigation privée...) : le profil fonctionne alors le temps de la session.
 */
const STORAGE_KEY = "kohlinder.profile";

function defaultProfile() {
    return { kohPoints: 0, unlockedIds: [] };
}

function loadProfile() {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const data = JSON.parse(raw);
            return {
                kohPoints: Math.max(0, Number(data.kohPoints) || 0),
                unlockedIds: Array.isArray(data.unlockedIds) ? data.unlockedIds : []
            };
        }
    } catch (e) {
        console.warn("Profil illisible, démarrage d'un profil vierge", e);
    }
    return defaultProfile();
}

function saveProfile(profile) {
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ kohPoints: profile.kohPoints, unlockedIds: profile.unlockedIds }));
    } catch (e) {
        console.warn("Profil non sauvegardé", e);
    }
}

/** Un personnage est jouable s'il est gratuit ou déjà débloqué. */
function isUnlocked(profile, character) {
    return character.unlockCost == 0 || profile.unlockedIds.includes(character.id);
}

/**
 * Débloque un personnage en échange de Koh-points.
 * @returns {boolean} false si déjà débloqué ou pas assez de Koh-points
 */
function unlockCharacter(profile, character) {
    if (isUnlocked(profile, character) || profile.kohPoints < character.unlockCost) {
        return false;
    }
    profile.kohPoints -= character.unlockCost;
    profile.unlockedIds.push(character.id);
    saveProfile(profile);
    return true;
}

function addKohPoints(profile, amount) {
    profile.kohPoints += Math.max(0, Number(amount) || 0);
    saveProfile(profile);
}

export { loadProfile, saveProfile, isUnlocked, unlockCharacter, addKohPoints }
