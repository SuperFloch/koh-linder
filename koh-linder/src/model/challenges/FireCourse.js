import { shuffle, pick } from "../CandidateGenerator";
import { EffectType } from "../Effect";
import { RelationGauge, RollContext } from "../Character";
import { HistoryType } from "../GameHistory";
import { RaceChallenge } from "./RaceChallenge";
import { Step, STEP_ICONS } from "./Challenge";

// Étapes propres à cette épreuve (les autres — RUN, HURDLE, JOINT_RUN, JOINT_OBSTACLE — sont génériques, voir Challenge)
const FireStep = {
  COLOR: "COLOR", // tirage d'une couleur pour former un binôme mixte
  FIRE: "FIRE" // allumer le feu : plusieurs jets joints d'INT consécutifs
};

// Parcours : un élément = une case. Position d'un candidat = nombre de cases franchies.
const STEPS = [
  Step.RUN, Step.RUN,
  Step.HURDLE, Step.HURDLE,
  FireStep.COLOR,
  Step.JOINT_RUN, Step.JOINT_RUN, Step.JOINT_RUN, Step.JOINT_RUN,
  Step.JOINT_OBSTACLE,
  Step.JOINT_RUN, Step.JOINT_RUN,
  FireStep.FIRE
];

// Couleurs piochées pour former les binômes (tons pastel) ; `css` sert de bordure aux indicateurs de course
const COLORS = [
  { name: "Orange", css: "#ffcba4" },
  { name: "Vert", css: "#b7e4c7" },
  { name: "Violet", css: "#d4b9f0" },
  { name: "Bleu", css: "#aecbfa" },
  { name: "Blanc", css: "#fdfdfd" },
  { name: "Noir", css: "#6d6875" },
  { name: "Rouge", css: "#f4a6a6" },
  { name: "Jaune", css: "#fff1a8" },
  { name: "Turquoise", css: "#a0e7e5" },
  { name: "Rose", css: "#ffc8dd" }
];

const ICONS = {
  ...STEP_ICONS,
  COLOR: "\u{1F3A8}",
  FIRE: "\u{1F525}"
};

// Paramètres propres à l'épreuve ; ceux des étapes génériques (seuils, énergie...) sont dans STEP_PARAMS (Challenge)
const DEFAULT_PARAMS = {
  fireThreshold: 25, // jet joint d'INT (somme des deux participants)
  fireStreak: 3, // jets joints d'INT réussis consécutivement pour allumer le feu
  duoAffinity: 3 // AFF gagnée par chaque membre d'un duo envers son binôme (réussite collective)
  // REP du classement : voir `rankRewards` dans les paramètres de Challenge (STEP_PARAMS)
};

/**
 * Première épreuve : un parcours mêlant plusieurs compétences, dont l'objectif final est d'allumer un feu avec un silex.
 *
 * Parcours (13 cases) : 2 de course (RUN), 2 de haies (HURDLE), 1 case couleur, 4 de course en jet joint (JOINT_RUN),
 * 1 obstacle en jet joint (JOINT_OBSTACLE : la courte échelle), 2 de course en jet joint, 1 case feu. Les règles des
 * étapes RUN, HURDLE, JOINT_RUN et JOINT_OBSTACLE et le jet joint sont dans la classe Challenge (réutilisables).
 *
 * Étapes propres à cette épreuve :
 * - Case couleur : chaque candidat pioche au hasard une couleur parmi 10. Deux hommes (ou deux femmes) ne peuvent pas avoir
 *   la même couleur. S'il n'y a personne d'autre avec cette couleur, il attend ; sinon il forme un duo mixte avec l'autre
 *   porteur de la couleur et ils continuent côte à côte. La couleur borde l'avatar du candidat sur la minimap.
 * - Feu : le duo doit réussir `fireStreak` jets joints d'INT consécutifs (un échec remet la série à zéro).
 *   Les premiers duos à y parvenir gagnent.
 *
 * Fin : chaque duo gagne `duoAffinity` d'AFF envers son binôme (réussite collective) ; le classement des duos change la REP
 * auprès de tous les autres pour les 1er (+5), 2e (+4), avant-dernier (-4) et dernier (-5) seulement ; le dernier duo a en plus
 * un vote à son nom (`councilVotes`) au prochain conseil.
 *
 * Variables de texte alimentées : {raceLog}, {nextStep}, {stepActionLeft}, {stepActionRight}, {playerRankLabel},
 * {raceWinners}, {raceLosers}.
 */
