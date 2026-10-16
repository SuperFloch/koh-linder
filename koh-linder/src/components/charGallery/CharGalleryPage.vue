<template>
    <div class="screen">
        <div class="screen-title small-title">Aventuriers</div>
        <div class="balance tiki-panel">Koh-points : <strong>{{ profile.kohPoints }}</strong></div>
        <div class="hint">1 Koh-point = 1 jour de survie dans l'aventure. Touchez un aventurier jouable pour voir sa fiche.</div>

        <!-- Grille : avatar (bordure = rareté), nom, prix ou « Jouable » -->
        <div class="gallery">
            <div v-for="character in characters" :key="character.id" class="tile tiki-panel"
                :class="{ locked: !unlocked(character), playable: unlocked(character) }" @click="open(character)">
                <div class="face" :class="'rarity-' + rarityKey(character)">{{ character.name.charAt(0) }}</div>
                <div class="name">{{ character.name }}</div>
                <div class="status" v-if="unlocked(character)">&#10003; Jouable</div>
                <button v-else class="tiki-btn unlockBtn" :disabled="profile.kohPoints < character.unlockCost" @click.stop="$emit('unlock', character)">
                    {{ character.unlockCost }} Koh-points
                </button>
            </div>
        </div>

        <div class="actions">
            <button class="tiki-btn secondary" @click="$emit('back')">Retour</button>
        </div>

        <!-- Fiche détaillée d'un aventurier jouable -->
        <div class="overlay" v-if="selected" @click.self="selected = null">
            <div class="modal tiki-panel">
                <div class="face big" :class="'rarity-' + rarityKey(selected)">{{ selected.name.charAt(0) }}</div>
                <div class="modalName">{{ selected.name }}</div>
                <div><span class="rarity" :class="'rarity-' + rarityKey(selected)">{{ rarityLabel(selected.rarity) }}</span></div>
                <div class="infos">{{ selected.job }}, {{ selected.age }} ans</div>
                <div class="bio" v-if="selected.bio">{{ selected.bio }}</div>
                <div class="attributes">
                    <div v-for="(value, attr) in selected.attributes" :key="attr" class="attribute">
                        <span class="attrName">{{ attr }}</span>
                        <span class="attrBar"><span class="attrFill" :style="{ width: Math.min(value, 10) * 10 + '%' }"></span></span>
                        <span class="attrValue">{{ value }}</span>
                    </div>
                </div>
                <button class="tiki-btn secondary closeBtn" @click="selected = null">Fermer</button>
            </div>
        </div>
    </div>
</template>
<script>
import { defineComponent } from 'vue'
import { RarityLabel } from 'src/model/Character';
import { isUnlocked } from 'src/content/ProfileStore';

/**
 * Galerie de tous les personnages de la réserve, en grille : on y échange ses Koh-points contre le droit de les jouer.
 * Un personnage jouable ouvre sa fiche (stats, métier, âge, biographie) au clic.
 */
export default defineComponent({
  name: 'CharGalleryPage',
  emits: ['back', 'unlock'],
  props: {
    characters: {
        type: Array,
        default: () => []
    },
    profile: {
        type: Object,
        required: true
    }
  },
  data() {
    return { selected: null };
  },
  methods: {
    unlocked(character){
        return isUnlocked(this.profile, character);
    },
    rarityLabel(rarity){
        return RarityLabel[rarity];
    },
    rarityKey(character){
        return (character.rarity || '').toLowerCase();
    },
    open(character){
        if (this.unlocked(character)) {
            this.selected = character;
        }
    }
  }
})
</script>
<style scoped>
.small-title {
    font-size: clamp(1.8rem, 6vw, 2.8rem);
    margin-bottom: 12px;
}
.balance {
    padding: 6px 20px;
    font-size: 1.1rem;
}
.hint {
    margin: 6px 0 16px;
    font-size: 0.85rem;
    opacity: 0.8;
    text-align: center;
}
.gallery {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 12px;
    width: 100%;
    max-width: 700px;
}
.tile {
    padding: 12px 8px;
    box-sizing: border-box;
    text-align: center;
}
.tile.playable {
    cursor: pointer;
}
.tile.locked .face {
    filter: grayscale(0.8);
    opacity: 0.7;
}
.face {
    width: 72px;
    height: 72px;
    line-height: 66px;
    margin: 0 auto 8px;
    border-radius: 50%;
    font-size: 2.2rem;
    font-weight: 900;
    color: var(--sand);
    background-color: var(--sea);
    box-sizing: border-box;
    border: 5px solid var(--wood);
}
.face.big {
    width: 96px;
    height: 96px;
    line-height: 86px;
    font-size: 3rem;
}
/* Rareté : bordure de l'avatar — Rare bleu, Mythique violet, Légendaire or */
.face.rarity-rare {
    border-color: #3a8dff;
}
.face.rarity-mythic {
    border-color: #9b4dff;
}
.face.rarity-legendary {
    border-color: #ffc83d;
}
.name {
    font-size: 1.2rem;
    font-weight: 900;
}
.status {
    margin-top: 8px;
    font-weight: 900;
    color: var(--jungle);
}
.unlockBtn {
    width: 100%;
    margin: 8px 0 0;
    padding: 6px 4px;
    font-size: 0.85rem;
}
.unlockBtn:disabled {
    opacity: 0.45;
    cursor: default;
}
.actions {
    width: 100%;
    max-width: 320px;
    margin-top: 24px;
}
.overlay {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background-color: rgba(33, 20, 17, 0.75);
}
.modal {
    width: 100%;
    max-width: 420px;
    max-height: 100%;
    overflow-y: auto;
    padding: 20px;
    box-sizing: border-box;
    text-align: center;
}
.modalName {
    font-size: 1.8rem;
    font-weight: 900;
}
.infos {
    margin: 4px 0 10px;
}
.bio {
    margin: 0 0 12px;
    font-size: 0.95rem;
    font-style: italic;
    text-align: left;
}
.attribute {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 3px 0;
    font-weight: 700;
    font-size: 0.9rem;
}
.attrName {
    width: 3em;
    text-align: left;
}
.attrBar {
    flex: 1;
    height: 10px;
    border-radius: 5px;
    background-color: var(--wood);
    overflow: hidden;
}
.attrFill {
    display: block;
    height: 100%;
    background-color: var(--sky);
}
.attrValue {
    width: 1.5em;
    text-align: right;
}
.closeBtn {
    width: 100%;
    margin-top: 16px;
}
</style>
