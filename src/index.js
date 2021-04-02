// import  {HandleMorph} from "./morphic";
// console.log(HandleMorph);
//
// import  {SymbolMorph} from "./symbols";
// console.log(SymbolMorph);
//
// import {PushButtonMorph} from "./widgets";
// let pbm = new PushButtonMorph();
// console.log(pbm.is3D);


// import {BlockSymbolMorph} from "./blocks";
// let sfm = new BlockSymbolMorph();
// console.log(sfm);
//
//
// import {Process} from "./threads";
// let sfm2 = new Process();
// console.log(sfm2);

import {WorldMorph} from "./morphic";
import {IDE_Morph} from "./gui";
// let ide = new IDE_Morph();
// console.log(ide);

var world, ide;
window.onload = function () {
  world = new WorldMorph(document.getElementById('world'),
    true, true);
  world.worldCanvas.focus();
  ide = new IDE_Morph();
  ide.openIn(world);
  loop();
  if (window.onWorldLoaded) {
    window.onWorldLoaded();
  }
};
function loop() {
  requestAnimationFrame(loop);
  world.doOneCycle();
}
