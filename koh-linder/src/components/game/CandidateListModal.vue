<template>
    <q-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)">
        <div class="tiki-panel listPanel">
            <div class="listTitle">Candidats</div>
            <div class="list">
                <div v-for="candidate in ordered" :key="candidate.name" class="row" :class="{ eliminated: candidate.eliminated }">
                    <div class="avatar" :style="avatarStyle(candidate)">{{ candidate.name.charAt(0) }}</div>
                    <div class="who">
                        <div class="name">{{ candidate.name }}<span v-if="candidate.isPlayer"> (vous)</span></div>
                        <div class="job">{{ candidate.job }}, {{ candidate.age }} ans</div>
                    </div>
                </div>
            </div>
            <button class="tiki-btn secondary closeBtn" @click="$emit('update:modelValue', false)">Fermer</button>
        </div>
    </q-dialog>
</template>
<script>
import { defineComponent } from 'vue'
import { Game } from 'src/model/Game';
import { TeamCssColor } from 'src/model/Team';
import { sortForPlayer } from 'src/model/Decision';

// Aucune jauge relationnelle (AFF/REP) n'est affichée ici : elles doivent rester cachées au joueur.
// Seul l'ordre (joueur en tête, puis meilleurs scores de relation) en découle.
export default defineComponent({
    props: {
        game: {
            type: Game
        },
        modelValue: {
            type: Boolean,
            default: false
        }
    },
    emits: ['update:modelValue'],
    computed: {
        // Triés selon l'opinion du joueur sur chacun (seul l'ordre est visible, jamais les valeurs)
        ordered() {
            return sortForPlayer(this.game.getEntityByName('{player}'), this.game.candidates);
        }
    },
    methods: {
        avatarStyle(candidate) {
            // Bordure de la couleur d'équipe uniquement si le candidat a une équipe
            const color = TeamCssColor[candidate.team];
            return color ? { borderColor: color } : {};
        }
    }
})
</script>
<style scoped>
.listPanel {
    width: min(420px, 92vw);
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    padding: 16px;
}
.listTitle {
    font-family: var(--font-display);
    font-size: 1.4rem;
    font-weight: 400;
    text-align: center;
    margin-bottom: 8px;
}
.list {
    flex: 1;
    overflow-y: auto;
}
.row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px 0;
}
.avatar {
    flex: none;
    width: 38px;
    height: 38px;
    line-height: 32px;
    box-sizing: border-box;
    text-align: center;
    font-weight: 900;
    border-radius: 50%;
    color: var(--sand-soft);
    background-color: var(--wood-dark);
    border: 3px solid transparent;
}
.name {
    font-weight: 700;
    line-height: 1.1;
}
.job {
    font-size: 0.8rem;
    opacity: 0.75;
}
.eliminated {
    opacity: 0.4;
    filter: grayscale(1);
}
.closeBtn {
    margin-bottom: 0;
}
</style>
