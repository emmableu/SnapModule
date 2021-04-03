/*

    threads.js

    a tail call optimized blocks-based programming language interpreter
    based on morphic.js and blocks.js
    inspired by Scratch, Scheme and Squeak

    written by Jens Mönig
    jens@moenig.org

    Copyright (C) 2020 by Jens Mönig

    This file is part of Snap!.

    Snap! is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as
    published by the Free Software Foundation, either version 3 of
    the License, or (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.


    prerequisites:
    --------------
    needs blocks.js and objects.js


    toc
    ---
    the following list shows the order in which all constructors are
    defined. Use this list to locate code in this document:

        ThreadManager
        Process
        Context
        Variable
        VariableFrame
        JSCompiler

    credits
    -------
    John Maloney and Dave Feinberg designed the original Scratch evaluator
    Ivan Motyashov contributed initial porting from Squeak

*/

// Global stuff ////////////////////////////////////////////////////////

/*global ArgMorph, BlockMorph, CommandBlockMorph, CommandSlotMorph, Morph, ZERO,
MultiArgMorph, Point, ReporterBlockMorph, SyntaxElementMorph, contains, Costume,
degrees, detect, nop, radians, ReporterSlotMorph, CSlotMorph, RingMorph, Sound,
IDE_Morph, ArgLabelMorph, localize, XML_Element, hex_sha512, TableDialogMorph,
StageMorph, SpriteMorph, StagePrompterMorph, Note, modules, isString, copy, Map,
isNil, WatcherMorph, List, ListWatcherMorph, alert, console, TableMorph, BLACK,
TableFrameMorph, ColorSlotMorph, isSnapObject, newCanvas, Symbol, SVG_Costume*/



import {ZERO, BLACK, modules, contains, Morph,Point,
  degrees, detect, nop, radians,
  localize, isString,
  isNil,newCanvas} from './morphic'


import {ArgMorph, BlockMorph, CommandBlockMorph, CommandSlotMorph,
  MultiArgMorph,  ReporterBlockMorph, SyntaxElementMorph,
  ReporterSlotMorph, CSlotMorph, RingMorph
  , ArgLabelMorph,   ColorSlotMorph} from './blocks.js'

modules.threads = '2020-November-20';

// export var ThreadManager;
// export var Process;
// export var Context;
// export var Variable;
// export var VariableFrame;
// export var JSCompiler;

export const NONNUMBERS = [true, false, ''];

(function () {
    // "zum Schneckengang verdorben, was Adlerflug geworden wäre"
    // collecting edge-cases that somebody complained about
    // on Github. Folks, take it easy and keep it fun, okay?
    // Shit like this is patently ugly and slows Snap down. Tnx!
    for (var i = 9; i <= 13; i += 1) {
        NONNUMBERS.push(String.fromCharCode(i));
    }
    NONNUMBERS.push(String.fromCharCode(160));
})();



// ThreadManager ///////////////////////////////////////////////////////

export function ThreadManager() {
    this.processes = [];
    this.wantsToPause = false; // single stepping support
}

// Process /////////////////////////////////////////////////////////////

/*
    A Process is what brings a stack of blocks to life. The process
    keeps track of which block to run next, evaluates block arguments,
    handles control structures, and so forth.

    The ThreadManager is the (passive) scheduler, telling each process
    when to run by calling its runStep() method. The runStep() method
    will execute some number of blocks, then voluntarily yield control
    so that the ThreadManager can run another process.

    The Scratch etiquette is that a process should yield control at the
    end of every loop iteration, and while it is running a timed command
    (e.g. "wait 5 secs") or a synchronous command (e.g. "broadcast xxx
    and wait"). Since Snap also has lambda and custom blocks Snap adds
    yields at the beginning of each non-atomic custom command block
    execution, and - to let users escape infinite loops and recursion -
    whenever the process runs into a timeout.

    a Process runs for a receiver, i.e. a sprite or the stage or any
    blocks-scriptable object that we'll introduce.

    structure:

    topBlock            the stack's first block, of which all others
                        are children
    receiver            object (sprite) to which the process applies,
                        cached from the top block
    instrument          musical instrument type, cached from the receiver,
                        so a single sprite can play several instruments
                        at once
    context             the Context describing the current state
                        of this process
    homeContext         stores information relevant to the whole process,
                        i.e. its receiver, result etc.
    isPaused            boolean indicating whether to pause
    readyToYield        boolean indicating whether to yield control to
                        another process
    readyToTerminate    boolean indicating whether the stop method has
                        been called
    isDead              boolean indicating a terminated clone process
    timeout             msecs after which to force yield
    lastYield           msecs when the process last yielded
    isFirstStep         boolean indicating whether on first step - for clones
    errorFlag           boolean indicating whether an error was encountered
    prompter            active instance of StagePrompterMorph
    httpRequest         active instance of an HttpRequest or null
    pauseOffset         msecs between the start of an interpolated operation
                        and when the process was paused
    isClicked           boolean flag indicating whether the process was
                        initiated by a user-click on a block
    isShowingResult     boolean flag indicating whether a "report" command
                        has been executed in a user-clicked process
    exportResult        boolean flag indicating whether a picture of the top
                        block along with the result bubble shoud be exported
    onComplete          an optional callback function to be executed when
                        the process is done
    procedureCount      number counting procedure call entries,
                        used to tag custom block calls, so "stop block"
                        invocations can catch them
    flashingContext     for single stepping
    isInterrupted       boolean, indicates intra-step flashing of blocks
    canBroadcast        boolean, used to control reentrancy & "when stopped"
*/

