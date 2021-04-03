import {
  BoxMorph,
  contains,
  isNil,
  isString,
  localize,
  MenuMorph,
  Morph, MorphicPreferences,
  newCanvas,
  nop,
  Point, radians,
  TextMorph, useBlurredShadows,
  WHITE
} from "./morphic";
import {
  CellMorph,
  Costume,
  isSnapObject,
  Sound,
  SpriteBubbleMorph,
  SpriteMorph,
  StageMorph,
  WatcherMorph
} from "./objects";
import {PaintEditorMorph} from "./paint";
import {PushButtonMorph, ToggleMorph} from "./widgets";
import {IDE_Morph} from "./gui";
import {Context, Process, VariableFrame} from "./threads";
import {BlockMorph, SyntaxElementMorph} from "./blocks";
import {VariableDialogMorph} from "./byob";
import {SymbolMorph} from "./symbols";
import {List, ListWatcherMorph} from "./lists";
import {TableFrameMorph} from "./tables";

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
SpriteMorph.prototype.blockTemplates = function (category) {
  var blocks = [], myself = this, varNames, button,
    cat = category || 'motion', txt,
    inheritedVars = this.inheritedVariableNames();

  function block(selector, isGhosted) {
    if (StageMorph.prototype.hiddenPrimitives[selector]) {
      return null;
    }
    var newBlock = SpriteMorph.prototype.blockForSelector(selector, true);
    newBlock.isTemplate = true;
    if (isGhosted) {newBlock.ghost(); }
    return newBlock;
  }

  function variableBlock(varName, isLocal) {
    var newBlock = SpriteMorph.prototype.variableBlock(varName, isLocal);
    newBlock.isDraggable = false;
    newBlock.isTemplate = true;
    if (contains(inheritedVars, varName)) {
      newBlock.ghost();
    }
    return newBlock;
  }

  function watcherToggle(selector) {
    if (StageMorph.prototype.hiddenPrimitives[selector]) {
      return null;
    }
    var info = SpriteMorph.prototype.blocks[selector];
    return new ToggleMorph(
      'checkbox',
      this,
      function () {
        myself.toggleWatcher(
          selector,
          localize(info.spec),
          myself.blockColor[info.category]
        );
      },
      null,
      function () {
        return myself.showingWatcher(selector);
      },
      null
    );
  }

  function variableWatcherToggle(varName) {
    return new ToggleMorph(
      'checkbox',
      this,
      function () {
        myself.toggleVariableWatcher(varName);
      },
      null,
      function () {
        return myself.showingVariableWatcher(varName);
      },
      null
    );
  }

  function helpMenu() {
    var menu = new MenuMorph(this);
    menu.addItem('help...', 'showHelp');
    return menu;
  }

  function addVar(pair) {
    var ide;
    if (pair) {
      if (myself.isVariableNameInUse(pair[0], pair[1])) {
        myself.inform('that name is already in use');
      } else {
        ide = myself.parentThatIsA(IDE_Morph);
        myself.addVariable(pair[0], pair[1]);
        myself.toggleVariableWatcher(pair[0], pair[1]);
        ide.flushBlocksCache('variables'); // b/c of inheritance
        ide.refreshPalette();
      }
    }
  }

  if (cat === 'motion') {

    blocks.push(block('forward'));
    blocks.push(block('turn'));
    blocks.push(block('turnLeft'));
    blocks.push('-');
    blocks.push(block('setHeading'));
    blocks.push(block('doFaceTowards'));
    blocks.push('-');
    blocks.push(block('gotoXY'));
    blocks.push(block('doGotoObject'));
    blocks.push(block('doGlide'));
    blocks.push('-');
    blocks.push(block('changeXPosition'));
    blocks.push(block('setXPosition'));
    blocks.push(block('changeYPosition'));
    blocks.push(block('setYPosition'));
    blocks.push('-');
    blocks.push(block('bounceOffEdge'));
    blocks.push('-');
    blocks.push(watcherToggle('xPosition'));
    blocks.push(block('xPosition', this.inheritsAttribute('x position')));
    blocks.push(watcherToggle('yPosition'));
    blocks.push(block('yPosition', this.inheritsAttribute('y position')));
    blocks.push(watcherToggle('direction'));
    blocks.push(block('direction', this.inheritsAttribute('direction')));
    blocks.push('=');
    blocks.push(this.makeBlockButton(cat));

  } else if (cat === 'looks') {

    blocks.push(block('doSwitchToCostume'));
    blocks.push(block('doWearNextCostume'));
    blocks.push(watcherToggle('getCostumeIdx'));
    blocks.push(block('getCostumeIdx', this.inheritsAttribute('costume #')));
    blocks.push('-');
    blocks.push(block('doSayFor'));
    blocks.push(block('bubble'));
    blocks.push(block('doThinkFor'));
    blocks.push(block('doThink'));
    blocks.push('-');
    blocks.push(block('reportGetImageAttribute'));
    blocks.push(block('reportNewCostumeStretched'));
    blocks.push(block('reportNewCostume'));
    blocks.push('-');
    blocks.push(block('changeEffect'));
    blocks.push(block('setEffect'));
    blocks.push(block('clearEffects'));
    blocks.push(block('getEffect'));
    blocks.push('-');
    blocks.push(block('changeScale'));
    blocks.push(block('setScale'));
    blocks.push(watcherToggle('getScale'));
    blocks.push(block('getScale', this.inheritsAttribute('size')));
    blocks.push('-');
    blocks.push(block('show'));
    blocks.push(block('hide'));
    blocks.push(watcherToggle('reportShown'));
    blocks.push(block('reportShown', this.inheritsAttribute('shown?')));
    blocks.push('-');
    blocks.push(block('goToLayer'));
    blocks.push(block('goBack'));

    // for debugging: ///////////////

    if (this.world().isDevMode) {
      blocks.push('-');
      txt = new TextMorph(localize(
        'development mode \ndebugging primitives:'
      ));
      txt.fontSize = 9;
      txt.setColor(this.paletteTextColor);
      blocks.push(txt);
      blocks.push('-');
      blocks.push(block('log'));
      blocks.push(block('alert'));
      blocks.push('-');
      blocks.push(block('doScreenshot'));
    }

    /////////////////////////////////

    blocks.push('=');
    blocks.push(this.makeBlockButton(cat));

  } else if (cat === 'sound') {

    blocks.push(block('playSound'));
    blocks.push(block('doPlaySoundUntilDone'));
    blocks.push(block('doStopAllSounds'));
    blocks.push('-');
    blocks.push(block('doPlaySoundAtRate'));
    blocks.push(block('reportGetSoundAttribute'));
    blocks.push(block('reportNewSoundFromSamples'));
    blocks.push('-');
    blocks.push(block('doRest'));
    blocks.push(block('doPlayNote'));
    blocks.push(block('doSetInstrument'));
    blocks.push('-');
    blocks.push(block('doChangeTempo'));
    blocks.push(block('doSetTempo'));
    blocks.push(watcherToggle('getTempo'));
    blocks.push(block('getTempo'));
    blocks.push('-');
    blocks.push(block('changeVolume'));
    blocks.push(block('setVolume'));
    blocks.push(watcherToggle('getVolume'));
    blocks.push(block('getVolume', this.inheritsAttribute('volume')));
    blocks.push('-');
    blocks.push(block('changePan'));
    blocks.push(block('setPan'));
    blocks.push(watcherToggle('getPan'));
    blocks.push(block('getPan', this.inheritsAttribute('balance')));
    blocks.push('-');
    blocks.push(block('playFreq'));
    blocks.push(block('stopFreq'));

    // for debugging: ///////////////

    if (this.world().isDevMode) {
      blocks.push('-');
      txt = new TextMorph(localize(
        'development mode \ndebugging primitives:'
      ));
      txt.fontSize = 9;
      txt.setColor(this.paletteTextColor);
      blocks.push(txt);
      blocks.push('-');
      blocks.push(block('doPlayFrequency'));
    }

    /////////////////////////////////

    blocks.push('=');
    blocks.push(this.makeBlockButton(cat));

  } else if (cat === 'pen') {

    blocks.push(block('clear'));
    blocks.push('-');
    blocks.push(block('down'));
    blocks.push(block('up'));
    blocks.push(watcherToggle('getPenDown'));
    blocks.push(block('getPenDown', this.inheritsAttribute('pen down?')));
    blocks.push('-');
    blocks.push(block('setColor'));
    blocks.push(block('changePenHSVA'));
    blocks.push(block('setPenHSVA'));
    blocks.push(block('getPenAttribute'));
    blocks.push('-');
    blocks.push(block('changeSize'));
    blocks.push(block('setSize'));
    blocks.push('-');
    blocks.push(block('doStamp'));
    blocks.push(block('floodFill'));
    blocks.push(block('write'));
    blocks.push('-');
    blocks.push(block('reportPenTrailsAsCostume'));
    blocks.push('-');
    blocks.push(block('doPasteOn'));
    blocks.push(block('doCutFrom'));
    blocks.push('=');
    blocks.push(this.makeBlockButton(cat));

  } else if (cat === 'control') {

    blocks.push(block('receiveGo'));
    blocks.push(block('receiveKey'));
    blocks.push(block('receiveInteraction'));
    blocks.push(block('receiveCondition'));
    blocks.push(block('receiveMessage'));
    blocks.push('-');
    blocks.push(block('doBroadcast'));
    blocks.push(block('doBroadcastAndWait'));
    blocks.push(block('doSend'));
    blocks.push(watcherToggle('getLastMessage'));
    blocks.push(block('getLastMessage'));
    blocks.push('-');
    blocks.push(block('doWarp'));
    blocks.push('-');
    blocks.push(block('doWait'));
    blocks.push(block('doWaitUntil'));
    blocks.push('-');
    blocks.push(block('doForever'));
    blocks.push(block('doRepeat'));
    blocks.push(block('doUntil'));
    blocks.push(block('doFor'));
    blocks.push('-');
    blocks.push(block('doIf'));
    blocks.push(block('doIfElse'));
    blocks.push(block('reportIfElse'));
    blocks.push('-');
    blocks.push(block('doReport'));
    blocks.push(block('doStopThis'));
    blocks.push('-');
    blocks.push(block('doRun'));
    blocks.push(block('fork'));
    blocks.push(block('evaluate'));
    blocks.push('-');
    blocks.push(block('doTellTo'));
    blocks.push(block('reportAskFor'));
    blocks.push('-');
    blocks.push(block('doCallCC'));
    blocks.push(block('reportCallCC'));
    blocks.push('-');
    blocks.push(block('receiveOnClone'));
    blocks.push(block('createClone'));
    blocks.push(block('newClone'));
    blocks.push(block('removeClone'));
    blocks.push('-');
    blocks.push(block('doPauseAll'));
    blocks.push('=');
    blocks.push(this.makeBlockButton(cat));

  } else if (cat === 'sensing') {

    blocks.push(block('reportTouchingObject'));
    blocks.push(block('reportTouchingColor'));
    blocks.push(block('reportColorIsTouchingColor'));
    blocks.push('-');
    blocks.push(block('doAsk'));
    blocks.push(watcherToggle('getLastAnswer'));
    blocks.push(block('getLastAnswer'));
    blocks.push('-');
    blocks.push(watcherToggle('reportMouseX'));
    blocks.push(block('reportMouseX'));
    blocks.push(watcherToggle('reportMouseY'));
    blocks.push(block('reportMouseY'));
    blocks.push(block('reportMouseDown'));
    blocks.push('-');
    blocks.push(block('reportKeyPressed'));
    blocks.push('-');
    blocks.push(block('reportRelationTo'));
    blocks.push(block('reportAspect'));
    blocks.push('-');
    blocks.push(block('doResetTimer'));
    blocks.push(watcherToggle('getTimer'));
    blocks.push(block('getTimer'));
    blocks.push('-');
    blocks.push(block('reportAttributeOf'));

    if (SpriteMorph.prototype.enableFirstClass) {
      blocks.push(block('reportGet'));
    }

    blocks.push(block('reportObject'));
    blocks.push('-');
    blocks.push(block('reportURL'));
    blocks.push(block('reportAudio'));
    blocks.push(block('reportVideo'));
    blocks.push(block('doSetVideoTransparency'));
    blocks.push('-');
    blocks.push(block('reportGlobalFlag'));
    blocks.push(block('doSetGlobalFlag'));
    blocks.push('-');
    blocks.push(block('reportDate'));

    // for debugging: ///////////////

    if (this.world().isDevMode) {

      blocks.push('-');
      txt = new TextMorph(localize(
        'development mode \ndebugging primitives:'
      ));
      txt.fontSize = 9;
      txt.setColor(this.paletteTextColor);
      blocks.push(txt);
      blocks.push('-');
      blocks.push(watcherToggle('reportThreadCount'));
      blocks.push(block('reportThreadCount'));
      blocks.push(block('reportStackSize'));
      blocks.push(block('reportFrameCount'));
    }

    /////////////////////////////////

    blocks.push('=');
    blocks.push(this.makeBlockButton(cat));

  } else if (cat === 'operators') {

    blocks.push(block('reifyScript'));
    blocks.push(block('reifyReporter'));
    blocks.push(block('reifyPredicate'));
    blocks.push('#');
    blocks.push('-');
    blocks.push(block('reportSum'));
    blocks.push(block('reportDifference'));
    blocks.push(block('reportProduct'));
    blocks.push(block('reportQuotient'));
    blocks.push(block('reportPower'));
    blocks.push('-');
    blocks.push(block('reportModulus'));
    blocks.push(block('reportRound'));
    blocks.push(block('reportMonadic'));
    blocks.push(block('reportRandom'));
    blocks.push('-');
    blocks.push(block('reportLessThan'));
    blocks.push(block('reportEquals'));
    blocks.push(block('reportGreaterThan'));
    blocks.push('-');
    blocks.push(block('reportAnd'));
    blocks.push(block('reportOr'));
    blocks.push(block('reportNot'));
    blocks.push(block('reportBoolean'));
    blocks.push('-');
    blocks.push(block('reportJoinWords'));
    blocks.push(block('reportTextSplit'));
    blocks.push(block('reportLetter'));
    blocks.push(block('reportStringSize'));
    blocks.push('-');
    blocks.push(block('reportUnicode'));
    blocks.push(block('reportUnicodeAsLetter'));
    blocks.push('-');
    blocks.push(block('reportIsA'));
    blocks.push(block('reportIsIdentical'));

    if (true) { // (Process.prototype.enableJS) {
      blocks.push('-');
      blocks.push(block('reportJSFunction'));
      if (Process.prototype.enableCompiling) {
        blocks.push(block('reportCompiled'));
      }
    }

    // for debugging: ///////////////

    if (this.world().isDevMode) {
      blocks.push('-');
      txt = new TextMorph(localize(
        'development mode \ndebugging primitives:'
      ));
      txt.fontSize = 9;
      txt.setColor(this.paletteTextColor);
      blocks.push(txt);
      blocks.push('-');
      blocks.push(block('reportTypeOf'));
      blocks.push(block('reportTextFunction'));
    }

    /////////////////////////////////

    blocks.push('=');
    blocks.push(this.makeBlockButton(cat));

  } else if (cat === 'variables') {

    button = new PushButtonMorph(
      null,
      function () {
        new VariableDialogMorph(
          null,
          addVar,
          myself
        ).prompt(
          'Variable name',
          null,
          myself.world()
        );
      },
      'Make a variable'
    );
    button.userMenu = helpMenu;
    button.selector = 'addVariable';
    button.showHelp = BlockMorph.prototype.showHelp;
    blocks.push(button);

    if (this.deletableVariableNames().length > 0) {
      button = new PushButtonMorph(
        null,
        function () {
          var menu = new MenuMorph(
            myself.deleteVariable,
            null,
            myself
          );
          myself.deletableVariableNames().forEach(name =>
            menu.addItem(
              name,
              name,
              null,
              null,
              null,
              null,
              null,
              null,
              true // verbatim - don't translate
            )
          );
          menu.popUpAtHand(myself.world());
        },
        'Delete a variable'
      );
      button.userMenu = helpMenu;
      button.selector = 'deleteVariable';
      button.showHelp = BlockMorph.prototype.showHelp;
      blocks.push(button);
    }

    blocks.push('-');

    varNames = this.reachableGlobalVariableNames(true);
    if (varNames.length > 0) {
      varNames.forEach(name => {
        blocks.push(variableWatcherToggle(name));
        blocks.push(variableBlock(name));
      });
      blocks.push('-');
    }

    varNames = this.allLocalVariableNames(true);
    if (varNames.length > 0) {
      varNames.forEach(name => {
        blocks.push(variableWatcherToggle(name));
        blocks.push(variableBlock(name, true));
      });
      blocks.push('-');
    }

    blocks.push(block('doSetVar'));
    blocks.push(block('doChangeVar'));
    blocks.push(block('doShowVar'));
    blocks.push(block('doHideVar'));
    blocks.push(block('doDeclareVariables'));

    // inheritance:

    if (StageMorph.prototype.enableInheritance) {
      blocks.push('-');
      blocks.push(block('doDeleteAttr'));
    }

    ///////////////////////////////

    blocks.push('=');

    blocks.push(block('reportNewList'));
    blocks.push(block('reportNumbers'));
    blocks.push('-');
    blocks.push(block('reportCONS'));
    blocks.push(block('reportListItem'));
    blocks.push(block('reportCDR'));
    blocks.push('-');
    blocks.push(block('reportListLength'));
    blocks.push(block('reportListIndex'));
    blocks.push(block('reportListContainsItem'));
    blocks.push(block('reportListIsEmpty'));
    blocks.push('-');
    blocks.push(block('reportMap'));
    blocks.push(block('reportKeep'));
    blocks.push(block('reportFindFirst'));
    blocks.push(block('reportCombine'));
    blocks.push('-');
    blocks.push(block('doForEach'));
    blocks.push('-');
    blocks.push(block('reportConcatenatedLists'));
    blocks.push('-');
    blocks.push(block('doAddToList'));
    blocks.push(block('doDeleteFromList'));
    blocks.push(block('doInsertInList'));
    blocks.push(block('doReplaceInList'));

    // for debugging: ///////////////

    if (this.world().isDevMode) {
      blocks.push('-');
      txt = new TextMorph(localize(
        'development mode \ndebugging primitives:'
      ));
      txt.fontSize = 9;
      txt.setColor(this.paletteTextColor);
      blocks.push(txt);
      blocks.push('-');
      blocks.push(block('doShowTable'));
    }

    /////////////////////////////////

    blocks.push('=');

    if (StageMorph.prototype.enableCodeMapping) {
      blocks.push(block('doMapCodeOrHeader'));
      blocks.push(block('doMapValueCode'));
      blocks.push(block('doMapListCode'));
      blocks.push('-');
      blocks.push(block('reportMappedCode'));
      blocks.push('=');
    }

    blocks.push(this.makeBlockButton());
  }
  return blocks;
};

