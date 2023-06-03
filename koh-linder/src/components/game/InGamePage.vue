<template>
    <div class="swipeListener" ref="swipe">
        <div class="currentCard" ref="currentCard">
            {{ (game.cardQueue[game.currentCardIndex]).name }}
        </div>
    </div>
</template>
<script>
import Hammer from 'hammerjs';
import {Game}  from 'src/model/Game';
import { defineComponent } from 'vue'


export default defineComponent({
    props:{
        game: {
            type: Game
        }
    },
    data: function(){
        return {
            hammer: null
        }
    },
    methods:{
        onPan(e){
            console.log(e)
        }
    },
    mounted: function(){
        console.log(this.game)
        this.hammer = new Hammer(this.$refs.swipe,{})
        this.hammer.on('pan',(e)=>{
            var xMulti = e.deltaX * 0.03;
            var yMulti = e.deltaY / 80;
            var rotate = xMulti * yMulti;
            this.$refs.currentCard.style.transform = 'translate(' + e.deltaX + 'px, ' + e.deltaY + 'px) rotate(' + rotate + 'deg)';

            if(Math.abs(e.deltaX) > 200 && e.isFinal){
                this.game.next();
            }
        });
        this.hammer.on('panend',(e)=>{
            this.$refs.currentCard.style.transform = '';
        })
    }
})
</script>
<style scoped>
.swipeListener{
    background-color: blue;
}
.currentCard{
    background-color: red;
}

</style>