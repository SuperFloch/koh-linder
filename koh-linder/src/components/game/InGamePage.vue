<template>
    <div class="stretch gamePage" :class="{ withTrack: showTrack, withDraft: showDraft, withCamp: showCamp }">
        <GameTopBar :game="game"/>
        <!-- Second header, hors épreuves : ressources du camp -->
        <CampHeader v-if="showCamp" :game="game" />
        <!-- Score d'avancement de l'épreuve en cours (minimap) -->
        <RaceTrack v-if="showTrack" :challenge="game.activeChallenge" :candidates="game.candidates" />
        <!-- Portraits cliquables pendant la formation des équipes -->
        <DraftPicker v-if="showDraft" :game="game" :challenge="game.activeChallenge" />
        <!-- Bouton de consultation du journal (débogage, voir src/debug.js) -->
        <DebugJournal v-if="debug" :game="game" />
        <div class="swipeListener" ref="swipe">
          <div class="cardArea">
            <div class="currentCard tiki-panel" ref="currentCard" v-if="card">
                <div class="cardName">{{ game.format(card.name) }}</div>
                <div v-if="card.type == 'PORTRAITS' && portrait" class="portrait">
                    <div class="portraitFace">{{ portrait.name.charAt(0) }}</div>
                    <div class="portraitName">{{ portrait.name }}</div>
                    <div>{{ portrait.job }}, {{ portrait.age }} ans</div>
                    <div class="portraitCount">{{ portraitIndex + 1 }} / {{ game.candidates.length }}</div>
                </div>
                <!-- Épreuves d'équipe : un bloc par équipe, bordure de sa couleur, police réduite pour l'équipe adverse -->
                <template v-if="card.type == 'CHALLENGE_TURN' && game.logSections && game.logSections.length">
                    <div v-for="s in game.logSections" :key="s.color" class="teamSection" :class="{ rival: !s.mine }"
                        :style="{ borderColor: teamCss(s.color) }">{{ s.text }}</div>
                </template>
                <div class="cardText">{{ cardText }}</div>
                <!-- Nature du swipe : flèche biface = pas de décision ; deux flèches colorées = décision -->
                <div class="swipeSymbol">
                    <span v-if="isDecision" class="arrow decisionLeft" title="Décision">&#8592;</span>
                    <span v-if="isDecision" class="arrow decisionRight" title="Décision">&#8594;</span>
                    <span v-else class="arrow neutral" title="Pas de décision">&#8596;</span>
                </div>
            </div>
            <div class="currentCard tiki-panel" v-else-if="game.finished">
                <div class="cardName">Fin de la partie</div>
                <div class="cardText">Fin du contenu disponible pour le moment.<br>Jours survécus : {{ game.kohPointsEarned }}</div>
                <button v-if="game.debug" class="tiki-btn" @click="$emit('end')">Terminer (débogage)</button>
                <button v-else class="tiki-btn" @click="$emit('end')">Récupérer {{ game.kohPointsEarned }} Koh-point{{ game.kohPointsEarned > 1 ? 's' : '' }}</button>
            </div>
          </div>
          <!-- Bande verticale collée au bord de l'écran, quand le swipe est assez avancé pour valider le choix : couleur du choix, blanche si ce n'est pas une décision -->
          <div v-if="card && commitSide" class="commitBand" :class="[commitSide, isDecision ? commitSide + 'Color' : 'neutralColor']"></div>
          <!-- Texte du choix, affiché sous la carte dès que le swipe commence -->
          <div class="choiceZone">
              <div class="choiceText leftHint" v-if="card && slidingLeft">{{ game.format(card.choices.left.text) }}</div>
              <div class="choiceText rightHint" v-else-if="card && slidingRight">{{ game.format(card.choices.right.text) }}</div>
          </div>
        </div>
    </div>
</template>
<script>
import Hammer from 'hammerjs';
import {Game}  from 'src/model/Game';
import { defineComponent } from 'vue'
import GameTopBar from './GameTopBar.vue';
import RaceTrack from './RaceTrack.vue';
import DraftPicker from './DraftPicker.vue';
import DebugJournal from './DebugJournal.vue';
import CampHeader from './CampHeader.vue';
import { TeamCssColor } from 'src/model/Team';
import { DEBUG } from 'src/debug';