// SpriteBubbleMorph contents formatting

SpriteBubbleMorph.prototype.dataAsMorph = function (data) {
  var contents,
    sprite = SpriteMorph.prototype,
    isText,
    img,
    scaledImg,
    width;
  if (data instanceof Morph) {
    if (isSnapObject(data)) {
      img = data.thumbnail(new Point(40, 40));
      contents = new Morph();
      contents.isCachingImage = true;
      contents.bounds.setWidth(img.width);
      contents.bounds.setHeight(img.height);
      contents.cachedImage = img;
      contents.version = data.version;
      contents.step = function () {
        if (this.version !== data.version) {
          img = data.thumbnail(new Point(40, 40), this.cachedImage);
          this.cachedImage = img;
          this.version = data.version;
          this.changed();
        }
      };
    } else {
      contents = data;
    }
  } else if (isString(data)) {
    isText = true;
    contents = new TextMorph(
      data,
      sprite.bubbleFontSize * this.scale,
      null, // fontStyle
      sprite.bubbleFontIsBold,
      false, // italic
      'center'
    );
  } else if (typeof data === 'boolean') {
    img = sprite.booleanMorph(data).fullImage();
    contents = new Morph();
    contents.isCachingImage = true;
    contents.bounds.setWidth(img.width);
    contents.bounds.setHeight(img.height);
    contents.cachedImage = img;
  } else if (data instanceof Costume) {
    img = data.thumbnail(new Point(40, 40));
    contents = new Morph();
    contents.isCachingImage = true;
    contents.bounds.setWidth(img.width);
    contents.bounds.setHeight(img.height);
    contents.cachedImage = img;
  } else if (data instanceof Sound) {
    contents = new SymbolMorph('notes', 30);
  } else if (data instanceof HTMLCanvasElement) {
    img = data;
    contents = new Morph();
    contents.isCachingImage = true;
    contents.bounds.setWidth(img.width);
    contents.bounds.setHeight(img.height);
    contents.cachedImage = img;
  } else if (data instanceof List) {
    if (data.isTable()) {
      contents = new TableFrameMorph(new TableMorph(data, 10));
      if (this.stage) {
        contents.expand(this.stage.extent().translateBy(
          -2 * (this.edge + this.border + this.padding)
        ));
      }
    } else {
      contents = new ListWatcherMorph(data);
      contents.update(true);
      contents.step = contents.update;
      if (this.stage) {
        contents.expand(this.stage.extent().translateBy(
          -2 * (this.edge + this.border + this.padding)
        ));
      }
    }
    contents.isDraggable = false;
  } else if (data instanceof Context) {
    img = data.image();
    contents = new Morph();
    contents.isCachingImage = true;
    contents.bounds.setWidth(img.width);
    contents.bounds.setHeight(img.height);
    contents.cachedImage = img;
  } else {
    contents = new TextMorph(
      data.toString(),
      sprite.bubbleFontSize * this.scale,
      null, // fontStyle
      sprite.bubbleFontIsBold,
      false, // italic
      'center'
    );
  }
  if (contents instanceof TextMorph) {
    // reflow text boundaries
    width = Math.max(
      contents.width(),
      sprite.bubbleCorner * 2 * this.scale
    );
    if (isText) {
      width = Math.min(width, sprite.bubbleMaxTextWidth * this.scale);
    }
    contents.setWidth(width);
  } else if (!(data instanceof List)) {
    // scale contents image
    scaledImg = newCanvas(contents.extent().multiplyBy(this.scale));
    scaledImg.getContext('2d').drawImage(
      contents.getImage(),
      0,
      0,
      scaledImg.width,
      scaledImg.height
    );
    contents.cachedImage = scaledImg;
    contents.bounds = contents.bounds.scaleBy(this.scale);
  }
  return contents;
};
// SpriteBubbleMorph scaling

