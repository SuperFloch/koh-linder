import { pick, shuffle, randInt } from "../CandidateGenerator";
import { RelationGauge } from "../Character";
import { HistoryType } from "../GameHistory";
import { fill, visibleTo, PitchKind } from "./Tractation";
import { mark } from "../Personalize";
import { Challenge } from "../challenges/Challenge";

const DENIS = "Denis Brognard";
const ORDINALS = ["premier", "deuxième", "troisième", "quatrième", "cinquième", "sixième", "septième", "huitième", "neuvième", "dixième",
    "onzième", "douzième", "treizième", "quatorzième", "quinzième", "seizième", "dix-septième", "dix-huitième", "dix-neuvième", "vingtième"];
const COLOR_LABELS = { RED: "Rouges", YELLOW: "Jaunes" };

const DEFAULT_PARAMS = {
    receivedVotesAff: -4,   // AFF d'un candidat qui a reçu des votes mais reste en jeu, envers chaque votant (échelle : vote sans élimination)
    keptPactAff: 4,         // AFF mutuelle d'une alliance tenue (alliance de confiance lors d'un conseil)
    brokenPactAff: -4,      // AFF d'un allié trahi envers le joueur
    summaryDays: 3,         // jours résumés par Denis
    comments: 3             // candidats qui prennent la parole avant le vote
};

/**
 * Le conseil. Chaque candidat de l'équipe qui n'a pas gagné l'immunité (ou toute la tribu après la réunification) vote pour celui qu'il
 * veut éliminer ; la majorité l'emporte, une égalité se règle par un tirage au sort (boules noire et blanche).
 *
 * Déroulé (cartes générées, une carte `CHALLENGE_TURN` rejouée, voir cards/council.json) : arrivée · résumé des trois derniers jours par
 * Denis · quelques commentaires · rappel des protections · vote du joueur (clic sur un portrait, puis swipe) · urne et question sur les
 * colliers d'immunité (non implémentés : personne n'en joue) · dépouillement dans un ordre qui retarde l'issue au maximum (Denis annonce
 * les bulletins qui peuvent déjà être décisifs, puis quand l'issue est connue) · tirage au sort en cas d'égalité · le flambeau, la sentence,
 * la torche éteinte, le dernier mot. Si le joueur n'est pas au conseil (équipe immunisée), il n'en voit que l'issue.
 *
 * Le vote d'un non-joueur dépend de ses relations (AFF + REP), des influences exercées par les tractations et de son humeur : voir Tractation.js.
 * Les votes inscrits à l'avance (`Candidate.councilVotes`, derniers de la première épreuve) sont ajoutés au dépouillement.
 *
 * Variables de texte : {councilName}, {councilText}, {councilLeft}, {councilRight}.
 */
class Council extends Challenge {
    static get ID() {
        return "COUNCIL";
    }
    /** Équipe qui va au conseil : "ALL" après la réunification, sinon la couleur de l'équipe qui n'a pas l'immunité (null s'il n'y a personne). */
    static councilColor(game) {
        if (game.reunified) {
            return "ALL";
        }
        const sizes = game.teams.map((t) => ({ color: t.color, n: game.teamMembers(t.color).length })).filter((t) => t.n >= 2);
        const open = sizes.filter((t) => t.color != game.immuneTeam);
        if (!open.length) {
            return null;
        }
        const player = game.getEntityByName("{player}");
        // Sans résultat d'immunité : la plus nombreuse, à égalité celle du joueur
        open.sort((a, b) => (b.n - a.n) || ((b.color == player.team ? 1 : 0) - (a.color == player.team ? 1 : 0)));
        return open[0].color;
    }
    static canHold(game) {
        return !!Council.councilColor(game);
    }
    constructor(params) {
        super(Council.ID, { ...DEFAULT_PARAMS, ...(params || {}) });
        this.visible = false;
        this.steps = [];
        this.index = 0;
        this.picker = null;   // { names, selection } pendant le vote du joueur
        this.note = "";
        this.playerVote = null;
        this.pactLines = [];
    }

