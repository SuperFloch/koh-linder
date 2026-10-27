<template>
    <div class="screen">
        <div class="screen-title small-title">Choisis ton aventurier</div>
        <div class="selector">
            <button class="tiki-btn small" @click="previous" aria-label="Précédent">&lsaquo;</button>

            <!-- Créateur de personnage (première option) -->
            <div class="tiki-panel character" v-if="isCreator">
                <!-- Le choix du portrait sera proposé quand les images d'avatar existeront -->
                <div class="creatorHead">
                    <div class="face small-face"><Face :id="creator.id" :name="creator.name" /></div>
                    <div class="creatorInfos">
                        <div class="randRow">
                            <span class="randValue">{{ creator.name }}</span>
                            <button class="tiki-btn small dice" @click="randomName" aria-label="Prénom aléatoire">&#127922;</button>
                        </div>
                        <div class="randRow">
                            <span class="randValue jobValue">{{ creatorJob }}, {{ creator.age }} ans</span>
                            <button class="tiki-btn small dice" @click="randomJobAndAge" aria-label="Métier et âge aléatoires">&#127922;</button>
                        </div>
                    </div>
                </div>
                <div class="sexRow">
                    <button class="tiki-btn small toggle" :class="{ active: creator.sex == 'M' }" @click="setSex('M')">Homme</button>
                    <button class="tiki-btn small toggle" :class="{ active: creator.sex == 'F' }" @click="setSex('F')">Femme</button>
                </div>

                <div class="points">Points répartis : {{ creatorTotal }} / {{ creatorRules.points }}</div>
                <div class="creatorAttributes">
                    <div v-for="(value, attr) in creator.attributes" :key="attr" class="attribute">
                        <span class="attrName statIcon" :title="attr"><StatIcon :stat="attr" size="1.3em" /></span>
                        <button class="tiki-btn small step" :disabled="!canAdjust(attr, -1)" @click="adjust(attr, -1)" aria-label="Diminuer">&minus;</button>
                        <span class="attrValue">{{ value }}</span>
                        <button class="tiki-btn small step" :disabled="!canAdjust(attr, 1)" @click="adjust(attr, 1)" aria-label="Augmenter">+</button>
                    </div>
                </div>
            </div>

            <!-- Personnage de la réserve -->
            <div class="tiki-panel character" v-else-if="selected">
                <div class="face"><Face :id="selected.id" :name="selected.name" /></div>
                <div class="name">{{ selected.name }}</div>
                <div v-if="selected.rarity"><span class="rarity" :class="'rarity-' + selected.rarity.toLowerCase()">{{ rarityLabel(selected.rarity) }}</span></div>
                <div class="infos">{{ selected.job }}, {{ selected.age }} ans</div>
                <div class="attributes">
                    <div v-for="(value, attr) in selected.attributes" :key="attr" class="attribute">
                        <span class="attrName statIcon" :title="attr"><StatIcon :stat="attr" size="1.3em" /></span>
                        <span class="attrBar"><span class="attrFill" :style="{ width: Math.min(value, 10) * 10 + '%' }"></span></span>
                        <span class="attrValue">{{ value }}</span>
                    </div>
                </div>
            </div>

            <button class="tiki-btn small" @click="next" aria-label="Suivant">&rsaquo;</button>
        </div>
        <div class="actions">
            <button class="tiki-btn" @click="onStart">Commencer</button>
            <button class="tiki-btn secondary" @click="onBack">Retour</button>
        </div>
    </div>
</template>
<script>
import { defineComponent } from 'vue'
import Face from 'src/components/game/Face.vue';
import { Character, RarityLabel } from 'src/model/Character';
import { randomFirstName, randomJobEntry, randomAge, pick } from 'src/model/CandidateGenerator';
import { isUnlocked } from 'src/content/ProfileStore';
import StatIcon from 'src/components/game/StatIcon.vue';