SpriteBubbleMorph.prototype.setScale = function (scale) {
  this.scale = scale;
  this.changed();
  this.fixLayout();
  this.rerender();
};

// SpriteBubbleMorph layout:

SpriteBubbleMorph.prototype.fixLayout = function () {
  var sprite = SpriteMorph.prototype;

  // rebuild my contents
  if (!(this.contentsMorph instanceof ListWatcherMorph ||
    this.contentsMorph instanceof TableFrameMorph)) {
    this.contentsMorph.destroy();
    this.contentsMorph = this.dataAsMorph(this.data);
  }
  this.add(this.contentsMorph);

  // scale my settings
  this.edge = sprite.bubbleCorner * this.scale;
  this.border = sprite.bubbleBorder * this.scale;
  this.padding = sprite.bubbleCorner / 2 * this.scale;

  // adjust my dimensions
  this.bounds.setWidth(this.contentsMorph.width()
    + (this.padding ? this.padding * 2 : this.edge * 2));
  this.bounds.setHeight(this.contentsMorph.height()
    + this.edge
    + this.border * 2
    + this.padding * 2
    + 2);

  // position my contents
  this.contentsMorph.setPosition(this.position().add(
    new Point(
      this.padding || this.edge,
      this.border + this.padding + 1
    )
  ));
};


