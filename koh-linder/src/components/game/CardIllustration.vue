<template>
    <!-- Illustration en haut de carte : l'image de la carte (`img`), sinon une scène dessinée selon le contexte -->
    <div class="illustration" aria-hidden="true">
        <img v-if="img" :src="img" alt="" />
        <svg v-else viewBox="0 0 280 150" preserveAspectRatio="xMidYMid slice">
            <rect width="280" height="150" :fill="colors.sky" />
            <template v-if="variant == 'camp'">
                <circle cx="230" cy="34" r="14" :fill="colors.sun" />
                <path d="M0 84c40-24 90-28 130-10 40-18 90-20 150 0v66H0z" fill="#2f5a26" />
                <path d="M0 108c80-10 190-10 280 0v42H0z" fill="#e8d49a" />
                <path d="M170 106l24-20 24 20v16h-48z" fill="#6b4129" />
                <path d="M164 108l30-26 30 26" fill="none" stroke="#4a2c1d" stroke-width="4" stroke-linejoin="round" />
                <path d="M74 120c0-9 7-13 11-20 4 7 11 11 11 20z" fill="#f5b942" />
                <path d="M68 124h34" stroke="#4a2c1d" stroke-width="4" stroke-linecap="round" />
            </template>
            <template v-else-if="variant == 'sea'">
                <circle cx="220" cy="36" r="16" fill="#fff4cf" />
                <path d="M0 80h280v70H0z" fill="#3a9fc0" />
                <path d="M0 80h280v6H0z" fill="#b8e6f0" />
                <path d="M90 92h100l-14 22H104z" fill="#4a2c1d" />
                <path d="M140 92V44l30 40z" fill="#e8d49a" stroke="#4a2c1d" stroke-width="2" stroke-linejoin="round" />
                <path d="M0 124c40-8 80-8 120 0s100 8 160 0" stroke="#6cc2da" stroke-width="4" fill="none" />
            </template>
            <template v-else>
                <circle cx="226" cy="34" r="16" fill="#fff4cf" />
                <path d="M0 100h280v14H0z" fill="#3a9fc0" />
                <path d="M0 112c90-8 190-8 280 0v38H0z" fill="#e8d49a" />
                <path d="M60 150c4-30 0-56-8-80" stroke="#2a1a12" stroke-width="5" fill="none" stroke-linecap="round" />
                <g fill="#2f5a26"><path d="M52 70c-20-4-34 4-40 16 14-10 28-12 40-16z" /><path d="M52 70c14-16 30-20 46-14-18 2-32 8-46 14z" /><path d="M52 70c-4-18-20-28-36-28 14 6 26 16 36 28z" /></g>
                <path d="M196 150V70" stroke="#4a2c1d" stroke-width="5" />
                <path d="M184 70h24l-4 7h-16z" fill="#4a2c1d" />
                <path d="M196 48c7 7 8 13 4 20h-8c-4-7-3-13 4-20z" fill="#f5b942" />
            </template>
        </svg>
    </div>
</template>
<script>
import { defineComponent } from 'vue'
import { sceneColors } from './scene';

export default defineComponent({
    props: {
        img: {
            type: String,
            default: ''
        },
        // 'beach' (épreuve), 'camp' ou 'sea' (bateau, introduction)
        variant: {
            type: String,
            default: 'beach'
        },
        period: {
            type: String,
            default: null
        }
    },
    computed: {
        colors() {
            return sceneColors(this.variant == 'camp' ? 'camp' : 'beach', this.period);
        }
    }
})
</script>
<style scoped>
.illustration {
    flex: none;
    height: 32%;
    overflow: hidden;
    background-color: var(--sky);
}
.illustration svg,
.illustration img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
}
</style>
