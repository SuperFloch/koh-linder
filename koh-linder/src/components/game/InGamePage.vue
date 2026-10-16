<template>
    <!-- Design « Braise · Planche » (Maquette/) : paysage en fond, header bois, bandeau, carte au centre, choix en bas -->
    <div class="stretch gamePage">
        <TropicalScene :variant="sceneVariant" :period="game.period" />
        <GameTopBar :game="game"/>
        <!-- Sous le header (laisse la place au médaillon du joueur) : bandeau du camp, minimap d'épreuve ou portraits -->
        <div class="hud">
            <CampHeader v-if="showCamp" :game="game" />
            <RaceTrack v-if="showTrack" :challenge="game.activeChallenge" :candidates="game.candidates" :title="challengeTitle" />
            <DraftPicker v-if="showDraft" :game="game" :challenge="game.activeChallenge" />
        </div>
        <!-- Bouton de consultation du journal (débogage, voir src/debug.js) -->
        <DebugJournal v-if="debug" :game="game" />
        <div class="swipeListener" :class="{ withDebug: debug }" ref="swipe">
          <div class="cardArea">
            <div class="currentCard" ref="currentCard" v-if="card">
              <div class="cardInner">
                <CardIllustration v-if="hasIllustration" :class="{ compact: card.type == 'CHALLENGE_TURN' }" :img="card.img"
                    :variant="illustrationVariant" :period="game.period" />
                <div class="cardBody" :class="{ centered: card.type == 'PORTRAITS' }">
                    <div class="cardName display-font">{{ game.format(card.name) }}</div>
                    <div v-if="card.type == 'PORTRAITS' && portrait" class="portrait">
                        <div class="portraitFace display-font">{{ portrait.name.charAt(0) }}</div>
                        <div class="portraitName display-font">{{ portrait.name }}</div>
                        <div>{{ portrait.job }}, {{ portrait.age }} ans</div>
                        <div class="portraitCount">{{ portraitIndex + 1 }} / {{ game.candidates.length }}</div>
                    </div>
                    <div class="cardText">{{ cardText }}</div>
                    <!-- Épreuves d'équipe : un bloc par équipe, bordure de sa couleur, police réduite pour l'équipe adverse -->
                    <template v-if="hasSections">
                        <div v-for="s in game.logSections" :key="s.color" class="teamSection" :class="{ rival: !s.mine }"
                            :style="{ borderColor: teamCss(s.color) }">{{ s.text }}</div>
                    </template>
                </div>
                <!-- Nature du swipe : flèche biface = pas de décision ; deux flèches colorées = décision -->
                <div class="swipeSymbol">
                    <span v-if="isDecision" class="arrow decisionLeft" title="Décision">&#8592;</span>
                    <span v-if="isDecision" class="arrow decisionRight" title="Décision">&#8594;</span>
                    <span v-else class="arrow neutral" title="Pas de décision">&#8596;</span>
                </div>
              </div>
            </div>
            <div class="currentCard" v-else-if="game.finished">
              <div class="cardInner">
                <CardIllustration :variant="sceneVariant" :period="game.period" />
                <div class="cardBody centered">
                    <div class="cardName display-font">Fin de la partie</div>
                    <div class="cardText">Fin du contenu disponible pour le moment.<br>Jours survécus : {{ game.kohPointsEarned }}</div>
                    <button v-if="game.debug" class="tiki-btn" @click="$emit('end')">Terminer (débogage)</button>
                    <button v-else class="tiki-btn" @click="$emit('end')">Récupérer {{ game.kohPointsEarned }} Koh-point{{ game.kohPointsEarned > 1 ? 's' : '' }}</button>
                </div>
              </div>
            </div>
          </div>
          <!-- Bande verticale collée au bord de l'écran, quand le swipe est assez avancé pour valider le choix : couleur du choix, blanche si ce n'est pas une décision -->
          <div v-if="card && commitSide" class="commitBand" :class="[commitSide, isDecision ? commitSide + 'Color' : 'neutralColor']"></div>
          <!-- Choix sous la carte, toujours visibles : toucher un bouton = swiper de ce côté -->
          <div class="choiceZone">
              <template v-if="card && isDecision">
                  <button class="choiceBtn left" :class="{ active: slidingLeft }" @click="choose('left')">
                      <span class="choiceArrow" aria-hidden="true">&#8592;</span><span>{{ game.format(card.choices.left.text) }}</span>
                  </button>
                  <button class="choiceBtn right" :class="{ active: slidingRight }" @click="choose('right')">
                      <span>{{ game.format(card.choices.right.text) }}</span><span class="choiceArrow" aria-hidden="true">&#8594;</span>
                  </button>
              </template>
              <button v-else-if="card" class="choiceBtn neutral" :class="{ active: slidingLeft || slidingRight }" @click="choose('right')">
                  <span>{{ game.format(card.choices.right.text) || 'Continuer' }}</span><span class="choiceArrow" aria-hidden="true">&#8596;</span>
              </button>
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
import TropicalScene from './TropicalScene.vue';
import CardIllustration from './CardIllustration.vue';
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
        CampHeader,
        TropicalScene,
        CardIllustration
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
        // Paysage de fond : plage pendant les épreuves (ciel bleu clair), plage + jungle au camp (ciel selon la période)
        sceneVariant(){
            return this.showCamp ? 'camp' : 'beach';
        },
        // Illustration par défaut d'une carte sans `img` : bateau pendant l'introduction, sinon la scène du moment
        illustrationVariant(){
            if(this.card && this.card.theme == 'INTRODUCTION'){
                return 'sea';
            }
            return this.sceneVariant;
        },
        hasIllustration(){
            return !!this.card && this.card.type != 'PORTRAITS';
        },
        hasSections(){
            return !!this.card && this.card.type == 'CHALLENGE_TURN' && !!this.game.logSections && this.game.logSections.length > 0;
        },
        // Nom de l'épreuve en cours, d'après le catalogue (manifest.challenges)
        challengeTitle(){
            const challenge = this.game.activeChallenge;
            if(!challenge){
                return '';
            }
            const entry = (this.game.content.challenges || []).find((c) => c.id == challenge.id);
            return entry ? entry.name : '';
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
        },
        // Bouton de choix : même effet qu'un swipe complet de ce côté
        choose(side){
            if(side == 'left'){
                this.game.left();
            } else {
                this.game.right();
            }
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
    position: relative;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background-color: var(--wood-dark);
}
/* Sous le header : la marge haute laisse la place au médaillon du joueur qui déborde */
.hud{
    position: relative;
    flex: none;
    padding: 46px 16px 0;
}
.swipeListener{
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 12px 16px 16px;
    overflow: hidden;
    touch-action: none;
}
/* Place pour le bouton du journal de débogage, sous les choix */
.swipeListener.withDebug{
    padding-bottom: 26px;
}
/* Conteneur de taille : la carte prend la plus grande taille possible au format 63 x 89 */
.cardArea{
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    container-type: size;
}
/* Carte à jouer au format 63 x 89 : cadre de bois autour d'une carte sable */
.currentCard{
    position: relative;
    box-sizing: border-box;
    width: min(100cqw, 100cqh * 63 / 89, 520px);
    aspect-ratio: 63 / 89;
    padding: 8px;
    border-radius: 14px;
    background-color: var(--wood-light);
    border: 2px solid var(--wood-dark);
    box-shadow: 0 16px 30px rgba(26, 16, 13, 0.45);
    user-select: none;
}
.cardInner{
    position: relative;
    height: 100%;
    box-sizing: border-box;
    border-radius: 8px;
    background-color: var(--sand-soft);
    color: var(--wood-dark);
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
.illustration.compact{
    height: 22%;
}
.cardBody{
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 16px 34px;
    overflow-y: auto;
    text-align: left;
}
.cardBody.centered{
    justify-content: center;
    text-align: center;
}
/* Zone des choix sous la carte (hauteur fixe pour éviter les sauts de mise en page) */
.choiceZone{
    flex: none;
    min-height: 58px;
    margin-top: 14px;
    display: flex;
    gap: 10px;
}
.choiceBtn{
    flex: 1;
    min-width: 0;
    min-height: 58px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    font-family: var(--font-body);
    font-size: 0.9rem;
    font-weight: 700;
    line-height: 1.2;
    text-align: left;
    color: var(--cream);
    border: 2px solid var(--wood-dark);
    border-radius: 10px;
    box-shadow: 0 4px 0 var(--wood-dark);
    cursor: pointer;
    transition: transform 0.12s, box-shadow 0.12s;
}
.choiceBtn.left{
    background-color: var(--jungle-soft);
}
.choiceBtn.right{
    justify-content: flex-end;
    text-align: right;
    background-color: var(--sea-soft);
}
.choiceBtn.neutral{
    justify-content: center;
    text-align: center;
    color: var(--wood-dark);
    background-color: var(--sand-soft);
}
/* Le bouton du côté vers lequel on swipe se met en avant */
.choiceBtn.active{
    transform: translateY(-3px) scale(1.03);
    box-shadow: 0 7px 0 var(--wood-dark), 0 0 0 3px var(--amber);
}
.choiceBtn:active{
    transform: translateY(3px);
    box-shadow: 0 1px 0 var(--wood-dark);
}
.choiceArrow{
    flex: none;
    font-size: 1.2rem;
    font-weight: 900;
}
.cardName{
    font-size: 1.35rem;
    line-height: 1.1;
}
.cardText{
    white-space: pre-line;
    font-size: 1rem;
    line-height: 1.42;
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
    background-color: var(--jungle-soft);
}
.commitBand.rightColor{
    background-color: var(--sea-soft);
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
    pointer-events: none;
    background: linear-gradient(transparent, var(--sand-soft) 40%);
    padding-top: 8px;
}
.arrow{
    font-size: 1.5rem;
    font-weight: 900;
}
.arrow.neutral{
    color: var(--wood-mid);
}
.arrow.decisionLeft{
    color: var(--jungle-soft);
}
.arrow.decisionRight{
    color: var(--sea-soft);
}
/* Compte rendu d'une équipe pendant une épreuve : bordure de la couleur de l'équipe ; l'équipe adverse en plus petit */
.teamSection{
    box-sizing: border-box;
    padding: 5px 9px;
    border: 2px solid var(--wood-dark);
    border-radius: 6px;
    background-color: #f2dfb0;
    font-size: 0.85rem;
    line-height: 1.3;
}
.teamSection.rival{
    background-color: #efe0b4;
    font-size: 0.72rem;
    line-height: 1.25;
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
    color: var(--sand-soft);
    background-color: var(--wood-dark);
    border: 4px solid var(--wood-light);
}
.portraitName{
    font-size: 1.5rem;
}
.portraitCount{
    margin-top: 4px;
    font-size: 0.85rem;
    opacity: 0.7;
}
</style>