// CellMorph accessing:

CellMorph.prototype.big = function () {
  this.isBig = true;
  this.changed();
  if (this.contentsMorph instanceof TextMorph) {
    this.contentsMorph.setFontSize(
      SyntaxElementMorph.prototype.fontSize * 1.5
    );
  }
  this.fixLayout(true);
  this.rerender();
};

CellMorph.prototype.normal = function () {
  this.isBig = false;
  this.changed();
  if (this.contentsMorph instanceof TextMorph) {
    this.contentsMorph.setFontSize(
      SyntaxElementMorph.prototype.fontSize
    );
  }
  this.fixLayout(true);
  this.rerender();
};

// CellMorph circularity testing:


CellMorph.prototype.isCircular = function (list) {
  if (!this.parentCell) {return false; }
  if (list instanceof List) {
    return this.contents === list || this.parentCell.isCircular(list);
  }
  return this.parentCell.isCircular(this.contents);
};

// CellMorph layout:

CellMorph.prototype.fixLayout = function (justMe) {
  var isSameList = this.contentsMorph instanceof ListWatcherMorph
    && (this.contentsMorph.list === this.contents),
    isSameTable = this.contentsMorph instanceof TableFrameMorph
      && (this.contentsMorph.tableMorph.table === this.contents),
    listwatcher;

  if (justMe) {return; }

  this.createContents();

  // adjust my dimensions
  this.bounds.setHeight(this.contentsMorph.height()
    + this.edge
    + this.border * 2);
  this.bounds.setWidth(Math.max(
    this.contentsMorph.width() + this.edge * 2,
    (this.contents instanceof Context ||
    this.contents instanceof List ? 0 :
      SyntaxElementMorph.prototype.fontSize * 3.5)
  ));

  // position my contents
  if (!isSameList && !isSameTable) {
    this.contentsMorph.setCenter(this.center());
  }

  if (this.parent) {
    this.parent.changed();
    this.parent.fixLayout();
    this.parent.rerender();
    listwatcher = this.parentThatIsA(ListWatcherMorph);
    if (listwatcher) {
      listwatcher.changed();
      listwatcher.fixLayout();
      listwatcher.rerender();
    }
  }
};