class FireCourse extends RaceChallenge {
  static get ID() {
    return "FIRE_COURSE";
  }
  constructor(params) {
    super(FireCourse.ID, { ...DEFAULT_PARAMS, ...(params || {}) }, STEPS.length, STEPS);
    this.partners = {}; // nom -> nom du binôme
    this.waiting = {}; // nom -> true : a pioché sa couleur et attend son binôme
    this.waitingByColor = {}; // nom de couleur -> nom du candidat en attente
    this.colorOf = {}; // nom -> nom de la couleur piochée
    this.takenColors = { M: [], F: [] };
    this.streaks = {}; // clé du duo -> jets d'INT réussis consécutivement
    this.arrivedDuos = []; // duos dans l'ordre d'arrivée : [[a, b], ...]
    this.ended = false;
  }

  // --- Interface Challenge ---

  start(game) {
    this.initRace(game);
    this.refresh(game);
    game.vars.raceLog = "";
  }
  playTurn(game, leftOrRight, card) {
    const player = game.getEntityByName("{player}");
    game.vars.raceLog = this.playRound(leftOrRight);
    this.refresh(game);
    if (this.hasArrived(player.name)) {
      return card.challenge.onFinish;
    }
    return "ID:" + card.id;
  }
  /**
   * Termine la course des autres puis applique les conséquences : affinité des duos, REP des vainqueurs et des derniers,
   * vote au nom des derniers pour le prochain conseil. Prépare {playerRankLabel}, {raceWinners} et {raceLosers}.
   */
  end(game) {
    if (this.ended) {
      return;
    }
    this.ended = true;
    this.finishRemaining();
    const p = this.params;
    // `history: false` : une seule entrée d'historique par duo est inscrite plus bas, au lieu d'une par membre
    const relation = (gauge, target, about, value) => game.applyEffect({ type: EffectType.RELATION, gauge, target, about, value, history: false });

    this.arrivedDuos.forEach(([a, b]) => {
      relation(RelationGauge.AFF, a, b, p.duoAffinity);
      relation(RelationGauge.AFF, b, a, p.duoAffinity);
      if (p.duoAffinity > 1) {
        game.record(HistoryType.GOOD_MOMENT, [a, b], a + " et " + b + " ont formé un duo à l'épreuve du parcours et du feu", { gauge: RelationGauge.AFF, value: p.duoAffinity, challenge: this.id });
      }
    });
    // REP du classement (voir Challenge.rankReward) : seuls les 1er, 2e, avant-dernier et dernier duos changent.
    // Une entrée d'historique par duo concerné (le changement est toujours de plus de 1).
    const total = this.arrivedDuos.length;
    this.arrivedDuos.forEach((duo, i) => {
      const reward = this.rankReward(i, total);
      if (reward == 0) {
        return;
      }
      duo.forEach((name) => relation(RelationGauge.REP, "ALL", name, reward));
      const rankWord = this.rankWord(i, total);
      const text = reward > 0
        ? duo.join(" et ") + (i == 0 ? " remportent" : " terminent " + rankWord + "s de") + " l'épreuve du parcours et du feu"
        : duo.join(" et ") + " terminent " + rankWord + "s de l'épreuve du parcours et du feu";
      game.record(reward > 0 ? HistoryType.CHALLENGE_SUCCESS : HistoryType.CHALLENGE_FAILURE, duo,
        text + (i == total - 1 ? " : un vote à leur nom les attend au prochain conseil" : ""),
        { gauge: RelationGauge.REP, value: reward, challenge: this.id });
    });
    const winners = this.arrivedDuos[0] || [];
    const losers = total > 1 ? this.arrivedDuos[total - 1] : [];
    // Les derniers ont un vote à leur nom pour le prochain conseil
    losers.forEach((name) => { game.getEntityByName(name).councilVotes++; });

    // Résultats disponibles pour les épreuves suivantes (ex: les vainqueurs deviennent chefs d'équipe)
    game.results[this.id] = { winners: winners.slice(), losers: losers.slice(), duos: this.arrivedDuos.map((d) => d.slice()) };

    const player = game.getEntityByName("{player}");
    const rank = this.duoRankOf(player.name);
    game.vars.playerRankLabel = rank == 1 ? "1re" : rank + "e";
    game.vars.raceWinners = winners.join(" et ");
    game.vars.raceLosers = losers.join(" et ");
  }
  close(game) {
    this.statusText = "";
    this.statusColor = "";
  }