// Durée d'affichage de chaque portrait sur la carte PORTRAITS
const PORTRAIT_INTERVAL_MS = 700;

export default defineComponent({
    emits: ['end'],
    props:{
        game: {
            type: Game
        }
    },
    components:{
        GameTopBar,
        RaceTrack,
        DraftPicker,
        DebugJournal,
        CampHeader
    },
    data: function(){
        return {
            hammer: null,
            slidingLeft: false,
            slidingRight: false,
            commitSide: null,
            portraitIndex: 0,
            portraitTimer: null,
            debug: DEBUG
        }
    },
    computed:{
        card(){
            return this.game.currentCard;
        },
        showTrack(){
            // Chaque épreuve choisit son affichage via `display` ; seule la minimap de course existe pour l'instant
            const challenge = this.game.activeChallenge;
            return !!challenge && challenge.display == 'RACE_TRACK';
        },
        showDraft(){
            const challenge = this.game.activeChallenge;
            return !!challenge && challenge.display == 'DRAFT_PICKER';
        },
        // Hors épreuves, pendant la vie de camp
        showCamp(){
            return !!this.game.challenges.CAMP_LIFE && !this.game.activeChallenge;
        },
        portrait(){
            return this.game.candidates[this.portraitIndex];
        },
        // Le swipe est une décision quand les deux choix proposent des textes différents (« Suivant » / « Suivant » n'en est pas une)
        isDecision(){
            if(!this.card){
                return false;
            }
            const left = this.game.format(this.card.choices.left.text || '').trim();
            const right = this.game.format(this.card.choices.right.text || '').trim();
            return left !== right;
        },
        // Texte de la carte sans retours à la ligne initiaux (le compte rendu des équipes est dans des blocs à part)
        cardText(){
            return this.card ? this.game.format(this.card.text).replace(/^\s+/, '') : '';
        }
    },
    methods:{
        teamCss(color){
            return TeamCssColor[color] || 'var(--wood)';
        }
    },
    watch:{
        // Carte spéciale PORTRAITS : fait défiler rapidement les candidats
        card: {
            immediate: true,
            handler(card){
                clearInterval(this.portraitTimer);
                this.portraitTimer = null;
                if(card && card.type == 'PORTRAITS'){
                    this.portraitIndex = 0;
                    // Défile une seule fois, puis s'arrête sur le dernier candidat (pas de boucle)
                    this.portraitTimer = setInterval(()=>{
                        if(this.portraitIndex < this.game.candidates.length - 1){
                            this.portraitIndex++;
                        } else {
                            clearInterval(this.portraitTimer);
                            this.portraitTimer = null;
                        }
                    }, PORTRAIT_INTERVAL_MS);
                }
            }
        }
    },
    beforeUnmount: function(){
        clearInterval(this.portraitTimer);
    },
    mounted: function(){
        this.hammer = new Hammer(this.$refs.swipe,{})
        this.hammer.on('pan',(e)=>{
            if (e.deltaX === 0) return;
            if (e.center.x === 0 && e.center.y === 0) return;
            if (!this.$refs.currentCard) return;
            var xMulti = e.deltaX * 0.03;
            var yMulti = e.deltaY / 80;
            var rotate = xMulti * yMulti;
            this.$refs.currentCard.style.transform = 'translate(' + e.deltaX + 'px, ' + e.deltaY + 'px) rotate(' + rotate + 'deg)';

            this.slidingLeft = e.deltaX < 0;
            this.slidingRight = e.deltaX > 0;
            // Le swipe est assez avancé pour passer à la carte suivante (même seuil que la validation ci-dessous)
            this.commitSide = e.deltaX > 200 ? 'right' : (e.deltaX < -200 ? 'left' : null);

            if(e.isFinal){
                if(e.deltaX > 200){
                    this.game.right();
                }
                if(e.deltaX < -200){
                    this.game.left();
                }
            }
        });
        this.hammer.on('panend',(e)=>{
            if (this.$refs.currentCard) {
                this.$refs.currentCard.style.transform = '';
            }
            this.slidingLeft = false;
            this.slidingRight = false;
            this.commitSide = null;
        })
    }
})
</script>
<style scoped>
.gamePage{
    /* Hauteur réservée hors carte (barre du haut, zone du texte de choix, marges) ; la minimap en ajoute */
    --reserved: 210px;
    display: flex;
    flex-direction: column;
    background: linear-gradient(180deg, var(--sea) 0%, var(--wood) 100%);
}
.withTrack{
    --reserved: 315px;
}
.withDraft{
    --reserved: 330px;
}
.withCamp{
    --reserved: 250px;
}
.swipeListener{
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 12px 16px;
    overflow: hidden;
    touch-action: none;
}
.cardArea{
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
}
/* Carte à jouer au format 63 x 89, la plus grande possible dans la zone de jeu */
.currentCard{
    position: relative;
    box-sizing: border-box;
    width: min(100%, calc((100vh - var(--reserved)) * 63 / 89), 520px);
    aspect-ratio: 63 / 89;
    padding: 24px 20px;
    text-align: center;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 16px;
    overflow: hidden;
    user-select: none;
}
/* Zone sous la carte réservée au texte du choix (hauteur fixe pour éviter les sauts de mise en page) */
.choiceZone{
    flex: none;
    height: 72px;
    display: flex;
    align-items: center;
    justify-content: center;
}
.choiceText{
    max-width: 100%;
    padding: 10px 22px;
    font-size: 1.3rem;
    font-weight: 900;
    text-align: center;
    border: 3px solid var(--sand);
    border-radius: 14px;
    color: var(--sand);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}