Process.prototype = {};
Process.prototype.constructor = Process;
Process.prototype.timeout = 500; // msecs after which to force yield
Process.prototype.isCatchingErrors = true;
Process.prototype.enableHyperOps = true; // experimental hyper operations
Process.prototype.enableLiveCoding = false; // experimental
Process.prototype.enableSingleStepping = false; // experimental
Process.prototype.enableCompiling = false; // experimental
Process.prototype.flashTime = 0; // experimental
// Process.prototype.enableJS = false;

export function Process(topBlock, receiver, onComplete, yieldFirst) {
    this.topBlock = topBlock || null;
    this.receiver = receiver;
    this.instrument = receiver ? receiver.instrument : null;
    this.readyToYield = false;
    this.readyToTerminate = false;
    this.isDead = false;
    this.isClicked = false;
    this.isShowingResult = false;
    this.errorFlag = false;
    this.context = null;
    this.homeContext = new Context(null, null, null, receiver);
    this.lastYield =  Date.now();
    this.isFirstStep = true;
    this.isAtomic = false;
    this.prompter = null;
    this.httpRequest = null;
    this.isPaused = false;
    this.pauseOffset = null;
    this.frameCount = 0;
    this.exportResult = false;
    this.onComplete = onComplete || null;
    this.procedureCount = 0;
    this.flashingContext = null; // experimental, for single-stepping
    this.isInterrupted = false; // experimental, for single-stepping
    this.canBroadcast = true; // used to control "when I am stopped"

    if (topBlock) {
        this.homeContext.variables.parentFrame =
            this.homeContext.receiver.variables;
        this.context = new Context(
            null,
            topBlock.blockSequence(),
            this.homeContext
        );
        if (yieldFirst) {
            this.pushContext('doYield'); // highlight top block
        }
    }
}

// Process accessing
// Context /////////////////////////////////////////////////////////////

/*
    A Context describes the state of a Process.

    Each Process has a pointer to a Context containing its
    state. Whenever the Process yields control, its Context
    tells it exactly where it left off.

    structure:

    parentContext   the Context to return to when this one has
                    been evaluated.
    outerContext    the Context holding my lexical scope
    expression      SyntaxElementMorph, an array of blocks to evaluate,
                    null or a String denoting a selector, e.g. 'doYield'
    origin          the object of origin, only used for serialization
    receiver        the object to which the expression applies, if any
    variables       the current VariableFrame, if any
    inputs          an array of input values computed so far
                    (if expression is a    BlockMorph)
    pc              the index of the next block to evaluate
                    (if expression is an array)
    isContinuation  flag for marking a transient continuation context
    startTime       time when the context was first evaluated
    startValue      initial value for interpolated operations
    activeAudio     audio buffer for interpolated operations, don't persist
    activeNote      audio oscillator for interpolated ops, don't persist
    activeSends		forked processes waiting to be completed
    isCustomBlock   marker for return ops
    isCustomCommand marker for interpolated blocking reporters (reportURL)
    emptySlots      caches the number of empty slots for reification
    tag             string or number to optionally identify the Context,
                    as a "return" target (for the "stop block" primitive)
    isFlashing      flag for single-stepping
    accumulator     slot for collecting data from reentrant visits
*/

