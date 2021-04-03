import {SpriteMorph, StageMorph} from "./objects";
import {
  ArgMorph,
  BlockMorph, CommandBlockMorph,
  CommandSlotMorph,
  CommentMorph, HatBlockMorph,
  InputSlotMorph,
  MultiArgMorph, ReporterBlockMorph, ReporterSlotMorph,
  RingMorph, ScriptFocusMorph,
  ScriptsMorph, SyntaxElementMorph, TemplateSlotMorph
} from "./blocks";
import {BlockEditorMorph, PrototypeHatBlockMorph} from "./byob";
import {Color, contains, detect, isNil, localize, MenuMorph, MorphicPreferences, Point} from "./morphic";
import {SymbolMorph} from "./symbols";
import {DialogBoxMorph} from "./widgets";
import {IDE_Morph} from "./gui";
import {Process} from "./threads";

BlockMorph.prototype.mouseClickLeft = function () {
  var top = this.topBlock(),
    receiver = top.scriptTarget(),
    shiftClicked = this.world().currentKey === 16,
    stage;
  if (shiftClicked && !this.isTemplate) {
    return this.selectForEdit().focus(); // enable coopy-on-edit
  }
  if (top instanceof PrototypeHatBlockMorph) {
    return; // top.mouseClickLeft();
  }
  if (receiver) {
    stage = receiver.parentThatIsA(StageMorph);
    if (stage) {
      var process = stage.threads.findProcess(top);
      if (process && !process.readyToTerminate) {
        // Trace.log('Block.clickStopRun', top.blockId());
      } else {
        // Trace.log('Block.clickRun', top.blockId());
      }
      // Useful for debugging
      window.lastRun = top;
      stage.threads.toggleProcess(top, receiver);
    }
  }
};

BlockMorph.prototype.activeProcess = function () {
  var top = this.topBlock(),
    receiver = top.scriptTarget(),
    stage;
  if (top instanceof PrototypeHatBlockMorph) {
    return null;
  }
  if (receiver) {
    stage = receiver.parentThatIsA(StageMorph);
    if (stage) {
      return stage.threads.findProcess(top, receiver);
    }
  }
  return null;
};


ScriptsMorph.prototype.closestInput = function (reporter, hand) {
  // passing the hand is optional (when dragging reporters)
  var fb = reporter.fullBoundsNoShadow(),
    stacks = this.children.filter(child =>
      (child instanceof BlockMorph) &&
      (child.fullBounds().intersects(fb))
    ),
    blackList = reporter.allInputs(),
    handPos,
    target,
    all;

  all = [];
  stacks.forEach(stack =>
    all = all.concat(stack.allInputs())
  );
  if (all.length === 0) {return null; }

  function touchingVariadicArrowsIfAny(inp, point) {
    if (inp instanceof MultiArgMorph) {
      if (point) {
        return inp.arrows().bounds.containsPoint(point);
      }
      return inp.arrows().bounds.intersects(fb);
    }
    return true;
  }

  if (this.isPreferringEmptySlots) {
    if (hand) {
      handPos = hand.position();
      target = detect(
        all,
        input => (input instanceof InputSlotMorph ||
            (input instanceof ArgMorph &&
              !(input instanceof CommandSlotMorph) &&
              !(input instanceof MultiArgMorph)
            ) ||
            (input instanceof RingMorph && !input.contents()) ||
            input.isEmptySlot()
          ) &&
          !input.isLocked() &&
          input.bounds.containsPoint(handPos) &&
          !contains(blackList, input)
      );
      if (target) {
        return target;
      }
    }
    target = detect(
      all,
      input => (input instanceof InputSlotMorph ||
          input instanceof ArgMorph ||
          (input instanceof RingMorph && !input.contents()) ||
          input.isEmptySlot()
        ) &&
        !input.isLocked() &&
        input.bounds.intersects(fb) &&
        !contains(blackList, input) &&
        touchingVariadicArrowsIfAny(input, handPos)
    );
    if (target) {
      return target;
    }
  }

  if (hand) {
    handPos = hand.position();
    target = detect(
      all,
      input => (input !== reporter) &&
        !input.isLocked() &&
        input.bounds.containsPoint(handPos) &&
        !(input.parent instanceof PrototypeHatBlockMorph) &&
        !contains(blackList, input) &&
        touchingVariadicArrowsIfAny(input, handPos)
    );
    if (target) {
      return target;
    }
  }
  return detect(
    all,
    input => (input !== reporter) &&
      !input.isLocked() &&
      input.fullBounds().intersects(fb) &&
      !(input.parent instanceof PrototypeHatBlockMorph) &&
      !contains(blackList, input) &&
      touchingVariadicArrowsIfAny(input)
  );
};

