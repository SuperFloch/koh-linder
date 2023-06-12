const ConditionType = {
    ENERGY: 'ENERGY',
    ELIMINATION: 'ELIMINATION',
    NONE: 'NONE'
}
/**
 * 
 */
class Condition {
    constructor() {
        this.type = ConditionType.NONE;
        this.value = 0;
        this.target = "";
    }
}
export { Condition, ConditionType }