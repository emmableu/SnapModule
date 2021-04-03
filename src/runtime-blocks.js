import {Costume, isSnapObject, Sound, SpriteMorph, StageMorph} from "./objects";
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
import {BlockInputFragmentMorph, PrototypeHatBlockMorph} from "./byob";
import {
  Color,
  contains,
  detect,
  isNil, isString,
  localize,
  MenuMorph, Morph,
  MorphicPreferences,
  Point,
  ScrollFrameMorph, SpeechBubbleMorph, TextMorph
} from "./morphic";
import {SymbolMorph} from "./symbols";
import {DialogBoxMorph} from "./widgets";
import {IDE_Morph, SpriteIconMorph} from "./gui";
import {Context, Process} from "./threads";
import {ListWatcherMorph} from "./lists";
import {TableFrameMorph} from "./tables";

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

ReporterBlockMorph.prototype.mouseClickLeft = function (pos) {
  var label,
    myself = this;
  if (this.parent instanceof BlockInputFragmentMorph) {
    return this.parent.mouseClickLeft();
  }
  if (this.parent instanceof TemplateSlotMorph) {
    if (this.parent.parent && this.parent.parent.parent &&
      this.parent.parent.parent instanceof RingMorph) {
      label = "Input name";
    } else if (this.parent.parent.elementSpec === '%blockVars') {
      label = "Block variable name";
    } else {
      label = "Script variable name";
    }
    new DialogBoxMorph(
      this,
      function(arg) {
        // Trace.log('TemplateArg.rename', {
        //     'id': myself.parent.argId(),
        //     'name': arg,
        // });
        myself.userSetSpec(arg);
      },
      this
    ).prompt(
      label,
      this.blockSpec,
      this.world()
    );
  } else {
    ReporterBlockMorph.uber.mouseClickLeft.call(this, pos);
  }
};


export {BlockMorph, ReporterBlockMorph};
