import {
  BlockDialogMorph,
  BlockEditorMorph,
  BlockExportDialogMorph, BlockImportDialogMorph, BlockRemovalDialogMorph,
  CustomCommandBlockMorph,
  PrototypeHatBlockMorph
} from "./byob";
import {
  contains,
  detect, fontHeight,
  HandleMorph,
  localize,
  MenuMorph, Morph,
  MorphicPreferences, nop,
  Point,
  ScrollFrameMorph,
  WHITE
} from "./morphic";
import {SpriteMorph, StageMorph, WatcherMorph} from "./objects";
import {DialogBoxMorph, ToggleButtonMorph} from "./widgets";
import {Process} from "./threads";
import {BlockMorph, CommentMorph, ScriptsMorph} from "./blocks";
import {List} from "./lists";

// CustomCommandBlockMorph.prototype.isInUse = function () {
//   // answer true if an instance of my definition is found
//   // in any of my receiver's scripts or block definitions
//   // NOTE: for sprite-local blocks only to be used in a situation
//   // where the user actively clicks on a block in the IDE,
//   // e.g. to edit it (and change its type)
//   var def = this.definition,
//     rcvr = this.scriptTarget(),
//     ide = rcvr.parentThatIsA(IDE_Morph);
//   if (def.isGlobal && ide) {
//     return ide.sprites.asArray().concat([ide.stage]).some((any, idx) =>
//       any.usesBlockInstance(def, false, idx)
//     );
//   }
//   return rcvr.allDependentInvocationsOf(this.blockSpec).length > 0;
// };
//
//
// CustomCommandBlockMorph.prototype.userMenu = function () {
//   var hat = this.parentThatIsA(PrototypeHatBlockMorph),
//     rcvr = this.scriptTarget(),
//     myself = this,
//     // shiftClicked = this.world().currentKey === 16,
//     menu;
//
//   function addOption(label, toggle, test, onHint, offHint) {
//     var on = '\u2611 ',
//       off = '\u2610 ';
//     menu.addItem(
//       (test ? on : off) + localize(label),
//       toggle,
//       test ? onHint : offHint
//     );
//   }
//
//   function monitor(vName) {
//     var stage = rcvr.parentThatIsA(StageMorph),
//       varFrame = myself.variables;
//     menu.addItem(
//       vName + '...',
//       function () {
//         var watcher = detect(
//           stage.children,
//           function (morph) {
//             return morph instanceof WatcherMorph
//               && morph.target === varFrame
//               && morph.getter === vName;
//           }
//           ),
//           others;
//         if (watcher !== null) {
//           watcher.show();
//           watcher.fixLayout(); // re-hide hidden parts
//           return;
//         }
//         watcher = new WatcherMorph(
//           vName + ' ' + localize('(temporary)'),
//           SpriteMorph.prototype.blockColor.variables,
//           varFrame,
//           vName
//         );
//         watcher.setPosition(stage.position().add(10));
//         others = stage.watchers(watcher.left());
//         if (others.length > 0) {
//           watcher.setTop(others[others.length - 1].bottom());
//         }
//         stage.add(watcher);
//         watcher.fixLayout();
//       }
//     );
//   }
//
//   if (this.isPrototype) {
//     menu = new MenuMorph(this);
//     menu.addItem(
//       "script pic...",
//       function () {
//         var ide = this.world().children[0];
//         ide.saveCanvasAs(
//           this.topBlock().scriptPic(),
//           (ide.projectName || localize('untitled')) + ' ' +
//           localize('script pic')
//         );
//       },
//       'open a new window\nwith a picture of this script'
//     );
//     menu.addItem(
//       "translations...",
//       function () {
//         hat.parentThatIsA(BlockEditorMorph).editTranslations();
//       },
//       'experimental -\nunder construction'
//     );
//     if (this.isGlobal) {
//       if (hat.inputs().length < 2) {
//         menu.addItem(
//           "block variables...",
//           function () {
//             hat.enableBlockVars();
//           },
//           'experimental -\nunder construction'
//         );
//       } else {
//         menu.addItem(
//           "remove block variables...",
//           function () {
//             hat.enableBlockVars(false);
//           },
//           'experimental -\nunder construction'
//         );
//       }
//     }
//   } else {
//     menu = this.constructor.uber.userMenu.call(this);
//     if (!menu) {
//       menu = new MenuMorph(this);
//     } else {
//       menu.addLine();
//     }
//     if (this.isTemplate) { // inside the palette
//       if (this.isGlobal) {
//         menu.addItem(
//           "delete block definition...",
//           'deleteBlockDefinition'
//         );
//       } else { // local method
//         if (contains(
//           Object.keys(rcvr.inheritedBlocks()),
//           this.blockSpec
//         )) {
//           // inherited
//           addOption(
//             'inherited',
//             function () {
//               var ide = myself.parentThatIsA(IDE_Morph);
//               rcvr.customBlocks.push(
//                 rcvr.getMethod(
//                   myself.blockSpec
//                 ).copyAndBindTo(rcvr)
//               );
//               if (ide) {
//                 ide.flushPaletteCache();
//                 ide.refreshPalette();
//               }
//             },
//             true,
//             'uncheck to\ndisinherit',
//             null
//           );
//         } else if (rcvr.exemplar &&
//           rcvr.exemplar.getMethod(this.blockSpec
//           )) {
//           // shadowed
//           addOption(
//             'inherited',
//             'deleteBlockDefinition',
//             false,
//             null,
//             localize('check to inherit\nfrom')
//             + ' ' + rcvr.exemplar.name
//           );
//         } else {
//           // own block
//           menu.addItem(
//             "delete block definition...",
//             'deleteBlockDefinition'
//           );
//         }
//       }
//       menu.addItem(
//         "duplicate block definition...",
//         'duplicateBlockDefinition'
//       );
//       if (this.isGlobal) {
//         menu.addItem(
//           "export block definition...",
//           'exportBlockDefinition',
//           'including dependencies'
//         );
//       }
//     } else { // inside a script
//       // if global or own method - let the user delete the definition
//       if (this.isGlobal ||
//         contains(
//           Object.keys(rcvr.ownBlocks()),
//           this.blockSpec
//         )
//       ) {
//         menu.addItem(
//           "delete block definition...",
//           'deleteBlockDefinition'
//         );
//       }
//     }
//
//     this.variables.names().forEach(vName =>
//       monitor(vName)
//     );
//   }
//   menu.addItem("edit...", 'edit'); // works also for prototypes
//   return menu;
// };
//
// CustomCommandBlockMorph.prototype.exportBlockDefinition = function () {
//   var ide = this.parentThatIsA(IDE_Morph);
//   new BlockExportDialogMorph(
//     ide.serializer,
//     [this.definition].concat(this.definition.collectDependencies())
//   ).popUp(this.world());
// };
//
//
// CustomCommandBlockMorph.prototype.duplicateBlockDefinition = function () {
//   var rcvr = this.scriptTarget(),
//     ide = this.parentThatIsA(IDE_Morph),
//     def = this.isGlobal ? this.definition : rcvr.getMethod(this.blockSpec),
//     dup = def.copyAndBindTo(rcvr),
//     spec = dup.spec,
//     count = 1;
//
//   if (this.isGlobal) {
//     ide.stage.globalBlocks.push(dup);
//   } else {
//     rcvr.customBlocks.push(dup);
//   }
//
//   // find a unique spec
//   while (rcvr.doubleDefinitionsFor(dup).length > 0) {
//     count += 1;
//     dup.spec = spec + ' (' + count + ')';
//   }
//
//   ide.flushPaletteCache();
//   ide.refreshPalette();
//   new BlockEditorMorph(dup, rcvr).popUp();
// };
//
//
//
// CustomCommandBlockMorph.prototype.deleteBlockDefinition = function () {
//   var idx, stage, ide, method, block,
//     rcvr = this.scriptTarget();
//   if (this.isPrototype) {
//     return null; // under construction...
//   }
//   method = this.isGlobal? this.definition
//     : rcvr.getLocalMethod(this.blockSpec);
//   block = method.blockInstance();
//   new DialogBoxMorph(
//     this,
//     () => {
//       // Trace.log('IDE.deleteCustomBlock', this.definition ? {
//       //     'spec': this.definition.spec,
//       //     'category': this.definition.category,
//       //     'type': this.definition.type,
//       //     'guid': this.definition.guid,
//       // } : null);
//       rcvr.deleteAllBlockInstances(method);
//       if (method.isGlobal) {
//         stage = rcvr.parentThatIsA(StageMorph);
//         idx = stage.globalBlocks.indexOf(method);
//         if (idx !== -1) {
//           stage.globalBlocks.splice(idx, 1);
//         }
//       } else {
//         // delete local definition
//         idx = rcvr.customBlocks.indexOf(method);
//         if (idx !== -1) {
//           rcvr.customBlocks.splice(idx, 1);
//         }
//         // refresh instances of inherited method, if any
//         method = rcvr.getMethod(this.blockSpec);
//         if (method) {
//           rcvr.allDependentInvocationsOf(this.blockSpec).forEach(
//             block => block.refresh(method)
//           );
//         }
//       }
//       ide = rcvr.parentThatIsA(IDE_Morph);
//       if (ide) {
//         ide.flushPaletteCache();
//         ide.refreshPalette();
//       }
//     },
//     this
//   ).askYesNo(
//     'Delete Custom Block',
//     localize('block deletion dialog text'), // long string lookup
//     this.world(),
//     block.doWithAlpha(
//       1,
//       () => {
//         block.addShadow();
//         return block.fullImage();
//       }
//     )
//   );
// };
//
// BlockDialogMorph.prototype.addCategoryButton = function (category) {
//   var labelWidth = 75,
//     colors = [
//       IDE_Morph.prototype.frameColor,
//       IDE_Morph.prototype.frameColor.darker(MorphicPreferences.isFlat ? 5 : 50),
//       SpriteMorph.prototype.blockColor[category]
//     ],
//     button;
//
//   button = new ToggleButtonMorph(
//     colors,
//     this, // this block dialog box is the target
//     () => {
//       this.category = category;
//       this.categories.children.forEach(each =>
//         each.refresh()
//       );
//       if (this.types) {
//         this.types.children.forEach(each =>
//           each.setColor(colors[2])
//         );
//       }
//       this.edit();
//     },
//     category[0].toUpperCase().concat(category.slice(1)), // UCase label
//     () => this.category === category, // query
//     null, // env
//     null, // hint
//     labelWidth, // minWidth
//     true // has preview
//   );
//
//   button.corner = 8;
//   button.padding = 0;
//   button.labelShadowOffset = new Point(-1, -1);
//   button.labelShadowColor = colors[1];
//   button.labelColor = IDE_Morph.prototype.buttonLabelColor;
//   if (MorphicPreferences.isFlat) {
//     button.labelPressColor = WHITE;
//   }
//   button.contrast = this.buttonContrast;
//   button.fixLayout();
//   button.refresh();
//   this.categories.add(button);
//   return button;
// };
//
//
//
// BlockEditorMorph.prototype = new DialogBoxMorph();
// BlockEditorMorph.prototype.constructor = BlockEditorMorph;
// BlockEditorMorph.uber = DialogBoxMorph.prototype;
//
// // Keep track of the currently showing block editors
// BlockEditorMorph.showing = [];
//
// // BlockEditorMorph instance creation:
//
// export function BlockEditorMorph(definition, target) {
//   this.init(definition, target);
// }
//
// BlockEditorMorph.prototype.ok = function() {
//   // Trace.log('BlockEditor.ok', this.getDefinitionJSON());
//   BlockEditorMorph.uber.ok.apply(this, arguments);
// };
//
// BlockEditorMorph.prototype.destroy = function() {
//   BlockEditorMorph.uber.destroy.apply(this, arguments);
//   var index = BlockEditorMorph.showing.indexOf(this);
//   if (index >= 0) {
//     BlockEditorMorph.showing.splice(index, 1);
//   }
// };
//
// BlockEditorMorph.defaultHatBlockMargin = new Point(10, 10);
//
// BlockEditorMorph.prototype.getDefinitionJSON = function() {
//   var definition = this.definition;
//   return definition ? {
//     'spec': definition.spec,
//     'category': definition.category,
//     'type': definition.type,
//     'guid': definition.guid,
//   } : null;
// };
//
// BlockEditorMorph.prototype.init = function (definition, target) {
//   var scripts, proto, scriptsFrame, block, comment,
//     isLive = Process.prototype.enableLiveCoding ||
//       Process.prototype.enableSingleStepping;
//
//   // additional properties:
//   this.definition = definition;
//   this.translations = definition.translationsAsText();
//   this.handle = null;
//
//   // Trace.log('BlockEditor.start', this.getDefinitionJSON());
//
//   // initialize inherited properties:
//   BlockEditorMorph.uber.init.call(
//     this,
//     target,
//     () => this.updateDefinition(),
//     target
//   );
//
//   // override inherited properites:
//   this.key = 'editBlock' + definition.spec;
//   this.labelString = this.definition.isGlobal ? 'Block Editor'
//     : 'Method Editor';
//   this.createLabel();
//
//   // Copy IDs when copying blocks, rather than making new block IDs
//   // as we would do for duplicating a block
//   BlockMorph.copyIDs = true;
//
//   // create scripting area
//   scripts = new ScriptsMorph();
//   scripts.rejectsHats = true;
//   scripts.isDraggable = false;
//   scripts.color = IDE_Morph.prototype.groupColor;
//   scripts.cachedTexture = IDE_Morph.prototype.scriptsPaneTexture;
//   scripts.cleanUpMargin = 10;
//
//   proto = new PrototypeHatBlockMorph(this.definition);
//   proto.setPosition(scripts.position().add(
//     BlockEditorMorph.defaultHatBlockMargin));
//   if (definition.comment !== null) {
//     comment = definition.comment.fullCopy();
//     proto.comment = comment;
//     comment.block = proto;
//   }
//   if (definition.body !== null) {
//     proto.nextBlock(isLive ? definition.body.expression
//       : definition.body.expression.fullCopy()
//     );
//   }
//   scripts.add(proto);
//   proto.fixBlockColor(null, true);
//
//   this.definition.scripts.forEach(element => {
//     block = element.fullCopy();
//     block.setPosition(scripts.position().add(element.position()));
//     scripts.add(block);
//     if (block instanceof BlockMorph) {
//       block.allComments().forEach(comment =>
//         comment.align(block)
//       );
//     }
//   });
//   proto.allComments().forEach(comment =>
//     comment.align(proto)
//   );
//
//   // Make sure to disable block ID copying
//   BlockMorph.copyIDs = false;
//
//   scriptsFrame = new ScrollFrameMorph(scripts);
//   scriptsFrame.padding = 10;
//   scriptsFrame.growth = 50;
//   scriptsFrame.isDraggable = false;
//   scriptsFrame.acceptsDrops = false;
//   scriptsFrame.contents.acceptsDrops = true;
//   scripts.scrollFrame = scriptsFrame;
//   scripts.updateToolbar();
//
//   this.addBody(scriptsFrame);
//   this.addButton('ok', 'OK');
//   if (!isLive) {
//     this.addButton('updateDefinition', 'Apply');
//     this.addButton('cancel', 'Cancel');
//   }
//
//   this.setExtent(new Point(400, 350).add(
//     BlockEditorMorph.defaultHatBlockMargin)); // normal initial extent
//   this.fixLayout();
//   scripts.fixMultiArgs();
//
//   block = proto.parts()[0];
//   block.forceNormalColoring();
//   block.fixBlockColor(proto, true);
// };
//
// BlockEditorMorph.prototype.popUp = function () {
//   var world = this.target.world();
//
//   // Add this to the list of showing blockEditorMorphs
//   BlockEditorMorph.showing.push(this);
//
//   if (world) {
//     BlockEditorMorph.uber.popUp.call(this, world);
//     this.setInitialDimensions();
//     this.handle = new HandleMorph(
//       this,
//       280,
//       220,
//       this.corner,
//       this.corner
//     );
//     world.keyboardFocus = null;
//   }
// };
//
// BlockEditorMorph.prototype.justDropped = function () {
//   // override the inherited default behavior, which is to
//   // give keyboard focus to dialog boxes, as in this case
//   // we want Snap-global keyboard-shortcuts like ctrl-f
//   // to still work
//   nop();
// };
//
// // BlockEditorMorph ops
//
// BlockEditorMorph.prototype.accept = function (origin) {
//   // check DialogBoxMorph comment for accept()
//   if (origin instanceof CursorMorph) {return; }
//   if (this.action) {
//     if (typeof this.target === 'function') {
//       if (typeof this.action === 'function') {
//         this.target.call(this.environment, this.action.call());
//       } else {
//         this.target.call(this.environment, this.action);
//       }
//     } else {
//       if (typeof this.action === 'function') {
//         this.action.call(this.target, this.getInput());
//       } else { // assume it's a String
//         this.target[this.action](this.getInput());
//       }
//     }
//   }
//   this.close();
// };
//
// BlockEditorMorph.prototype.cancel = function (origin) {
//   if (origin instanceof CursorMorph) {return; }
//   // Trace.log('BlockEditor.cancel', this.getDefinitionJSON());
//   //this.refreshAllBlockInstances();
//   this.close();
// };
//
// BlockEditorMorph.prototype.close = function () {
//   var doubles, block;
//
//   // assert that no scope conflicts exists, i.e. that a global
//   // definition doesn't contain any local custom blocks, as they
//   // will be rendered "Obsolete!" when reloading the project
//   if (this.definition.isGlobal) {
//     block = detect(
//       this.body.contents.allChildren(),
//       morph => morph.isCustomBlock && !morph.isGlobal
//     );
//     if (block) {
//       block = block.scriptTarget()
//         .getMethod(block.semanticSpec)
//         .blockInstance();
//       block.addShadow();
//       new DialogBoxMorph().inform(
//         'Local Block(s) in Global Definition',
//         'This global block definition contains one or more\n'
//         + 'local custom blocks which must be removed first.',
//         this.world(),
//         block.doWithAlpha(1, () => block.fullImage())
//       );
//       return;
//     }
//   }
//
//   // allow me to disappear only when name collisions
//   // have been resolved
//   doubles = this.target.doubleDefinitionsFor(this.definition);
//   if (doubles.length > 0) {
//     block = doubles[0].blockInstance();
//     block.addShadow();
//     new DialogBoxMorph(this, 'consolidateDoubles', this).askYesNo(
//       'Same Named Blocks',
//       'Another custom block with this name exists.\n'
//       + 'Would you like to replace it?',
//       this.world(),
//       block.doWithAlpha(1, () => block.fullImage())
//     );
//     return;
//   }
//
//   this.destroy();
//   this.deduplicateBlockIDs();
// };
//
// BlockEditorMorph.prototype.consolidateDoubles = function () {
//   this.target.replaceDoubleDefinitionsFor(this.definition);
//   this.deduplicateBlockIDs();
//   this.destroy();
// };
//
// BlockEditorMorph.prototype.refreshAllBlockInstances = function (oldSpec) {
//   var def = this.definition,
//     template = this.target.paletteBlockInstance(def);
//
//   if (this.definition.isGlobal) {
//     this.target.allBlockInstances(this.definition).reverse().forEach(
//       block => block.refresh()
//     );
//   } else {
//     this.target.allDependentInvocationsOf(oldSpec).reverse().forEach(
//       block => block.refresh(def)
//     );
//   }
//   if (template) {
//     template.refreshDefaults();
//   }
// };
//
// // It is possible for blocks to get duplicated by dragging them out of a block
// // editor and then cancelling the edit. This checks for any duplicate block IDs
// // in the just-closed block definition and then assigns new IDs to those blocks.
// BlockEditorMorph.prototype.deduplicateBlockIDs = function() {
//   var definition = this.definition;
//   function findBlockIDs(root, array) {
//     array = array || [];
//     // Ignore any children of this definition
//     if (root == definition || root == null) return array;
//     if (root instanceof BlockMorph) array.push(root.id);
//     // Include custom block definitions in Sprites and the Stage
//     if (root instanceof SpriteMorph) findBlockIDs(root.customBlocks);
//     if (root instanceof StageMorph) findBlockIDs(root.globalBlocks);
//     var children = root.children || root;
//     if (!(children instanceof Array)) return array;
//     children.forEach(function(child) {
//       if (child instanceof Morph) {
//         findBlockIDs(child, array);
//       }
//     });
//     return array;
//   }
//   var blockIDs = findBlockIDs(this.root());
//
//   var scripts = definition.scripts.slice();
//   if (this.definition.body) scripts.push(this.definition.body.expression);
//   scripts.forEach(function(script) {
//     if (script == null || !script.allChildren) return;
//     script.allChildren().forEach(function(block) {
//       if (!(block instanceof BlockMorph)) return;
//       if (blockIDs.includes(block.id)) block.getNewID();
//     });
//   });
// };
//
// BlockEditorMorph.prototype.updateDefinition = function () {
//   // Trace.log('BlockEditor.apply', this.getDefinitionJSON());
//   var oldSpec = this.definition.blockSpec();
//   this.applyToDefinition(this.definition);
//   this.refreshAllBlockInstances(oldSpec);
//   ide = this.target.parentThatIsA(IDE_Morph);
//   ide.flushPaletteCache();
//   ide.refreshPalette();
// };
//
// // We want to be able to apply the edits represented in this editor to an
// // arbitrary block definition (e.g. a copy of the original), mainly for
// // logging purposes.
// BlockEditorMorph.prototype.applyToDefinition = function (definition) {
//   var head,
//     pos = this.body.contents.position(),
//     count = 1,
//     element;
//
//   // Copy IDs when copying blocks, rather than making new block IDs
//   // as we would do for duplicating a block
//   BlockMorph.copyIDs = true;
//
//   definition.receiver = this.target; // only for serialization
//   definition.spec = this.prototypeSpec();
//   definition.declarations = this.prototypeSlots();
//   definition.variableNames = this.variableNames();
//   definition.scripts = [];
//   definition.updateTranslations(this.translations);
//   definition.cachedTranslation = null;
//   definition.editorDimensions = this.bounds.copy();
//   definition.cachedIsRecursive = null; // flush the cache, don't update
//
//   this.body.contents.children.forEach(morph => {
//     if (morph instanceof PrototypeHatBlockMorph) {
//       head = morph;
//     } else if (morph instanceof BlockMorph ||
//       (morph instanceof CommentMorph && !morph.block)) {
//       element = morph.fullCopy();
//       element.parent = null;
//       element.setPosition(morph.position().subtract(pos));
//       definition.scripts.push(element);
//     }
//   });
//
//   if (head) {
//     if (definition.category !== head.blockCategory) {
//       this.target.shadowAttribute('scripts');
//     }
//     definition.category = head.blockCategory;
//     definition.type = head.type;
//     if (head.comment) {
//       definition.comment = head.comment.fullCopy();
//       definition.comment.block = true; // serialize in short form
//     } else {
//       definition.comment = null;
//     }
//   }
//
//   definition.body = this.context(head);
//
//   // Make sure to turn copying IDs off when finished
//   BlockMorph.copyIDs = false;
//
//   // make sure the spec is unique
//   while (this.target.doubleDefinitionsFor(this.definition).length > 0) {
//     count += 1;
//     this.definition.spec = this.definition.spec + ' (' + count + ')';
//   }
// };
//
// BlockEditorMorph.prototype.context = function (prototypeHat) {
//   // answer my script reified for deferred execution
//   // if no prototypeHat is given, my body is scanned
//   var head, topBlock, stackFrame;
//
//   head = prototypeHat || detect(
//     this.body.contents.children,
//     c => c instanceof PrototypeHatBlockMorph
//   );
//   topBlock = head.nextBlock();
//   if (topBlock === null) {
//     return null;
//   }
//   topBlock.allChildren().forEach(c => {
//     if (c instanceof BlockMorph) {c.cachedInputs = null; }
//   });
//   stackFrame = Process.prototype.reify.call(
//     null,
//     topBlock,
//     new List(this.definition.inputNames()),
//     true // ignore empty slots for custom block reification
//   );
//   stackFrame.outerContext = null;
//   return stackFrame;
// };
//
// BlockEditorMorph.prototype.prototypeSpec = function () {
//   // answer the spec represented by my (edited) block prototype
//   return detect(
//     this.body.contents.children,
//     c => c instanceof PrototypeHatBlockMorph
//   ).parts()[0].specFromFragments();
// };
//
// BlockEditorMorph.prototype.prototypeSlots = function () {
//   // answer the slot declarations from my (edited) block prototype
//   return detect(
//     this.body.contents.children,
//     c => c instanceof PrototypeHatBlockMorph
//   ).parts()[0].declarationsFromFragments();
// };
//
// BlockEditorMorph.prototype.variableNames = function () {
//   // answer the variable declarations from my prototype hat
//   return detect(
//     this.body.contents.children,
//     c => c instanceof PrototypeHatBlockMorph
//   ).variableNames();
// };
//
// // BlockEditorMorph translation
//
// BlockEditorMorph.prototype.editTranslations = function () {
//   var block = this.definition.blockInstance();
//   block.addShadow(new Point(3, 3));
//   new DialogBoxMorph(
//     this,
//     text => this.translations = text,
//     this
//   ).promptCode(
//     'Custom Block Translations',
//     this.translations,
//     this.world(),
//     block.doWithAlpha(1, () => block.fullImage()),
//     this.definition.abstractBlockSpec() +
//     '\n\n' +
//     localize('Enter one translation per line. ' +
//       'use colon (":") as lang/spec delimiter\n' +
//       'and underscore ("_") as placeholder for an input, ' +
//       'e.g.:\n\nen:say _ for _ secs')
//   );
// };
//
// // BlockEditorMorph layout
//
// BlockEditorMorph.prototype.setInitialDimensions = function () {
//   var world = this.world(),
//     mex = world.extent().subtract(new Point(this.padding, this.padding)),
//     th = fontHeight(this.titleFontSize) + this.titlePadding * 2,
//     bh = this.buttons.height();
//
//   if (this.definition.editorDimensions) {
//     this.setPosition(this.definition.editorDimensions.origin);
//     this.setExtent(this.definition.editorDimensions.extent().min(mex));
//     this.keepWithin(world);
//     return;
//   }
//   this.setExtent(
//     this.body.contents.extent().add(
//       new Point(this.padding, this.padding + th + bh)
//     ).min(mex)
//   );
//   this.setCenter(this.world().center());
// };
//
// BlockEditorMorph.prototype.fixLayout = function () {
//   var th = fontHeight(this.titleFontSize) + this.titlePadding * 2;
//
//   if (this.buttons && (this.buttons.children.length > 0)) {
//     this.buttons.fixLayout();
//   }
//
//   if (this.body) {
//     this.body.setPosition(this.position().add(new Point(
//       this.padding,
//       th + this.padding
//     )));
//     this.body.setExtent(new Point(
//       this.width() - this.padding * 2,
//       this.height() - this.padding * 3 - th - this.buttons.height()
//     ));
//   }
//
//   if (this.label) {
//     this.label.setCenter(this.center());
//     this.label.setTop(this.top() + (th - this.label.height()) / 2);
//   }
//
//   if (this.buttons && (this.buttons.children.length > 0)) {
//     this.buttons.setCenter(this.center());
//     this.buttons.setBottom(this.bottom() - this.padding);
//   }
//
//   // refresh a shallow shadow
//   this.removeShadow();
//   this.addShadow();
// };
//
//
// CustomCommandBlockMorph.prototype.edit = function () {
//   var def = this.definition,
//     editor, block,
//     hat,
//     rcvr;
//
//   if (this.isPrototype) {
//     block = this.definition.blockInstance();
//     block.addShadow();
//     hat = this.parentThatIsA(PrototypeHatBlockMorph);
//     new BlockDialogMorph(
//       null,
//       (definition) => {
//         if (definition) { // temporarily update everything
//           // Trace.log('BlockEditor.changeType', this.getDefinitionID());
//           hat.blockCategory = definition.category;
//           hat.type = definition.type;
//           this.refreshPrototype();
//         }
//       },
//       this
//     ).openForChange(
//       'Change block',
//       hat.blockCategory,
//       hat.type,
//       this.world(),
//       block.doWithAlpha(1, () => block.fullImage()),
//       this.isInUse()
//     );
//   } else {
//     // check for local custom block inheritance
//     rcvr = this.scriptTarget();
//     if (!this.isGlobal) {
//       if (contains(
//         Object.keys(rcvr.inheritedBlocks()),
//         this.blockSpec
//       )
//       ) {
//         this.duplicateBlockDefinition();
//         return;
//       }
//       def = rcvr.getMethod(this.semanticSpec);
//     }
//     editor = new BlockEditorMorph(def, rcvr);
//     editor.popUp();
//     editor.changed();
//   }
// };
//
//
// BlockExportDialogMorph.prototype.fixLayout
//   = BlockEditorMorph.prototype.fixLayout;
//
// BlockImportDialogMorph.prototype.fixLayout
//   = BlockEditorMorph.prototype.fixLayout;
//
// BlockRemovalDialogMorph.prototype.fixLayout
//   = BlockEditorMorph.prototype.fixLayout;
//
//
// BlockImportDialogMorph.prototype.importBlocks = function (name) {
//   var ide = this.target.parentThatIsA(IDE_Morph);
//   if (!ide) {return; }
//   if (this.blocks.length > 0) {
//     this.blocks.forEach(def => {
//       def.receiver = ide.stage;
//       ide.stage.globalBlocks.push(def);
//       ide.stage.replaceDoubleDefinitionsFor(def);
//     });
//     ide.flushPaletteCache();
//     ide.refreshPalette();
//     ide.showMessage(
//       'Imported Blocks Module' + (name ? ': ' + name : '') + '.',
//       2
//     );
//   } else {
//     new DialogBoxMorph().inform(
//       'Import blocks',
//       'no blocks were selected',
//       this.world()
//     );
//   }
// };
