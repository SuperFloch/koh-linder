const EffectType = {
    ENERGY: 'ENERGY',
    ELIMINATION: 'ELIMINATION',
    NONE: 'NONE'
}
/**
 * 
 */
class Effect {
    constructor() {
        this.text = "";
        this.type = EffectType.NONE;
        this.value = 0;
        this.target = "";
    }
}
export { Effect, EffectType }