    // --- Interface Challenge ---

    start(game) {
        game.logSections = [];
        this.game = game;
        this.color = Council.councilColor(game);
        this.attendees = this.color == "ALL" ? game.candidates.filter((c) => !c.eliminated) : game.teamMembers(this.color);
        this.candidates = this.attendees;
        this.player = game.getEntityByName("{player}");
        this.attending = this.attendees.some((c) => c.isPlayer);
        this.tr = game.tractations;
        this.protectedNames = game.individualImmune || [];
        this.texts = game.content.resources.council || {};
        const team = game.teams.find((t) => t.color == this.color);
        this.tribe = game.reunified ? "réunifiée" : (team && team.name ? team.name : "des " + COLOR_LABELS[this.color]);
        this.teamLabel = game.reunified ? "la tribu réunifiée" : "les " + COLOR_LABELS[this.color];
        if (this.attending) {
            this.pactReport = this.tr.checkPacts(game, this.player, this.attendees.map((c) => c.name));
            this.buildOpening(game);
        } else {
            this.buildSpectator(game);
        }
        this.enter(game);
        this.refresh(game);
    }
    playTurn(game, leftOrRight, card) {
        const step = this.steps[this.index];
        this.note = "";
        if (step.vote) {
            if (!this.picker || !this.picker.selection) {
                this.note = "Cliquez d'abord sur le portrait de celui que vous voulez éliminer, puis swipez pour valider.";
                this.refresh(game);
                return "ID:" + card.id;
            }
            this.playerVote = this.picker.selection;
            this.picker = null;
            this.buildVotingAndCounting(game);
        }
        this.index++;
        if (this.index >= this.steps.length) {
            return card.challenge.onFinish;
        }
        this.enter(game);
        this.refresh(game);
        return "ID:" + card.id;
    }
    /** Appelé quand le joueur clique sur un portrait pendant le vote. */
    selectName(game, name) {
        if (this.picker && this.picker.names.includes(name)) {
            this.picker.selection = this.picker.selection == name ? null : name;
            this.refresh(game);
        }
    }

    // --- Déroulé ---

    say(name, text, extra) {
        this.steps.push({ name, text, ...(extra || {}) });
    }
    denis(text, extra) {
        this.say(DENIS, text, extra);
    }
    /** Mise en place de l'étape courante (portraits du vote, effets d'entrée). */
    enter(game) {
        const step = this.steps[this.index];
        this.picker = null;
        if (step.vote) {
            this.picker = { names: this.attendees.filter((c) => !c.isPlayer && !this.protectedNames.includes(c.name)).map((c) => c.name), selection: null };
        }
        if (step.onEnter) {
            step.onEnter(game);
        }
    }
    refresh(game) {
        const step = this.steps[this.index];
        const text = typeof step.text == "function" ? step.text() : step.text;
        game.vars.councilName = step.name;
        game.vars.councilText = text + (this.note ? "\n\n" + this.note : "");
        const label = step.vote ? (this.picker && this.picker.selection ? "Voter contre " + this.picker.selection : "Choisissez un portrait") : (step.button || "Suivant");
        game.vars.councilLeft = label;
        game.vars.councilRight = label;
    }