export function Context(
  parentContext,
  expression,
  outerContext,
  receiver
) {
  this.outerContext = outerContext || null;
  this.parentContext = parentContext || null;
  this.expression = expression || null;
  this.receiver = receiver || null;
  this.origin = receiver || null; // only for serialization
  this.variables = new VariableFrame();
  if (this.outerContext) {
    this.variables.parentFrame = this.outerContext.variables;
    this.receiver = this.outerContext.receiver;
  }
  this.inputs = [];
  this.pc = 0;
  this.isContinuation = false;
  this.startTime = null;
  this.activeSends = null;
  this.activeAudio = null;
  this.activeNote = null;
  this.isCustomBlock = false; // marks the end of a custom block's stack
  this.isCustomCommand = null; // used for ignoring URL reporters' results
  this.emptySlots = 0; // used for block reification
  this.tag = null;  // lexical catch-tag for custom blocks
  this.isFlashing = false; // for single-stepping
  this.accumulator = null;
}

Context.prototype.toString = function () {
    var expr = this.expression;
    if (expr instanceof Array) {
        if (expr.length > 0) {
            expr = '[' + expr[0] + ']';
        }
    }
    return 'Context >> ' + expr + ' ' + this.variables;
};

Context.prototype.image = function () {
    var ring = new RingMorph(),
        block,
        cont;

    if (this.expression instanceof Morph) {
        block = this.expression.fullCopy();

        // replace marked call/cc block with empty slot
        if (this.isContinuation) {
            cont = detect(
                block.allInputs(),
                inp => inp.bindingID === 1
            );
            if (cont) {
                block.revertToDefaultInput(cont, true);
            }
        }
        ring.embed(block, this.inputs);
        return ring.doWithAlpha(
            1,
            () => {
                ring.clearAlpha();
                return ring.fullImage();
            }
        );
    }
    if (this.expression instanceof Array) {
        block = this.expression[this.pc].fullCopy();
        if (block instanceof RingMorph && !block.contents()) { // empty ring
            return block.doWithAlpha(1, () => block.fullImage());
        }
        ring.embed(block, this.isContinuation ? [] : this.inputs);
        return ring.doWithAlpha(1, () => ring.fullImage());
    }

    // otherwise show an empty ring
    ring.color = SpriteMorph.prototype.blockColor.other;
    ring.setSpec('%rc %ringparms');

    // also show my inputs, unless I'm a continuation
    if (!this.isContinuation) {
        this.inputs.forEach(inp =>
            ring.parts()[1].addInput(inp)
        );
    }
    return ring.doWithAlpha(1, () => ring.fullImage());
};

// Context continuations:

Context.prototype.continuation = function (isReporter) {
    var cont;
    if (this.expression instanceof Array) {
        cont = this;
    } else if (this.parentContext) {
        cont = this.parentContext;
    } else {
        cont = new Context(
            null,
            isReporter ? 'expectReport' : 'popContext'
        );
        cont.isContinuation = true;
        return cont;
    }
    cont = cont.copyForContinuation();
    cont.tag = null;
    cont.isContinuation = true;
    return cont;
};

Context.prototype.copyForContinuation = function () {
    var cpy = copy(this),
        cur = cpy,
        isReporter = !(this.expression instanceof Array ||
            isString(this.expression));
    if (isReporter) {
        cur.prepareContinuationForBinding();
        while (cur.parentContext) {
            cur.parentContext = copy(cur.parentContext);
            cur = cur.parentContext;
            cur.inputs = [];
        }
    }
    return cpy;
};

Context.prototype.copyForContinuationCall = function () {
    var cpy = copy(this),
        cur = cpy,
        isReporter = !(this.expression instanceof Array ||
            isString(this.expression));
    if (isReporter) {
        this.expression = this.expression.fullCopy();
        this.inputs = [];
        while (cur.parentContext) {
            cur.parentContext = copy(cur.parentContext);
            cur = cur.parentContext;
            cur.inputs = [];
        }
    }
    return cpy;
};

Context.prototype.prepareContinuationForBinding = function () {
    var pos = this.inputs.length,
        slot;
    this.expression = this.expression.fullCopy();
    slot = this.expression.inputs()[pos];
    if (slot) {
        this.inputs = [];
        // mark slot containing the call/cc reporter with an identifier
        slot.bindingID = 1;
        // and remember the number of detected empty slots
        this.emptySlots = 1;
    }
};

// Context accessing:

Context.prototype.addInput = function (input) {
    this.inputs.push(input);
};