CellMorph.prototype.createContents = function () {
  // re-build my contents
  var txt,
    img,
    fontSize = SyntaxElementMorph.prototype.fontSize,
    isSameList = this.contentsMorph instanceof ListWatcherMorph
      && (this.contentsMorph.list === this.contents),
    isSameTable = this.contentsMorph instanceof TableFrameMorph
      && (this.contentsMorph.tableMorph.table === this.contents);

  if (this.isBig) {
    fontSize = fontSize * 1.5;
  }

  if (this.contentsMorph && !isSameList && !isSameTable) {
    this.contentsMorph.destroy();
    this.version = null;
  }

  if (!isSameList && !isSameTable) {
    if (this.contents instanceof Morph) {
      if (isSnapObject(this.contents)) {
        img = this.contents.thumbnail(new Point(40, 40));
        this.contentsMorph = new Morph();
        this.contentsMorph.isCachingImage = true;
        this.contentsMorph.bounds.setWidth(img.width);
        this.contentsMorph.bounds.setHeight(img.height);
        this.contentsMorph.cachedImage = img;
        this.version = this.contents.version;
      } else {
        this.contentsMorph = this.contents;
      }
    } else if (isString(this.contents)) {
      txt  = this.contents.length > 500 ?
        this.contents.slice(0, 500) + '...' : this.contents;
      this.contentsMorph = new TextMorph(
        txt,
        fontSize,
        null,
        true,
        false,
        'left' // was formerly 'center', reverted b/c of code-mapping
      );
      if (this.isEditable) {
        this.contentsMorph.isEditable = true;
        this.contentsMorph.enableSelecting();
      }
      this.contentsMorph.setColor(WHITE);
    } else if (typeof this.contents === 'boolean') {
      img = SpriteMorph.prototype.booleanMorph.call(
        null,
        this.contents
      ).fullImage();
      this.contentsMorph = new Morph();
      this.contentsMorph.isCachingImage = true;
      this.contentsMorph.bounds.setWidth(img.width);
      this.contentsMorph.bounds.setHeight(img.height);
      this.contentsMorph.cachedImage = img;
    } else if (this.contents instanceof HTMLCanvasElement) {
      img = this.contents;
      this.contentsMorph = new Morph();
      this.contentsMorph.isCachingImage = true;
      this.contentsMorph.bounds.setWidth(img.width);
      this.contentsMorph.bounds.setHeight(img.height);
      this.contentsMorph.cachedImage = img;
    } else if (this.contents instanceof Context) {
      img = this.contents.image();
      this.contentsMorph = new Morph();
      this.contentsMorph.isCachingImage = true;
      this.contentsMorph.bounds.setWidth(img.width);
      this.contentsMorph.bounds.setHeight(img.height);
      this.contentsMorph.cachedImage = img;
    } else if (this.contents instanceof Costume) {
      img = this.contents.thumbnail(new Point(40, 40));
      this.contentsMorph = new Morph();
      this.contentsMorph.isCachingImage = true;
      this.contentsMorph.bounds.setWidth(img.width);
      this.contentsMorph.bounds.setHeight(img.height);
      this.contentsMorph.cachedImage = img;
    } else if (this.contents instanceof Sound) {
      this.contentsMorph = new SymbolMorph('notes', 30);
    } else if (this.contents instanceof List) {
      if (this.contents.isTable()) {
        this.contentsMorph = new TableFrameMorph(new TableMorph(
          this.contents,
          10
        ));
        this.contentsMorph.expand(new Point(200, 150));
      } else {
        if (this.isCircular()) {
          this.contentsMorph = new TextMorph(
            '(...)',
            fontSize,
            null,
            false, // bold
            true, // italic
            'center'
          );
          this.contentsMorph.setColor(WHITE);
        } else {
          this.contentsMorph = new ListWatcherMorph(
            this.contents,
            this
          );
        }
      }
      this.contentsMorph.isDraggable = false;
    } else {
      this.contentsMorph = new TextMorph(
        !isNil(this.contents) ? this.contents.toString() : '',
        fontSize,
        null,
        true,
        false,
        'center'
      );
      if (this.isEditable) {
        this.contentsMorph.isEditable = true;
        this.contentsMorph.enableSelecting();
      }
      this.contentsMorph.setColor(WHITE);
    }
    this.add(this.contentsMorph);
  }
};

