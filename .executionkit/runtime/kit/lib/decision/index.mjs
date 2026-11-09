import {validateDecision} from './contract.mjs';
import {loadKnowledge} from './knowledge.mjs';
import {decide} from './policy.mjs';
export function evaluateDecision(request,{knowledge=loadKnowledge()}={}){return decide(validateDecision(request),knowledge);}
export {validateDecision} from './contract.mjs';
export {parseKnowledge,loadKnowledge} from './knowledge.mjs';