// Context music

Context.prototype.stopMusic = function () {
    if (this.activeNote) {
        this.activeNote.stop();
        this.activeNote = null;
    }
};

// Context single-stepping:

Context.prototype.lastFlashable = function () {
    // for experimental single-stepping when pausing
    if (this.expression instanceof SyntaxElementMorph &&
            !(this.expression instanceof CommandSlotMorph)) {
        return this;
    } else if (this.parentContext) {
        return this.parentContext.lastFlashable();
    }
    return null;
};

// Context debugging

Context.prototype.stackSize = function () {
    if (!this.parentContext) {
        return 1;
    }
    return 1 + this.parentContext.stackSize();
};

// Variable /////////////////////////////////////////////////////////////////

export function Variable(value, isTransient) {
    this.value = value;
    this.isTransient = isTransient || false; // prevent value serialization
}

Variable.prototype.toString = function () {
    return 'a ' + (this.isTransient ? 'transient ' : '') + 'Variable [' +
        this.value + ']';
};

Variable.prototype.copy = function () {
    return new Variable(this.value, this.isTransient);
};

// VariableFrame ///////////////////////////////////////////////////////

export function VariableFrame(parentFrame, owner) {
    this.vars = {};
    this.parentFrame = parentFrame || null;
    this.owner = owner || null;
}

VariableFrame.prototype.toString = function () {
    return 'a VariableFrame {' + this.names() + '}';
};

VariableFrame.prototype.copy = function () {
    var frame = new VariableFrame(this.parentFrame);
    this.names().forEach(vName =>
        frame.addVar(vName, this.getVar(vName))
    );
    return frame;
};

VariableFrame.prototype.fullCopy = function () {
    // experimental - for compiling to JS
    var frame;
    if (this.parentFrame) {
        frame = new VariableFrame(this.parentFrame.fullCopy());
    } else {
        frame = new VariableFrame();
    }
    frame.vars = copy(this.vars);
    return frame;
};

VariableFrame.prototype.root = function () {
    if (this.parentFrame) {
        return this.parentFrame.root();
    }
    return this;
};

VariableFrame.prototype.find = function (name) {
    // answer the closest variable frame containing
    // the specified variable. otherwise throw an exception.
    var frame = this.silentFind(name);
    if (frame) {return frame; }
    throw new Error(
        localize('a variable of name \'')
            + name
            + localize('\'\ndoes not exist in this context')
    );
};

VariableFrame.prototype.silentFind = function (name) {
    // answer the closest variable frame containing
    // the specified variable. Otherwise return null.
    if (this.vars[name] instanceof Variable) {
        return this;
    }
    if (this.parentFrame) {
        return this.parentFrame.silentFind(name);
    }
    return null;
};

VariableFrame.prototype.setVar = function (name, value, sender) {
    // change the specified variable if it exists
    // else throw an error, because variables need to be
    // declared explicitly (e.g. through a "script variables" block),
    // before they can be accessed.
    // if the found frame is inherited by the sender sprite
    // shadow it (create an explicit one for the sender)
    // before setting the value ("create-on-write")

    var frame = this.find(name);
    if (frame) {
        if (sender instanceof SpriteMorph &&
                (frame.owner instanceof SpriteMorph) &&
                (sender !== frame.owner)) {
            sender.shadowVar(name, value);
        } else {
            frame.vars[name].value = value;
        }
    }
};

VariableFrame.prototype.changeVar = function (name, delta, sender) {
    // change the specified variable if it exists
    // else throw an error, because variables need to be
    // declared explicitly (e.g. through a "script variables" block,
    // before they can be accessed.
    // if the found frame is inherited by the sender sprite
    // shadow it (create an explicit one for the sender)
    // before changing the value ("create-on-write")

    var frame = this.find(name),
        value,
        newValue;
    if (frame) {
        value = parseFloat(frame.vars[name].value);
        newValue = isNaN(value) ? delta : value + parseFloat(delta);
        if (sender instanceof SpriteMorph &&
                (frame.owner instanceof SpriteMorph) &&
                (sender !== frame.owner)) {
            sender.shadowVar(name, newValue);
        } else {
            frame.vars[name].value = newValue;
        }

    }
};