// CellMorph drawing:

CellMorph.prototype.update = function () {
  // special case for observing sprites
  if (!isSnapObject(this.contents) && !(this.contents instanceof Costume)) {
    return;
  }
  if (this.version !== this.contents.version) {
    this.fixLayout();
    this.rerender();
    this.version = this.contents.version;
  }
};

CellMorph.prototype.render = function (ctx) {
  // draw my outline
  if ((this.edge === 0) && (this.border === 0)) {
    BoxMorph.uber.render.call(this, ctx);
    return null;
  }
  ctx.fillStyle = this.color.toString();
  ctx.beginPath();
  this.outlinePath(
    ctx,
    Math.max(this.edge - this.border, 0),
    this.border
  );
  ctx.closePath();
  ctx.fill();
  if (this.border > 0 && !MorphicPreferences.isFlat) {
    ctx.lineWidth = this.border;
    ctx.strokeStyle = this.borderColor.toString();
    ctx.beginPath();
    this.outlinePath(ctx, this.edge, this.border / 2);
    ctx.closePath();
    ctx.stroke();

    if (useBlurredShadows) {
      ctx.shadowOffsetX = this.border;
      ctx.shadowOffsetY = this.border;
      ctx.shadowBlur = this.border;
      ctx.shadowColor = this.color.darker(80).toString();
      this.drawShadow(ctx, this.edge, this.border / 2);
    }
  }
};

