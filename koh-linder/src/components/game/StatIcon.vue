<template>
    <!-- Symbole d'une stat (Maquette/stats/*.svg) : pastille de couleur, pictogramme sable, contour bois -->
    <svg class="statIcon" viewBox="0 0 24 24" :width="size" :height="size" role="img" :aria-label="label">
        <title>{{ label }}</title>
        <template v-if="stat == 'STR'">
            <circle cx="12" cy="12" r="11" fill="#e0553f" stroke="#1a100d" stroke-width="1.5" />
            <path d="M6.6 9.4c0-1 .8-1.8 1.8-1.8s1.8.8 1.8 1.8V8.6c0-1 .8-1.8 1.8-1.8s1.8.8 1.8 1.8v.4c0-1 .8-1.8 1.8-1.8s1.8.8 1.8 1.8v.6c0-.9.7-1.6 1.6-1.6s1.6.7 1.6 1.6v4.6c0 3.1-2.5 5.4-5.6 5.4h-1.6c-3.1 0-5.6-2.4-5.6-5.4z" fill="#f2e6bf" stroke="#1a100d" stroke-width="1.2" stroke-linejoin="round" />
            <path d="M10.2 9.4v1.8M13.8 9v2M17.4 9.6v1.6" fill="none" stroke="#1a100d" stroke-width="1.1" stroke-linecap="round" />
            <path d="M6.6 12.4c1.4-.6 3.6-.6 5 .2.9.5.8 1.8-.2 2-1 .2-2 .1-2.8-.2" fill="#f2e6bf" stroke="#1a100d" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
        </template>
        <template v-else-if="stat == 'INT'">
            <circle cx="12" cy="12" r="11" fill="#1d3f63" stroke="#1a100d" stroke-width="1.5" />
            <path d="M12 6.2c-.9-1.2-3-1.3-3.9 0-1.5 0-2.5 1.3-2.1 2.6-1.3.7-1.5 2.4-.4 3.3-.6 1.3.3 2.8 1.7 2.9.6 1.4 2.4 1.9 3.6 1 .5.5 1.1.6 1.1.6z" fill="#f2e6bf" stroke="#1a100d" stroke-width="1.2" stroke-linejoin="round" />
            <path d="M12 6.2c.9-1.2 3-1.3 3.9 0 1.5 0 2.5 1.3 2.1 2.6 1.3.7 1.5 2.4.4 3.3.6 1.3-.3 2.8-1.7 2.9-.6 1.4-2.4 1.9-3.6 1-.5.5-1.1.6-1.1.6z" fill="#f2e6bf" stroke="#1a100d" stroke-width="1.2" stroke-linejoin="round" />
            <path d="M8.6 9.6c.9 0 1.6.6 1.6 1.4M15.4 9.6c-.9 0-1.6.6-1.6 1.4M8.8 13.2c.7-.4 1.6-.2 2 .4M15.2 13.2c-.7-.4-1.6-.2-2 .4" fill="none" stroke="#1a100d" stroke-width="1" stroke-linecap="round" />
        </template>
        <template v-else-if="stat == 'SWI'">
            <circle cx="12" cy="12" r="11" fill="#2a8fb0" stroke="#1a100d" stroke-width="1.5" />
            <circle cx="8.2" cy="10" r="1.9" fill="#f2e6bf" stroke="#1a100d" stroke-width="1" />
            <path d="M10.4 12.2l3.4-3.4 3.6 1.6" fill="none" stroke="#f2e6bf" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M4.6 14.6c1.2-1 2.3-1 3.5 0s2.3 1 3.5 0 2.3-1 3.5 0 2.3 1 3.5 0" fill="none" stroke="#f2e6bf" stroke-width="1.6" stroke-linecap="round" />
            <path d="M6 17.6c1.2-1 2.3-1 3.5 0s2.3 1 3.5 0 2.3-1 3.5 0" fill="none" stroke="#f2e6bf" stroke-width="1.6" stroke-linecap="round" />
        </template>
        <template v-else-if="stat == 'AGI'">
            <circle cx="12" cy="12" r="11" fill="#e8c93a" stroke="#1a100d" stroke-width="1.5" />
            <circle cx="12" cy="5.9" r="1.9" fill="#1a100d" />
            <path d="M12 8.6v4.8M6.6 7.4l5.4 2.4 5.4-2.4M12 13.4l-3.8 4.8M12 13.4l3.8 4.8" fill="none" stroke="#1a100d" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" />
        </template>
        <template v-else-if="stat == 'OBS'">
            <circle cx="12" cy="12" r="11" fill="#2f5a26" stroke="#1a100d" stroke-width="1.5" />
            <path d="M3.8 12c1-1.9 2.3-2.9 3.9-2.9s2.9 1 3.9 2.9c-1 1.9-2.3 2.9-3.9 2.9S4.8 13.9 3.8 12z" fill="#f2e6bf" stroke="#1a100d" stroke-width="1" />
            <path d="M12.4 12c1-1.9 2.3-2.9 3.9-2.9s2.9 1 3.9 2.9c-1 1.9-2.3 2.9-3.9 2.9s-2.9-1-3.9-2.9z" fill="#f2e6bf" stroke="#1a100d" stroke-width="1" />
            <circle cx="8.2" cy="12" r="1.5" fill="#1a100d" />
            <circle cx="16.8" cy="12" r="1.5" fill="#1a100d" />
        </template>
        <template v-else-if="stat == 'SOC'">
            <circle cx="12" cy="12" r="11" fill="#d9772e" stroke="#1a100d" stroke-width="1.5" />
            <circle cx="8.8" cy="9.8" r="1.4" fill="#f2e6bf" />
            <circle cx="15.2" cy="9.8" r="1.4" fill="#f2e6bf" />
            <path d="M7.4 13.6c1.1 2.2 2.7 3.3 4.6 3.3s3.5-1.1 4.6-3.3" fill="none" stroke="#f2e6bf" stroke-width="2" stroke-linecap="round" />
        </template>
    </svg>
</template>
<script>
import { defineComponent } from 'vue'

const STAT_NAMES = { STR: 'Constitution', INT: 'Intelligence', SWI: 'Nage', AGI: 'Agilité', OBS: 'Observation', SOC: 'Social' };

export default defineComponent({
    props: {
        // STR, INT, SWI, AGI, OBS ou SOC
        stat: {
            type: String,
            required: true
        },
        size: {
            type: String,
            default: '1.15em'
        }
    },
    computed: {
        label() {
            return STAT_NAMES[this.stat] || this.stat;
        }
    }
})
</script>
<style scoped>
.statIcon {
    display: inline-block;
    flex: none;
    vertical-align: -0.2em;
}
</style>