  // --- Affichage ---

  cellLabel(index) {
    return index == 0 ? "\u{1F3C1}" : ICONS[STEPS[index - 1]];
  }
  /** Bordure de l'avatar = couleur piochée (tons pastel), une fois la couleur tirée. */
  avatarBorder(candidate) {
    return this.cssOfColor(this.colorOf[candidate.name]);
  }
  cssOfColor(colorName) {
    const color = COLORS.find((c) => c.name == colorName);
    return color ? color.css : null;
  }

  // --- Règles du parcours ---

  duoKey(a, b) {
    return [a, b].sort().join("|");
  }
  duoRankOf(name) {
    return this.arrivedDuos.findIndex((duo) => duo.includes(name)) + 1;
  }
  partnerOf(c) {
    return this.candidates.find((o) => o.name == this.partners[c.name]);
  }
  /** Le binôme de `c` s'il est présent sur la même case (et pas déjà arrivé), sinon null. */
  presentPartner(c) {
    const partner = this.partnerOf(c);
    if (!partner || this.positions[partner.name] != this.positions[c.name] || this.hasArrived(partner.name)) {
      return null;
    }
    return partner;
  }
  /**
   * Joue un tour pour tous les candidats encore en course (ceux qui attendent un binôme ne font rien).
   * @param {string} playerSide sens de swipe du joueur ("left" / "right"), null si le joueur n'est plus en course
   * @returns {string} compte rendu du tour du joueur ("" s'il n'est plus en course)
   */
  playRound(playerSide) {
    const done = {};
    var playerLog = "";
    const logIf = (names, text) => {
      if (names.some((n) => this.isPlayerName(n))) {
        playerLog = text;
      }
    };
    const p = this.params;
    const active = shuffle(this.candidates.filter((c) => !this.hasArrived(c.name) && !this.waiting[c.name]));

    active.forEach((c) => {
      if (done[c.name]) {
        return;
      }
      const step = this.stepOf(c);
      switch (step) {
        // Étapes génériques (voir Challenge)
        case Step.RUN:
        case Step.HURDLE:
          this.resolveSolo(step, c, playerSide, logIf);
          break;
        case Step.JOINT_RUN:
        case Step.JOINT_OBSTACLE: {
          const partner = this.presentPartner(c);
          if (partner) {
            done[c.name] = done[partner.name] = true;
            this.resolveJoint(step, [c, partner], playerSide, logIf);
          }
          break;
        }
        // Étapes propres à l'épreuve
        case FireStep.COLOR:
          logIf([c.name], this.drawColor(c, logIf));
          break;
        case FireStep.FIRE: {
          const partner = this.partnerOf(c);
          if (!partner || this.positions[partner.name] < this.positions[c.name]) {
            logIf([c.name], "Le feu est prêt, mais votre binôme n'est pas encore arrivé : vous l'attendez.");
            break;
          }
          const outcome = this.jointRoll([c, partner], "INT", p.fireThreshold, RollContext.INDIVIDUAL_INT);
          done[c.name] = done[partner.name] = true;
          const key = this.duoKey(c.name, partner.name);
          this.streaks[key] = outcome.ok ? (this.streaks[key] || 0) + 1 : 0;
          var text = "Silex " + outcome.text + " : ";
          if (this.streaks[key] >= p.fireStreak) {
            // Le feu prend : le duo franchit la dernière case
            this.advance(c, 1);
            this.advance(partner, 1);
            const duo = shuffle([c.name, partner.name]);
            duo.forEach((n) => this.arrived.push(n));
            this.arrivedDuos.push(duo);
            text += "le feu prend, vous avez terminé le parcours !";
          } else {
            text += outcome.ok ?
              "étincelle ! (" + this.streaks[key] + "/" + p.fireStreak + " d'affilée)" :
              "raté, il faut tout recommencer (0/" + p.fireStreak + ").";
          }
          logIf([c.name, partner.name], text);
          break;
        }
      }
    });

    if (playerLog == "") {
      const player = this.candidates.find((c) => c.isPlayer);
      if (player && this.waiting[player.name]) {
        playerLog = "Vous attendez votre binôme sur la case des couleurs (" + this.colorOf[player.name] + ").";
      }
    }
    return playerLog;
  }
  /**
   * Tirage d'une couleur au hasard parmi celles qui ne sont pas déjà prises par une personne du même sexe.
   * Si quelqu'un (de l'autre sexe) attend avec cette couleur, un duo se forme ; sinon le candidat attend.
   * @returns {string} compte rendu pour le candidat qui pioche
   */
  drawColor(c, logIf) {
    const color = pick(COLORS.filter((col) => !this.takenColors[c.sex].includes(col.name))).name;
    this.takenColors[c.sex].push(color);
    this.colorOf[c.name] = color;
    // Case couleur franchie : le candidat y reste (en attente) ou repart avec son binôme
    this.positions[c.name] = STEPS.indexOf(FireStep.COLOR) + 1;

    const waitingName = this.waitingByColor[color];
    if (waitingName) {
      delete this.waitingByColor[color];
      delete this.waiting[waitingName];
      this.partners[c.name] = waitingName;
      this.partners[waitingName] = c.name;
      // Le joueur qui attendait est informé de l'arrivée de son binôme
      logIf([waitingName], c.name + " pioche la couleur " + color + ", la même que vous : vous formez un duo avec " + c.name + " !");
      return "Vous piochez la couleur " + color + ". " + waitingName + " l'a aussi : vous formez un duo !";
    }
    this.waiting[c.name] = true;
    this.waitingByColor[color] = c.name;
    return "Vous piochez la couleur " + color + ", mais personne ne l'a encore : vous patientez.";
  }
  /** Termine la course des candidats restants (le joueur est déjà arrivé). */
  finishRemaining() {
    var guard = 0;
    while (this.arrived.length < this.candidates.length && guard++ < 2000) {
      this.playRound(null);
    }
    // Sécurité (effectif déséquilibré...) : ceux qui n'ont pas pu finir arrivent derniers, du plus avancé au moins avancé
    this.candidates
      .filter((c) => !this.hasArrived(c.name))
      .sort((a, b) => this.positions[b.name] - this.positions[a.name])
      .forEach((c) => this.arrived.push(c.name));
  }
  /** Met à jour la ligne de statut du joueur et les variables {nextStep}, {stepActionLeft} et {stepActionRight}. */
  refresh(game) {
    const player = game.getEntityByName("{player}");
    const partner = this.partners[player.name];
    if (partner) {
      this.statusText = "En duo avec " + partner;
    } else if (this.waiting[player.name]) {
      this.statusText = "En attente d'un binôme (couleur " + this.colorOf[player.name] + ")";
    } else {
      this.statusText = "";
    }
    this.statusColor = this.cssOfColor(this.colorOf[player.name]) || "";

    const pos = this.positions[player.name];
    const prefix = "Étape " + Math.min(pos + 1, this.length) + "/" + this.length + " : ";
    var left = "Continuer";
    var right = "Continuer";
    var next = "";
    const p = this.params;
    if (this.waiting[player.name]) {
      left = right = "Attendre votre binôme";
      next = prefix + "vous attendez que votre binôme pioche la même couleur que vous.";
    } else {
      const step = STEPS[pos];
      const generic = this.describeStep(step, partner);
      if (generic) {
        left = generic.left;
        right = generic.right;
        next = prefix + generic.text;
      } else if (step == FireStep.COLOR) {
        left = right = "Piocher une couleur";
        next = prefix + "piochez une couleur au hasard : vous formerez un duo avec la personne de l'autre sexe qui a la même.";
      } else if (step == FireStep.FIRE) {
        left = right = "Allumer le feu (jet joint d'INT)";
        next = prefix + "allumer le feu avec le silex : " + p.fireStreak + " jets joints d'INT consécutifs avec " +
          partner + " (" + (this.streaks[this.duoKey(player.name, partner)] || 0) + "/" + p.fireStreak + ").";
      }
    }
    game.vars.stepActionLeft = left;
    game.vars.stepActionRight = right;
    game.vars.nextStep = next;
  }
}

export { FireCourse, FireStep, STEPS, COLORS }
