<template>
    <div class="screen">
        <div class="screen-title small-title">Épreuves (DEBUG)</div>
        <div class="hint">Lance une épreuve seule avec un joueur et des candidats aléatoires. Aucun Koh-point n'est gagné.</div>
        <div class="list">
            <div v-for="entry in challenges" :key="entry.id" class="tiki-panel entry">
                <div class="head">
                    <span class="name">{{ entry.name }}</span>
                    <span class="context" :class="entry.context == 'TEAM' ? 'team' : 'solo'">{{ entry.context == 'TEAM' ? 'Équipe' : 'Individuelle' }}</span>
                </div>
                <div class="description">{{ entry.description }}</div>
                <div class="meta">{{ entry.id }}{{ entry.random ? ' · tirée au sort les jours d\'épreuve' : ' · épreuve de l\'histoire' }}</div>
                <button class="tiki-btn launch" @click="$emit('launch', entry)">Lancer</button>
            </div>
            <div v-if="!challenges.length" class="tiki-panel entry">Aucune épreuve dans le catalogue (manifest.json → challenges).</div>
        </div>
        <div class="actions">
            <button class="tiki-btn secondary" @click="$emit('back')">Retour</button>
        </div>
    </div>
</template>
<script>
import { defineComponent } from 'vue'

/**
 * Page de débogage : liste de toutes les épreuves du catalogue, à lancer individuellement.
 */
export default defineComponent({
  name: 'ChallengeDebugPage',
  emits: ['back', 'launch'],
  props: {
    challenges: {
        type: Array,
        default: () => []
    }
  }
})
</script>
<style scoped>
.small-title {
    font-size: clamp(1.6rem, 6vw, 2.4rem);
    margin-bottom: 8px;
}
.hint {
    margin-bottom: 14px;
    font-size: 0.85rem;
    opacity: 0.8;
}
.list {
    width: 100%;
    max-width: 560px;
}
.entry {
    margin: 10px 0;
    padding: 12px 14px;
    text-align: left;
}
.head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
}
.name {
    font-size: 1.2rem;
    font-weight: 900;
}
.context {
    padding: 1px 10px;
    font-size: 0.75rem;
    font-weight: 900;
    border-radius: 10px;
    border: 2px solid var(--wood);
    color: var(--sand);
}
.context.team {
    background-color: var(--sea);
}
.context.solo {
    background-color: var(--jungle);
}
.description {
    margin: 6px 0;
}
.meta {
    font-size: 0.75rem;
    opacity: 0.7;
}
.launch {
    width: 100%;
    margin: 10px 0 0;
    padding: 8px 12px;
}
.actions {
    width: 100%;
    max-width: 320px;
    margin-top: 16px;
}
</style>
