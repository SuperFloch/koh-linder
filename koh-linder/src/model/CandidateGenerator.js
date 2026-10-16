import { Candidate, Character } from "./Character";

function randInt(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
}
function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
}
function normalizeName(name) {
    return name.trim().toLowerCase();
}
function shuffle(list) {
    var arr = list.slice();
    for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * Génère le casting d'une partie : le joueur, `reserveCharacterCount` personnages tirés de la réserve (Rare, Mythique,
 * Légendaire) et des profils aléatoires (prénom, sexe, métier, âge, attributs) pour compléter.
 * @param {Character[]} characters réserve de personnages (ceux qui ont une `rarity`)
 * @param {Object} resources ressources chargées (generation, firstnames_male, firstnames_female, jobs)
 * @param {Character} playerCharacter personnage incarné
 * @returns {Candidate[]} candidats mélangés, le joueur est marqué isPlayer
 */
function generateCandidates(characters, resources, playerCharacter) {
    const rules = resources.generation;

    const player = new Candidate(playerCharacter);
    player.isPlayer = true;

    // Toujours autant d'hommes que de femmes (si l'effectif est impair, un homme de plus)
    const maxPerSex = { M: Math.ceil(rules.candidateCount / 2), F: Math.floor(rules.candidateCount / 2) };
    const sexCount = { M: 0, F: 0 };
    sexCount[player.sex]++;

    // Les personnages de la réserve (Rare, Mythique, Légendaire) ne doivent pas partager un prénom avec le joueur ou entre eux,
    // ni faire dépasser la moitié d'un sexe
    const reserveCandidates = [];
    const takenNames = [normalizeName(playerCharacter.name)];
    shuffle(characters.filter((c) => c.rarity && c.id !== playerCharacter.id)).forEach((c) => {
        if (reserveCandidates.length < rules.reserveCharacterCount && !takenNames.includes(normalizeName(c.name)) && sexCount[c.sex] < maxPerSex[c.sex]) {
            reserveCandidates.push(new Candidate(c));
            takenNames.push(normalizeName(c.name));
            sexCount[c.sex]++;
        }
    });

    const candidates = [player, ...reserveCandidates];
    const generated = [];
    const usedNames = candidates.map((c) => c.name);
    // Sexes restants à générer, dans un ordre aléatoire
    const sexesToGenerate = shuffle([
        ...Array(maxPerSex.M - sexCount.M).fill("M"),
        ...Array(maxPerSex.F - sexCount.F).fill("F")
    ]);
    for (var i = 0; i < sexesToGenerate.length; i++) {
        const candidate = generateProfile(resources, usedNames, i, sexesToGenerate[i]);
        usedNames.push(candidate.name);
        generated.push(candidate);
        candidates.push(candidate);
    }

    enforceAgeQuota(candidates, generated, rules.age);
    return shuffle(candidates);
}

/**
 * Prénom aléatoire du sexe demandé, différent de ceux de `usedNames` (comparaison insensible à la casse).
 */
function randomFirstName(resources, sex, usedNames) {
    const sameSex = sex == "M" ? resources.firstnames_male.values : resources.firstnames_female.values;
    const otherSex = sex == "M" ? resources.firstnames_female.values : resources.firstnames_male.values;
    const taken = (usedNames || []).map(normalizeName);
    const isFree = (n) => !taken.includes(normalizeName(n));
    // Jamais de doublon de prénom : on pioche dans les prénoms du sexe, puis dans l'autre liste en dernier recours
    var available = sameSex.filter(isFree);
    if (!available.length) {
        available = otherSex.filter(isFree);
    }
    if (!available.length) {
        throw new Error("Pas assez de prénoms différents dans les ressources pour générer le casting");
    }
    return pick(available);
}
/** Métier aléatoire sous ses deux formes { m, f } (permet de ré-accorder le métier si le sexe change). */
function randomJobEntry(resources) {
    return pick(resources.jobs.values);
}
/** Métier aléatoire, accordé au sexe. */
function randomJob(resources, sex) {
    return randomJobEntry(resources)[sex == "M" ? "m" : "f"];
}
/** Âge aléatoire entre les bornes de generation.json. */
function randomAge(resources) {
    return randInt(resources.generation.age.min, resources.generation.age.max);
}

function generateProfile(resources, usedNames, index, sex) {
    const rules = resources.generation;
    const attrs = {};
    ["STR", "INT", "SWI", "AGI", "OBS", "SOC"].forEach((a) => {
        attrs[a] = randInt(rules.attributes.min, rules.attributes.max);
    });
    return new Candidate({
        id: "gen_" + index,
        name: randomFirstName(resources, sex, usedNames),
        sex: sex,
        age: randomAge(resources),
        job: randomJob(resources, sex),
        rarity: null,
        attributes: attrs
    });
}

/**
 * Personnage jouable aléatoire (sexe, prénom, métier, âge et attributs tirés au hasard), pour lancer une partie de test.
 * @returns {Character}
 */
function randomCharacter(resources) {
    const sex = Math.random() < 0.5 ? "M" : "F";
    const profile = generateProfile(resources, [], 0, sex);
    return new Character({
        id: "debug_player", name: profile.name, sex: profile.sex, age: profile.age, job: profile.job, attributes: profile.attributes
    });
}

/**
 * Garantit au moins `minYoung` candidats < youngBelow et `minOld` candidats > oldAbove.
 * Seuls les profils générés sont modifiés (le joueur et les personnages de la réserve gardent leur âge).
 */
function enforceAgeQuota(all, generated, rule) {
    const isYoung = (c) => c.age < rule.youngBelow;
    const isOld = (c) => c.age > rule.oldAbove;
    const count = (fn) => all.filter(fn).length;

    const fix = (isTarget, minCount, otherIsTarget, otherMin, min, max) => {
        while (count(isTarget) < minCount) {
            // On préfère modifier un profil qui ne compte dans aucun quota, sinon un profil en surplus de l'autre quota
            var candidates = generated.filter((c) => !isTarget(c) && !otherIsTarget(c));
            if (!candidates.length) {
                candidates = generated.filter((c) => !isTarget(c) && count(otherIsTarget) > otherMin);
            }
            if (!candidates.length) {
                console.warn("Impossible de respecter le quota d'âges");
                return;
            }
            pick(candidates).age = randInt(min, max);
        }
    };
    fix(isYoung, rule.minYoung, isOld, rule.minOld, rule.min, rule.youngBelow - 1);
    fix(isOld, rule.minOld, isYoung, rule.minYoung, rule.oldAbove + 1, rule.max);
}

export { generateCandidates, randomCharacter, randomFirstName, randomJob, randomJobEntry, randomAge, randInt, pick, shuffle }