export default defineComponent({
  name: 'CharSelectionPage',
  components: { StatIcon, Face },
  emits: ['back','start'],
  props: {
    // Réserve complète de personnages ; seuls les personnages débloqués sont proposés
    characters: {
        type: Array,
        default: () => []
    },
    resources: {
        type: Object,
        required: true
    },
    profile: {
        type: Object,
        required: true
    }
  },
  data: function(){
    const rules = this.resources.generation.creator;
    const sex = pick(["M", "F"]);
    const attributes = {};
    ["STR", "INT", "SWI", "AGI", "OBS", "SOC"].forEach((a) => { attributes[a] = rules.base; });
    return {
        // 0 = créateur de personnage, puis les personnages jouables
        selectedIndex: 0,
        creator: {
            sex: sex,
            name: randomFirstName(this.resources, sex, []),
            jobEntry: randomJobEntry(this.resources),
            age: randomAge(this.resources),
            attributes: attributes
        }
    }
  },
  computed: {
    creatorRules(){
        return this.resources.generation.creator;
    },
    creatorTotal(){
        return Object.values(this.creator.attributes).reduce((sum, v) => sum + v, 0);
    },
    creatorJob(){
        return this.creator.jobEntry[this.creator.sex == 'M' ? 'm' : 'f'];
    },
    playable(){
        return this.characters.filter((c) => isUnlocked(this.profile, c));
    },
    isCreator(){
        return this.selectedIndex == 0;
    },
    selected(){
        return this.playable[this.selectedIndex - 1];
    }
  },
  methods: {
    rarityLabel(rarity){
        return RarityLabel[rarity];
    },
    setSex(sex){
        if(this.creator.sex != sex){
            this.creator.sex = sex;
            // Changer de sexe change aussi le prénom (le métier est ré-accordé automatiquement)
            this.randomName();
        }
    },
    randomName(){
        this.creator.name = randomFirstName(this.resources, this.creator.sex, [this.creator.name]);
    },
    // Un seul tirage pour le métier et l'âge
    randomJobAndAge(){
        this.creator.jobEntry = randomJobEntry(this.resources);
        this.creator.age = randomAge(this.resources);
    },
    canAdjust(attr, delta){
        const value = this.creator.attributes[attr] + delta;
        if(value < this.creatorRules.min || value > this.creatorRules.max){
            return false;
        }
        // Jamais plus de points au total que le budget
        return this.creatorTotal + delta <= this.creatorRules.points;
    },
    adjust(attr, delta){
        if(this.canAdjust(attr, delta)){
            this.creator.attributes[attr] += delta;
        }
    },
    onBack(){
        this.$emit('back');
    },
    onStart(){
        if(this.isCreator){
            this.$emit('start', new Character({
                id: 'custom',
                name: this.creator.name,
                sex: this.creator.sex,
                age: this.creator.age,
                job: this.creatorJob,
                attributes: { ...this.creator.attributes }
            }));
        } else {
            this.$emit('start', this.selected);
        }
    },
    next(){
        this.selectedIndex++;
        if(this.selectedIndex > this.playable.length){
            this.selectedIndex = 0;
        }
    },
    previous(){
        this.selectedIndex--;
        if(this.selectedIndex < 0){
            this.selectedIndex = this.playable.length;
        }
    }
  }
})
</script>
<style scoped>
.small-title {
    font-size: clamp(1.4rem, 5vw, 2rem);
    margin-bottom: 10px;
}
.selector {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    width: 100%;
    max-width: 560px;
}
.character {
    flex: 1;
    padding: 10px 12px;
    min-width: 0;
}
/* Créateur compact : tout tient sans faire défiler la page */
.creatorHead {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 6px;
}
.face.small-face {
    flex: none;
    width: 56px;
    height: 56px;
    line-height: 48px;
    margin: 0;
    font-size: 1.8rem;
    border-width: 3px;
}
.creatorInfos {
    flex: 1;
    min-width: 0;
}
.jobValue {
    font-size: 0.9rem;
    font-weight: 700;
}
.dice {
    padding: 2px 8px;
    font-size: 1.1rem;
    line-height: 1.3;
}
.creatorAttributes {
    display: flex;
    flex-direction: column;
}
.creatorAttributes .attribute {
    margin: 2px 0;
    gap: 4px;
}
.creatorAttributes .attrName {
    width: 2.6em;
    font-size: 1.2rem;
    text-align: center;
}
.statIcon {
    font-size: 1.2rem;
    text-align: center;
}
.creatorAttributes .attrValue {
    flex: 1;
    width: auto;
    text-align: center;
}
.face {
    width: 96px;
    height: 96px;
    line-height: 96px;
    margin: 0 auto 12px;
    border-radius: 50%;
    font-size: 3rem;
    font-weight: 900;
    color: var(--sand-soft);
    background-color: var(--wood-dark);
    border: 4px solid var(--wood-light);
}
.name {
    font-family: var(--font-display);
    font-size: 1.6rem;
    font-weight: 400;
}
.infos {
    margin: 4px 0 14px;
}
.sexRow {
    display: flex;
    justify-content: center;
    gap: 8px;
    margin-bottom: 6px;
}
.toggle {
    opacity: 0.55;
}
.toggle.active {
    opacity: 1;
    background-color: var(--amber);
}
.randRow {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin: 3px 0;
}
.randValue {
    flex: 1;
    font-size: 1.1rem;
    font-weight: 900;
    text-align: left;
}
.points {
    margin: 6px 0 2px;
    font-weight: 700;
}
.attribute {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 4px 0;
    font-weight: 700;
}
.attrName {
    width: 3em;
    text-align: left;
}
.attrBar {
    flex: 1;
    height: 12px;
    border-radius: 6px;
    background-color: var(--wood-light);
    overflow: hidden;
}
.attrFill {
    display: block;
    height: 100%;
    background-color: var(--amber);
}
.attrValue {
    width: 1.5em;
    text-align: right;
}
.step {
    padding: 2px 10px;
    min-width: 32px;
}
.step:disabled {
    opacity: 0.35;
    cursor: default;
}
.actions {
    display: flex;
    gap: 12px;
    width: 100%;
    max-width: 420px;
    margin-top: 14px;
}
.actions .tiki-btn {
    flex: 1;
    width: auto;
    margin: 6px 0;
    padding: 10px 12px;
}
</style>