    /** Arrivée, résumé de Denis, commentaires, rappel des protections, vote du joueur. */
    buildOpening(game) {
        const p = this.player;
        const names = this.attendees.filter((c) => !c.isPlayer).map((c) => c.name);
        this.say("Le conseil", "La nuit est tombée. " + (game.reunified ? "Les aventuriers réunis" : "Les " + COLOR_LABELS[this.color]) + " rejoignent le lieu du conseil, éclairé par les torches, et prennent place autour du feu face à Denis Brognard."
            + (names.length ? " " + mark(p.name) + " s'assied à côté de " + names[0] + "." : ""));
        this.denis("« Bienvenue au conseil. Avant de passer au vote, revenons sur ces " + this.params.summaryDays + " derniers jours. »\n" + this.summary(game).join("\n"));
        this.buildComments(game);
        this.denis(() => this.protectedNames.length
            ? "« Un rappel avant le vote : vous ne pouvez pas voter contre " + this.protectedNames.join(", ") + ", qui " + (this.protectedNames.length > 1 ? "sont protégés" : "est protégé") + " par une immunité. »"
            : "« Un rappel avant le vote : ce soir, personne n'est protégé. N'importe lequel d'entre vous peut recevoir des votes. »");
        const rank = randInt(1, this.attendees.length);
        this.say("Le vote", "« Il est temps de voter. » Les aventuriers passent l'un après l'autre derrière le paravent, un parchemin à la main. Vous passez en " + (rank == 1 ? "1re" : rank + "e") + " position.\n"
            + "Cliquez sur le portrait de celui que vous voulez éliminer, puis swipez pour valider.", { vote: true });
    }
    /** Résumé de Denis : épreuves et évènements marquants des derniers jours, tels que la tribu les connaît. */
    summary(game) {
        const since = game.currentDay - this.params.summaryDays;
        const camp = game.challenges.CAMP_LIFE;
        const lines = [];
        (camp ? camp.dayLog : []).filter((e) => e.day > since).forEach((e) => lines.push("• " + e.text));
        const notable = game.history.entries
            .filter((e) => e.day > since && e.type != HistoryType.COUNCIL && (this.color == "ALL" || visibleTo(e, this.color)) && this.involvesAttendee(e))
            .sort((a, b) => Math.abs((b.data && b.data.value) || 0) - Math.abs((a.data && a.data.value) || 0));
        const seen = [];
        notable.forEach((e) => {
            if (seen.length < 3 && !seen.includes(e.description)) {
                seen.push(e.description);
                lines.push("• " + e.description + ".");
            }
        });
        return lines.length ? lines : ["• Des journées plutôt calmes, sans évènement marquant."];
    }
    /** « e » du féminin pour accorder les paroles d'un candidat désigné par son nom. */
    suffix(game, name) {
        const c = game.getEntityByName(name);
        return c && c.sex == "F" ? "e" : "";
    }
    involvesAttendee(entry) {
        return this.attendees.some((a) => entry.participants.includes(a.id));
    }
    /** Quelques candidats prennent la parole : alliés du joueur d'abord (tenue ou rupture des pactes), puis des avis sur leur cible. */
    buildComments(game) {
        const p = this.player;
        const comments = this.texts.comments || {};
        const text = (key, vars, fallback) => fill(comments[key] && comments[key].length ? pick(comments[key]) : fallback, vars);
        const spoken = [];
        (this.pactReport || []).filter((r) => r.broken).forEach((r) => {
            this.say(r.ally, "« " + text(r.reason == "conduct" ? "brokenConduct" : "brokenRival", { player: p.name, e: this.suffix(game, r.ally) }, "Je ne peux plus te suivre sur ce vote, {player}.") + " »");
            spoken.push(r.ally);
        });
        const held = (this.pactReport || []).find((r) => !r.broken);
        if (held) {
            this.say(held.ally, "« " + text("heldPact", { player: p.name, e: this.suffix(game, held.ally) }, "On a un accord, {player}. Je tiens parole ce soir.") + " »");
            spoken.push(held.ally);
        }
        const speakers = shuffle(this.attendees.filter((c) => !c.isPlayer && !spoken.includes(c.name))).slice(0, this.params.comments);
        speakers.forEach((voter) => {
            const target = this.tr.voteOf(voter, this.attendees.filter((o) => !this.protectedNames.includes(o.name)));
            if (!target) {
                return;
            }
            const facts = this.tr.journalEntries(game, target, voter.team, 6).filter((e) => e.sign < 0);
            const vars = { target: target.name, player: p.name, e: voter.sex == "F" ? "e" : "", fact: facts.length ? pick(facts).entry.description : "" };
            let key;
            if (target.isPlayer) {
                key = facts.length ? "selfFact" : "selfGeneric";
            } else {
                key = facts.length ? "fact" : "generic";
            }
            const fallback = {
                fact: "{fact}. Pour moi, {target} est un risque pour l'équipe.",
                generic: "Je ne sens plus {target} dans l'esprit d'équipe.",
                selfFact: "{fact}. Je suis désolé, mais ça pèse dans ma décision.",
                selfGeneric: "Je ne me sens plus en phase avec toi, {player}."
            }[key];
            this.say(voter.name, "« " + text(key, vars, fallback) + " »");
        });
    }