ScriptsMorph.prototype.cleanUp = function (silently) {
  if (!silently) {
    // Trace.log('Scripts.cleanUp');
  }
  var target = this.selectForEdit(), // enable copy-on-edit
    origin = target.topLeft(),
    y = target.cleanUpMargin;
  target.children.sort((a, b) =>
    // make sure the prototype hat block always stays on top
    a instanceof PrototypeHatBlockMorph ? 0 : a.top() - b.top()
  ).forEach(child => {
    if (child instanceof CommentMorph && child.block) {
      return; // skip anchored comments
    }
    child.setPosition(origin.add(new Point(target.cleanUpMargin, y)));
    if (child instanceof BlockMorph) {
      child.allComments().forEach(comment =>
        comment.align(child, true) // ignore layer
      );
    }
    y += child.stackHeight() + target.cleanUpSpacing;
  });
  if (target.parent) {
    target.setPosition(target.parent.topLeft());
  }
  target.adjustBounds();
};

ScriptsMorph.prototype.sortedElements = function () {
  // return all scripts and unattached comments
  var scripts = this.children.filter(each =>
    each instanceof CommentMorph ? !each.block : true
  );
  scripts.sort((a, b) =>
    // make sure the prototype hat block always stays on top
    a instanceof PrototypeHatBlockMorph ? 0 : a.top() - b.top()
  );
  return scripts;
};

ArgMorph.prototype.reactToSliderEdit = function () {
  /*
      directly execute the stack of blocks I'm part of if my
      "executeOnSliderEdit" setting is turned on, obeying the stage's
      thread safety setting. This feature allows for "Bret Victor" style
      interactive coding.
  */
  var block, top, receiver, stage;
  if (!this.executeOnSliderEdit) {return; }
  block = this.parentThatIsA(BlockMorph);
  if (block) {
    top = block.topBlock();
    receiver = top.scriptTarget();
    if (top instanceof PrototypeHatBlockMorph) {
      return;
    }
    if (receiver) {
      stage = receiver.parentThatIsA(StageMorph);
      if (stage && (stage.isThreadSafe ||
        Process.prototype.enableSingleStepping)) {
        stage.threads.startProcess(top, receiver, stage.isThreadSafe);
      } else {
        top.mouseClickLeft();
      }
    }
  }
};

ScriptFocusMorph.prototype.shiftScript = function (deltaPoint) {
  var tb;
  if (this.element instanceof ScriptsMorph) {
    this.moveBy(deltaPoint);
  } else {
    tb = this.element.topBlock();
    if (tb && !(tb instanceof PrototypeHatBlockMorph)) {
      tb.moveBy(deltaPoint);
    }
  }
  this.editor.adjustBounds();
  this.fixLayout();
};


ScriptFocusMorph.prototype.sortedScripts = function () {
  var scripts = this.editor.children.filter(each =>
    each instanceof BlockMorph
  );
  scripts.sort((a, b) =>
    // make sure the prototype hat block always stays on top
    a instanceof PrototypeHatBlockMorph ? 0 : a.top() - b.top()
  );
  return scripts;
};

SyntaxElementMorph.prototype.getVarNamesDict = function () {
  var block = this.parentThatIsA(BlockMorph),
    rcvr,
    tempVars = [],
    dict;

  if (!block) {
    return {};
  }
  rcvr = block.scriptTarget();
  block.allParents().forEach(morph => {
    if (morph instanceof PrototypeHatBlockMorph) {
      tempVars.push.apply(
        tempVars,
        morph.variableNames()
      );
      tempVars.push.apply(
        tempVars,
        morph.inputs()[0].inputFragmentNames()
      );
    } else if (morph instanceof BlockMorph) {
      morph.inputs().forEach(inp => {
        inp.allChildren().forEach(child => {
          if (child instanceof TemplateSlotMorph) {
            tempVars.push(child.contents());
          } else if (child instanceof MultiArgMorph) {
            child.children.forEach(m => {
              if (m instanceof TemplateSlotMorph) {
                tempVars.push(m.contents());
              }
            });
          }
        });
      });
    }
  });
  if (rcvr) {
    dict = rcvr.variables.allNamesDict();
    tempVars.forEach(name =>
      dict[name] = name
    );
    if (block.selector === 'doSetVar') {
      // add settable object attributes
      dict['~'] = null;
      dict.my = [{// wrap the submenu into a 1-item array to translate it
        'anchor' : ['my anchor'],
        'parent' : ['my parent'],
        'name' : ['my name'],
        'temporary?' : ['my temporary?'],
        'dangling?' : ['my dangling?'],
        'draggable?' : ['my draggable?'],
        'rotation style' : ['my rotation style'],
        'rotation x' : ['my rotation x'],
        'rotation y' : ['my rotation y']
      }];
      if (this.world().currentKey === 16) { // shift
        dict.my[0]['~'] = null; // don't forget we're inside an array...
        dict.my[0]['microphone modifier'] = ['microphone modifier'];
      }
    }
    return dict;
  }
  return {};
};


