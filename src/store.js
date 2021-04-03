/*

    store.js

    saving and loading Snap! projects

    written by Jens Mönig
    jens@moenig.org

    Copyright (C) 2019 by Jens Mönig

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
    needs morphic.js, xml.js, and most of Snap!'s other modules


    hierarchy
    ---------
    the following tree lists all constructors hierarchically,
    indentation indicating inheritance. Refer to this list to get a
    contextual overview:

        XML_Serializer
            SnapSerializer


    credits
    -------
    Nathan Dinsmore contributed to the design and implemented a first
    working version of a complete XMLSerializer. I have taken much of the
    overall design and many of the functions and methods in this file from
    Nathan's fine original prototype.

*/

/*global modules, XML_Element, VariableFrame, StageMorph, SpriteMorph,
WatcherMorph, Point, CustomBlockDefinition, Context, ReporterBlockMorph,
CommandBlockMorph, detect, CustomCommandBlockMorph, CustomReporterBlockMorph,
Color, List, newCanvas, Costume, Sound, Audio, IDE_Morph, ScriptsMorph,
BlockMorph, ArgMorph, InputSlotMorph, TemplateSlotMorph, CommandSlotMorph,
FunctionSlotMorph, MultiArgMorph, ColorSlotMorph, nop, CommentMorph, isNil,
localize, sizeOf, ArgLabelMorph, SVG_Costume, MorphicPreferences, Process,
SyntaxElementMorph, Variable, isSnapObject, console, BooleanSlotMorph,
normalizeCanvas, contains*/

// Global stuff ////////////////////////////////////////////////////////
import {sb} from './ypr'

import {modules,  nop, isNil,  } from './morphic'

import {XML_Element} from './xml'
modules.store = '2020-October-27';


// XML_Serializer ///////////////////////////////////////////////////////
/*
    I am an abstract protype for my heirs.

    I manage object identities and keep track of circular data structures.
    Objects are "touched" and a property named "serializationID" is added
    to each, representing an index integer in the list, starting with 1.
*/

// XML_Serializer instance creation:

export function XML_Serializer() {
  this.contents = [];
  this.media = [];
  this.isCollectingMedia = false;
  this.isExportingBlocksLibrary = false;
}

// XML_Serializer preferences settings:

XML_Serializer.prototype.idProperty = 'serializationID';
XML_Serializer.prototype.mediaIdProperty = 'serializationMediaID';
XML_Serializer.prototype.mediaDetectionProperty = 'isMedia';
XML_Serializer.prototype.version = 1; // increment on structural change

// XML_Serializer accessing:

XML_Serializer.prototype.serialize = function (object, forBlocksLibrary) {
  // public: answer an XML string representing the given object
  var xml;
  this.flush(); // in case an error occurred in an earlier attempt
  this.flushMedia();
  this.isExportingBlocksLibrary = forBlocksLibrary;
  xml = this.store(object);
  this.flush();
  return xml;
};

XML_Serializer.prototype.store = function (object, mediaID) {
  // private - mediaID is optional
  if (isNil(object) || !object.toXML) {
    // unsupported type, to be checked before calling store()
    // when debugging, be sure to throw an error at this point
    return '';
  }
  if (this.isCollectingMedia && object[this.mediaDetectionProperty]) {
    this.addMedia(object, mediaID);
    return this.format(
      '<ref mediaID="@"></ref>',
      object[this.mediaIdProperty]
    );
  }
  if (object[this.idProperty]) {
    return this.format('<ref id="@"></ref>', object[this.idProperty]);
  }
  this.add(object);
  return object.toXML(this, mediaID).replace(
    '~',
    this.format('id="@"', object[this.idProperty])
  );
};

XML_Serializer.prototype.mediaXML = function () {
  // answer a project's collected media module as XML
  var xml = '<media>';
  this.media.forEach(object => {
    var str = object.toXML(this).replace(
      '~',
      this.format('mediaID="@"', object[this.mediaIdProperty])
    );
    xml = xml + str;
  });
  return xml + '</media>';
};

XML_Serializer.prototype.add = function (object) {
  // private - mark the object with a serializationID property and add it
  if (object[this.idProperty]) { // already present
    return -1;
  }
  this.contents.push(object);
  object[this.idProperty] = this.contents.length;
  return this.contents.length;
};

XML_Serializer.prototype.addMedia = function (object, mediaID) {
  // private - mark the object with a serializationMediaID property
  // and add it to media
  // if a mediaID is given, take it, otherwise generate one
  if (object[this.mediaIdProperty]) { // already present
    return -1;
  }
  this.media.push(object);
  if (mediaID) {
    object[this.mediaIdProperty] = mediaID + '_' + object.name;
  } else {
    object[this.mediaIdProperty] = this.media.length;
  }
  return this.media.length;
};

XML_Serializer.prototype.at = function (integer) {
  // private
  return this.contents[integer - 1];
};

XML_Serializer.prototype.flush = function () {
  // private - free all objects and empty my contents
  this.contents.forEach(obj => delete obj[this.idProperty]);
  this.contents = [];
};

XML_Serializer.prototype.flushMedia = function () {
  // private - free all media objects and empty my media
  if (this.media instanceof Array) {
    this.media.forEach(obj => delete obj[this.mediaIdProperty]);
  }
  this.media = [];
  this.isExportingBlocksLibrary = false;
};

// XML_Serializer formatting:

XML_Serializer.prototype.escape = XML_Element.prototype.escape;
XML_Serializer.prototype.unescape = XML_Element.prototype.unescape;


XML_Serializer.prototype.format = function (string) {
  // private
  var i = -1,
    values = arguments,
    value;

  return string.replace(/[@$%]([\d]+)?/g, (spec, index) => {
    index = parseInt(index, 10);

    if (isNaN(index)) {
      i += 1;
      value = values[i + 1];
    } else {
      value = values[index + 1];
    }
    // original line of code - now frowned upon by JSLint:
    // value = values[(isNaN(index) ? (i += 1) : index) + 1];

    return spec === '@' ?
      this.escape(value)
      : spec === '$' ?
        this.escape(value, true)
        : value;
  });
};

// XML_Serializer loading:

XML_Serializer.prototype.load = function (xmlString) {
  // public - answer a new object which is represented by the given
  // XML string.
  nop(xmlString);
  throw new Error(
    'loading should be implemented in heir of XML_Serializer'
  );
};

XML_Serializer.prototype.parse = function (xmlString) {
  // private - answer an XML_Element representing the given XML String
  var element = new XML_Element();
  try {
    element.parseString(xmlString);
  } catch (e) {
    // Trace.log('XML.parseFailed', xmlString);
    throw e;
  }
  return element;
};
