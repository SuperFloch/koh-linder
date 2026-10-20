<template>
    <!-- Carte boussole de la vie de camp (Maquette : piste E) : chaque option est placée dans le sens de son swipe, avec les
         avatars des coéquipiers qui ont fait le même choix. Toucher une option = swiper dans ce sens. -->
    <div class="campCompass">
        <div class="meta">
            <span>{{ view.period }}<template v-if="view.action"> · action {{ view.action }}</template></span>
            <template v-if="view.place"><span aria-hidden="true">›</span><span class="placeChip">{{ view.place }}</span></template>
            <span v-if="view.step" class="step">{{ view.step }}</span>
        </div>
        <div class="question display-font">{{ view.question }}</div>
        <div v-if="view.notice" class="notice">{{ view.notice }}</div>
        <div v-else-if="view.hint" class="hint">{{ view.hint }}</div>

        <div class="compass" :class="{ flat: !hasVertical }">
            <button v-for="o in view.options" :key="o.dir" class="tile" :class="['dir-' + o.dir, { blocked: o.blocked, active: active == o.dir }]"
                :title="o.blocked || ''" @click="$emit('choose', o.dir)">
                <svg v-if="o.place == 'FOREST'" class="placeIcon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 5 13h4l-3 5h12l-3-5h4z" /><path d="M12 18v3" /></svg>
                <svg v-else-if="o.place == 'SEA'" class="placeIcon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 9c3-3 5-3 8 0s5 3 8 0 3-2 4-1" /><path d="M2 15c3-3 5-3 8 0s5 3 8 0 3-2 4-1" /></svg>
                <svg v-else-if="o.place == 'CAMP'" class="placeIcon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12 12 4l9 8" /><path d="M5 11v9h14v-9" /><path d="M10 20v-5h4v5" /></svg>
                <span class="label display-font"><span v-if="o.dir == 'left' || o.dir == 'up'" class="arrow" aria-hidden="true">{{ arrows[o.dir] }}</span> {{ o.label }} <span v-if="o.dir == 'right' || o.dir == 'down'" class="arrow" aria-hidden="true">{{ arrows[o.dir] }}</span></span>
                <span v-if="o.sub" class="sub">{{ o.sub }}</span>
                <span v-if="o.stats.length || o.chips.length" class="chips">
                    <span v-if="o.stats.length" class="chip stat"><StatIcon v-for="s in o.stats" :key="s" :stat="s" size="19px" />{{ o.level }}</span>
                    <span v-for="(c, i) in o.chips" :key="i" class="chip" :class="c.kind">{{ c.text }}</span>
                </span>
                <span v-if="o.people.length" class="people" :title="o.people.map((p) => p.name).join(', ')">
                    <span v-for="p in o.people.slice(0, maxAvatars)" :key="p.name" class="avatar" :style="avatarStyle(p)">{{ p.name.charAt(0) }}</span>
                    <span v-if="o.people.length > maxAvatars" class="avatar more">+{{ o.people.length - maxAvatars }}</span>
                </span>
                <span v-if="o.blocked" class="blockedNote">indisponible</span>
            </button>
            <div class="center display-font" :style="{ borderColor: teamColor || 'var(--amber)' }" :title="view.player.name">{{ view.player.name.charAt(0) }}</div>
        </div>

        <!-- Coéquipiers dont le choix n'est pas parmi les options affichées (ex. « discuter », proposé dans chaque lieu) -->
        <div v-if="view.elsewhere.length" class="elsewhere">
            <span v-for="p in view.elsewhere" :key="p.name" class="avatar small" :style="avatarStyle(p)" :title="p.name">{{ p.name.charAt(0) }}</span>
            <span>{{ elsewhereText }}</span>
        </div>
    </div>
</template>
<script>
import { defineComponent } from 'vue'
import StatIcon from './StatIcon.vue';

// Couleurs d'avatar (en attendant les portraits) : une par candidat, tirée de son prénom
const AVATAR_COLORS = ['#6b4129', '#1d3f63', '#2f5a26', '#8a3b2a', '#3d4f5c', '#7a5a1e', '#4a2c5a', '#1e6a72'];
const ARROWS = { left: '←', up: '↑', right: '→', down: '↓' };

