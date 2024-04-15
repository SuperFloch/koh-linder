<template>
    <div class="stretch">
        <GameTopBar class="topbar" :game="game"/>
        <div class="swipeListener stretch" ref="swipe">
            <div class="currentCard stretch" ref="currentCard" v-if="game.cardQueue[game.currentCardIndex]">
                <div :class="{'hidden': !slidingLeft}">{{ (game.cardQueue[game.currentCardIndex]).choices.left.text }}</div>
                <div :class="{'hidden': !slidingRight}">{{ (game.cardQueue[game.currentCardIndex]).choices.right.text }}</div>
                <div class="hint"></div>
                {{ (game.cardQueue[game.currentCardIndex]).text }}
            </div>
        </div>
    </div>
</template>
<script>
import Hammer from 'hammerjs';
import {Game}  from 'src/model/Game';
import { defineComponent } from 'vue'
import GameTopBar from './GameTopBar.vue';


export default defineComponent({
    props:{
        game: {
            type: Game
        }
    },
    components:{
        GameTopBar
    },
    data: function(){
        return {
            hammer: null,
            slidingLeft: false,
            slidingRight: false,
        }
    },
    methods:{
        onPan(e){
            console.log(e)
        }
    },
    mounted: function(){
        this.hammer = new Hammer(this.$refs.swipe,{})
        this.hammer.on('pan',(e)=>{
            if (e.deltaX === 0) return;
            if (e.center.x === 0 && e.center.y === 0) return;
            var xMulti = e.deltaX * 0.03;
            var yMulti = e.deltaY / 80;
            var rotate = xMulti * yMulti;
            this.$refs.currentCard.style.transform = 'translate(' + e.deltaX + 'px, ' + e.deltaY + 'px) rotate(' + rotate + 'deg)';

            this.slidingLeft = e.deltaX < 0;
            this.slidingRight = e.deltaX > 0;

            if(e.isFinal){
                if(e.deltaX > 200){
                    this.game.right();
                }
                if(e.deltaX < -200){
                    this.game.left();
                }
                console.log(this.game.cardQueue);
            }
        });
        this.hammer.on('panend',(e)=>{
            this.$refs.currentCard.style.transform = '';
            this.slidingLeft = false;
            this.slidingRight = false;
        })
    }
})
</script>
<style scoped>
.topbar{
    background-color: green;
}
.swipeListener{
    background-color: blue;
    padding: 5%;
}
.currentCard{
    background-color: red;
}

</style>