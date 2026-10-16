<template>
    <div>
        <button class="debugBtn" @click="open = true">&#128030; Journal (DEBUG)</button>
        <q-dialog v-model="open">
            <div class="tiki-panel journal">
                <div class="journalTitle">Journal ({{ entries.length }}) &mdash; DEBUG</div>
                <div class="list">
                    <div v-if="!entries.length" class="empty">Aucun évènement enregistré pour le moment.</div>
                    <div v-for="(e, i) in entries" :key="i" class="entry" :class="typeClass(e.type)">
                        <div class="head">
                            <span class="day">Jour {{ e.day }}</span>
                            <span class="type">{{ e.type }}</span>
                            <span class="delta" v-if="e.data && e.data.gauge">{{ e.data.gauge }} {{ e.data.value > 0 ? '+' : '' }}{{ e.data.value }}</span>
                        </div>
                        <div class="description">{{ e.description }}</div>
                        <div class="participants">{{ names(e) }}</div>
                    </div>
                </div>
                <button class="tiki-btn secondary closeBtn" @click="open = false">Fermer</button>
            </div>
        </q-dialog>
    </div>
</template>
<script>
import { defineComponent } from 'vue'
import { Game } from 'src/model/Game';

/**
 * Bouton + fenêtre de consultation du journal (GameHistory). Outil de débogage : affiche aussi les valeurs d'AFF / REP.
 */
export default defineComponent({
    props: {
        game: {
            type: Game
        }
    },
    data() {
        return { open: false };
    },
    computed: {
        // Les évènements de l'équipe adverse (tous les participants dans l'autre équipe au moment des faits) sont masqués
        entries() {
            const myTeam = this.game.getEntityByName('{player}').team;
            return this.game.history.entries.filter((e) => {
                const adverse = e.teams.length > 0 && e.teams.every((t) => t != 'NONE' && t != myTeam);
                return !adverse;
            });
        }
    },
    methods: {
        names(entry) {
            return entry.participants.map((id) => {
                const c = this.game.getEntityById(id);
                return c ? c.name : id;
            }).join(', ');
        },
        typeClass(type) {
            return type == 'CHALLENGE_SUCCESS' || type == 'GOOD_MOMENT' ? 'positive' : 'negative';
        }
    }
})
</script>
<style scoped>
/* En bas au centre, sous les boutons de choix (rien sur les côtés de l'écran de jeu) */
.debugBtn {
    position: fixed;
    left: 50%;
    bottom: 2px;
    transform: translateX(-50%);
    z-index: 10;
    padding: 1px 10px;
    font-size: 0.65rem;
    font-weight: 700;
    cursor: pointer;
    color: var(--sand-soft);
    background-color: rgba(33, 20, 17, 0.85);
    border: 2px dashed var(--sand-soft);
    border-radius: 8px;
}
.journal {
    width: min(520px, 94vw);
    max-height: 88vh;
    display: flex;
    flex-direction: column;
    padding: 14px;
}
.journalTitle {
    font-size: 1.2rem;
    font-weight: 900;
    text-align: center;
    margin-bottom: 8px;
}
.list {
    flex: 1;
    overflow-y: auto;
}
.empty {
    padding: 12px;
    text-align: center;
    opacity: 0.7;
}
.entry {
    margin: 6px 0;
    padding: 6px 10px;
    border-left: 6px solid var(--jungle-soft);
    background-color: rgba(33, 20, 17, 0.08);
    border-radius: 6px;
}
.entry.negative {
    border-left-color: var(--team-red);
}
.head {
    display: flex;
    gap: 8px;
    font-size: 0.75rem;
    font-weight: 700;
    opacity: 0.85;
}
.delta {
    margin-left: auto;
}
.description {
    font-weight: 700;
}
.participants {
    font-size: 0.8rem;
    opacity: 0.75;
}
.closeBtn {
    margin-bottom: 0;
}
</style>