CellMorph.prototype.drawShadow = function (context, radius, inset) {
  var offset = radius + inset,
    w = this.width(),
    h = this.height();

  // bottom left:
  context.beginPath();
  context.moveTo(0, h - offset);
  context.lineTo(0, offset);
  context.stroke();

  // top left:
  context.beginPath();
  context.arc(
    offset,
    offset,
    radius,
    radians(-180),
    radians(-90),
    false
  );
  context.stroke();

  // top right:
  context.beginPath();
  context.moveTo(offset, 0);
  context.lineTo(w - offset, 0);
  context.stroke();
};

// CellMorph editing (inside list watchers):

CellMorph.prototype.layoutChanged = function () {
  var listWatcher = this.parentThatIsA(ListWatcherMorph);

  // adjust my layout
  this.bounds.setHeight(this.contentsMorph.height()
    + this.edge
    + this.border * 2);
  this.bounds.setWidth(Math.max(
    this.contentsMorph.width() + this.edge * 2,
    (this.contents instanceof Context ||
    this.contents instanceof List ? 0 : this.height() * 2)
  ));

  // position my contents
  this.contentsMorph.setCenter(this.center());
  this.rerender();

  if (listWatcher) {
    listWatcher.fixLayout();
  }
};

CellMorph.prototype.reactToEdit = function (textMorph) {
  var listWatcher;
  if (!isNil(this.idx)) {
    listWatcher = this.parentThatIsA(ListWatcherMorph);
    if (listWatcher) {
      listWatcher.list.put(
        textMorph.text,
        this.idx + listWatcher.start - 1
      );
    }
  }
};

