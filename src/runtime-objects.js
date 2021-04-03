import {newCanvas, nop} from "./morphic";
import {Costume, SpriteMorph, StageMorph} from "./objects";
import {PaintEditorMorph} from "./paint";
// import {IDE_Morph} from "./gui";
// import {BlockDialogMorph} from "./byob";

Costume.prototype.edit = function (aWorld, anIDE, isnew, oncancel, onsubmit) {
  var editor = new PaintEditorMorph();
  editor.oncancel = oncancel || nop;
  editor.openIn(
    aWorld,
    isnew ?
      newCanvas(StageMorph.prototype.dimensions, true) :
      this.contents,
    isnew ?
      null :
      this.rotationCenter,
    (img, rc) => {
      this.contents = img;
      this.rotationCenter = rc;
      this.version = Date.now();
      aWorld.changed();
      if (anIDE) {
        if (anIDE.currentSprite instanceof SpriteMorph) {
          // don't shrinkwrap stage costumes
          this.shrinkWrap();
        }
        anIDE.currentSprite.wearCostume(this, true); // don't shadow
        anIDE.hasChangedMedia = true;
      }
      (onsubmit || nop)();
    },
    anIDE
  );
};
//
// SpriteMorph.prototype.makeBlock = function () {
//   // prompt the user to make a new block
//   var ide = this.parentThatIsA(IDE_Morph),
//     stage = this.parentThatIsA(StageMorph),
//     category = ide.currentCategory,
//     clr = SpriteMorph.prototype.blockColor[category],
//     dlg;
//   dlg = new BlockDialogMorph(
//     null,
//     definition => {
//       if (definition.spec !== '') {
//         if (definition.isGlobal) {
//           stage.globalBlocks.push(definition);
//         } else {
//           this.customBlocks.push(definition);
//         }
//         ide.flushPaletteCache();
//         ide.refreshPalette();
//         new BlockEditorMorph(definition, this).popUp();
//       }
//     },
//     this
//   );
//   if (category !== 'variables') {
//     dlg.category = category;
//     dlg.categories.children.forEach(each => each.refresh());
//     dlg.types.children.forEach(each => {
//       each.setColor(clr);
//       each.refresh();
//     });
//   }
//   dlg.prompt(
//     'Make a block',
//     null,
//     this.world()
//   );
// };

export {Costume}
// export {SpriteMorph}
