<template>
    <!-- Texte du jeu mis en forme : prénom du joueur surligné, résultats de jets (symbole de la stat sur fond vert / rouge),
         symboles de stats en SVG (marqueurs de Personalize.js) -->
    <span class="richText"><template v-for="(seg, i) in segments" :key="i"><mark v-if="seg.kind == 'me'" class="me">{{ seg.text }}</mark><span
        v-else-if="seg.kind == 'roll'" class="rollGroup" :class="seg.ok ? 'ok' : 'fail'" :title="seg.ok ? 'Réussite' : 'Échec'"><StatIcon
        v-for="(stat, j) in seg.stats" :key="j" :stat="stat" /></span><StatIcon v-else-if="seg.kind == 'stat'" :stat="seg.stat" /><template
        v-else>{{ seg.text }}</template></template></span>
</template>
<script>
import { defineComponent } from 'vue'
import { splitRich } from 'src/model/Personalize';
import StatIcon from './StatIcon.vue';

export default defineComponent({
    components: {
        StatIcon
    },
    props: {
        text: {
            type: String,
            default: ''
        }
    },
    computed: {
        segments() {
            return splitRich(this.text || '');
        }
    }
})
</script>
<style scoped>
/* Résultat d'un jet de dé : symbole(s) de la stat testée dans une pastille verte (réussite) ou rouge (échec) ; un jet joint ou
   combiné montre un symbole par jet côte à côte */
.rollGroup {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 2px;
    border-radius: 999px;
    vertical-align: middle;
    background-color: #2e7d32;
}
.rollGroup.fail {
    background-color: #c62828;
}
/* Prénom du joueur dans les comptes rendus d'action : surligné pour le démarquer */
.me {
    padding: 0 4px;
    border-radius: 4px;
    font-weight: 700;
    color: var(--wood-dark);
    background-color: var(--amber);
}
</style>