CellMorph.prototype.mouseClickLeft = function (pos) {
  if (this.isEditable && this.contentsMorph instanceof TextMorph) {
    this.contentsMorph.selectAllAndEdit();
  } else {
    this.escalateEvent('mouseClickLeft', pos);
  }
};

CellMorph.prototype.mouseDoubleClick = function (pos) {
  if (List.prototype.enableTables &&
    this.currentValue instanceof List) {
    new TableDialogMorph(this.contents).popUp(this.world());
  } else {
    this.escalateEvent('mouseDoubleClick', pos);
  }
};

// WatcherMorph updating:

WatcherMorph.prototype.update = function () {
  var newValue, sprite, num, att,
    isInherited = false;

  if (this.target && this.getter) {
    this.updateLabel();
    if (this.target instanceof VariableFrame) {
      newValue = this.target.vars[this.getter] ?
        this.target.vars[this.getter].value : undefined;
      if (newValue === undefined && this.target.owner) {
        sprite = this.target.owner;
        if (contains(sprite.inheritedVariableNames(), this.getter)) {
          newValue = this.target.getVar(this.getter);
          // ghost cell color
          this.cellMorph.setColor(
            SpriteMorph.prototype.blockColor.variables
              .lighter(35)
          );
        } else {
          this.destroy();
          return;
        }
      } else {
        // un-ghost the cell color
        this.cellMorph.setColor(
          SpriteMorph.prototype.blockColor.variables
        );
      }
    } else {
      newValue = this.target[this.getter]();

      // determine whether my getter is an inherited attribute
      att = {
        xPosition: 'x position',
        yPosition: 'y position',
        direction: 'direction',
        getCostumeIdx: 'costume #',
        getScale: 'size',
        getVolume: 'volume',
        getPan: 'balance',
        reportShown: 'shown?',
        getPenDown: 'pen down?'
      } [this.getter];
      isInherited = att ? this.target.inheritsAttribute(att) : false;
    }
    if (newValue !== '' && !isNil(newValue)) {
      num = +newValue;
      if (typeof newValue !== 'boolean' && !isNaN(num)) {
        newValue = Math.round(newValue * 1000000000) / 1000000000;
      }
    }
    if (newValue === undefined) {
      // console.log('removing watcher for', this.labelText);
      this.destroy();
      return;
    }
    if (newValue !== this.currentValue ||
      isInherited !== this.isGhosted ||
      (!isNil(newValue) &&
        newValue.version &&
        (newValue.version !== this.version)
      )
    ) {
      this.changed();
      this.cellMorph.contents = newValue;
      this.isGhosted = isInherited;
      if (isSnapObject(this.target)) {
        if (isInherited) {
          this.cellMorph.setColor(this.readoutColor.lighter(35));
        } else {
          this.cellMorph.setColor(this.readoutColor);
        }
      }
      this.cellMorph.fixLayout();
      if (!isNaN(newValue)) {
        this.sliderMorph.value = newValue;
        this.sliderMorph.fixLayout();
      }
      this.fixLayout();
      if (this.currentValue && this.currentValue.version) {
        this.version = this.currentValue.version;
      } else {
        this.version = Date.now();
      }
      this.currentValue = newValue;
    }
  }
  if (this.cellMorph.contentsMorph instanceof ListWatcherMorph) {
    this.cellMorph.contentsMorph.update();
  } else if (isSnapObject(this.cellMorph.contents)) {
    this.cellMorph.update();
  }
};

export {Costume}
export {SpriteMorph}
export {SpriteBubbleMorph}
export {CellMorph}
export {WatcherMorph}