BlockMorph.prototype.userMenu = function () {
  var menu = new MenuMorph(this),
    world = this.world(),
    myself = this,
    hasLine = false,
    shiftClicked = world.currentKey === 16,
    proc = this.activeProcess(),
    top = this.topBlock(),
    vNames = proc && proc.context && proc.context.outerContext ?
      proc.context.outerContext.variables.names() : [],
    alternatives,
    field,
    rcvr;

  function addOption(label, toggle, test, onHint, offHint) {
    menu.addItem(
      [
        test ? new SymbolMorph(
          'checkedBox',
          MorphicPreferences.menuFontSize * 0.75
        ) : new SymbolMorph(
          'rectangle',
          MorphicPreferences.menuFontSize * 0.75
        ),
        localize(label)
      ],
      toggle,
      test ? onHint : offHint
    );
  }

  function renameVar() {
    var blck = myself.fullCopy();
    blck.addShadow();
    new DialogBoxMorph(
      myself,
      function(arg) {
        // Trace.log('Block.rename', {
        //     'id': myself.blockId(),
        //     'name': arg,
        // });
        myself.userSetSpec(arg);
      },
      myself
    ).prompt(
      "Variable name",
      myself.blockSpec,
      world,
      blck.doWithAlpha(1, () => blck.fullImage()), // pic
      InputSlotMorph.prototype.getVarNamesDict.call(myself)
    );
  }

  menu.addItem(
    "help...",
    'showHelp'
  );
  if (this.isTemplate) {
    if (this.parent instanceof SyntaxElementMorph) { // in-line
      if (this.selector === 'reportGetVar') { // script var definition
        menu.addLine();
        menu.addItem(
          'rename...',
          () => this.refactorThisVar(true), // just the template
          'rename only\nthis reporter'
        );
        menu.addItem(
          'rename all...',
          'refactorThisVar',
          'rename all blocks that\naccess this variable'
        );
      }
    } else { // in palette
      if (this.selector === 'reportGetVar') {
        rcvr = this.scriptTarget();
        if (this.isInheritedVariable(false)) { // fully inherited
          addOption(
            'inherited',
            () => rcvr.toggleInheritedVariable(this.blockSpec),
            true,
            'uncheck to\ndisinherit',
            null
          );
        } else { // not inherited
          if (this.isInheritedVariable(true)) { // shadowed
            addOption(
              'inherited',
              () => rcvr.toggleInheritedVariable(
                this.blockSpec
              ),
              false,
              null,
              localize('check to inherit\nfrom')
              + ' ' + rcvr.exemplar.name
            );
          }
          addOption(
            'transient',
            'toggleTransientVariable',
            this.isTransientVariable(),
            'uncheck to save contents\nin the project',
            'check to prevent contents\nfrom being saved'
          );
          menu.addLine();
          menu.addItem(
            'rename...',
            () => this.refactorThisVar(true), // just the template
            'rename only\nthis reporter'
          );
          menu.addItem(
            'rename all...',
            'refactorThisVar',
            'rename all blocks that\naccess this variable'
          );
        }
      } else if (this.selector !== 'evaluateCustomBlock') {
        menu.addItem(
          "hide",
          'hidePrimitive'
        );
      }

      // allow toggling inheritable attributes
      if (StageMorph.prototype.enableInheritance) {
        rcvr = this.scriptTarget();
        field = {
          xPosition: 'x position',
          yPosition: 'y position',
          direction: 'direction',
          getScale: 'size',
          getCostumeIdx: 'costume #',
          getVolume: 'volume',
          getPan: 'balance',
          reportShown: 'shown?',
          getPenDown: 'pen down?'
        }[this.selector];
        if (field && rcvr && rcvr.exemplar) {
          menu.addLine();
          addOption(
            'inherited',
            () => rcvr.toggleInheritanceForAttribute(field),
            rcvr.inheritsAttribute(field),
            'uncheck to\ndisinherit',
            localize('check to inherit\nfrom')
            + ' ' + rcvr.exemplar.name
          );
        }
      }

      if (StageMorph.prototype.enableCodeMapping) {
        menu.addLine();
        menu.addItem(
          'header mapping...',
          'mapToHeader'
        );
        menu.addItem(
          'code mapping...',
          'mapToCode'
        );
      }
    }
    return menu;
  }
  menu.addLine();
  if (this.selector === 'reportGetVar') {
    menu.addItem(
      'rename...',
      renameVar,
      'rename only\nthis reporter'
    );
  } else if (SpriteMorph.prototype.blockAlternatives[this.selector]) {
    menu.addItem(
      'relabel...',
      () => this.relabel(
        SpriteMorph.prototype.blockAlternatives[this.selector]
      )
    );
  } else if (this.isCustomBlock && this.alternatives) {
    alternatives = this.alternatives();
    if (alternatives.length > 0) {
      menu.addItem(
        'relabel...',
        () => this.relabel(alternatives)
      );
    }
  }

  // direct relabelling:
  // - JIT-compile HOFs - experimental
  // - vector pen trails
  if (
    contains(
      ['reportMap', 'reportKeep', 'reportFindFirst', 'reportCombine'],
      this.selector
    )
  ) {
    alternatives = {
      reportMap : 'reportAtomicMap',
      reportKeep : 'reportAtomicKeep',
      reportFindFirst: 'reportAtomicFindFirst',
      reportCombine : 'reportAtomicCombine'
    };
    menu.addItem(
      'compile',
      () => this.setSelector(alternatives[this.selector]),
      'experimental!\nmake this reporter fast and uninterruptable\n' +
      'CAUTION: Errors in the ring\ncan break your Snap! session!'
    );
  } else if (
    contains(
      [
        'reportAtomicMap',
        'reportAtomicKeep',
        'reportAtomicFindFirst',
        'reportAtomicCombine'
      ],
      this.selector
    )
  ) {
    alternatives = {
      reportAtomicMap : 'reportMap',
      reportAtomicKeep : 'reportKeep',
      reportAtomicFindFirst: 'reportFindFirst',
      reportAtomicCombine : 'reportCombine'
    };
    menu.addItem(
      'uncompile',
      () => this.setSelector(alternatives[this.selector])
    );
  } else if (
    contains(
      ['reportPenTrailsAsCostume', 'reportPentrailsAsSVG'],
      this.selector
    )
  ) {
    alternatives = {
      reportPenTrailsAsCostume : 'reportPentrailsAsSVG',
      reportPentrailsAsSVG : 'reportPenTrailsAsCostume'
    };
    menu.addItem(
      localize(
        SpriteMorph.prototype.blocks[
          alternatives[this.selector]
          ].spec
      ),
      () => {
        this.setSelector(alternatives[this.selector]);
        this.changed();
      }
    );
  }

  menu.addItem(
    "duplicate",
    () => {
      var dup = this.fullCopy(),
        ide = this.parentThatIsA(IDE_Morph),
        blockEditor = this.parentThatIsA(BlockEditorMorph);
      dup.pickUp(world);
      // register the drop-origin, so the block can
      // slide back to its former situation if dropped
      // somewhere where it gets rejected
      if (!ide && blockEditor) {
        ide = blockEditor.target.parentThatIsA(IDE_Morph);
      }
      if (ide) {
        world.hand.grabOrigin = {
          origin: ide.palette,
          position: ide.palette.center()
        };
      }
    },
    'make a copy\nand pick it up'
  );
  if (this instanceof CommandBlockMorph && this.nextBlock()) {
    menu.addItem(
      (proc ? this.fullCopy() : this).thumbnail(0.5, 60),
      () => {
        var cpy = this.fullCopy(),
          nb = cpy.nextBlock(),
          ide = this.parentThatIsA(IDE_Morph),
          blockEditor = this.parentThatIsA(BlockEditorMorph);
        if (nb) {nb.destroy(); }
        cpy.pickUp(world);
        if (!ide && blockEditor) {
          ide = blockEditor.target.parentThatIsA(IDE_Morph);
        }
        if (ide) {
          world.hand.grabOrigin = {
            origin: ide.palette,
            position: ide.palette.center()
          };
        }
      },
      'only duplicate this block'
    );
    menu.addItem(
      'extract',
      'userExtractJustThis',
      'only grab this block'
    );
  }
  menu.addItem(
    "delete",
    'userDestroy'
  );
  if (isNil(this.comment)) {
    menu.addItem(
      "add comment",
      () => {
        var comment = new CommentMorph();
        this.comment = comment;
        comment.block = this;
        comment.layoutChanged();

        // Simulate drag/drop for better undo/redo behavior
        var scripts = this.parentThatIsA(ScriptsMorph),
          ide = this.parentThatIsA(IDE_Morph),
          blockEditor = this.parentThatIsA(BlockEditorMorph);
        if (!ide && blockEditor) {
          ide = blockEditor.target.parentThatIsA(IDE_Morph);
        }
        if (ide) {
          world.hand.grabOrigin = {
            origin: ide.palette,
            position: ide.palette.center()
          };
        }
        scripts.clearDropInfo();
        scripts.lastDropTarget = { element: this };
        scripts.lastDroppedBlock = comment;
        scripts.recordDrop(world.hand.grabOrigin);
      }
    );
  }
  menu.addItem(
    "script pic...",
    () => {
      // Trace.log('Block.scriptPic', myself.blockId());
      var ide = this.parentThatIsA(IDE_Morph) ||
        this.parentThatIsA(BlockEditorMorph).target.parentThatIsA(
          IDE_Morph
        );
      ide.saveCanvasAs(
        top.scriptPic(),
        (ide.projectName || localize('untitled')) + ' ' +
        localize('script pic')
      );
    },
    'save a picture\nof this script'
  );
  if (top instanceof ReporterBlockMorph ||
    (!(top instanceof PrototypeHatBlockMorph) &&
      top.allChildren().some((any) => any.selector === 'doReport'))
  ) {
    menu.addItem(
      "result pic...",
      () => top.exportResultPic(),
      'save a picture of both\nthis script and its result'
    );
  }
  if (shiftClicked) {
    menu.addItem(
      'download script',
      () => {
        var ide = this.parentThatIsA(IDE_Morph),
          blockEditor = this.parentThatIsA(BlockEditorMorph);
        if (!ide && blockEditor) {
          ide = blockEditor.target.parentThatIsA(IDE_Morph);
        }
        if (ide) {
          ide.saveXMLAs(
            ide.serializer.serialize(this),
            this.selector + ' script',
            false);
        }
      },
      'download this script\nas an XML file',
      new Color(100, 0, 0)
    );
  }
  if (proc) {
    if (vNames.length) {
      menu.addLine();
      vNames.forEach(vn =>
        menu.addItem(
          vn + '...',
          () => proc.doShowVar(vn)
        )
      );
    }
    proc.homeContext.variables.names().forEach(vn => {
      if (!contains(vNames, vn)) {
        menu.addItem(
          vn + '...',
          () => proc.doShowVar(vn)
        );
      }
    });
    return menu;
  }
  if (this.parent.parentThatIsA(RingMorph)) {
    menu.addLine();
    menu.addItem("unringify", 'unringify');
    if (this instanceof ReporterBlockMorph ||
      (!(top instanceof HatBlockMorph))) {
      menu.addItem("ringify", 'ringify');
    }
    return menu;
  }
  if (contains(
    ['doBroadcast', 'doSend', 'doBroadcastAndWait', 'receiveMessage',
      'receiveOnClone', 'receiveGo'],
    this.selector
  )) {
    hasLine = true;
    menu.addLine();
    menu.addItem(
      (this.selector.indexOf('receive') === 0 ?
        "senders..." : "receivers..."),
      'showMessageUsers'
    );
  }
  if (this.parent instanceof ReporterSlotMorph
    || (this.parent instanceof CommandSlotMorph)
    || (this instanceof HatBlockMorph)
    || (this instanceof CommandBlockMorph
      && (top instanceof HatBlockMorph))) {
    return menu;
  }
  if (!hasLine) {menu.addLine(); }
  menu.addItem("ringify", 'ringify');
  if (StageMorph.prototype.enableCodeMapping) {
    menu.addLine();
    menu.addItem(
      'header mapping...',
      'mapToHeader'
    );
    menu.addItem(
      'code mapping...',
      'mapToCode'
    );
  }
  return menu;
};
BlockMorph.prototype.codeDefinitionHeader = function () {
  var block = this.isCustomBlock ? new PrototypeHatBlockMorph(this.definition)
    : SpriteMorph.prototype.blockForSelector(this.selector),
    hat = new HatBlockMorph(),
    count = 1;

  if (this.isCustomBlock) {return block; }
  block.inputs().forEach(input => {
    var part = new TemplateSlotMorph('#' + count);
    block.replaceInput(input, part);
    count += 1;
  });
  block.isPrototype = true;
  hat.setCategory("control");
  hat.setSpec('%s');
  hat.replaceInput(hat.inputs()[0], block);
  if (this.category === 'control') {
    hat.alternateBlockColor();
  }
  return hat;
};



export {BlockMorph};
