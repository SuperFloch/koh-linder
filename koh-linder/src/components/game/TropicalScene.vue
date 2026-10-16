<template>
    <!-- Paysage de fond : plage (épreuves) ou plage avec jungle et cabane (camp), ciel selon la période -->
    <div class="scene" :style="{ backgroundColor: colors.sky }" aria-hidden="true">
        <svg class="land" viewBox="0 0 390 844" preserveAspectRatio="xMidYMax slice">
            <rect x="-400" y="0" width="1190" height="844" :fill="colors.sky" />
            <template v-if="variant == 'camp'">
                <circle cx="80" cy="210" r="38" :fill="colors.sun" opacity="0.9" />
                <path d="M-400 470c140 0 300-60 400 0 40-50 90-60 130-30 30-40 80-50 120-20 40-30 100-30 140 10 100-40 300 0 400 0v140H-400z" fill="#1f4220" />
                <path d="M-400 520h400c50-30 110-34 160-10 50-26 130-30 230 0h400v100H-400z" fill="#2f5a26" />
                <g fill="none" stroke="#1a100d" stroke-width="6" stroke-linecap="round"><path d="M60 600c4-40 0-80-10-110" /><path d="M330 610c-2-46 4-86 14-116" /></g>
                <g fill="#244a1f"><path d="M50 490c-26-4-44 6-52 22 18-12 36-14 52-22z" /><path d="M50 490c16-20 38-26 58-18-22 2-40 10-58 18z" /><path d="M50 490c-6-22-26-34-46-34 18 8 34 18 46 34z" /><path d="M344 494c-20-18-42-22-60-12 22 0 42 4 60 12z" /><path d="M344 494c10-22 30-32 50-26-20 4-36 14-50 26z" /></g>
                <path d="M250 560l30-24 30 24v26h-60z" fill="#6b4129" />
                <path d="M244 562l36-30 36 30" fill="none" stroke="#4a2c1d" stroke-width="6" stroke-linejoin="round" />
                <path d="M-400 600h400c90-18 220-20 390-4h400v248H-400z" fill="#e8d49a" />
                <path d="M-400 660h400c100-12 230-10 390 2h400v182H-400z" fill="#dcc283" />
            </template>
            <template v-else>
                <circle cx="300" cy="190" r="42" fill="#fff4cf" opacity="0.85" />
                <path d="M-400 470h1190v120H-400z" fill="#3a9fc0" />
                <path d="M-400 470h1190v10H-400z" fill="#8fd6e6" opacity="0.7" />
                <path d="M-400 590h400c80-22 200-26 390-6h400v260H-400z" fill="#e8d49a" />
                <path d="M-400 640h1190v204H-400z" fill="#dcc283" />
                <g fill="none" stroke="#2a1a12" stroke-width="7" stroke-linecap="round"><path d="M40 760c6-60 0-120-14-180" /><path d="M356 780c-4-70 4-130 18-190" /></g>
                <g fill="#2f5a26"><path d="M26 580c-30-6-52 6-62 24 22-14 44-16 62-24z" /><path d="M26 580c20-24 46-30 70-22-26 2-48 12-70 22z" /><path d="M26 580c-8-26-30-40-54-40 22 10 40 22 54 40z" /><path d="M374 590c-22-22-50-26-72-14 26 0 50 6 72 14z" /><path d="M374 590c12-26 36-38 60-32-24 6-44 18-60 32z" /><path d="M374 590c-28 2-48 18-54 40 16-20 34-32 54-40z" /></g>
            </template>
        </svg>
        <div class="shade" :style="{ backgroundColor: colors.shade }"></div>
    </div>
</template>
<script>
import { defineComponent } from 'vue'
import { sceneColors } from './scene';

export default defineComponent({
    props: {
        // 'beach' (épreuves, intro) ou 'camp'
        variant: {
            type: String,
            default: 'beach'
        },
        // Période de la journée (Time.Period), utilisée au camp
        period: {
            type: String,
            default: null
        }
    },
    computed: {
        colors() {
            return sceneColors(this.variant, this.period);
        }
    }
})
</script>
<style scoped>
.scene {
    position: absolute;
    inset: 0;
    overflow: hidden;
    transition: background-color 0.8s;
    pointer-events: none;
}
.land {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
}
.land rect {
    transition: fill 0.8s;
}
.shade {
    position: absolute;
    inset: 0;
    transition: background-color 0.8s;
}
</style>
