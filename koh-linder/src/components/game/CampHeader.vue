<template>
    <!-- Bandeau sable du camp : ressources, feu, cabane et ruban des périodes -->
    <div class="campHeader">
        <div class="resources">
            <div class="res"><span class="value display-font">{{ camp.resources.water }}<small>/{{ waterMax }}</small></span><span>Eau</span></div>
            <div class="res"><span class="value display-font">{{ camp.resources.wood }}</span><span>Bois</span></div>
            <div class="res"><span class="value display-font">{{ camp.resources.food }}</span><span>Vivres</span></div>
            <div class="res" :class="{ off: !camp.equipements.fire }">
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" :fill="camp.equipements.fire ? 'var(--team-red-soft)' : 'none'" stroke="var(--wood-dark)" stroke-width="1.6" stroke-linejoin="round"><path d="M12 22c4 0 7-2.6 7-6.5 0-3.2-2.4-5.6-3.6-8-1 2-2 3-3.4 3.4C12.5 7.5 11 4.5 8.5 2 8.5 6 5 9 5 15.5 5 19.4 8 22 12 22z" /></svg>
                <span>Feu {{ camp.equipements.fire ? 'allumé' : 'éteint' }}</span>
            </div>
        </div>
        <div class="cabin">
            <span class="label">{{ project.name }}</span>
            <div class="steps" role="img" :aria-label="project.name + ' ' + project.done + ' sur ' + project.steps">
                <span v-for="n in project.steps" :key="n" class="step" :class="{ done: n <= project.done }"></span>
            </div>
            <span class="label">{{ project.done }}/{{ project.steps }}</span>
        </div>
        <div class="periods">
            <span v-for="p in periods" :key="p.key" class="period" :class="{ current: p.current, past: p.past }">{{ p.label }}</span>
        </div>
    </div>
</template>
<script>
import { defineComponent } from 'vue'
import { Game } from 'src/model/Game';
import { CAMP_RESOURCE_MAX, CAMP_PROJECTS } from 'src/model/Team';
import { PERIOD_ORDER, PERIOD_LABELS } from 'src/model/Time';

/**
 * Bandeau sous le header, hors épreuves : ressources du camp de l'équipe du joueur et avancée de la journée.
 */
export default defineComponent({
    props: {
        game: {
            type: Game
        }
    },
    computed: {
        camp() {
            return this.game.teamOf(this.game.getEntityByName('{player}')).camp;
        },
        waterMax() {
            return CAMP_RESOURCE_MAX.water;
        },
        // Projet de construction en cours (la cabane tant qu'elle n'est pas finie), sinon la cabane terminée
        project() {
            const camp = this.camp;
            const id = !camp.cabinDone ? 'CABIN' : (camp.extraProject && !camp.projectDone(camp.extraProject) ? camp.extraProject : null);
            const def = CAMP_PROJECTS[id || 'CABIN'];
            return { name: def.name, steps: def.steps, done: camp.projectSteps(id || 'CABIN') };
        },
        periods() {
            const idx = PERIOD_ORDER.indexOf(this.game.period);
            return PERIOD_ORDER.map((p, i) => ({
                key: p,
                label: p == 'AFTERNOON' ? 'Ap.-midi' : PERIOD_LABELS[p],
                current: i == idx,
                past: idx >= 0 && i < idx
            }));
        }
    }
})
</script>
<style scoped>
.campHeader {
    display: flex;
    flex-direction: column;
    gap: 7px;
    padding: 8px 10px;
    color: var(--wood-dark);
    background-color: var(--sand-soft);
    border: 2px solid var(--wood-light);
    border-radius: 10px;
    box-shadow: 0 4px 0 var(--wood-light);
}
.resources {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    text-align: center;
    font-size: 0.7rem;
}
.res {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1px;
}
.res + .res {
    border-left: 1px solid var(--sand-deep);
}
.res.off {
    opacity: 0.7;
}
.value {
    font-size: 1.05rem;
    line-height: 1.1;
}
.value small {
    font-size: 0.65rem;
}
.cabin {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.7rem;
}
.label {
    font-weight: 700;
}
.steps {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(15, minmax(0, 1fr));
    gap: 2px;
}
.step {
    height: 8px;
    border-radius: 2px;
    background-color: #cdb680;
}
.step.done {
    background-color: var(--wood-mid);
}
.periods {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    border-radius: 6px;
    overflow: hidden;
    background-color: var(--wood-light);
}
.period {
    padding: 3px 0;
    text-align: center;
    font-size: 0.62rem;
    font-weight: 700;
    color: var(--sand-soft);
}
.period.past {
    color: #a88a6a;
}
.period.current {
    color: var(--wood-dark);
    background-color: var(--amber);
}
</style>