VariableFrame.prototype.getVar = function (name) {
    var frame = this.silentFind(name),
        value;
    if (frame) {
        value = frame.vars[name].value;
        return (value === 0 ? 0
                : value === false ? false
                        : value === '' ? ''
                            : value || 0); // don't return null
    }
    if (typeof name === 'number') {
        // empty input with a Binding-ID called without an argument
        return '';
    }
    throw new Error(
        localize('a variable of name \'')
            + name
            + localize('\'\ndoes not exist in this context')
    );
};

VariableFrame.prototype.addVar = function (name, value) {
    this.vars[name] = new Variable(value === 0 ? 0
              : value === false ? false
                       : value === '' ? '' : value || 0);
};

VariableFrame.prototype.deleteVar = function (name) {
    var frame = this.find(name);
    if (frame) {
        delete frame.vars[name];
    }
};

// VariableFrame tools

VariableFrame.prototype.names = function () {
    var each, names = [];
    for (each in this.vars) {
        if (Object.prototype.hasOwnProperty.call(this.vars, each)) {
            names.push(each);
        }
    }
    return names;
};

VariableFrame.prototype.allNamesDict = function (upTo) {
	// "upTo" is an optional parent frame at which to stop, e.g. globals
    var dict = {}, current = this;

    function addKeysToDict(srcDict, trgtDict) {
        var eachKey;
        for (eachKey in srcDict) {
            if (Object.prototype.hasOwnProperty.call(srcDict, eachKey)) {
                trgtDict[eachKey] = eachKey;
            }
        }
    }

    while (current && (current !== upTo)) {
        addKeysToDict(current.vars, dict);
        current = current.parentFrame;
    }
    return dict;
};

VariableFrame.prototype.allNames = function (upTo) {
/*
    only show the names of the lexical scope, hybrid scoping is
    reserved to the daring ;-)
	"upTo" is an optional parent frame at which to stop, e.g. globals
*/
    var answer = [], each, dict = this.allNamesDict(upTo);

    for (each in dict) {
        if (Object.prototype.hasOwnProperty.call(dict, each)) {
            answer.push(each);
        }
    }
    return answer;
};

// JSCompiler /////////////////////////////////////////////////////////////////

/*
	Compile simple, side-effect free Reporters
    with either only explicit formal parameters or a specified number of
    implicit formal parameters mapped to empty input slots
	*** highly experimental and heavily under construction ***
*/

export function JSCompiler(aProcess) {
	this.process = aProcess;
	this.source = null; // a context
 	this.gensyms = null; // temp dictionary for parameter substitutions
  	this.implicitParams = null;
   	this.paramCount = null;
}

JSCompiler.prototype.toString = function () {
    return 'a JSCompiler';
};

JSCompiler.prototype.compileFunction = function (aContext, implicitParamCount) {
    var block = aContext.expression,
  		parameters = aContext.inputs,
        parms = [],
        hasEmptySlots = false,
        i;

	this.source = aContext;
    this.implicitParams = implicitParamCount || 1;

	// scan for empty input slots
 	hasEmptySlots = !isNil(detect(
  		block.allChildren(),
    	morph => morph.isEmptySlot && morph.isEmptySlot()
    ));

    // translate formal parameters into gensyms
    this.gensyms = {};
    this.paramCount = 0;
    if (parameters.length) {
        // test for conflicts
        if (hasEmptySlots) {
        	throw new Error(
                'compiling does not yet support\n' +
                'mixing explicit formal parameters\n' +
                'with empty input slots'
            );
        }
        // map explicit formal parameters
        parameters.forEach((pName, idx) => {
        	var pn = 'p' + idx;
            parms.push(pn);
        	this.gensyms[pName] = pn;
        });
    } else if (hasEmptySlots) {
    	if (this.implicitParams > 1) {
        	for (i = 0; i < this.implicitParams; i += 1) {
         		parms.push('p' + i);
         	}
     	} else {
        	// allow for a single implicit formal parameter
        	parms = ['p0'];
        }
    }

    // compile using gensyms

    if (block instanceof CommandBlockMorph) {
        return Function.apply(
            null,
            parms.concat([this.compileSequence(block)])
        );
    }
    return Function.apply(
        null,
        parms.concat(['return ' + this.compileExpression(block)])
    );
};

