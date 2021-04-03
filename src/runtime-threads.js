import {BlockMorph, CommandSlotMorph, CSlotMorph, ReporterBlockMorph, ReporterSlotMorph} from "./blocks";
import {Process, ThreadManager} from "./threads";
import {List, ListWatcherMorph} from "./lists";
import {TableFrameMorph, TableMorph} from "./tables";

ThreadManager.prototype.removeTerminatedProcesses = function () {
  // and un-highlight their scripts
  var remaining = [],
    count;
  this.processes.forEach(proc => {
    var result,
      glow;
    if ((!proc.isRunning() && !proc.errorFlag) || proc.isDead) {
      if (proc.topBlock instanceof BlockMorph) {
        proc.unflash();
        // adjust the thread count indicator, if any
        count = this.processesForBlock(proc.topBlock).length;
        if (count) {
          glow = proc.topBlock.getHighlight() ||
            proc.topBlock.addHighlight();
          glow.threadCount = count;
          glow.updateReadout();
        } else {
          proc.topBlock.removeHighlight();
        }
      }
      if (proc.prompter) {
        proc.prompter.destroy();
        if (proc.homeContext.receiver.stopTalking) {
          proc.homeContext.receiver.stopTalking();
        }
      }
      if (proc.topBlock instanceof ReporterBlockMorph ||
        proc.isShowingResult || proc.exportResult) {
        result = proc.homeContext.inputs[0];
        if (proc.onComplete instanceof Function) {
          proc.onComplete(result);
        } else {
          if (result instanceof List) {
            proc.topBlock.showBubble(
              result.isTable() ?
                new TableFrameMorph(
                  new TableMorph(result, 10)
                )
                : new ListWatcherMorph(result),
              proc.exportResult,
              proc.receiver
            );
          } else {
            proc.topBlock.showBubble(
              result,
              proc.exportResult,
              proc.receiver
            );
          }
        }
      } else if (proc.onComplete instanceof Function) {
        proc.onComplete();
      }
    } else {
      remaining.push(proc);
    }
  });
  this.processes = remaining;
};

Process.prototype.evaluateInput = function (input) {
  // evaluate the input unless it is bound to an implicit parameter
  var ans;
  if (this.flashContext()) {return; } // yield to flash the current argMorph
  if (input.bindingID) {
    if (this.isCatchingErrors) {
      try {
        ans = this.context.variables.getVar(input.bindingID);
      } catch (error) {
        this.handleError(error, input);
      }
    } else {
      ans = this.context.variables.getVar(input.bindingID);
    }
  } else {
    ans = input.evaluate();
    if (ans) {
      if (input.constructor === CommandSlotMorph ||
        input.constructor === ReporterSlotMorph ||
        (input instanceof CSlotMorph &&
          (!input.isStatic || input.isLambda))) {
        // I know, this still needs yet to be done right....
        ans = this.reify(ans, new List());
      }
    }
  }
  this.returnValueToParentContext(ans);
  this.popContext();
};

export {ThreadManager}
export {Process}