export default defineComponent({
    components: {
        StatIcon
    },
    emits: ['choose'],
    props: {
        // CampLife.view
        view: {
            type: Object,
            required: true
        },
        // Couleur de l'équipe du joueur (anneau des avatars)
        teamColor: {
            type: String,
            default: ''
        },
        // Sens du swipe en cours (mise en avant de l'option visée)
        active: {
            type: String,
            default: null
        }
    },
    data() {
        // Au-delà de 4 coéquipiers sur une option, les suivants sont résumés par « +N » (le survol donne tous les prénoms)
        return { arrows: ARROWS, maxAvatars: 4 };
    },
    computed: {
        // Options haut / bas présentes : sinon (réveil, repas, nuit) la croix n'a qu'un trait horizontal
        hasVertical() {
            return this.view.options.some((o) => o.dir == 'up' || o.dir == 'down');
        },
        elsewhereText() {
            const list = this.view.elsewhere;
            const names = list.map((p) => p.name);
            const joined = names.length > 1 ? names.slice(0, -1).join(', ') + ' et ' + names[names.length - 1] : names[0];
            const talk = list.every((p) => p.action == 'discussion');
            if (talk) {
                return joined + (names.length > 1 ? ' veulent' : ' veut') + ' discuter, où que vous alliez';
            }
            return joined + (names.length > 1 ? ' ont' : ' a') + ' choisi autre chose';
        }
    },
    methods: {
        avatarStyle(p) {
            var h = 0;
            for (const ch of p.name) {
                h = (h * 31 + ch.charCodeAt(0)) % 997;
            }
            return { backgroundColor: AVATAR_COLORS[h % AVATAR_COLORS.length], borderColor: this.teamColor || 'var(--wood-dark)' };
        }
    }
})
</script>
<style scoped>
.campCompass {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px 8px 8px;
}
.meta {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 4px;
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--wood-mid);
}
.placeChip {
    padding: 1px 8px;
    border-radius: 999px;
    color: var(--cream);
    background-color: var(--jungle-soft);
}
.step {
    margin-left: auto;
}
.question {
    padding: 0 4px;
    font-size: 1.3rem;
    line-height: 1.1;
}
.hint, .notice {
    padding: 0 4px;
    font-size: 0.75rem;
    color: var(--wood-mid);
}
.notice {
    align-self: flex-start;
    margin: 0 4px;
    padding: 3px 8px;
    border-radius: 6px;
    font-weight: 700;
    color: var(--cream);
    background-color: #b8402c;
}
/* Boussole : haut / gauche - centre - droite / bas, reliés par une croix en pointillés */
.compass {
    position: relative;
    flex: 1;
    min-height: 0;
    margin-top: 6px;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 46px minmax(0, 1fr);
    grid-template-rows: auto auto auto;
    grid-template-areas: "up up up" "left center right" "down down down";
    align-items: center;
    align-content: space-evenly;
    gap: 10px 4px;
}
.compass::before, .compass::after {
    content: "";
    position: absolute;
    pointer-events: none;
    border: 0 dashed var(--sand-deep);
}
.compass::before {
    left: 50%;
    top: 12px;
    bottom: 12px;
    border-left-width: 3px;
    transform: translateX(-1.5px);
}
.compass.flat::before {
    display: none;
}
.compass::after {
    top: 50%;
    left: 8px;
    right: 8px;
    border-top-width: 3px;
    transform: translateY(-1.5px);
}
.tile {
    position: relative;
    z-index: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 7px 6px;
    font-family: var(--font-body);
    text-align: center;
    color: var(--cream);
    border: 2px solid var(--wood-dark);
    border-radius: 10px;
    box-shadow: 0 3px 0 var(--wood-dark);
    cursor: pointer;
    transition: transform 0.12s, box-shadow 0.12s;
}
.tile.dir-left { grid-area: left; background-color: var(--jungle-soft); }
.tile.dir-right { grid-area: right; background-color: var(--sea-soft); }
.tile.dir-up, .tile.dir-down {
    justify-self: center;
    width: min(100%, 210px);
}
.tile.dir-up { grid-area: up; color: var(--wood-dark); background-color: var(--cream); }
.tile.dir-down { grid-area: down; color: var(--wood-dark); background-color: var(--amber); }
.tile.dir-up .arrow { color: #1e7a8f; }
.tile.active {
    transform: translateY(-2px) scale(1.04);
    box-shadow: 0 5px 0 var(--wood-dark), 0 0 0 3px var(--amber);
}
.tile.blocked {
    opacity: 0.55;
}
.placeIcon {
    width: 22px;
    height: 22px;
}
.label {
    font-size: 0.95rem;
    line-height: 1.05;
}
.sub {
    font-size: 0.65rem;
    opacity: 0.85;
}
.chips {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 3px;
}
.chip {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 1px 6px;
    border-radius: 999px;
    font-size: 0.62rem;
    font-weight: 700;
    white-space: nowrap;
    color: var(--wood-dark);
    background-color: #dcc684;
}
.chip.stat {
    padding-left: 1px;
}
.chip.gain {
    color: var(--cream);
    background-color: #2f7a2a;
}
.dir-left .chip.gain { color: var(--jungle-soft); background-color: var(--cream); }
.chip.cost { background-color: #dcc684; }
.chip.info { background-color: #f2e6bf; }
.people {
    display: flex;
    padding-left: 6px;
}
.avatar {
    width: 26px;
    height: 26px;
    margin-left: -6px;
    box-sizing: border-box;
    border-radius: 50%;
    border: 2px solid var(--wood-dark);
    color: var(--cream);
    font-size: 0.68rem;
    font-weight: 700;
    line-height: 22px;
    text-align: center;
}
.avatar.more {
    color: var(--wood-dark);
    background-color: var(--cream);
}
.avatar.small {
    width: 22px;
    height: 22px;
    margin-left: 0;
    line-height: 18px;
    font-size: 0.6rem;
}
.blockedNote {
    font-size: 0.6rem;
    font-style: italic;
}
.center {
    grid-area: center;
    justify-self: center;
    position: relative;
    z-index: 1;
    width: 44px;
    height: 44px;
    box-sizing: border-box;
    border-radius: 50%;
    border: 3px solid var(--amber);
    background-color: var(--wood-dark);
    color: var(--sand-soft);
    font-size: 1.1rem;
    line-height: 38px;
    text-align: center;
}
.elsewhere {
    align-self: center;
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 6px;
    padding: 2px 10px 2px 3px;
    border-radius: 999px;
    font-size: 0.68rem;
    color: var(--wood-light);
    background-color: #dcc684;
}
</style>