.leftHint{
    background-color: var(--jungle);
}
.rightHint{
    background-color: var(--sea);
}
.cardName{
    font-size: 1.3rem;
    font-weight: 900;
    color: var(--sea);
}
.cardText{
    white-space: pre-line;
    font-size: 1.1rem;
}
/* Bande latérale de validation du swipe, collée au bord de l'écran */
.commitBand{
    position: fixed;
    top: 0;
    bottom: 0;
    width: 14px;
    z-index: 50;
    pointer-events: none;
}
.commitBand.left{
    left: 0;
}
.commitBand.right{
    right: 0;
}
.commitBand.leftColor{
    background-color: var(--jungle);
}
.commitBand.rightColor{
    background-color: var(--sea);
}
.commitBand.neutralColor{
    background-color: #ffffff;
}
/* Symbole de nature du swipe, en bas de la carte */
.swipeSymbol{
    position: absolute;
    left: 0;
    right: 0;
    bottom: 6px;
    display: flex;
    justify-content: center;
    gap: 28px;
    line-height: 1;
}
.arrow{
    font-size: 1.6rem;
    font-weight: 900;
}
.arrow.neutral{
    color: var(--wood);
    opacity: 0.6;
}
.arrow.decisionLeft{
    color: var(--jungle);
}
.arrow.decisionRight{
    color: var(--sea);
}
/* Compte rendu d'une équipe pendant une épreuve : bordure de la couleur de l'équipe ; l'équipe adverse en plus petit */
.teamSection{
    box-sizing: border-box;
    padding: 6px 10px;
    border: 4px solid var(--wood);
    border-radius: 10px;
    font-size: 0.95rem;
    line-height: 1.25;
}
.teamSection.rival{
    font-size: 0.75rem;
    line-height: 1.2;
}
.portrait{
    text-align: center;
}
.portraitFace{
    width: 96px;
    height: 96px;
    line-height: 96px;
    margin: 0 auto 8px;
    border-radius: 50%;
    font-size: 3rem;
    font-weight: 900;
    color: var(--sand);
    background-color: var(--sea);
    border: 4px solid var(--wood);
}
.portraitName{
    font-size: 1.5rem;
    font-weight: 900;
}
.portraitCount{
    margin-top: 4px;
    font-size: 0.85rem;
    opacity: 0.7;
}
</style>