    /** Après le vote du joueur (ou d'emblée sans lui) : bulletins, urne, dépouillement, élimination. */
    buildVotingAndCounting(game) {
        const ballots = this.castVotes(game);
        if (this.attending) {
            this.say("Le vote", "Votre bulletin est glissé dans l'urne. Les autres aventuriers passent à leur tour derrière le paravent, en silence.");
        }
        this.denis("Denis revient avec l'urne et la pose devant lui. « Est-ce que quelqu'un a un collier d'immunité, et souhaite le jouer ce soir ? »\nUn silence pesant s'installe. Personne ne bouge.");
        this.denis("« Personne ? Je vais donc procéder au dépouillement. »");
        const outcome = this.outcome(ballots);
        this.buildCounting(ballots, outcome);
        this.buildElimination(game, ballots, outcome);
    }
    /** Les bulletins : non-joueurs selon leurs relations et les influences, joueur selon son choix, plus les votes déjà inscrits. */
    castVotes(game) {
        const ballots = [];
        const open = this.attendees.filter((o) => !this.protectedNames.includes(o.name));
        this.attendees.forEach((voter) => {
            const target = voter.isPlayer ? (this.playerVote ? game.getEntityByName(this.playerVote) : null) : this.tr.voteOf(voter, open);
            if (target) {
                ballots.push({ voter, target });
            }
        });
        this.attendees.forEach((a) => {
            for (let i = 0; i < (a.councilVotes || 0); i++) {
                ballots.push({ voter: null, target: a });
            }
        });
        return ballots;
    }
    /** Décompte, candidats à égalité en tête, et éliminé (tirage au sort s'il y a égalité). */
    outcome(ballots) {
        const counts = {};
        ballots.forEach((b) => { counts[b.target.name] = (counts[b.target.name] || 0) + 1; });
        const top = Math.max(...Object.values(counts));
        const leaders = Object.keys(counts).filter((n) => counts[n] == top);
        const tie = leaders.length > 1;
        const eliminatedName = tie ? pick(leaders) : leaders[0];
        return { counts, top, leaders, tie, eliminatedName };
    }
    /**
     * Ordre de révélation qui retarde le plus possible l'issue : les bulletins des candidats non en tête d'abord (répartis à tour de
     * rôle), puis ceux du ou des candidats en tête (à tour de rôle, pour arriver à égalité avant le dernier bulletin).
     */
    order(ballots, leaders) {
        const groups = {};
        ballots.forEach((b) => { (groups[b.target.name] = groups[b.target.name] || []).push(b); });
        const roundRobin = (names) => {
            const lists = names.map((n) => groups[n].slice());
            const out = [];
            while (lists.some((l) => l.length)) {
                lists.forEach((l) => { if (l.length) { out.push(l.shift()); } });
            }
            return out;
        };
        const others = Object.keys(groups).filter((n) => !leaders.includes(n)).sort((a, b) => groups[b].length - groups[a].length);
        return [...roundRobin(others), ...roundRobin(leaders)];
    }
    tallyText(running) {
        return Object.entries(running).sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0], "fr")).map(([n, c]) => n + " : " + c).join(" · ");
    }
    buildCounting(ballots, outcome) {
        const ordered = this.order(ballots, outcome.leaders);
        const total = ordered.length;
        const running = {};
        let announcedDecided = false;
        ordered.forEach((ballot, i) => {
            const remaining = total - i; // y compris ce bulletin
            const sorted = Object.values(running).sort((a, b) => b - a);
            const max = sorted[0] || 0;
            const second = sorted[1] || 0;
            const decidedBefore = (max - second) > remaining;
            if (decidedBefore && !announcedDecided) {
                announcedDecided = true;
                this.denis("« Je vais terminer le dépouillement, mais il ne changera pas l'issue du vote. »");
            }
            const word = remaining == 1 ? "dernier" : ORDINALS[Math.min(i, ORDINALS.length - 1)];
            // Un bulletin qui peut déjà trancher : Denis le signale avant de le lire
            if (!decidedBefore && (max + 1 - second) > (remaining - 1)) {
                this.denis("« Voici le " + word + " bulletin, et il peut déjà être décisif. »");
            }
            running[ballot.target.name] = (running[ballot.target.name] || 0) + 1;
            const snapshot = this.tallyText(running);
            this.say("Le dépouillement", (word.charAt(0).toUpperCase() + word.slice(1)) + " bulletin : " + ballot.target.name + ".\n" + snapshot);
        });
        if (outcome.tie) {
            const names = outcome.leaders.join(", ");
            this.denis("« Égalité parfaite entre " + names + " ! Nous allons procéder à un tirage au sort : chacun pioche une boule dans ce sac. Une seule est noire. Celui qui la pioche quitte l'aventure. »");
            const drawn = outcome.leaders.map((n) => n == outcome.eliminatedName ? n + " tire la boule noire." : n + " tire une boule blanche.");
            this.say("Le tirage au sort", "Les mains plongent dans le sac, l'une après l'autre.\n" + drawn.join("\n"));
        }
    }
    /** Le flambeau, la sentence, la torche éteinte, le dernier mot. L'élimination est effective quand la torche s'éteint. */
    buildElimination(game, ballots, outcome) {
        const x = game.getEntityByName(outcome.eliminatedName);
        const you = x.isPlayer;
        this.eliminated = x;
        this.denis("« " + x.name + ", prenez votre flambeau, et venez me rejoindre. »");
        this.say("Le conseil", you
            ? "Vous vous levez, saisissez votre flambeau et avancez vers Denis sous le regard de vos compagnons."
            : x.name + " se lève, saisit son flambeau et s'avance vers Denis sous le regard de ses compagnons.");
        this.denis("« " + x.name + ", les aventuriers de la tribu " + this.tribe + " ont décidé de vous éliminer, et leur sentence est irrévocable. »");
        this.say("La flamme s'éteint", "Denis plonge " + (you ? "votre flambeau" : "le flambeau de " + x.name) + " dans les braises. La flamme s'éteint dans un sifflement et un grondement sourd roule dans la nuit.", {
            onEnter: (g) => this.applyOutcome(g, ballots, outcome)
        });
        const words = this.texts.lastWords && this.texts.lastWords.length ? pick(this.texts.lastWords) : "Je pars la tête haute. Bonne chance à tous.";
        this.say(x.name, "« " + words + " »\n" + (you ? "Vous embrassez une dernière fois vos compagnons et quittez le conseil, votre flambeau éteint." : x.name + " serre une dernière fois ses compagnons dans ses bras et quitte le conseil, " + (x.sex == "F" ? "sa" : "son") + " flambeau éteint."));
        this.denis(() => "« Le conseil est terminé. Regagnez votre camp. »" + (this.pactLines.length ? "\n" + this.pactLines.join("\n") : ""));
    }
    /** Conséquences du vote : élimination, rancunes, historique, alliances tenues ou trahies. */
    applyOutcome(game, ballots, outcome) {
        const x = this.eliminated;
        x.eliminated = true;
        const count = outcome.counts[x.name];
        game.record(HistoryType.COUNCIL, [x], x.name + " est éliminé" + (x.sex == "F" ? "e" : "") + " lors du conseil (" + count + " vote" + (count > 1 ? "s" : "") + (outcome.tie ? ", tirage au sort" : "") + ")", { votes: count });
        const votersOf = {};
        ballots.forEach((b) => { if (b.voter) { (votersOf[b.target.name] = votersOf[b.target.name] || []).push(b.voter); } });
        Object.keys(outcome.counts).filter((n) => n != x.name).forEach((name) => {
            const target = game.getEntityByName(name);
            (votersOf[name] || []).forEach((v) => target.changeRelation(v.name, RelationGauge.AFF, this.params.receivedVotesAff));
            game.record(HistoryType.COUNCIL, [target], target.name + " reçoit " + outcome.counts[name] + " vote" + (outcome.counts[name] > 1 ? "s" : "") + " au conseil mais reste en jeu",
                { votes: outcome.counts[name], gauge: RelationGauge.AFF, value: this.params.receivedVotesAff });
        });
        this.attendees.forEach((a) => { a.councilVotes = 0; });
        // Alliances du joueur : tenues si son vote respecte la promesse, trahies sinon
        this.pactLines = [];
        if (this.attending && this.playerVote) {
            this.tr.influences.filter((i) => i.pact && i.speaker == this.player.name && i.status == "ACTIVE").forEach((pact) => {
                const ally = game.getEntityByName(pact.listener);
                if (!ally || ally.name == x.name) {
                    return;
                }
                const kept = pact.kind == PitchKind.CHARGE ? this.playerVote == pact.target : this.playerVote != pact.target;
                const gain = this.params.keptPactAff;
                if (kept) {
                    [[ally, this.player], [this.player, ally]].forEach(([a, b]) => a.changeRelation(b.name, RelationGauge.AFF, gain));
                    game.record(HistoryType.COUNCIL, [this.player, ally], this.player.name + " et " + ally.name + " tiennent leur alliance lors du conseil", { gauge: RelationGauge.AFF, value: gain });
                    this.pactLines.push("Vous avez tenu parole avec " + ally.name + " : votre alliance en sort renforcée.");
                } else {
                    ally.changeRelation(this.player.name, RelationGauge.AFF, this.params.brokenPactAff);
                    game.record(HistoryType.COUNCIL, [this.player, ally], this.player.name + " trahit sa promesse envers " + ally.name + " lors du conseil", { gauge: RelationGauge.AFF, value: this.params.brokenPactAff });
                    this.pactLines.push(ally.name + " ne vous pardonnera pas d'avoir rompu votre accord.");
                }
            });
        }
    }
    /** Le joueur n'est pas au conseil : il n'en apprend que l'issue. */
    buildSpectator(game) {
        const outcomeBallots = this.castVotes(game);
        const outcome = this.outcome(outcomeBallots);
        const x = game.getEntityByName(outcome.eliminatedName);
        this.eliminated = x;
        this.say("Pendant ce temps...", "Ce soir, " + this.teamLabel + " se rend" + (game.reunified ? "" : "ent") + " au conseil. Votre équipe a remporté l'immunité : vous regagnez le campement et attendez des nouvelles.");
        this.say("Le conseil des " + (game.reunified ? "réunifiés" : COLOR_LABELS[this.color]), () => "Au matin, la nouvelle circule : " + x.name + " a été éliminé" + (x.sex == "F" ? "e" : "") + " lors du conseil, par " + outcome.counts[x.name] + " vote" + (outcome.counts[x.name] > 1 ? "s" : "") + ". " + x.name + " ne reviendra pas.", {
            onEnter: (g) => this.applyOutcome(g, outcomeBallots, outcome)
        });
    }
}

export { Council }