JSCompiler.prototype.compileExpression = function (block) {
    var selector = block.selector,
        inputs = block.inputs(),
        target,
        rcvr,
        args;

    // first check for special forms and infix operators
    switch (selector) {
    case 'reportOr':
        return this.compileInfix('||', inputs);
    case 'reportAnd':
        return this.compileInfix('&&', inputs);
    case 'reportIfElse':
        return '(' +
            this.compileInput(inputs[0]) +
            ' ? ' +
            this.compileInput(inputs[1]) +
            ' : ' +
            this.compileInput(inputs[2]) +
            ')';
    case 'evaluateCustomBlock':
        throw new Error(
            'compiling does not yet support\n' +
            'custom blocks'
        );

    // special command forms
    case 'doSetVar': // redirect var to process
        return 'arguments[arguments.length - 1].setVarNamed(' +
            this.compileInput(inputs[0]) +
            ',' +
            this.compileInput(inputs[1]) +
            ')';
    case 'doChangeVar': // redirect var to process
        return 'arguments[arguments.length - 1].incrementVarNamed(' +
            this.compileInput(inputs[0]) +
            ',' +
            this.compileInput(inputs[1]) +
            ')';
    case 'doReport':
        return 'return ' + this.compileInput(inputs[0]);
    case 'doIf':
        return 'if (' +
            this.compileInput(inputs[0]) +
            ') {\n' +
            this.compileSequence(inputs[1].evaluate()) +
            '}';
    case 'doIfElse':
        return 'if (' +
            this.compileInput(inputs[0]) +
            ') {\n' +
            this.compileSequence(inputs[1].evaluate()) +
            '} else {\n' +
            this.compileSequence(inputs[2].evaluate()) +
            '}';

    default:
        target = this.process[selector] ? this.process
            : (this.source.receiver || this.process.receiver);
        rcvr = target.constructor.name + '.prototype';
        args = this.compileInputs(inputs);
        if (isSnapObject(target)) {
            return rcvr + '.' + selector + '.apply('+ rcvr + ', [' + args +'])';
        } else {
            return 'arguments[arguments.length - 1].' +
                selector +
                '.apply(arguments[arguments.length - 1], [' + args +'])';
        }
    }
};

JSCompiler.prototype.compileSequence = function (commandBlock) {
    var body = '';
    commandBlock.blockSequence().forEach(block => {
        body += this.compileExpression(block);
        body += ';\n';
    });
    return body;
};

JSCompiler.prototype.compileInfix = function (operator, inputs) {
    return '(' + this.compileInput(inputs[0]) + ' ' + operator + ' ' +
        this.compileInput(inputs[1]) +')';
};

JSCompiler.prototype.compileInputs = function (array) {
    var args = '';
    array.forEach(inp => {
        if (args.length) {
            args += ', ';
        }
        args += this.compileInput(inp);
    });
    return args;
};

JSCompiler.prototype.compileInput = function (inp) {
     var value, type;

    if (inp.isEmptySlot && inp.isEmptySlot()) {
        // implicit formal parameter
        if (this.implicitParams > 1) {
         	if (this.paramCount < this.implicitParams) {
            	this.paramCount += 1;
             	return 'p' + (this.paramCount - 1);
        	}
            throw new Error(
                localize('expecting') + ' ' + this.implicitParams + ' '
                    + localize('input(s), but getting') + ' '
                    + this.paramCount
            );
        }
		return 'p0';
    } else if (inp instanceof MultiArgMorph) {
        return 'new List([' + this.compileInputs(inp.inputs()) + '])';
    } else if (inp instanceof ArgLabelMorph) {
    	return this.compileInput(inp.argMorph());
    } else if (inp instanceof ArgMorph) {
        // literal - evaluate inline
        value = inp.evaluate();
        type = this.process.reportTypeOf(value);
        switch (type) {
        case 'number':
        case 'Boolean':
            return '' + value;
        case 'text':
            // enclose in double quotes
            return '"' + value + '"';
        case 'list':
            return 'new List([' + this.compileInputs(value) + '])';
        default:
            if (value instanceof Array) {
                 return '"' + value[0] + '"';
            }
            throw new Error(
                'compiling does not yet support\n' +
                'inputs of type\n' +
                 type
            );
        }
    } else if (inp instanceof BlockMorph) {
        if (inp.selector === 'reportGetVar') {
        	if (contains(this.source.inputs, inp.blockSpec)) {
            	// un-quoted gensym:
            	return this.gensyms[inp.blockSpec];
        	}
         	// redirect var query to process
            return 'arguments[arguments.length - 1].getVarNamed("' +
            	inp.blockSpec +
            	'")';
        }
        return this.compileExpression(inp);
    } else {
        throw new Error(
            'compiling does not yet support\n' +
            'input slots of type\n' +
            inp.constructor.name
        );
    }
};
