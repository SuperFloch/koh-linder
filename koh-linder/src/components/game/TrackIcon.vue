<template>
    <!-- Symbole d'une case de minimap (remplace les emojis) : trait bois, quelques aplats de la palette -->
    <svg class="trackIcon" viewBox="0 0 24 24" :width="size" :height="size" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round" role="img" :aria-label="label">
        <title>{{ label }}</title>
        <template v-if="name == 'flag'">
            <path d="M6 21V3" /><path d="M6 4h12l-2.5 4L18 12H6" fill="#f2e6bf" /><path d="M9 4v8M12 4v8M15 4v8" stroke-width="1" />
        </template>
        <template v-else-if="name == 'run'">
            <circle cx="15" cy="4.5" r="2" fill="currentColor" /><path d="M13.5 8 10 13l3.5 2.5V21" /><path d="M10 13l-4.5 1" /><path d="M13.5 8l4 3.5 2.5-1" /><path d="M10 13l-2 4-3 .5" />
        </template>
        <template v-else-if="name == 'hurdle'">
            <path d="M5 21V8M19 21V8" /><rect x="3" y="8" width="18" height="4" rx="1" fill="#f5b942" /><path d="M7 8l3 4M12 8l3 4M17 8l2 3" stroke-width="1.4" />
        </template>
        <template v-else-if="name == 'duo'">
            <circle cx="8" cy="6" r="2.4" fill="currentColor" /><circle cx="16" cy="6" r="2.4" fill="currentColor" /><path d="M4 20v-4c0-2.5 1.8-4.5 4-4.5s4 2 4 4.5M12 16c0-2.5 1.8-4.5 4-4.5s4 2 4 4.5v4" /><path d="M10 15.5h4" />
        </template>
        <template v-else-if="name == 'climb'">
            <path d="M7 3v18M17 3v18M7 7h10M7 12h10M7 17h10" />
        </template>
        <template v-else-if="name == 'palette'">
            <path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-1 1.4-2.2-.7-1.3.2-2.8 1.7-2.8H18a3 3 0 0 0 3-3c0-5.5-4-10-9-10z" fill="#f2e6bf" />
            <circle cx="7.5" cy="11" r="1.4" fill="#e0553f" stroke="none" /><circle cx="10" cy="7" r="1.4" fill="#2a8fb0" stroke="none" /><circle cx="14.5" cy="7" r="1.4" fill="#2f5a26" stroke="none" /><circle cx="17" cy="10.5" r="1.4" fill="#e8c93a" stroke="none" />
        </template>
        <template v-else-if="name == 'fire'">
            <path d="M12 22c4 0 7-2.6 7-6.5 0-3.2-2.4-5.6-3.6-8-1 2-2 3-3.4 3.4C12.5 7.5 11 4.5 8.5 2 8.5 6 5 9 5 15.5 5 19.4 8 22 12 22z" fill="#e0553f" />
            <path d="M12 21c1.8 0 3-1.2 3-3 0-1.6-1-2.6-1.8-3.8-.5 1-1 1.4-1.7 1.6-.2-1.3-.8-2.5-1.8-3.4 0 2-1.7 3-1.7 5.6 0 1.8 1.2 3 3 3z" fill="#f5b942" stroke="none" />
        </template>
        <template v-else-if="name == 'crate'">
            <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z" fill="#c9ae6e" /><path d="M3 7.5 12 12l9-4.5M12 12v9" />
        </template>
        <template v-else-if="name == 'door'">
            <path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17" fill="#c9ae6e" /><path d="M4 21h16" /><path d="M8 8c2 1.5 6 1.5 8 0M8 13c2 1.5 6 1.5 8 0" stroke-width="1.4" /><circle cx="15" cy="11" r="0.6" fill="currentColor" />
        </template>
        <template v-else-if="name == 'mast'">
            <path d="M12 21V8" /><path d="M8 21h8" /><path d="M8 8h8l-1.5 2.5h-5z" fill="#c9ae6e" /><path d="M12 2c1.6 1.6 1.8 3 .9 4.5h-1.8C10.2 5 10.4 3.6 12 2z" fill="#f5b942" />
        </template>
        <template v-else-if="name == 'wave'">
            <path d="M2 9c3-3 5-3 8 0s5 3 8 0 3-2 4-1" /><path d="M2 15c3-3 5-3 8 0s5 3 8 0 3-2 4-1" />
        </template>
        <template v-else-if="name == 'necklace'">
            <path d="M4 5c0 7 3.6 11 8 11s8-4 8-11" stroke-width="1.4" />
            <circle cx="5" cy="9" r="1.6" fill="#f5b942" /><circle cx="7.5" cy="13" r="1.6" fill="#e0553f" /><circle cx="12" cy="16" r="2" fill="#2a8fb0" /><circle cx="16.5" cy="13" r="1.6" fill="#e0553f" /><circle cx="19" cy="9" r="1.6" fill="#f5b942" />
        </template>
        <template v-else-if="name == 'target'">
            <circle cx="12" cy="12" r="9" fill="#f2e6bf" /><circle cx="12" cy="12" r="5.5" fill="#e0553f" /><circle cx="12" cy="12" r="2" fill="#f2e6bf" />
        </template>
        <template v-else-if="name == 'pot'">
            <path d="M9 3h6M10 3v3c-3 1.5-4.5 4-4.5 7 0 4.4 3 8 6.5 8s6.5-3.6 6.5-8c0-3-1.5-5.5-4.5-7V3" fill="#c97a4a" /><path d="M7 12h10" stroke-width="1.4" />
        </template>
        <template v-else-if="name == 'island'">
            <path d="M2 20c3-3 7-4 10-4s7 1 10 4z" fill="#e8d49a" /><path d="M12 16c0-4-1-7-3-9" /><path d="M9 7C6 5.5 4 6 3 7.5M9 7c1-2.5 3.5-3.5 6-2.5M9 7c3 0 5 1.5 5.5 3.5" />
        </template>
        <template v-else-if="name == 'boat'">
            <path d="M3 15h18l-3 5H6z" fill="#6b4129" /><path d="M12 15V3l7 10h-7" fill="#f2e6bf" /><path d="M12 5 6 13h6" fill="#f2e6bf" />
        </template>
        <template v-else-if="name == 'stake'">
            <path d="M12 3v14l-2 4h4l-2-4" /><path d="M7 8c3 1.5 7 1.5 10 0" stroke-width="1.4" /><path d="M7 12c3 1.5 7 1.5 10 0" stroke-width="1.4" />
        </template>
        <template v-else-if="name == 'dagger'">
            <path d="M12 2l2 3v10h-4V5z" fill="#f2e6bf" /><path d="M7 15h10" /><path d="M12 15v5" stroke-width="2.6" /><circle cx="12" cy="21.5" r="0.8" fill="currentColor" />
        </template>
        <template v-else-if="name == 'stick'">
            <path d="M5 19 19 5" stroke-width="3.6" stroke="#6b4129" /><path d="M5 19 19 5" stroke-width="1" /><path d="M9 15l-2-3M14 10l2 3" stroke-width="1.4" />
        </template>
        <template v-else-if="name == 'spool'">
            <path d="M6 3h12M6 21h12" stroke-width="2.4" /><path d="M8 3v18M16 3v18" stroke-width="1.4" /><path d="M8 7h8M8 10h8M8 13h8M8 16h8" stroke="#e0553f" stroke-width="1.6" />
        </template>
        <template v-else-if="name == 'tower'">
            <path d="M8 21 10 6h4l2 15" fill="#c9ae6e" /><path d="M7 21h10M9.4 11h5.2M9 16h6" /><path d="M12 2c1.4 1.4 1.6 2.6.8 4h-1.6c-.8-1.4-.6-2.6.8-4z" fill="#f5b942" />
        </template>
        <template v-else>
            <circle cx="12" cy="12" r="3" fill="currentColor" />
        </template>
    </svg>
</template>
<script>
import { defineComponent } from 'vue'

const LABELS = {
    flag: 'Départ', run: 'Course', hurdle: 'Obstacle', duo: 'Course en duo', climb: 'Courte échelle', palette: 'Couleurs',
    fire: 'Feu', crate: 'Course avec la charge', door: 'Porte nouée', mast: 'Mât', wave: 'Nage', necklace: 'Colliers',
    target: 'Cibles', pot: 'Poteries', island: 'Rive', boat: 'Bateau', stake: 'Pieu', dagger: 'Poignard', stick: 'Bâton',
    spool: 'Bobine', tower: 'Tour'
};

export default defineComponent({
    props: {
        // Nom de l'icône (voir LABELS)
        name: {
            type: String,
            required: true
        },
        size: {
            type: String,
            default: '14px'
        }
    },
    computed: {
        label() {
            return LABELS[this.name] || this.name;
        }
    }
})
</script>
<style scoped>
.trackIcon {
    display: inline-block;
    flex: none;
    vertical-align: middle;
}
</style>
