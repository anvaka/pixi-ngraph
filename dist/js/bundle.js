(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.ngraph = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var work = require('webworkify');
var w = work(require('./workers/layout'));
var NodeMover = require('./modules/NodeMover').NodeMover;
var PixiGraphics = require('./modules/PixiGraphics').PixiGraphics;

module.exports.main = function () {
    var _layoutIterations = 1000;
    var _layoutStepsPerMessage = 25;

    //--simple frame-rate display for renders vs layouts
    var _counts = {renders: 0, layouts: 0, renderRate: 0, layoutRate: 0};
    var $info = $('<div>').appendTo('body');
    var startTime = new Date();

    var _updateInfo = function () {
        var endTime = new Date();
        var timeDiff = (endTime - startTime) / 1000;

        if (_counts.layouts < _layoutIterations) {
            _counts.layoutRate = _counts.layouts / timeDiff;
        }
        _counts.renderRate = _counts.renders / timeDiff;
        $info.text('Renders: ' + _counts.renders + ' (' + Math.round(_counts.renderRate) + ') | Layouts: ' + _counts.layouts + ' (' + Math.round(_counts.layoutRate) + ')');
    };

    var _nodeMovers = {};

    $.getJSON('data/graph.json', function (jsonData) {
        jsonData.nodes.forEach(function (node, i) {
            var nodeMover = new NodeMover();
            nodeMover.data('id', node.id);
            _nodeMovers[node.id] = nodeMover;
        });

        var _layoutPositions = {};
        w.addEventListener('message', function (ev) {
            _layoutPositions = ev.data;
            _counts.layouts = _layoutPositions.i;
        });
        w.postMessage({jsonData: jsonData, iterations: _layoutIterations, stepsPerMessage: _layoutStepsPerMessage}); // when the worker is ready, kick things off

        var graphics = new PixiGraphics(0.75, jsonData, function () {
            $.each(_nodeMovers, function (id, nodeMover) {
                if (_layoutPositions.nodePositions) {
                    nodeMover.position(_layoutPositions.nodePositions[id]);
                    nodeMover.animate();
                }
            });
            return _nodeMovers;
        });

        function renderFrame() {
            graphics.renderFrame();
            _counts.renders++;
            _updateInfo();
            requestAnimFrame(renderFrame);
        }

        // begin animation loop:
        renderFrame();
    });
};

},{"./modules/NodeMover":3,"./modules/PixiGraphics":4,"./workers/layout":23,"webworkify":22}],2:[function(require,module,exports){
//region npm modules

//endregion
//region modules

//endregion

/**
 @class AnimationHelper
 */
AnimationHelper = function () {
    var _self = this;

    //region private fields and methods
    /** @type {Number} */
    var _stepsToCatchUp = 20;
    /** @type {Number} */
    var _maxDist = 10;

    var _init = function () {
    };

    var _approachTarget = function (targetVal, currentVal) {
        if (targetVal == null || isNaN(targetVal)) {
            return currentVal;
        }
        if (currentVal == null || isNaN(currentVal)) {
            return targetVal;
        }
        var tol = Math.max(0.000001, Math.abs(targetVal / 10000));//base tolerance on size of target...
        var diff = (targetVal - currentVal);
        if (Math.abs(diff) < tol) return targetVal;
        var dist = diff / _stepsToCatchUp;
        if (dist > _maxDist) {
            dist = _maxDist;
        }
        if (dist < -_maxDist) {
            dist = -_maxDist;
        }
        return currentVal + dist;
    };

    var _updateObj = function (obj, valObj) {
        Object.keys(valObj).forEach(function (k) {
            var value = valObj[k];
            if (obj[k] !== value) {
                obj[k] = value;
            }
        });
    };

    var _updateIfChanged = function (state, targetState) {
        var cState = {};
        Object.keys(state).forEach(function (k) {
            cState[k] = state[k];
        });
        var hasChange = false;
        if (targetState == null) {
            var foo = 1;
        } else {
            Object.keys(targetState).forEach(function (k) {
                var value = targetState[k];
                if (typeof value === 'object') {
                    hasChange = hasChange || _updateIfChanged(cState[k], value);
                } else {
                    if (value !== cState[k]) {
                        hasChange = true;
                        cState[k] = _approachTarget(value, cState[k]);
                    }
                }
            });
        }
        _updateObj(state, cState);
        return hasChange;
    };

    //endregion

    this.p_this = function () {
        return _self;
    };

    //region public API
    this.applyChanges = function (obj, valObj) {
        _updateObj(obj, valObj);
    };

    this.updateIfChanged = function (state, targetState) {
        return _updateIfChanged(state, targetState);
    };

    /**
     * @param {Number} [maxDist]
     * @return {Number|AnimationHelper}
     */
    this.maxDist = function (maxDist) {
        if (!arguments.length) {
            return _maxDist;
        }
        _maxDist = maxDist;
        return _self.p_this();
    };

    /**
     * @param {Number} [stepsToCatchUp]
     * @return {Number|AnimationHelper}
     */
    this.stepsToCatchUp = function (stepsToCatchUp) {
        if (!arguments.length) {
            return _stepsToCatchUp;
        }
        _stepsToCatchUp = stepsToCatchUp;
        return _self.p_this();
    };
    //endregion

    _init();
};

module.exports.AnimationHelper = AnimationHelper;


},{}],3:[function(require,module,exports){
//region npm modules

//endregion
//region modules
var AnimHelper = require('./AnimationHelper').AnimationHelper;
//endregion

/**
 @class NodeMover
 */
NodeMover = function () {
    var _self = this;

    //region private fields and methods

    /** @type {Object} */
    var _currentState;
    /** @type {Object} */
    var _targetState = {
        alpha: 1,
        position: {x: 0, y: 0},
        radius: 10
    };

    /** @type {Object} */
    var _data = {};

    var _animHelper = new AnimHelper();

    var _init = function () {
        _currentState = JSON.parse(JSON.stringify(_targetState));
    };

    //endregion

    this.p_this = function () {
        return _self;
    };

    //region public API
    this.renderPosition = function () {
       return _currentState.position;
    };

    /**
     * @param {Object} [position]
     * @return {Object|NodeMover}
     */
    this.position = function (position) {
        if (!arguments.length) {
            return _targetState.position;
        }
        _targetState.position = position;
        return _self.p_this();
    };

    /**
     * @param {Number} [radius]
     * @return {Number|NodeMover}
     */
    this.radius = function (radius) {
        if (!arguments.length) {
            return _targetState.radius;
        }
        _targetState.radius = radius;
        return _self.p_this();
    };

    this.animate = function () {
        var changes = _animHelper.updateIfChanged(_currentState, _targetState);
    };

    /**
     * @param {String} prop
     * @param {Object} [data]
     * @return {Object|NodeMover}
     */
    this.data = function (prop, data) {
        if (!arguments.length) throw 'Data property must be specified';
        if (arguments.length === 1) {
            return _data[prop];
        }
        _data[prop] = data;
        return _self.p_this();
    };

    //endregion

    _init();
};

module.exports.NodeMover = NodeMover;


},{"./AnimationHelper":2}],4:[function(require,module,exports){
//region npm modules

//endregion
//region modules

//endregion

/**
 @class PixiGraphics
 */
PixiGraphics = function (scale, graphData, layoutFn) {
    var _self = this;

    //region private fields and methods
    var _graphics;
    var _renderer;
    var _stage;

    var _init = function () {
        var width = window.innerWidth,
            height = window.innerHeight;

        _stage = new PIXI.Stage(0x666666, true);
        _stage.setInteractive(true);

        _renderer = PIXI.autoDetectRenderer(width, height, null, false, true);
        _renderer.view.style.display = "block";
        document.body.appendChild(_renderer.view);

        _graphics = new PIXI.Graphics();
        _graphics.position.x = width / 2;
        _graphics.position.y = height / 2;
        _graphics.scale.x = scale;
        _graphics.scale.y = scale;
        _stage.addChild(_graphics);
    };

    var _toRGB = function (hex) {
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    };

    var _toDecColor = function (color) {
        return (color.r << 16) + (color.g << 8) + (color.b);
    };

    var _edges = graphData.edges;
    var _nodesById = {};

    $.each(graphData.nodes, function (i, node) {
        _nodesById[node.id] = node;
        node.decColor = _toDecColor(_toRGB(node.color));
    });

    var _drawGraph = function (graphics, nodeMovers) {
        // No magic at all: Iterate over positions array and render nodes/links
        graphics.clear();
        var i, x, y, x1, y1;

        graphics.lineStyle(5, 0x3300FF, 0.25);
        $.each(_edges, function (i, edge) {
            var sourcePos = nodeMovers[edge.source].renderPosition();
            var targetPos = nodeMovers[edge.target].renderPosition();

            graphics.moveTo(sourcePos.x, sourcePos.y);
            graphics.lineTo(targetPos.x, targetPos.y);
        });

        $.each(_edges, function (i, edge) {
            var sourcePos = nodeMovers[edge.source].renderPosition();
            var targetPos = nodeMovers[edge.target].renderPosition();

            graphics.lineStyle(2, _nodesById[edge.source].decColor, 0.85);

            graphics.moveTo(sourcePos.x, sourcePos.y);
            graphics.lineTo(targetPos.x, targetPos.y);
        });

        graphics.lineStyle(4, 0x3300FF, 0.25);
        $.each(nodeMovers, function (i, nodeMover) {
            var node = _nodesById[nodeMover.data('id')];
            graphics.beginFill(node.decColor);
            var pos = nodeMover.renderPosition();
            var r = nodeMover.radius();

            if (node.shape === 'circle') {
                graphics.drawCircle(pos.x, pos.y, r);
            } else {
                x = pos.x - r / 2;
                y = pos.y - r / 2;
                graphics.drawRect(x, y, r, r);//not really radius, but we want smaller rectangles here...
            }
        });
    };
    //endregion

    //region public API
    this.renderFrame = function () {
        var nodeMovers = layoutFn();
        if (nodeMovers) {
            _drawGraph(_graphics, nodeMovers);
        }
        _renderer.render(_stage);
    };
    //endregion

    _init();
};

module.exports.PixiGraphics = PixiGraphics;


},{}],5:[function(require,module,exports){
module.exports = createLayout;

// Maximum movement of the system at which system should be considered as stable
var MAX_MOVEMENT = 0.001; 

/**
 * Creates force based layout for a given graph.
 * @param {ngraph.graph} graph which needs to be layed out
 */
function createLayout(graph, physicsSimulator) {
  if (!graph) {
    throw new Error('Graph structure cannot be undefined');
  }

  var random = require('ngraph.random').random(42),
      simulator = require('ngraph.physics.simulator'),
      physics = require('ngraph.physics.primitives');

  physicsSimulator = physicsSimulator || simulator();

  var nodeBodies = {},
      springs = {},
      graphRect = { x1: 0, y1: 0, x2: 0, y2: 0 };

  // Initialize physical objects according to what we have in the graph:
  initPhysics();
  listenToGraphEvents();

  return {
    /**
     * Performs one step of iterative layout algorithm
     */
    step: function() {
      var totalMovement = physicsSimulator.step();
      updateGraphRect();

      return totalMovement < MAX_MOVEMENT;
    },

    /**
     * For a given `nodeId` returns position
     */
    getNodePosition: function (nodeId) {
      return getInitializedBody(nodeId).pos;
    },

    /**
     * @returns {Object} Link position by link id
     * @returns {Object.from} {x, y} coordinates of link start
     * @returns {Object.to} {x, y} coordinates of link end
     */
    getLinkPosition: function (linkId) {
      var spring = springs[linkId];
      if (spring) {
        return {
          from: spring.from.pos,
          to: spring.to.pos
        };
      }
    },

    /**
     * @returns {Object} area required to fit in the graph. Object contains
     * `x1`, `y1` - top left coordinates
     * `x2`, `y2` - bottom right coordinates
     */
    getGraphRect: function () {
      return graphRect;
    },

    /*
     * Requests layout algorithm to pin/unpin node to its current position
     * Pinned nodes should not be affected by layout algorithm and always
     * remain at their position
     */
    pinNode: function (node, isPinned) {
      var body = getInitializedBody(node.id);
       body.isPinned = !!isPinned;
    },

    /**
     * Checks whether given graph's node is currently pinned
     */
    isNodePinned: function (node) {
      return getInitializedBody(node.id).isPinned;
    },

    /**
     * Request to release all resources
     */
    dispose: function() {
      graph.off('changed', onGraphChanged);
    }
  };

  function listenToGraphEvents() {
    graph.on('changed', onGraphChanged);
  }

  function onGraphChanged(changes) {
    for (var i = 0; i < changes.length; ++i) {
      var change = changes[i];
      if (change.changeType === 'add') {
        if (change.node) {
          initBody(change.node.id);
        }
        if (change.link) {
          initLink(change.link);
        }
      } else if (change.changeType === 'remove') {
        if (change.node) {
          releaseNode(change.node);
        }
        if (change.link) {
          releaseLink(change.link);
        }
      }
    }
  }

  function initPhysics() {
    graph.forEachNode(function (node) {
      initBody(node.id);
    });
    graph.forEachLink(initLink);
  }

  function initBody(nodeId) {
    var body = nodeBodies[nodeId];
    if (!body) {
      var node = graph.getNode(nodeId);
      if (!node) {
        throw new Error('initBody() was called with unknown node id');
      }

      var pos = getBestInitialNodePosition(node);
      body = new physics.Body(pos.x, pos.y);
      // we need to augment body with previous position to let users pin them
      body.prevPos = new physics.Vector2d(pos.x, pos.y);

      nodeBodies[nodeId] = body;
      updateBodyMass(nodeId);

      if (isNodeOriginallyPinned(node)) {
        body.isPinned = true;
      }

      physicsSimulator.addBody(body);
    }
  }

  function releaseNode(node) {
    var nodeId = node.id;
    var body = nodeBodies[nodeId];
    if (body) {
      nodeBodies[nodeId] = null;
      delete nodeBodies[nodeId];

      physicsSimulator.removeBody(body);
      if (graph.getNodesCount() === 0) {
        graphRect.x1 = graphRect.y1 = 0;
        graphRect.x2 = graphRect.y2 = 0;
      }
    }
  }

  function initLink(link) {
    updateBodyMass(link.fromId);
    updateBodyMass(link.toId);

    var fromBody = nodeBodies[link.fromId],
        toBody  = nodeBodies[link.toId],
        spring = physicsSimulator.addSpring(fromBody, toBody, link.length);

    springs[link.id] = spring;
  }

  function releaseLink(link) {
    var spring = springs[link.id];
    if (spring) {
      var from = graph.getNode(link.fromId),
          to = graph.getNode(link.toId);

      if (from) updateBodyMass(from.id);
      if (to) updateBodyMass(to.id);

      delete springs[link.id];

      physicsSimulator.removeSpring(spring);
    }
  }

  function getBestInitialNodePosition(node) {
    // TODO: Initial position could be picked better, e.g. take into
    // account all neighbouring nodes/links, not only one.
    // How about center of mass?
    if (node.position) {
      return node.position;
    }

    var baseX = (graphRect.x1 + graphRect.x2) / 2,
        baseY = (graphRect.y1 + graphRect.y2) / 2,
        springLength = physicsSimulator.springLength();

    if (node.links && node.links.length > 0) {
      var firstLink = node.links[0],
          otherBody = firstLink.fromId !== node.id ? nodeBodies[firstLink.fromId] : nodeBodies[firstLink.toId];
      if (otherBody && otherBody.pos) {
        baseX = otherBody.pos.x;
        baseY = otherBody.pos.y;
      }
    }

    return {
      x: baseX + random.next(springLength) - springLength / 2,
      y: baseY + random.next(springLength) - springLength / 2
    };
  }

  function updateBodyMass(nodeId) {
    var body = nodeBodies[nodeId];
    body.mass = nodeMass(nodeId);
  }


  function updateGraphRect() {
    if (graph.getNodesCount() === 0) {
      // don't have to wory here.
      return;
    }

    var x1 = Number.MAX_VALUE,
        y1 = Number.MAX_VALUE,
        x2 = Number.MIN_VALUE,
        y2 = Number.MIN_VALUE;

    // this is O(n), could it be done faster with quadtree?
    for (var key in nodeBodies) {
      if (nodeBodies.hasOwnProperty(key)) {
        // how about pinned nodes?
        var body = nodeBodies[key];
        if (isBodyPinned(body)) {
          body.pos.x = body.prevPos.x;
          body.pos.y = body.prevPos.y;
        } else {
          body.prevPos.x = body.pos.x;
          body.prevPos.y = body.pos.y;
        }
        if (body.pos.x < x1) {
          x1 = body.pos.x;
        }
        if (body.pos.x > x2) {
          x2 = body.pos.x;
        }
        if (body.pos.y < y1) {
          y1 = body.pos.y;
        }
        if (body.pos.y > y2) {
          y2 = body.pos.y;
        }
      }
    }

    graphRect.x1 = x1;
    graphRect.x2 = x2;
    graphRect.y1 = y1;
    graphRect.y2 = y2;
  }

  /**
   * Checks whether graph node has in its settings pinned attribute,
   * which means layout algorithm cannot move it. Node can be preconfigured
   * as pinned, if it has "isPinned" attribute, or when node.data has it.
   *
   * @param {Object} node a graph node to check
   * @return {Boolean} true if node should be treated as pinned; false otherwise.
   */
  function isNodeOriginallyPinned(node) {
    return (node && (node.isPinned || (node.data && node.data.isPinned)));
  }

  /**
   * Checks whether given physical body should be treated as pinned. Unlinke
   * `isNodeOriginallyPinned` this operates on body object, which is specific to layout
   * instance. Thus two layouters can independntly pin bodies, which represent
   * same node of a source graph.
   *
   * @param {ngraph.physics.Body} body - body to check
   * @return {Boolean} true if body should be treated as pinned; false otherwise.
   */
  function isBodyPinned (body) {
    return body.isPinned;
  }

  function getInitializedBody(nodeId) {
    var body = nodeBodies[nodeId];
    if (!body) {
      initBody(nodeId);
      body = nodeBodies[nodeId];
    }
    return body;
  }

  /**
   * Calculates mass of a body, which corresponds to node with given id.
   *
   * @param {String|Number} nodeId identifier of a node, for which body mass needs to be calculated
   * @returns {Number} recommended mass of the body;
   */
  function nodeMass(nodeId) {
    return 1 + graph.getLinks(nodeId).length / 3.0;
  }
}

},{"ngraph.physics.primitives":6,"ngraph.physics.simulator":10,"ngraph.random":7}],6:[function(require,module,exports){
module.exports = {
  Body: Body,
  Vector2d: Vector2d
  // that's it for now
};

function Body(x, y) {
  this.pos = new Vector2d(x, y);
  this.force = new Vector2d();
  this.velocity = new Vector2d();
  this.mass = 1;
}

function Vector2d(x, y) {
  this.x = typeof x === 'number' ? x : 0;
  this.y = typeof y === 'number' ? y : 0;
}

},{}],7:[function(require,module,exports){
module.exports = {
  random: random,
  randomIterator: randomIterator
};

/**
 * Creates seeded PRNG with two methods:
 *   next() and nextDouble()
 */
function random(inputSeed) {
  var seed = typeof inputSeed === 'number' ? inputSeed : (+ new Date());
  var randomFunc = function() {
      // Robert Jenkins' 32 bit integer hash function.
      seed = ((seed + 0x7ed55d16) + (seed << 12))  & 0xffffffff;
      seed = ((seed ^ 0xc761c23c) ^ (seed >>> 19)) & 0xffffffff;
      seed = ((seed + 0x165667b1) + (seed << 5))   & 0xffffffff;
      seed = ((seed + 0xd3a2646c) ^ (seed << 9))   & 0xffffffff;
      seed = ((seed + 0xfd7046c5) + (seed << 3))   & 0xffffffff;
      seed = ((seed ^ 0xb55a4f09) ^ (seed >>> 16)) & 0xffffffff;
      return (seed & 0xfffffff) / 0x10000000;
  };

  return {
      /**
       * Generates random integer number in the range from 0 (inclusive) to maxValue (exclusive)
       *
       * @param maxValue Number REQUIRED. Ommitting this number will result in NaN values from PRNG.
       */
      next : function (maxValue) {
          return Math.floor(randomFunc() * maxValue);
      },

      /**
       * Generates random double number in the range from 0 (inclusive) to 1 (exclusive)
       * This function is the same as Math.random() (except that it could be seeded)
       */
      nextDouble : function () {
          return randomFunc();
      }
  };
}

/*
 * Creates iterator over array, which returns items of array in random order
 * Time complexity is guaranteed to be O(n);
 */
function randomIterator(array, customRandom) {
    var localRandom = customRandom || random();
    if (typeof localRandom.next !== 'function') {
      throw new Error('customRandom does not match expected API: next() function is missing');
    }

    return {
        forEach : function (callback) {
            var i, j, t;
            for (i = array.length - 1; i > 0; --i) {
                j = localRandom.next(i + 1); // i inclusive
                t = array[j];
                array[j] = array[i];
                array[i] = t;

                callback(t);
            }

            if (array.length) {
                callback(array[0]);
            }
        },

        /**
         * Shuffles array randomly, in place.
         */
        shuffle : function () {
            var i, j, t;
            for (i = array.length - 1; i > 0; --i) {
                j = localRandom.next(i + 1); // i inclusive
                t = array[j];
                array[j] = array[i];
                array[i] = t;
            }

            return array;
        }
    };
}

},{}],8:[function(require,module,exports){
/**
 * @fileOverview Contains definition of the core graph object.
 */

/**
 * @example
 *  var graph = require('ngraph.graph')();
 *  graph.addNode(1);     // graph has one node.
 *  graph.addLink(2, 3);  // now graph contains three nodes and one link.
 *
 */
module.exports = createGraph;

var eventify = require('ngraph.events');

/**
 * Creates a new graph
 */
function createGraph(options) {
  // Graph structure is maintained as dictionary of nodes
  // and array of links. Each node has 'links' property which
  // hold all links related to that node. And general links
  // array is used to speed up all links enumeration. This is inefficient
  // in terms of memory, but simplifies coding.
  options = options || {};
  if (options.uniqueLinkId === undefined) {
    // Request each link id to be unique between same nodes. This negatively
    // impacts `addLink()` performance (O(n), where n - number of edges of each
    // vertex), but makes operations with multigraphs more accessible.
    options.uniqueLinkId = true;
  }

  var nodes = typeof Object.create === 'function' ? Object.create(null) : {},
    links = [],
    // Hash of multi-edges. Used to track ids of edges between same nodes
    multiEdges = {},
    nodesCount = 0,
    suspendEvents = 0,

    forEachNode = createNodeIterator(),
    createLink = options.uniqueLinkId ? createUniqueLink : createSingleLink,

    // Our graph API provides means to listen to graph changes. Users can subscribe
    // to be notified about changes in the graph by using `on` method. However
    // in some cases they don't use it. To avoid unnecessary memory consumption
    // we will not record graph changes until we have at least one subscriber.
    // Code below supports this optimization.
    //
    // Accumulates all changes made during graph updates.
    // Each change element contains:
    //  changeType - one of the strings: 'add', 'remove' or 'update';
    //  node - if change is related to node this property is set to changed graph's node;
    //  link - if change is related to link this property is set to changed graph's link;
    changes = [],
    recordLinkChange = noop,
    recordNodeChange = noop,
    enterModification = noop,
    exitModification = noop;

  // this is our public API:
  var graphPart = {
    /**
     * Adds node to the graph. If node with given id already exists in the graph
     * its data is extended with whatever comes in 'data' argument.
     *
     * @param nodeId the node's identifier. A string or number is preferred.
     *   note: If you request options.uniqueLinkId, then node id should not
     *   contain '👉 '. This will break link identifiers
     * @param [data] additional data for the node being added. If node already
     *   exists its data object is augmented with the new one.
     *
     * @return {node} The newly added node or node with given id if it already exists.
     */
    addNode: addNode,

    /**
     * Adds a link to the graph. The function always create a new
     * link between two nodes. If one of the nodes does not exists
     * a new node is created.
     *
     * @param fromId link start node id;
     * @param toId link end node id;
     * @param [data] additional data to be set on the new link;
     *
     * @return {link} The newly created link
     */
    addLink: addLink,

    /**
     * Removes link from the graph. If link does not exist does nothing.
     *
     * @param link - object returned by addLink() or getLinks() methods.
     *
     * @returns true if link was removed; false otherwise.
     */
    removeLink: removeLink,

    /**
     * Removes node with given id from the graph. If node does not exist in the graph
     * does nothing.
     *
     * @param nodeId node's identifier passed to addNode() function.
     *
     * @returns true if node was removed; false otherwise.
     */
    removeNode: removeNode,

    /**
     * Gets node with given identifier. If node does not exist undefined value is returned.
     *
     * @param nodeId requested node identifier;
     *
     * @return {node} in with requested identifier or undefined if no such node exists.
     */
    getNode: getNode,

    /**
     * Gets number of nodes in this graph.
     *
     * @return number of nodes in the graph.
     */
    getNodesCount: function() {
      return nodesCount;
    },

    /**
     * Gets total number of links in the graph.
     */
    getLinksCount: function() {
      return links.length;
    },

    /**
     * Gets all links (inbound and outbound) from the node with given id.
     * If node with given id is not found null is returned.
     *
     * @param nodeId requested node identifier.
     *
     * @return Array of links from and to requested node if such node exists;
     *   otherwise null is returned.
     */
    getLinks: getLinks,

    /**
     * Invokes callback on each node of the graph.
     *
     * @param {Function(node)} callback Function to be invoked. The function
     *   is passed one argument: visited node.
     */
    forEachNode: forEachNode,

    /**
     * Invokes callback on every linked (adjacent) node to the given one.
     *
     * @param nodeId Identifier of the requested node.
     * @param {Function(node, link)} callback Function to be called on all linked nodes.
     *   The function is passed two parameters: adjacent node and link object itself.
     * @param oriented if true graph treated as oriented.
     */
    forEachLinkedNode: forEachLinkedNode,

    /**
     * Enumerates all links in the graph
     *
     * @param {Function(link)} callback Function to be called on all links in the graph.
     *   The function is passed one parameter: graph's link object.
     *
     * Link object contains at least the following fields:
     *  fromId - node id where link starts;
     *  toId - node id where link ends,
     *  data - additional data passed to graph.addLink() method.
     */
    forEachLink: forEachLink,

    /**
     * Suspend all notifications about graph changes until
     * endUpdate is called.
     */
    beginUpdate: enterModification,

    /**
     * Resumes all notifications about graph changes and fires
     * graph 'changed' event in case there are any pending changes.
     */
    endUpdate: exitModification,

    /**
     * Removes all nodes and links from the graph.
     */
    clear: clear,

    /**
     * Detects whether there is a link between two nodes.
     * Operation complexity is O(n) where n - number of links of a node.
     * NOTE: this function is synonim for getLink()
     *
     * @returns link if there is one. null otherwise.
     */
    hasLink: getLink,

    /**
     * Gets an edge between two nodes.
     * Operation complexity is O(n) where n - number of links of a node.
     *
     * @param {string} fromId link start identifier
     * @param {string} toId link end identifier
     *
     * @returns link if there is one. null otherwise.
     */
    getLink: getLink
  };

  // this will add `on()` and `fire()` methods.
  eventify(graphPart);

  monitorSubscribers();

  return graphPart;

  function monitorSubscribers() {
    var realOn = graphPart.on;

    // replace real `on` with our temporary on, which will trigger change
    // modification monitoring:
    graphPart.on = on;

    function on() {
      // now it's time to start tracking stuff:
      graphPart.beginUpdate = enterModification = enterModificationReal;
      graphPart.endUpdate = exitModification = exitModificationReal;
      recordLinkChange = recordLinkChangeReal;
      recordNodeChange = recordNodeChangeReal;

      // this will replace current `on` method with real pub/sub from `eventify`.
      graphPart.on = realOn;
      // delegate to real `on` handler:
      return realOn.apply(graphPart, arguments);
    }
  }

  function recordLinkChangeReal(link, changeType) {
    changes.push({
      link: link,
      changeType: changeType
    });
  }

  function recordNodeChangeReal(node, changeType) {
    changes.push({
      node: node,
      changeType: changeType
    });
  }

  function addNode(nodeId, data) {
    if (nodeId === undefined) {
      throw new Error('Invalid node identifier');
    }

    enterModification();

    var node = getNode(nodeId);
    if (!node) {
      // TODO: Should I check for 👉  here?
      node = new Node(nodeId);
      nodesCount++;
      recordNodeChange(node, 'add');
    } else {
      recordNodeChange(node, 'update');
    }

    node.data = data;

    nodes[nodeId] = node;

    exitModification();
    return node;
  }

  function getNode(nodeId) {
    return nodes[nodeId];
  }

  function removeNode(nodeId) {
    var node = getNode(nodeId);
    if (!node) {
      return false;
    }

    enterModification();

    while (node.links.length) {
      var link = node.links[0];
      removeLink(link);
    }

    delete nodes[nodeId];
    nodesCount--;

    recordNodeChange(node, 'remove');

    exitModification();

    return true;
  }


  function addLink(fromId, toId, data) {
    enterModification();

    var fromNode = getNode(fromId) || addNode(fromId);
    var toNode = getNode(toId) || addNode(toId);

    var link = createLink(fromId, toId, data);

    links.push(link);

    // TODO: this is not cool. On large graphs potentially would consume more memory.
    fromNode.links.push(link);
    if (fromId !== toId) {
      // make sure we are not duplicating links for self-loops
      toNode.links.push(link);
    }

    recordLinkChange(link, 'add');

    exitModification();

    return link;
  }

  function createSingleLink(fromId, toId, data) {
    var linkId = fromId.toString() + toId.toString();
    return new Link(fromId, toId, data, linkId);
  }

  function createUniqueLink(fromId, toId, data) {
    var linkId = fromId.toString() + '👉 ' + toId.toString();
    var isMultiEdge = multiEdges.hasOwnProperty(linkId);
    if (isMultiEdge || getLink(fromId, toId)) {
      if (!isMultiEdge) {
        multiEdges[linkId] = 0;
      }
      linkId += '@' + (++multiEdges[linkId]);
    }

    return new Link(fromId, toId, data, linkId);
  }

  function getLinks(nodeId) {
    var node = getNode(nodeId);
    return node ? node.links : null;
  }

  function removeLink(link) {
    if (!link) {
      return false;
    }
    var idx = indexOfElementInArray(link, links);
    if (idx < 0) {
      return false;
    }

    enterModification();

    links.splice(idx, 1);

    var fromNode = getNode(link.fromId);
    var toNode = getNode(link.toId);

    if (fromNode) {
      idx = indexOfElementInArray(link, fromNode.links);
      if (idx >= 0) {
        fromNode.links.splice(idx, 1);
      }
    }

    if (toNode) {
      idx = indexOfElementInArray(link, toNode.links);
      if (idx >= 0) {
        toNode.links.splice(idx, 1);
      }
    }

    recordLinkChange(link, 'remove');

    exitModification();

    return true;
  }

  function getLink(fromNodeId, toNodeId) {
    // TODO: Use sorted links to speed this up
    var node = getNode(fromNodeId),
      i;
    if (!node) {
      return null;
    }

    for (i = 0; i < node.links.length; ++i) {
      var link = node.links[i];
      if (link.fromId === fromNodeId && link.toId === toNodeId) {
        return link;
      }
    }

    return null; // no link.
  }

  function clear() {
    enterModification();
    forEachNode(function(node) {
      removeNode(node.id);
    });
    exitModification();
  }

  function forEachLink(callback) {
    var i, length;
    if (typeof callback === 'function') {
      for (i = 0, length = links.length; i < length; ++i) {
        callback(links[i]);
      }
    }
  }

  function forEachLinkedNode(nodeId, callback, oriented) {
    var node = getNode(nodeId);

    if (node && node.links && typeof callback === 'function') {
      if (oriented) {
        return forEachOrientedLink(node.links, nodeId, callback);
      } else {
        return forEachNonOrientedLink(node.links, nodeId, callback);
      }
    }
  }

  function forEachNonOrientedLink(links, nodeId, callback) {
    var quitFast;
    for (var i = 0; i < links.length; ++i) {
      var link = links[i];
      var linkedNodeId = link.fromId === nodeId ? link.toId : link.fromId;

      quitFast = callback(nodes[linkedNodeId], link);
      if (quitFast) {
        return true; // Client does not need more iterations. Break now.
      }
    }
  }

  function forEachOrientedLink(links, nodeId, callback) {
    var quitFast;
    for (var i = 0; i < links.length; ++i) {
      var link = links[i];
      if (link.fromId === nodeId) {
        quitFast = callback(nodes[link.toId], link);
        if (quitFast) {
          return true; // Client does not need more iterations. Break now.
        }
      }
    }
  }

  // we will not fire anything until users of this library explicitly call `on()`
  // method.
  function noop() {}

  // Enter, Exit modification allows bulk graph updates without firing events.
  function enterModificationReal() {
    suspendEvents += 1;
  }

  function exitModificationReal() {
    suspendEvents -= 1;
    if (suspendEvents === 0 && changes.length > 0) {
      graphPart.fire('changed', changes);
      changes.length = 0;
    }
  }

  function createNodeIterator() {
    // Object.keys iterator is 1.3x faster than `for in` loop.
    // See `https://github.com/anvaka/ngraph.graph/tree/bench-for-in-vs-obj-keys`
    // branch for perf test
    return Object.keys ? objectKeysIterator : forInIterator;
  }

  function objectKeysIterator(callback) {
    if (typeof callback !== 'function') {
      return;
    }

    var keys = Object.keys(nodes);
    for (var i = 0; i < keys.length; ++i) {
      if (callback(nodes[keys[i]])) {
        return true; // client doesn't want to proceed. Return.
      }
    }
  }

  function forInIterator(callback) {
    if (typeof callback !== 'function') {
      return;
    }
    var node;

    for (node in nodes) {
      if (callback(nodes[node])) {
        return true; // client doesn't want to proceed. Return.
      }
    }
  }
}

// need this for old browsers. Should this be a separate module?
function indexOfElementInArray(element, array) {
  if (array.indexOf) {
    return array.indexOf(element);
  }

  var len = array.length,
    i;

  for (i = 0; i < len; i += 1) {
    if (array[i] === element) {
      return i;
    }
  }

  return -1;
}

/**
 * Internal structure to represent node;
 */
function Node(id) {
  this.id = id;
  this.links = [];
  this.data = null;
}


/**
 * Internal structure to represent links;
 */
function Link(fromId, toId, data, id) {
  this.fromId = fromId;
  this.toId = toId;
  this.data = data;
  this.id = id;
}

},{"ngraph.events":9}],9:[function(require,module,exports){
module.exports = function(subject) {
  validateSubject(subject);

  var eventsStorage = createEventsStorage(subject);
  subject.on = eventsStorage.on;
  subject.off = eventsStorage.off;
  subject.fire = eventsStorage.fire;
  return subject;
};

function createEventsStorage(subject) {
  // Store all event listeners to this hash. Key is event name, value is array
  // of callback records.
  //
  // A callback record consists of callback function and its optional context:
  // { 'eventName' => [{callback: function, ctx: object}] }
  var registeredEvents = Object.create(null);

  return {
    on: function (eventName, callback, ctx) {
      if (typeof callback !== 'function') {
        throw new Error('callback is expected to be a function');
      }
      var handlers = registeredEvents[eventName];
      if (!handlers) {
        handlers = registeredEvents[eventName] = [];
      }
      handlers.push({callback: callback, ctx: ctx});

      return subject;
    },

    off: function (eventName, callback) {
      var wantToRemoveAll = (typeof eventName === 'undefined');
      if (wantToRemoveAll) {
        // Killing old events storage should be enough in this case:
        registeredEvents = Object.create(null);
        return subject;
      }

      if (registeredEvents[eventName]) {
        var deleteAllCallbacksForEvent = (typeof callback !== 'function');
        if (deleteAllCallbacksForEvent) {
          delete registeredEvents[eventName];
        } else {
          var callbacks = registeredEvents[eventName];
          for (var i = 0; i < callbacks.length; ++i) {
            if (callbacks[i].callback === callback) {
              callbacks.splice(i, 1);
            }
          }
        }
      }

      return subject;
    },

    fire: function (eventName) {
      var callbacks = registeredEvents[eventName];
      if (!callbacks) {
        return subject;
      }

      var fireArguments;
      if (arguments.length > 1) {
        fireArguments = Array.prototype.splice.call(arguments, 1);
      }
      for(var i = 0; i < callbacks.length; ++i) {
        var callbackInfo = callbacks[i];
        callbackInfo.callback.apply(callbackInfo.ctx, fireArguments);
      }

      return subject;
    }
  };
}

function validateSubject(subject) {
  if (!subject) {
    throw new Error('Eventify cannot use falsy object as events subject');
  }
  var reservedWords = ['on', 'fire', 'off'];
  for (var i = 0; i < reservedWords.length; ++i) {
    if (subject.hasOwnProperty(reservedWords[i])) {
      throw new Error("Subject cannot be eventified, since it already has property '" + reservedWords[i] + "'");
    }
  }
}

},{}],10:[function(require,module,exports){
/**
 * Manages a simulation of physical forces acting on bodies and springs.
 */
module.exports = physicsSimulator;

function physicsSimulator(settings) {
  var Spring = require('./lib/spring');
  var createQuadTree = require('ngraph.quadtreebh');
  var createDragForce = require('./lib/dragForce');
  var createSpringForce = require('./lib/springForce');
  var integrate = require('./lib/eulerIntegrator');
  var expose = require('./lib/exposeProperties');
  var merge = require('ngraph.merge');

  settings = merge(settings, {
      /**
       * Ideal length for links (springs in physical model).
       */
      springLength: 80,

      /**
       * Hook's law coefficient. 1 - solid spring.
       */
      springCoeff: 0.0002,

      /**
       * Coulomb's law coefficient. It's used to repel nodes thus should be negative
       * if you make it positive nodes start attract each other :).
       */
      gravity: -1.2,

      /**
       * Theta coeffiecient from Barnes Hut simulation. Ranged between (0, 1).
       * The closer it's to 1 the more nodes algorithm will have to go through.
       * Setting it to one makes Barnes Hut simulation no different from
       * brute-force forces calculation (each node is considered).
       */
      theta: 0.8,

      /**
       * Drag force coefficient. Used to slow down system, thus should be less than 1.
       * The closer it is to 0 the less tight system will be.
       */
      dragCoeff: 0.02,

      /**
       * Default time step (dt) for forces integration
       */
      timeStep : 20
  });

  var bodies = [], // Bodies in this simulation.
      springs = [], // Springs in this simulation.
      quadTree = createQuadTree(settings),
      springForce = createSpringForce(settings),
      dragForce = createDragForce(settings);

  var publicApi = {
    /**
     * Array of bodies, registered with current simulator
     *
     * Note: To add new body, use addBody() method. This property is only
     * exposed for testing/performance purposes.
     */
    bodies: bodies,

    /**
     * Performs one step of force simulation.
     *
     * @returns {Number} Total movement of the system. Calculated as:
     *   (total distance traveled by bodies)^2/(total # of bodies)
     */
    step: function () {
      // I'm reluctant to check timeStep here, since this method is going to be
      // super hot, I don't want to add more complexity to it
      accumulateForces();
      return integrate(bodies, settings.timeStep);
    },

    /**
     * Adds body to the system
     *
     * @param {ngraph.physics.primitives.Body} body physical body
     *
     * @returns {ngraph.physics.primitives.Body} added body
     */
    addBody: function (body) {
      if (!body) {
        throw new Error('Body is required');
      }
      bodies.push(body);

      return body;
    },

    /**
     * Removes body from the system
     *
     * @param {ngraph.physics.primitives.Body} body to remove
     *
     * @returns {Boolean} true if body found and removed. falsy otherwise;
     */
    removeBody: function (body) {
      if (!body) { return; }
      var idx = bodies.indexOf(body);
      if (idx > -1) {
        bodies.splice(idx, 1);
        return true;
      }
    },

    /**
     * Adds a spring to this simulation.
     *
     * @returns {Object} - a handle for a spring. If you want to later remove
     * spring pass it to removeSpring() method.
     */
    addSpring: function (body1, body2, springLength, springWeight, springCoefficient) {
      if (!body1 || !body2) {
        throw new Error('Cannot add null spring to force simulator');
      }

      if (typeof springLength !== 'number') {
        springLength = -1; // assume global configuration
      }

      var spring = new Spring(body1, body2, springLength, springCoefficient >= 0 ? springCoefficient : -1, springWeight);
      springs.push(spring);

      // TODO: could mark simulator as dirty.
      return spring;
    },

    /**
     * Removes spring from the system
     *
     * @param {Object} spring to remove. Spring is an object returned by addSpring
     *
     * @returns {Boolean} true if spring found and removed. falsy otherwise;
     */
    removeSpring: function (spring) {
      if (!spring) { return; }
      var idx = springs.indexOf(spring);
      if (idx > -1) {
        springs.splice(idx, 1);
        return true;
      }
    },

    gravity: function (value) {
      if (value !== undefined) {
        settings.gravity = value;
        quadTree.options({gravity: value});
        return this;
      } else {
        return settings.gravity;
      }
    },

    theta: function (value) {
      if (value !== undefined) {
        settings.theta = value;
        quadTree.options({theta: value});
        return this;
      } else {
        return settings.theta;
      }
    }
  }

  // allow settings modification via public API:
  expose(settings, publicApi);

  return publicApi;

  function accumulateForces() {
    // Accumulate forces acting on bodies.
    var body,
        i = bodies.length;

    if (i) {
      // only add bodies if there the array is not empty:
      quadTree.insertBodies(bodies); // performance: O(n * log n)
      while (i--) {
        body = bodies[i];
        body.force.x = 0;
        body.force.y = 0;

        quadTree.updateBodyForce(body);
        dragForce.update(body);
      }
    }

    i = springs.length;
    while(i--) {
      springForce.update(springs[i]);
    }
  }
};

},{"./lib/dragForce":11,"./lib/eulerIntegrator":12,"./lib/exposeProperties":13,"./lib/spring":14,"./lib/springForce":15,"ngraph.merge":16,"ngraph.quadtreebh":17}],11:[function(require,module,exports){
/**
 * Represents drag force, which reduces force value on each step by given
 * coefficient.
 *
 * @param {Object} options for the drag force
 * @param {Number=} options.dragCoeff drag force coefficient. 0.1 by default
 */
module.exports = function (options) {
  var merge = require('ngraph.merge'),
      expose = require('./exposeProperties');

  options = merge(options, {
    dragCoeff: 0.02
  });

  var api = {
    update : function (body) {
      body.force.x -= options.dragCoeff * body.velocity.x;
      body.force.y -= options.dragCoeff * body.velocity.y;
    }
  };

  // let easy access to dragCoeff:
  expose(options, api, ['dragCoeff']);

  return api;
};

},{"./exposeProperties":13,"ngraph.merge":16}],12:[function(require,module,exports){
/**
 * Performs forces integration, using given timestep. Uses Euler method to solve
 * differential equation (http://en.wikipedia.org/wiki/Euler_method ).
 *
 * @returns {Number} squared distance of total position updates.
 */

module.exports = integrate;

function integrate(bodies, timeStep) {
  var dx = 0, tx = 0,
      dy = 0, ty = 0,
      i,
      max = bodies.length;

  for (i = 0; i < max; ++i) {
    var body = bodies[i],
        coeff = timeStep / body.mass;

    body.velocity.x += coeff * body.force.x;
    body.velocity.y += coeff * body.force.y;
    var vx = body.velocity.x,
        vy = body.velocity.y,
        v = Math.sqrt(vx * vx + vy * vy);

    if (v > 1) {
      body.velocity.x = vx / v;
      body.velocity.y = vy / v;
    }

    dx = timeStep * body.velocity.x;
    dy = timeStep * body.velocity.y;

    body.pos.x += dx;
    body.pos.y += dy;

    // TODO: this is not accurate. Total value should be absolute
    tx += dx; ty += dy;
  }

  return (tx * tx + ty * ty)/bodies.length;
}

},{}],13:[function(require,module,exports){
module.exports = exposeProperties;

/**
 * Augments `target` object with getter/setter functions, which modify settings
 *
 * @example
 *  var target = {};
 *  exposeProperties({ age: 42}, target);
 *  target.age(); // returns 42
 *  target.age(24); // make age 24;
 *
 *  var filteredTarget = {};
 *  exposeProperties({ age: 42, name: 'John'}, filteredTarget, ['name']);
 *  filteredTarget.name(); // returns 'John'
 *  filteredTarget.age === undefined; // true
 */
function exposeProperties(settings, target, filter) {
  var needsFilter = Object.prototype.toString.call(filter) === '[object Array]';
  if (needsFilter) {
    for (var i = 0; i < filter.length; ++i) {
      augment(settings, target, filter[i]);
    }
  } else {
    for (var key in settings) {
      augment(settings, target, key);
    }
  }
}

function augment(source, target, key) {
  if (source.hasOwnProperty(key)) {
    if (typeof target[key] === 'function') {
      // this accessor is already defined. Ignore it
      return;
    }
    target[key] = function (value) {
      if (value !== undefined) {
        source[key] = value;
        return target;
      }
      return source[key];
    }
  }
}

},{}],14:[function(require,module,exports){
module.exports = Spring;

/**
 * Represents a physical spring. Spring connects two bodies, has rest length
 * stiffness coefficient and optional weight
 */
function Spring(fromBody, toBody, length, coeff, weight) {
    this.from = fromBody;
    this.to = toBody;
    this.length = length;
    this.coeff = coeff;

    this.weight = typeof weight === 'number' ? weight : 1;
};

},{}],15:[function(require,module,exports){
/**
 * Represents spring force, which updates forces acting on two bodies, conntected
 * by a spring.
 *
 * @param {Object} options for the spring force
 * @param {Number=} options.springCoeff spring force coefficient.
 * @param {Number=} options.springLength desired length of a spring at rest.
 */
module.exports = function (options) {
  var merge = require('ngraph.merge');
  var random = require('ngraph.random').random(42);
  var expose = require('./exposeProperties');

  options = merge(options, {
    springCoeff: 0.0002,
    springLength: 80
  });

  var api = {
    /**
     * Upsates forces acting on a spring
     */
    update : function (spring) {
      var body1 = spring.from,
          body2 = spring.to,
          length = spring.length < 0 ? options.springLength : spring.length,
          dx = body2.pos.x - body1.pos.x,
          dy = body2.pos.y - body1.pos.y,
          r = Math.sqrt(dx * dx + dy * dy);

      if (r === 0) {
          dx = (random.nextDouble() - 0.5) / 50;
          dy = (random.nextDouble() - 0.5) / 50;
          r = Math.sqrt(dx * dx + dy * dy);
      }

      var d = r - length;
      var coeff = ((!spring.coeff || spring.coeff < 0) ? options.springCoeff : spring.coeff) * d / r * spring.weight;

      body1.force.x += coeff * dx;
      body1.force.y += coeff * dy;

      body2.force.x -= coeff * dx;
      body2.force.y -= coeff * dy;
    }
  };

  expose(options, api, ['springCoeff', 'springLength']);
  return api;
}

},{"./exposeProperties":13,"ngraph.merge":16,"ngraph.random":21}],16:[function(require,module,exports){
module.exports = merge;

/**
 * Augments `target` with properties in `options`. Does not override
 * target's properties if they are defined and matches expected type in 
 * options
 *
 * @returns {Object} merged object
 */
function merge(target, options) {
  var key;
  if (!target) { target = {}; }
  if (options) {
    for (key in options) {
      if (options.hasOwnProperty(key)) {
        var targetHasIt = target.hasOwnProperty(key),
            optionsValueType = typeof options[key],
            shouldReplace = !targetHasIt || (typeof target[key] !== optionsValueType);

        if (shouldReplace) {
          target[key] = options[key];
        } else if (optionsValueType === 'object') {
          // go deep, don't care about loops here, we are simple API!:
          target[key] = merge(target[key], options[key]);
        }
      }
    }
  }

  return target;
}

},{}],17:[function(require,module,exports){
/**
 * This is Barnes Hut simulation algorithm. Implementation
 * is adopted to non-recursive solution, since certain browsers
 * handle recursion extremly bad.
 *
 * http://www.cs.princeton.edu/courses/archive/fall03/cs126/assignments/barnes-hut.html
 */

module.exports = function (options) {
    options = options || {};
    options.gravity = typeof options.gravity === 'number' ? options.gravity : -1;
    options.theta = typeof options.theta === 'number' ? options.theta : 0.8;

    // we require deterministic randomness here
    var random = require('ngraph.random').random(1984),
        Node = require('./node'),
        InsertStack = require('./insertStack'),
        isSamePosition = require('./isSamePosition');

    var gravity = options.gravity,
        updateQueue = [],
        insertStack = new InsertStack(),
        theta = options.theta,

        nodesCache = [],
        currentInCache = 0,
        newNode = function () {
            // To avoid pressure on GC we reuse nodes.
            var node = nodesCache[currentInCache];
            if (node) {
                node.quads[0] = null;
                node.quads[1] = null;
                node.quads[2] = null;
                node.quads[3] = null;
                node.body = null;
                node.mass = node.massX = node.massY = 0;
                node.left = node.right = node.top = node.bottom = 0;
            } else {
                node = new Node();
                nodesCache[currentInCache] = node;
            }

            ++currentInCache;
            return node;
        },

        root = newNode(),

        // Inserts body to the tree
        insert = function (newBody) {
            insertStack.reset();
            insertStack.push(root, newBody);

            while (!insertStack.isEmpty()) {
                var stackItem = insertStack.pop(),
                    node = stackItem.node,
                    body = stackItem.body;

                if (!node.body) {
                    // This is internal node. Update the total mass of the node and center-of-mass.
                    var x = body.pos.x;
                    var y = body.pos.y;
                    node.mass = node.mass + body.mass;
                    node.massX = node.massX + body.mass * x;
                    node.massY = node.massY + body.mass * y;

                    // Recursively insert the body in the appropriate quadrant.
                    // But first find the appropriate quadrant.
                    var quadIdx = 0, // Assume we are in the 0's quad.
                        left = node.left,
                        right = (node.right + left) / 2,
                        top = node.top,
                        bottom = (node.bottom + top) / 2;

                    if (x > right) { // somewhere in the eastern part.
                        quadIdx = quadIdx + 1;
                        var oldLeft = left;
                        left = right;
                        right = right + (right - oldLeft);
                    }
                    if (y > bottom) { // and in south.
                        quadIdx = quadIdx + 2;
                        var oldTop = top;
                        top = bottom;
                        bottom = bottom + (bottom - oldTop);
                    }

                    var child = node.quads[quadIdx];
                    if (!child) {
                        // The node is internal but this quadrant is not taken. Add
                        // subnode to it.
                        child = newNode();
                        child.left = left;
                        child.top = top;
                        child.right = right;
                        child.bottom = bottom;
                        child.body = body;

                        node.quads[quadIdx] = child;
                    } else {
                        // continue searching in this quadrant.
                        insertStack.push(child, body);
                    }
                } else {
                    // We are trying to add to the leaf node.
                    // We have to convert current leaf into internal node
                    // and continue adding two nodes.
                    var oldBody = node.body;
                    node.body = null; // internal nodes do not cary bodies

                    if (isSamePosition(oldBody.pos, body.pos)) {
                        // Prevent infinite subdivision by bumping one node
                        // anywhere in this quadrant
                        if (node.right - node.left < 1e-8) {
                            // This is very bad, we ran out of precision.
                            // if we do not return from the method we'll get into
                            // infinite loop here. So we sacrifice correctness of layout, and keep the app running
                            // Next layout iteration should get larger bounding box in the first step and fix this
                            return;
                        }
                        do {
                            var offset = random.nextDouble();
                            var dx = (node.right - node.left) * offset;
                            var dy = (node.bottom - node.top) * offset;

                            oldBody.pos.x = node.left + dx;
                            oldBody.pos.y = node.top + dy;
                            // Make sure we don't bump it out of the box. If we do, next iteration should fix it
                        } while (isSamePosition(oldBody.pos, body.pos));

                    }
                    // Next iteration should subdivide node further.
                    insertStack.push(node, oldBody);
                    insertStack.push(node, body);
                }
           }
        },

        update = function (sourceBody) {
            var queue = updateQueue,
                v,
                dx,
                dy,
                r,
                queueLength = 1,
                shiftIdx = 0,
                pushIdx = 1;

            queue[0] = root;

            while (queueLength) {
                var node = queue[shiftIdx],
                    body = node.body;

                queueLength -= 1;
                shiftIdx += 1;
                // technically there should be external "if (body !== sourceBody) {"
                // but in practice it gives slightghly worse performance, and does not
                // have impact on layout correctness
                if (body && body !== sourceBody) {
                    // If the current node is a leaf node (and it is not source body),
                    // calculate the force exerted by the current node on body, and add this
                    // amount to body's net force.
                    dx = body.pos.x - sourceBody.pos.x;
                    dy = body.pos.y - sourceBody.pos.y;
                    r = Math.sqrt(dx * dx + dy * dy);

                    if (r === 0) {
                        // Poor man's protection against zero distance.
                        dx = (random.nextDouble() - 0.5) / 50;
                        dy = (random.nextDouble() - 0.5) / 50;
                        r = Math.sqrt(dx * dx + dy * dy);
                    }

                    // This is standard gravition force calculation but we divide
                    // by r^3 to save two operations when normalizing force vector.
                    v = gravity * body.mass * sourceBody.mass / (r * r * r);
                    sourceBody.force.x += v * dx;
                    sourceBody.force.y += v * dy;
                } else {
                    // Otherwise, calculate the ratio s / r,  where s is the width of the region
                    // represented by the internal node, and r is the distance between the body
                    // and the node's center-of-mass
                    dx = node.massX / node.mass - sourceBody.pos.x;
                    dy = node.massY / node.mass - sourceBody.pos.y;
                    r = Math.sqrt(dx * dx + dy * dy);

                    if (r === 0) {
                        // Sorry about code duplucation. I don't want to create many functions
                        // right away. Just want to see performance first.
                        dx = (random.nextDouble() - 0.5) / 50;
                        dy = (random.nextDouble() - 0.5) / 50;
                        r = Math.sqrt(dx * dx + dy * dy);
                    }
                    // If s / r < θ, treat this internal node as a single body, and calculate the
                    // force it exerts on body b, and add this amount to b's net force.
                    if ((node.right - node.left) / r < theta) {
                        // in the if statement above we consider node's width only
                        // because the region was squarified during tree creation.
                        // Thus there is no difference between using width or height.
                        v = gravity * node.mass * sourceBody.mass / (r * r * r);
                        sourceBody.force.x += v * dx;
                        sourceBody.force.y += v * dy;
                    } else {
                        // Otherwise, run the procedure recursively on each of the current node's children.

                        // I intentionally unfolded this loop, to save several CPU cycles.
                        if (node.quads[0]) { queue[pushIdx] = node.quads[0]; queueLength += 1; pushIdx += 1; }
                        if (node.quads[1]) { queue[pushIdx] = node.quads[1]; queueLength += 1; pushIdx += 1; }
                        if (node.quads[2]) { queue[pushIdx] = node.quads[2]; queueLength += 1; pushIdx += 1; }
                        if (node.quads[3]) { queue[pushIdx] = node.quads[3]; queueLength += 1; pushIdx += 1; }
                    }
                }
            }
        },

        insertBodies = function (bodies) {
            var x1 = Number.MAX_VALUE,
                y1 = Number.MAX_VALUE,
                x2 = Number.MIN_VALUE,
                y2 = Number.MIN_VALUE,
                i,
                max = bodies.length;

            // To reduce quad tree depth we are looking for exact bounding box of all particles.
            i = max;
            while (i--) {
                var x = bodies[i].pos.x;
                var y = bodies[i].pos.y;
                if (x < x1) { x1 = x; }
                if (x > x2) { x2 = x; }
                if (y < y1) { y1 = y; }
                if (y > y2) { y2 = y; }
            }

            // Squarify the bounds.
            var dx = x2 - x1,
                dy = y2 - y1;
            if (dx > dy) { y2 = y1 + dx; } else { x2 = x1 + dy; }

            currentInCache = 0;
            root = newNode();
            root.left = x1;
            root.right = x2;
            root.top = y1;
            root.bottom = y2;

            i = max - 1;
            if (i > 0) {
              root.body = bodies[i];
            }
            while (i--) {
                insert(bodies[i], root);
            }
        };

    return {
        insertBodies : insertBodies,
        updateBodyForce : update,
        options : function (newOptions) {
            if (newOptions) {
                if (typeof newOptions.gravity === 'number') { gravity = newOptions.gravity; }
                if (typeof newOptions.theta === 'number') { theta = newOptions.theta; }

                return this;
            }

            return {gravity : gravity, theta : theta};
        }
    };
};


},{"./insertStack":18,"./isSamePosition":19,"./node":20,"ngraph.random":21}],18:[function(require,module,exports){
module.exports = InsertStack;

/**
 * Our implmentation of QuadTree is non-recursive (recursion handled not really
 * well in old browsers). This data structure represent stack of elemnts
 * which we are trying to insert into quad tree. It also avoids unnecessary
 * memory pressue when we are adding more elements
 */
function InsertStack () {
    this.stack = [];
    this.popIdx = 0;
}

InsertStack.prototype = {
    isEmpty: function() {
        return this.popIdx === 0;
    },
    push: function (node, body) {
        var item = this.stack[this.popIdx];
        if (!item) {
            // we are trying to avoid memory pressue: create new element
            // only when absolutely necessary
            this.stack[this.popIdx] = new InsertStackElement(node, body);
        } else {
            item.node = node;
            item.body = body;
        }
        ++this.popIdx;
    },
    pop: function () {
        if (this.popIdx > 0) {
            return this.stack[--this.popIdx];
        }
    },
    reset: function () {
        this.popIdx = 0;
    }
};

function InsertStackElement(node, body) {
    this.node = node; // QuadTree node
    this.body = body; // physical body which needs to be inserted to node
}

},{}],19:[function(require,module,exports){
module.exports = function isSamePosition(point1, point2) {
    var dx = Math.abs(point1.x - point2.x);
    var dy = Math.abs(point1.y - point2.y);

    return (dx < 1e-8 && dy < 1e-8);
};

},{}],20:[function(require,module,exports){
/**
 * Internal data structure to represent 2D QuadTree node
 */
module.exports = function Node() {
  // body stored inside this node. In quad tree only leaf nodes (by construction)
  // contain boides:
  this.body = null;

  // Child nodes are stored in quads. Each quad is presented by number:
  // 0 | 1
  // -----
  // 2 | 3
  this.quads = [];

  // Total mass of current node
  this.mass = 0;

  // Center of mass coordinates
  this.massX = 0;
  this.massY = 0;

  // bounding box coordinates
  this.left = 0;
  this.top = 0;
  this.bottom = 0;
  this.right = 0;

  // Node is internal when it is not a leaf
  this.isInternal = false;
};

},{}],21:[function(require,module,exports){
arguments[4][7][0].apply(exports,arguments)
},{"dup":7}],22:[function(require,module,exports){
var bundleFn = arguments[3];
var sources = arguments[4];
var cache = arguments[5];

var stringify = JSON.stringify;

module.exports = function (fn) {
    var keys = [];
    var wkey;
    var cacheKeys = Object.keys(cache);
    
    for (var i = 0, l = cacheKeys.length; i < l; i++) {
        var key = cacheKeys[i];
        if (cache[key].exports === fn) {
            wkey = key;
            break;
        }
    }
    
    if (!wkey) {
        wkey = Math.floor(Math.pow(16, 8) * Math.random()).toString(16);
        var wcache = {};
        for (var i = 0, l = cacheKeys.length; i < l; i++) {
            var key = cacheKeys[i];
            wcache[key] = key;
        }
        sources[wkey] = [
            Function(['require','module','exports'], '(' + fn + ')(self)'),
            wcache
        ];
    }
    var skey = Math.floor(Math.pow(16, 8) * Math.random()).toString(16);
    
    var scache = {}; scache[wkey] = wkey;
    sources[skey] = [
        Function(['require'],'require(' + stringify(wkey) + ')(self)'),
        scache
    ];
    
    var src = '(' + bundleFn + ')({'
        + Object.keys(sources).map(function (key) {
            return stringify(key) + ':['
                + sources[key][0]
                + ',' + stringify(sources[key][1]) + ']'
            ;
        }).join(',')
        + '},{},[' + stringify(skey) + '])'
    ;
    
    var URL = window.URL || window.webkitURL || window.mozURL || window.msURL;
    
    return new Worker(URL.createObjectURL(
        new Blob([src], { type: 'text/javascript' })
    ));
};

},{}],23:[function(require,module,exports){
var graph = require('ngraph.graph')();
var nodePositions = {};

var createLayout = function (graph) {
    var layout = require('ngraph.forcelayout'),
        physics = require('ngraph.physics.simulator');

    return layout(graph, physics({
        springLength: 30,
        springCoeff: 0.0001,
        dragCoeff: 0.01,
        gravity: -0.5,
        theta: 0.5
    }));
};

module.exports = function (self) {
    var _jNodeIds = {};
    var layout = createLayout(graph);

    self.addEventListener('message', function (ev) {
        var data = ev.data.jsonData;

        data.nodes.forEach(function (jNode, i) {
            //_nodesById[node.id] = node;
            var vNode = graph.addNode(jNode.id);
            _jNodeIds[vNode.id] = jNode.id;
        });
        data.edges.forEach(function (edge, i) {
            //if (edge.weight < 6) return;
            graph.addLink(edge.source, edge.target, {connectionStrength: edge.weight});
        });

        graph.forEachNode(function (node) {
            nodePositions[_jNodeIds[node.id]] = layout.getNodePosition(node.id);
        });

        var iterations = parseInt(ev.data.iterations); // ev.data=4 from main.js

        for (var i = 0; i < iterations; i++) {
            layout.step();
            if (i % ev.data.stepsPerMessage === 0) {
                //because the layout can happen much faster than the render loop, reduce overhead by not passing every loop
                self.postMessage({i: i, nodePositions: nodePositions});
            }
        }
        self.postMessage({i: iterations, nodePositions: nodePositions});
    });

};


},{"ngraph.forcelayout":5,"ngraph.graph":8,"ngraph.physics.simulator":10}]},{},[1])(1)
});
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsIm1vZHVsZXMvQW5pbWF0aW9uSGVscGVyLmpzIiwibW9kdWxlcy9Ob2RlTW92ZXIuanMiLCJtb2R1bGVzL1BpeGlHcmFwaGljcy5qcyIsIm5vZGVfbW9kdWxlcy9uZ3JhcGguZm9yY2VsYXlvdXQvaW5kZXguanMiLCJub2RlX21vZHVsZXMvbmdyYXBoLmZvcmNlbGF5b3V0L25vZGVfbW9kdWxlcy9uZ3JhcGgucGh5c2ljcy5wcmltaXRpdmVzL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL25ncmFwaC5mb3JjZWxheW91dC9ub2RlX21vZHVsZXMvbmdyYXBoLnJhbmRvbS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9uZ3JhcGguZ3JhcGgvaW5kZXguanMiLCJub2RlX21vZHVsZXMvbmdyYXBoLmdyYXBoL25vZGVfbW9kdWxlcy9uZ3JhcGguZXZlbnRzL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL25ncmFwaC5waHlzaWNzLnNpbXVsYXRvci9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9uZ3JhcGgucGh5c2ljcy5zaW11bGF0b3IvbGliL2RyYWdGb3JjZS5qcyIsIm5vZGVfbW9kdWxlcy9uZ3JhcGgucGh5c2ljcy5zaW11bGF0b3IvbGliL2V1bGVySW50ZWdyYXRvci5qcyIsIm5vZGVfbW9kdWxlcy9uZ3JhcGgucGh5c2ljcy5zaW11bGF0b3IvbGliL2V4cG9zZVByb3BlcnRpZXMuanMiLCJub2RlX21vZHVsZXMvbmdyYXBoLnBoeXNpY3Muc2ltdWxhdG9yL2xpYi9zcHJpbmcuanMiLCJub2RlX21vZHVsZXMvbmdyYXBoLnBoeXNpY3Muc2ltdWxhdG9yL2xpYi9zcHJpbmdGb3JjZS5qcyIsIm5vZGVfbW9kdWxlcy9uZ3JhcGgucGh5c2ljcy5zaW11bGF0b3Ivbm9kZV9tb2R1bGVzL25ncmFwaC5tZXJnZS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9uZ3JhcGgucGh5c2ljcy5zaW11bGF0b3Ivbm9kZV9tb2R1bGVzL25ncmFwaC5xdWFkdHJlZWJoL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL25ncmFwaC5waHlzaWNzLnNpbXVsYXRvci9ub2RlX21vZHVsZXMvbmdyYXBoLnF1YWR0cmVlYmgvaW5zZXJ0U3RhY2suanMiLCJub2RlX21vZHVsZXMvbmdyYXBoLnBoeXNpY3Muc2ltdWxhdG9yL25vZGVfbW9kdWxlcy9uZ3JhcGgucXVhZHRyZWViaC9pc1NhbWVQb3NpdGlvbi5qcyIsIm5vZGVfbW9kdWxlcy9uZ3JhcGgucGh5c2ljcy5zaW11bGF0b3Ivbm9kZV9tb2R1bGVzL25ncmFwaC5xdWFkdHJlZWJoL25vZGUuanMiLCJub2RlX21vZHVsZXMvd2Vid29ya2lmeS9pbmRleC5qcyIsIndvcmtlcnMvbGF5b3V0LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6VEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4aUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdk1BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaFJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDOUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsInZhciB3b3JrID0gcmVxdWlyZSgnd2Vid29ya2lmeScpO1xudmFyIHcgPSB3b3JrKHJlcXVpcmUoJy4vd29ya2Vycy9sYXlvdXQnKSk7XG52YXIgTm9kZU1vdmVyID0gcmVxdWlyZSgnLi9tb2R1bGVzL05vZGVNb3ZlcicpLk5vZGVNb3ZlcjtcbnZhciBQaXhpR3JhcGhpY3MgPSByZXF1aXJlKCcuL21vZHVsZXMvUGl4aUdyYXBoaWNzJykuUGl4aUdyYXBoaWNzO1xuXG5tb2R1bGUuZXhwb3J0cy5tYWluID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBfbGF5b3V0SXRlcmF0aW9ucyA9IDEwMDA7XG4gICAgdmFyIF9sYXlvdXRTdGVwc1Blck1lc3NhZ2UgPSAyNTtcblxuICAgIC8vLS1zaW1wbGUgZnJhbWUtcmF0ZSBkaXNwbGF5IGZvciByZW5kZXJzIHZzIGxheW91dHNcbiAgICB2YXIgX2NvdW50cyA9IHtyZW5kZXJzOiAwLCBsYXlvdXRzOiAwLCByZW5kZXJSYXRlOiAwLCBsYXlvdXRSYXRlOiAwfTtcbiAgICB2YXIgJGluZm8gPSAkKCc8ZGl2PicpLmFwcGVuZFRvKCdib2R5Jyk7XG4gICAgdmFyIHN0YXJ0VGltZSA9IG5ldyBEYXRlKCk7XG5cbiAgICB2YXIgX3VwZGF0ZUluZm8gPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBlbmRUaW1lID0gbmV3IERhdGUoKTtcbiAgICAgICAgdmFyIHRpbWVEaWZmID0gKGVuZFRpbWUgLSBzdGFydFRpbWUpIC8gMTAwMDtcblxuICAgICAgICBpZiAoX2NvdW50cy5sYXlvdXRzIDwgX2xheW91dEl0ZXJhdGlvbnMpIHtcbiAgICAgICAgICAgIF9jb3VudHMubGF5b3V0UmF0ZSA9IF9jb3VudHMubGF5b3V0cyAvIHRpbWVEaWZmO1xuICAgICAgICB9XG4gICAgICAgIF9jb3VudHMucmVuZGVyUmF0ZSA9IF9jb3VudHMucmVuZGVycyAvIHRpbWVEaWZmO1xuICAgICAgICAkaW5mby50ZXh0KCdSZW5kZXJzOiAnICsgX2NvdW50cy5yZW5kZXJzICsgJyAoJyArIE1hdGgucm91bmQoX2NvdW50cy5yZW5kZXJSYXRlKSArICcpIHwgTGF5b3V0czogJyArIF9jb3VudHMubGF5b3V0cyArICcgKCcgKyBNYXRoLnJvdW5kKF9jb3VudHMubGF5b3V0UmF0ZSkgKyAnKScpO1xuICAgIH07XG5cbiAgICB2YXIgX25vZGVNb3ZlcnMgPSB7fTtcblxuICAgICQuZ2V0SlNPTignZGF0YS9ncmFwaC5qc29uJywgZnVuY3Rpb24gKGpzb25EYXRhKSB7XG4gICAgICAgIGpzb25EYXRhLm5vZGVzLmZvckVhY2goZnVuY3Rpb24gKG5vZGUsIGkpIHtcbiAgICAgICAgICAgIHZhciBub2RlTW92ZXIgPSBuZXcgTm9kZU1vdmVyKCk7XG4gICAgICAgICAgICBub2RlTW92ZXIuZGF0YSgnaWQnLCBub2RlLmlkKTtcbiAgICAgICAgICAgIF9ub2RlTW92ZXJzW25vZGUuaWRdID0gbm9kZU1vdmVyO1xuICAgICAgICB9KTtcblxuICAgICAgICB2YXIgX2xheW91dFBvc2l0aW9ucyA9IHt9O1xuICAgICAgICB3LmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBmdW5jdGlvbiAoZXYpIHtcbiAgICAgICAgICAgIF9sYXlvdXRQb3NpdGlvbnMgPSBldi5kYXRhO1xuICAgICAgICAgICAgX2NvdW50cy5sYXlvdXRzID0gX2xheW91dFBvc2l0aW9ucy5pO1xuICAgICAgICB9KTtcbiAgICAgICAgdy5wb3N0TWVzc2FnZSh7anNvbkRhdGE6IGpzb25EYXRhLCBpdGVyYXRpb25zOiBfbGF5b3V0SXRlcmF0aW9ucywgc3RlcHNQZXJNZXNzYWdlOiBfbGF5b3V0U3RlcHNQZXJNZXNzYWdlfSk7IC8vIHdoZW4gdGhlIHdvcmtlciBpcyByZWFkeSwga2ljayB0aGluZ3Mgb2ZmXG5cbiAgICAgICAgdmFyIGdyYXBoaWNzID0gbmV3IFBpeGlHcmFwaGljcygwLjc1LCBqc29uRGF0YSwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgJC5lYWNoKF9ub2RlTW92ZXJzLCBmdW5jdGlvbiAoaWQsIG5vZGVNb3Zlcikge1xuICAgICAgICAgICAgICAgIGlmIChfbGF5b3V0UG9zaXRpb25zLm5vZGVQb3NpdGlvbnMpIHtcbiAgICAgICAgICAgICAgICAgICAgbm9kZU1vdmVyLnBvc2l0aW9uKF9sYXlvdXRQb3NpdGlvbnMubm9kZVBvc2l0aW9uc1tpZF0pO1xuICAgICAgICAgICAgICAgICAgICBub2RlTW92ZXIuYW5pbWF0ZSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIF9ub2RlTW92ZXJzO1xuICAgICAgICB9KTtcblxuICAgICAgICBmdW5jdGlvbiByZW5kZXJGcmFtZSgpIHtcbiAgICAgICAgICAgIGdyYXBoaWNzLnJlbmRlckZyYW1lKCk7XG4gICAgICAgICAgICBfY291bnRzLnJlbmRlcnMrKztcbiAgICAgICAgICAgIF91cGRhdGVJbmZvKCk7XG4gICAgICAgICAgICByZXF1ZXN0QW5pbUZyYW1lKHJlbmRlckZyYW1lKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGJlZ2luIGFuaW1hdGlvbiBsb29wOlxuICAgICAgICByZW5kZXJGcmFtZSgpO1xuICAgIH0pO1xufTtcbiIsIi8vcmVnaW9uIG5wbSBtb2R1bGVzXG5cbi8vZW5kcmVnaW9uXG4vL3JlZ2lvbiBtb2R1bGVzXG5cbi8vZW5kcmVnaW9uXG5cbi8qKlxuIEBjbGFzcyBBbmltYXRpb25IZWxwZXJcbiAqL1xuQW5pbWF0aW9uSGVscGVyID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBfc2VsZiA9IHRoaXM7XG5cbiAgICAvL3JlZ2lvbiBwcml2YXRlIGZpZWxkcyBhbmQgbWV0aG9kc1xuICAgIC8qKiBAdHlwZSB7TnVtYmVyfSAqL1xuICAgIHZhciBfc3RlcHNUb0NhdGNoVXAgPSAyMDtcbiAgICAvKiogQHR5cGUge051bWJlcn0gKi9cbiAgICB2YXIgX21heERpc3QgPSAxMDtcblxuICAgIHZhciBfaW5pdCA9IGZ1bmN0aW9uICgpIHtcbiAgICB9O1xuXG4gICAgdmFyIF9hcHByb2FjaFRhcmdldCA9IGZ1bmN0aW9uICh0YXJnZXRWYWwsIGN1cnJlbnRWYWwpIHtcbiAgICAgICAgaWYgKHRhcmdldFZhbCA9PSBudWxsIHx8IGlzTmFOKHRhcmdldFZhbCkpIHtcbiAgICAgICAgICAgIHJldHVybiBjdXJyZW50VmFsO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjdXJyZW50VmFsID09IG51bGwgfHwgaXNOYU4oY3VycmVudFZhbCkpIHtcbiAgICAgICAgICAgIHJldHVybiB0YXJnZXRWYWw7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHRvbCA9IE1hdGgubWF4KDAuMDAwMDAxLCBNYXRoLmFicyh0YXJnZXRWYWwgLyAxMDAwMCkpOy8vYmFzZSB0b2xlcmFuY2Ugb24gc2l6ZSBvZiB0YXJnZXQuLi5cbiAgICAgICAgdmFyIGRpZmYgPSAodGFyZ2V0VmFsIC0gY3VycmVudFZhbCk7XG4gICAgICAgIGlmIChNYXRoLmFicyhkaWZmKSA8IHRvbCkgcmV0dXJuIHRhcmdldFZhbDtcbiAgICAgICAgdmFyIGRpc3QgPSBkaWZmIC8gX3N0ZXBzVG9DYXRjaFVwO1xuICAgICAgICBpZiAoZGlzdCA+IF9tYXhEaXN0KSB7XG4gICAgICAgICAgICBkaXN0ID0gX21heERpc3Q7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGRpc3QgPCAtX21heERpc3QpIHtcbiAgICAgICAgICAgIGRpc3QgPSAtX21heERpc3Q7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGN1cnJlbnRWYWwgKyBkaXN0O1xuICAgIH07XG5cbiAgICB2YXIgX3VwZGF0ZU9iaiA9IGZ1bmN0aW9uIChvYmosIHZhbE9iaikge1xuICAgICAgICBPYmplY3Qua2V5cyh2YWxPYmopLmZvckVhY2goZnVuY3Rpb24gKGspIHtcbiAgICAgICAgICAgIHZhciB2YWx1ZSA9IHZhbE9ialtrXTtcbiAgICAgICAgICAgIGlmIChvYmpba10gIT09IHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgb2JqW2tdID0gdmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICB2YXIgX3VwZGF0ZUlmQ2hhbmdlZCA9IGZ1bmN0aW9uIChzdGF0ZSwgdGFyZ2V0U3RhdGUpIHtcbiAgICAgICAgdmFyIGNTdGF0ZSA9IHt9O1xuICAgICAgICBPYmplY3Qua2V5cyhzdGF0ZSkuZm9yRWFjaChmdW5jdGlvbiAoaykge1xuICAgICAgICAgICAgY1N0YXRlW2tdID0gc3RhdGVba107XG4gICAgICAgIH0pO1xuICAgICAgICB2YXIgaGFzQ2hhbmdlID0gZmFsc2U7XG4gICAgICAgIGlmICh0YXJnZXRTdGF0ZSA9PSBudWxsKSB7XG4gICAgICAgICAgICB2YXIgZm9vID0gMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIE9iamVjdC5rZXlzKHRhcmdldFN0YXRlKS5mb3JFYWNoKGZ1bmN0aW9uIChrKSB7XG4gICAgICAgICAgICAgICAgdmFyIHZhbHVlID0gdGFyZ2V0U3RhdGVba107XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICAgICAgaGFzQ2hhbmdlID0gaGFzQ2hhbmdlIHx8IF91cGRhdGVJZkNoYW5nZWQoY1N0YXRlW2tdLCB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHZhbHVlICE9PSBjU3RhdGVba10pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGhhc0NoYW5nZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBjU3RhdGVba10gPSBfYXBwcm9hY2hUYXJnZXQodmFsdWUsIGNTdGF0ZVtrXSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBfdXBkYXRlT2JqKHN0YXRlLCBjU3RhdGUpO1xuICAgICAgICByZXR1cm4gaGFzQ2hhbmdlO1xuICAgIH07XG5cbiAgICAvL2VuZHJlZ2lvblxuXG4gICAgdGhpcy5wX3RoaXMgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBfc2VsZjtcbiAgICB9O1xuXG4gICAgLy9yZWdpb24gcHVibGljIEFQSVxuICAgIHRoaXMuYXBwbHlDaGFuZ2VzID0gZnVuY3Rpb24gKG9iaiwgdmFsT2JqKSB7XG4gICAgICAgIF91cGRhdGVPYmoob2JqLCB2YWxPYmopO1xuICAgIH07XG5cbiAgICB0aGlzLnVwZGF0ZUlmQ2hhbmdlZCA9IGZ1bmN0aW9uIChzdGF0ZSwgdGFyZ2V0U3RhdGUpIHtcbiAgICAgICAgcmV0dXJuIF91cGRhdGVJZkNoYW5nZWQoc3RhdGUsIHRhcmdldFN0YXRlKTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IFttYXhEaXN0XVxuICAgICAqIEByZXR1cm4ge051bWJlcnxBbmltYXRpb25IZWxwZXJ9XG4gICAgICovXG4gICAgdGhpcy5tYXhEaXN0ID0gZnVuY3Rpb24gKG1heERpc3QpIHtcbiAgICAgICAgaWYgKCFhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAgICAgICByZXR1cm4gX21heERpc3Q7XG4gICAgICAgIH1cbiAgICAgICAgX21heERpc3QgPSBtYXhEaXN0O1xuICAgICAgICByZXR1cm4gX3NlbGYucF90aGlzKCk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSBbc3RlcHNUb0NhdGNoVXBdXG4gICAgICogQHJldHVybiB7TnVtYmVyfEFuaW1hdGlvbkhlbHBlcn1cbiAgICAgKi9cbiAgICB0aGlzLnN0ZXBzVG9DYXRjaFVwID0gZnVuY3Rpb24gKHN0ZXBzVG9DYXRjaFVwKSB7XG4gICAgICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgICAgICAgcmV0dXJuIF9zdGVwc1RvQ2F0Y2hVcDtcbiAgICAgICAgfVxuICAgICAgICBfc3RlcHNUb0NhdGNoVXAgPSBzdGVwc1RvQ2F0Y2hVcDtcbiAgICAgICAgcmV0dXJuIF9zZWxmLnBfdGhpcygpO1xuICAgIH07XG4gICAgLy9lbmRyZWdpb25cblxuICAgIF9pbml0KCk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cy5BbmltYXRpb25IZWxwZXIgPSBBbmltYXRpb25IZWxwZXI7XG5cbiIsIi8vcmVnaW9uIG5wbSBtb2R1bGVzXG5cbi8vZW5kcmVnaW9uXG4vL3JlZ2lvbiBtb2R1bGVzXG52YXIgQW5pbUhlbHBlciA9IHJlcXVpcmUoJy4vQW5pbWF0aW9uSGVscGVyJykuQW5pbWF0aW9uSGVscGVyO1xuLy9lbmRyZWdpb25cblxuLyoqXG4gQGNsYXNzIE5vZGVNb3ZlclxuICovXG5Ob2RlTW92ZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIF9zZWxmID0gdGhpcztcblxuICAgIC8vcmVnaW9uIHByaXZhdGUgZmllbGRzIGFuZCBtZXRob2RzXG5cbiAgICAvKiogQHR5cGUge09iamVjdH0gKi9cbiAgICB2YXIgX2N1cnJlbnRTdGF0ZTtcbiAgICAvKiogQHR5cGUge09iamVjdH0gKi9cbiAgICB2YXIgX3RhcmdldFN0YXRlID0ge1xuICAgICAgICBhbHBoYTogMSxcbiAgICAgICAgcG9zaXRpb246IHt4OiAwLCB5OiAwfSxcbiAgICAgICAgcmFkaXVzOiAxMFxuICAgIH07XG5cbiAgICAvKiogQHR5cGUge09iamVjdH0gKi9cbiAgICB2YXIgX2RhdGEgPSB7fTtcblxuICAgIHZhciBfYW5pbUhlbHBlciA9IG5ldyBBbmltSGVscGVyKCk7XG5cbiAgICB2YXIgX2luaXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIF9jdXJyZW50U3RhdGUgPSBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KF90YXJnZXRTdGF0ZSkpO1xuICAgIH07XG5cbiAgICAvL2VuZHJlZ2lvblxuXG4gICAgdGhpcy5wX3RoaXMgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBfc2VsZjtcbiAgICB9O1xuXG4gICAgLy9yZWdpb24gcHVibGljIEFQSVxuICAgIHRoaXMucmVuZGVyUG9zaXRpb24gPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgcmV0dXJuIF9jdXJyZW50U3RhdGUucG9zaXRpb247XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbcG9zaXRpb25dXG4gICAgICogQHJldHVybiB7T2JqZWN0fE5vZGVNb3Zlcn1cbiAgICAgKi9cbiAgICB0aGlzLnBvc2l0aW9uID0gZnVuY3Rpb24gKHBvc2l0aW9uKSB7XG4gICAgICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgICAgICAgcmV0dXJuIF90YXJnZXRTdGF0ZS5wb3NpdGlvbjtcbiAgICAgICAgfVxuICAgICAgICBfdGFyZ2V0U3RhdGUucG9zaXRpb24gPSBwb3NpdGlvbjtcbiAgICAgICAgcmV0dXJuIF9zZWxmLnBfdGhpcygpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge051bWJlcn0gW3JhZGl1c11cbiAgICAgKiBAcmV0dXJuIHtOdW1iZXJ8Tm9kZU1vdmVyfVxuICAgICAqL1xuICAgIHRoaXMucmFkaXVzID0gZnVuY3Rpb24gKHJhZGl1cykge1xuICAgICAgICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHJldHVybiBfdGFyZ2V0U3RhdGUucmFkaXVzO1xuICAgICAgICB9XG4gICAgICAgIF90YXJnZXRTdGF0ZS5yYWRpdXMgPSByYWRpdXM7XG4gICAgICAgIHJldHVybiBfc2VsZi5wX3RoaXMoKTtcbiAgICB9O1xuXG4gICAgdGhpcy5hbmltYXRlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgY2hhbmdlcyA9IF9hbmltSGVscGVyLnVwZGF0ZUlmQ2hhbmdlZChfY3VycmVudFN0YXRlLCBfdGFyZ2V0U3RhdGUpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gcHJvcFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbZGF0YV1cbiAgICAgKiBAcmV0dXJuIHtPYmplY3R8Tm9kZU1vdmVyfVxuICAgICAqL1xuICAgIHRoaXMuZGF0YSA9IGZ1bmN0aW9uIChwcm9wLCBkYXRhKSB7XG4gICAgICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgdGhyb3cgJ0RhdGEgcHJvcGVydHkgbXVzdCBiZSBzcGVjaWZpZWQnO1xuICAgICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgICAgcmV0dXJuIF9kYXRhW3Byb3BdO1xuICAgICAgICB9XG4gICAgICAgIF9kYXRhW3Byb3BdID0gZGF0YTtcbiAgICAgICAgcmV0dXJuIF9zZWxmLnBfdGhpcygpO1xuICAgIH07XG5cbiAgICAvL2VuZHJlZ2lvblxuXG4gICAgX2luaXQoKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzLk5vZGVNb3ZlciA9IE5vZGVNb3ZlcjtcblxuIiwiLy9yZWdpb24gbnBtIG1vZHVsZXNcblxuLy9lbmRyZWdpb25cbi8vcmVnaW9uIG1vZHVsZXNcblxuLy9lbmRyZWdpb25cblxuLyoqXG4gQGNsYXNzIFBpeGlHcmFwaGljc1xuICovXG5QaXhpR3JhcGhpY3MgPSBmdW5jdGlvbiAoc2NhbGUsIGdyYXBoRGF0YSwgbGF5b3V0Rm4pIHtcbiAgICB2YXIgX3NlbGYgPSB0aGlzO1xuXG4gICAgLy9yZWdpb24gcHJpdmF0ZSBmaWVsZHMgYW5kIG1ldGhvZHNcbiAgICB2YXIgX2dyYXBoaWNzO1xuICAgIHZhciBfcmVuZGVyZXI7XG4gICAgdmFyIF9zdGFnZTtcblxuICAgIHZhciBfaW5pdCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIHdpZHRoID0gd2luZG93LmlubmVyV2lkdGgsXG4gICAgICAgICAgICBoZWlnaHQgPSB3aW5kb3cuaW5uZXJIZWlnaHQ7XG5cbiAgICAgICAgX3N0YWdlID0gbmV3IFBJWEkuU3RhZ2UoMHg2NjY2NjYsIHRydWUpO1xuICAgICAgICBfc3RhZ2Uuc2V0SW50ZXJhY3RpdmUodHJ1ZSk7XG5cbiAgICAgICAgX3JlbmRlcmVyID0gUElYSS5hdXRvRGV0ZWN0UmVuZGVyZXIod2lkdGgsIGhlaWdodCwgbnVsbCwgZmFsc2UsIHRydWUpO1xuICAgICAgICBfcmVuZGVyZXIudmlldy5zdHlsZS5kaXNwbGF5ID0gXCJibG9ja1wiO1xuICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKF9yZW5kZXJlci52aWV3KTtcblxuICAgICAgICBfZ3JhcGhpY3MgPSBuZXcgUElYSS5HcmFwaGljcygpO1xuICAgICAgICBfZ3JhcGhpY3MucG9zaXRpb24ueCA9IHdpZHRoIC8gMjtcbiAgICAgICAgX2dyYXBoaWNzLnBvc2l0aW9uLnkgPSBoZWlnaHQgLyAyO1xuICAgICAgICBfZ3JhcGhpY3Muc2NhbGUueCA9IHNjYWxlO1xuICAgICAgICBfZ3JhcGhpY3Muc2NhbGUueSA9IHNjYWxlO1xuICAgICAgICBfc3RhZ2UuYWRkQ2hpbGQoX2dyYXBoaWNzKTtcbiAgICB9O1xuXG4gICAgdmFyIF90b1JHQiA9IGZ1bmN0aW9uIChoZXgpIHtcbiAgICAgICAgdmFyIHJlc3VsdCA9IC9eIz8oW2EtZlxcZF17Mn0pKFthLWZcXGRdezJ9KShbYS1mXFxkXXsyfSkkL2kuZXhlYyhoZXgpO1xuICAgICAgICByZXR1cm4gcmVzdWx0ID8ge1xuICAgICAgICAgICAgcjogcGFyc2VJbnQocmVzdWx0WzFdLCAxNiksXG4gICAgICAgICAgICBnOiBwYXJzZUludChyZXN1bHRbMl0sIDE2KSxcbiAgICAgICAgICAgIGI6IHBhcnNlSW50KHJlc3VsdFszXSwgMTYpXG4gICAgICAgIH0gOiBudWxsO1xuICAgIH07XG5cbiAgICB2YXIgX3RvRGVjQ29sb3IgPSBmdW5jdGlvbiAoY29sb3IpIHtcbiAgICAgICAgcmV0dXJuIChjb2xvci5yIDw8IDE2KSArIChjb2xvci5nIDw8IDgpICsgKGNvbG9yLmIpO1xuICAgIH07XG5cbiAgICB2YXIgX2VkZ2VzID0gZ3JhcGhEYXRhLmVkZ2VzO1xuICAgIHZhciBfbm9kZXNCeUlkID0ge307XG5cbiAgICAkLmVhY2goZ3JhcGhEYXRhLm5vZGVzLCBmdW5jdGlvbiAoaSwgbm9kZSkge1xuICAgICAgICBfbm9kZXNCeUlkW25vZGUuaWRdID0gbm9kZTtcbiAgICAgICAgbm9kZS5kZWNDb2xvciA9IF90b0RlY0NvbG9yKF90b1JHQihub2RlLmNvbG9yKSk7XG4gICAgfSk7XG5cbiAgICB2YXIgX2RyYXdHcmFwaCA9IGZ1bmN0aW9uIChncmFwaGljcywgbm9kZU1vdmVycykge1xuICAgICAgICAvLyBObyBtYWdpYyBhdCBhbGw6IEl0ZXJhdGUgb3ZlciBwb3NpdGlvbnMgYXJyYXkgYW5kIHJlbmRlciBub2Rlcy9saW5rc1xuICAgICAgICBncmFwaGljcy5jbGVhcigpO1xuICAgICAgICB2YXIgaSwgeCwgeSwgeDEsIHkxO1xuXG4gICAgICAgIGdyYXBoaWNzLmxpbmVTdHlsZSg1LCAweDMzMDBGRiwgMC4yNSk7XG4gICAgICAgICQuZWFjaChfZWRnZXMsIGZ1bmN0aW9uIChpLCBlZGdlKSB7XG4gICAgICAgICAgICB2YXIgc291cmNlUG9zID0gbm9kZU1vdmVyc1tlZGdlLnNvdXJjZV0ucmVuZGVyUG9zaXRpb24oKTtcbiAgICAgICAgICAgIHZhciB0YXJnZXRQb3MgPSBub2RlTW92ZXJzW2VkZ2UudGFyZ2V0XS5yZW5kZXJQb3NpdGlvbigpO1xuXG4gICAgICAgICAgICBncmFwaGljcy5tb3ZlVG8oc291cmNlUG9zLngsIHNvdXJjZVBvcy55KTtcbiAgICAgICAgICAgIGdyYXBoaWNzLmxpbmVUbyh0YXJnZXRQb3MueCwgdGFyZ2V0UG9zLnkpO1xuICAgICAgICB9KTtcblxuICAgICAgICAkLmVhY2goX2VkZ2VzLCBmdW5jdGlvbiAoaSwgZWRnZSkge1xuICAgICAgICAgICAgdmFyIHNvdXJjZVBvcyA9IG5vZGVNb3ZlcnNbZWRnZS5zb3VyY2VdLnJlbmRlclBvc2l0aW9uKCk7XG4gICAgICAgICAgICB2YXIgdGFyZ2V0UG9zID0gbm9kZU1vdmVyc1tlZGdlLnRhcmdldF0ucmVuZGVyUG9zaXRpb24oKTtcblxuICAgICAgICAgICAgZ3JhcGhpY3MubGluZVN0eWxlKDIsIF9ub2Rlc0J5SWRbZWRnZS5zb3VyY2VdLmRlY0NvbG9yLCAwLjg1KTtcblxuICAgICAgICAgICAgZ3JhcGhpY3MubW92ZVRvKHNvdXJjZVBvcy54LCBzb3VyY2VQb3MueSk7XG4gICAgICAgICAgICBncmFwaGljcy5saW5lVG8odGFyZ2V0UG9zLngsIHRhcmdldFBvcy55KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgZ3JhcGhpY3MubGluZVN0eWxlKDQsIDB4MzMwMEZGLCAwLjI1KTtcbiAgICAgICAgJC5lYWNoKG5vZGVNb3ZlcnMsIGZ1bmN0aW9uIChpLCBub2RlTW92ZXIpIHtcbiAgICAgICAgICAgIHZhciBub2RlID0gX25vZGVzQnlJZFtub2RlTW92ZXIuZGF0YSgnaWQnKV07XG4gICAgICAgICAgICBncmFwaGljcy5iZWdpbkZpbGwobm9kZS5kZWNDb2xvcik7XG4gICAgICAgICAgICB2YXIgcG9zID0gbm9kZU1vdmVyLnJlbmRlclBvc2l0aW9uKCk7XG4gICAgICAgICAgICB2YXIgciA9IG5vZGVNb3Zlci5yYWRpdXMoKTtcblxuICAgICAgICAgICAgaWYgKG5vZGUuc2hhcGUgPT09ICdjaXJjbGUnKSB7XG4gICAgICAgICAgICAgICAgZ3JhcGhpY3MuZHJhd0NpcmNsZShwb3MueCwgcG9zLnksIHIpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB4ID0gcG9zLnggLSByIC8gMjtcbiAgICAgICAgICAgICAgICB5ID0gcG9zLnkgLSByIC8gMjtcbiAgICAgICAgICAgICAgICBncmFwaGljcy5kcmF3UmVjdCh4LCB5LCByLCByKTsvL25vdCByZWFsbHkgcmFkaXVzLCBidXQgd2Ugd2FudCBzbWFsbGVyIHJlY3RhbmdsZXMgaGVyZS4uLlxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9O1xuICAgIC8vZW5kcmVnaW9uXG5cbiAgICAvL3JlZ2lvbiBwdWJsaWMgQVBJXG4gICAgdGhpcy5yZW5kZXJGcmFtZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIG5vZGVNb3ZlcnMgPSBsYXlvdXRGbigpO1xuICAgICAgICBpZiAobm9kZU1vdmVycykge1xuICAgICAgICAgICAgX2RyYXdHcmFwaChfZ3JhcGhpY3MsIG5vZGVNb3ZlcnMpO1xuICAgICAgICB9XG4gICAgICAgIF9yZW5kZXJlci5yZW5kZXIoX3N0YWdlKTtcbiAgICB9O1xuICAgIC8vZW5kcmVnaW9uXG5cbiAgICBfaW5pdCgpO1xufTtcblxubW9kdWxlLmV4cG9ydHMuUGl4aUdyYXBoaWNzID0gUGl4aUdyYXBoaWNzO1xuXG4iLCJtb2R1bGUuZXhwb3J0cyA9IGNyZWF0ZUxheW91dDtcblxuLy8gTWF4aW11bSBtb3ZlbWVudCBvZiB0aGUgc3lzdGVtIGF0IHdoaWNoIHN5c3RlbSBzaG91bGQgYmUgY29uc2lkZXJlZCBhcyBzdGFibGVcbnZhciBNQVhfTU9WRU1FTlQgPSAwLjAwMTsgXG5cbi8qKlxuICogQ3JlYXRlcyBmb3JjZSBiYXNlZCBsYXlvdXQgZm9yIGEgZ2l2ZW4gZ3JhcGguXG4gKiBAcGFyYW0ge25ncmFwaC5ncmFwaH0gZ3JhcGggd2hpY2ggbmVlZHMgdG8gYmUgbGF5ZWQgb3V0XG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZUxheW91dChncmFwaCwgcGh5c2ljc1NpbXVsYXRvcikge1xuICBpZiAoIWdyYXBoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdHcmFwaCBzdHJ1Y3R1cmUgY2Fubm90IGJlIHVuZGVmaW5lZCcpO1xuICB9XG5cbiAgdmFyIHJhbmRvbSA9IHJlcXVpcmUoJ25ncmFwaC5yYW5kb20nKS5yYW5kb20oNDIpLFxuICAgICAgc2ltdWxhdG9yID0gcmVxdWlyZSgnbmdyYXBoLnBoeXNpY3Muc2ltdWxhdG9yJyksXG4gICAgICBwaHlzaWNzID0gcmVxdWlyZSgnbmdyYXBoLnBoeXNpY3MucHJpbWl0aXZlcycpO1xuXG4gIHBoeXNpY3NTaW11bGF0b3IgPSBwaHlzaWNzU2ltdWxhdG9yIHx8IHNpbXVsYXRvcigpO1xuXG4gIHZhciBub2RlQm9kaWVzID0ge30sXG4gICAgICBzcHJpbmdzID0ge30sXG4gICAgICBncmFwaFJlY3QgPSB7IHgxOiAwLCB5MTogMCwgeDI6IDAsIHkyOiAwIH07XG5cbiAgLy8gSW5pdGlhbGl6ZSBwaHlzaWNhbCBvYmplY3RzIGFjY29yZGluZyB0byB3aGF0IHdlIGhhdmUgaW4gdGhlIGdyYXBoOlxuICBpbml0UGh5c2ljcygpO1xuICBsaXN0ZW5Ub0dyYXBoRXZlbnRzKCk7XG5cbiAgcmV0dXJuIHtcbiAgICAvKipcbiAgICAgKiBQZXJmb3JtcyBvbmUgc3RlcCBvZiBpdGVyYXRpdmUgbGF5b3V0IGFsZ29yaXRobVxuICAgICAqL1xuICAgIHN0ZXA6IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHRvdGFsTW92ZW1lbnQgPSBwaHlzaWNzU2ltdWxhdG9yLnN0ZXAoKTtcbiAgICAgIHVwZGF0ZUdyYXBoUmVjdCgpO1xuXG4gICAgICByZXR1cm4gdG90YWxNb3ZlbWVudCA8IE1BWF9NT1ZFTUVOVDtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogRm9yIGEgZ2l2ZW4gYG5vZGVJZGAgcmV0dXJucyBwb3NpdGlvblxuICAgICAqL1xuICAgIGdldE5vZGVQb3NpdGlvbjogZnVuY3Rpb24gKG5vZGVJZCkge1xuICAgICAgcmV0dXJuIGdldEluaXRpYWxpemVkQm9keShub2RlSWQpLnBvcztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHJldHVybnMge09iamVjdH0gTGluayBwb3NpdGlvbiBieSBsaW5rIGlkXG4gICAgICogQHJldHVybnMge09iamVjdC5mcm9tfSB7eCwgeX0gY29vcmRpbmF0ZXMgb2YgbGluayBzdGFydFxuICAgICAqIEByZXR1cm5zIHtPYmplY3QudG99IHt4LCB5fSBjb29yZGluYXRlcyBvZiBsaW5rIGVuZFxuICAgICAqL1xuICAgIGdldExpbmtQb3NpdGlvbjogZnVuY3Rpb24gKGxpbmtJZCkge1xuICAgICAgdmFyIHNwcmluZyA9IHNwcmluZ3NbbGlua0lkXTtcbiAgICAgIGlmIChzcHJpbmcpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBmcm9tOiBzcHJpbmcuZnJvbS5wb3MsXG4gICAgICAgICAgdG86IHNwcmluZy50by5wb3NcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHJldHVybnMge09iamVjdH0gYXJlYSByZXF1aXJlZCB0byBmaXQgaW4gdGhlIGdyYXBoLiBPYmplY3QgY29udGFpbnNcbiAgICAgKiBgeDFgLCBgeTFgIC0gdG9wIGxlZnQgY29vcmRpbmF0ZXNcbiAgICAgKiBgeDJgLCBgeTJgIC0gYm90dG9tIHJpZ2h0IGNvb3JkaW5hdGVzXG4gICAgICovXG4gICAgZ2V0R3JhcGhSZWN0OiBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gZ3JhcGhSZWN0O1xuICAgIH0sXG5cbiAgICAvKlxuICAgICAqIFJlcXVlc3RzIGxheW91dCBhbGdvcml0aG0gdG8gcGluL3VucGluIG5vZGUgdG8gaXRzIGN1cnJlbnQgcG9zaXRpb25cbiAgICAgKiBQaW5uZWQgbm9kZXMgc2hvdWxkIG5vdCBiZSBhZmZlY3RlZCBieSBsYXlvdXQgYWxnb3JpdGhtIGFuZCBhbHdheXNcbiAgICAgKiByZW1haW4gYXQgdGhlaXIgcG9zaXRpb25cbiAgICAgKi9cbiAgICBwaW5Ob2RlOiBmdW5jdGlvbiAobm9kZSwgaXNQaW5uZWQpIHtcbiAgICAgIHZhciBib2R5ID0gZ2V0SW5pdGlhbGl6ZWRCb2R5KG5vZGUuaWQpO1xuICAgICAgIGJvZHkuaXNQaW5uZWQgPSAhIWlzUGlubmVkO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBDaGVja3Mgd2hldGhlciBnaXZlbiBncmFwaCdzIG5vZGUgaXMgY3VycmVudGx5IHBpbm5lZFxuICAgICAqL1xuICAgIGlzTm9kZVBpbm5lZDogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICAgIHJldHVybiBnZXRJbml0aWFsaXplZEJvZHkobm9kZS5pZCkuaXNQaW5uZWQ7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJlcXVlc3QgdG8gcmVsZWFzZSBhbGwgcmVzb3VyY2VzXG4gICAgICovXG4gICAgZGlzcG9zZTogZnVuY3Rpb24oKSB7XG4gICAgICBncmFwaC5vZmYoJ2NoYW5nZWQnLCBvbkdyYXBoQ2hhbmdlZCk7XG4gICAgfVxuICB9O1xuXG4gIGZ1bmN0aW9uIGxpc3RlblRvR3JhcGhFdmVudHMoKSB7XG4gICAgZ3JhcGgub24oJ2NoYW5nZWQnLCBvbkdyYXBoQ2hhbmdlZCk7XG4gIH1cblxuICBmdW5jdGlvbiBvbkdyYXBoQ2hhbmdlZChjaGFuZ2VzKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjaGFuZ2VzLmxlbmd0aDsgKytpKSB7XG4gICAgICB2YXIgY2hhbmdlID0gY2hhbmdlc1tpXTtcbiAgICAgIGlmIChjaGFuZ2UuY2hhbmdlVHlwZSA9PT0gJ2FkZCcpIHtcbiAgICAgICAgaWYgKGNoYW5nZS5ub2RlKSB7XG4gICAgICAgICAgaW5pdEJvZHkoY2hhbmdlLm5vZGUuaWQpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaGFuZ2UubGluaykge1xuICAgICAgICAgIGluaXRMaW5rKGNoYW5nZS5saW5rKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChjaGFuZ2UuY2hhbmdlVHlwZSA9PT0gJ3JlbW92ZScpIHtcbiAgICAgICAgaWYgKGNoYW5nZS5ub2RlKSB7XG4gICAgICAgICAgcmVsZWFzZU5vZGUoY2hhbmdlLm5vZGUpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaGFuZ2UubGluaykge1xuICAgICAgICAgIHJlbGVhc2VMaW5rKGNoYW5nZS5saW5rKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGluaXRQaHlzaWNzKCkge1xuICAgIGdyYXBoLmZvckVhY2hOb2RlKGZ1bmN0aW9uIChub2RlKSB7XG4gICAgICBpbml0Qm9keShub2RlLmlkKTtcbiAgICB9KTtcbiAgICBncmFwaC5mb3JFYWNoTGluayhpbml0TGluayk7XG4gIH1cblxuICBmdW5jdGlvbiBpbml0Qm9keShub2RlSWQpIHtcbiAgICB2YXIgYm9keSA9IG5vZGVCb2RpZXNbbm9kZUlkXTtcbiAgICBpZiAoIWJvZHkpIHtcbiAgICAgIHZhciBub2RlID0gZ3JhcGguZ2V0Tm9kZShub2RlSWQpO1xuICAgICAgaWYgKCFub2RlKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignaW5pdEJvZHkoKSB3YXMgY2FsbGVkIHdpdGggdW5rbm93biBub2RlIGlkJyk7XG4gICAgICB9XG5cbiAgICAgIHZhciBwb3MgPSBnZXRCZXN0SW5pdGlhbE5vZGVQb3NpdGlvbihub2RlKTtcbiAgICAgIGJvZHkgPSBuZXcgcGh5c2ljcy5Cb2R5KHBvcy54LCBwb3MueSk7XG4gICAgICAvLyB3ZSBuZWVkIHRvIGF1Z21lbnQgYm9keSB3aXRoIHByZXZpb3VzIHBvc2l0aW9uIHRvIGxldCB1c2VycyBwaW4gdGhlbVxuICAgICAgYm9keS5wcmV2UG9zID0gbmV3IHBoeXNpY3MuVmVjdG9yMmQocG9zLngsIHBvcy55KTtcblxuICAgICAgbm9kZUJvZGllc1tub2RlSWRdID0gYm9keTtcbiAgICAgIHVwZGF0ZUJvZHlNYXNzKG5vZGVJZCk7XG5cbiAgICAgIGlmIChpc05vZGVPcmlnaW5hbGx5UGlubmVkKG5vZGUpKSB7XG4gICAgICAgIGJvZHkuaXNQaW5uZWQgPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICBwaHlzaWNzU2ltdWxhdG9yLmFkZEJvZHkoYm9keSk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gcmVsZWFzZU5vZGUobm9kZSkge1xuICAgIHZhciBub2RlSWQgPSBub2RlLmlkO1xuICAgIHZhciBib2R5ID0gbm9kZUJvZGllc1tub2RlSWRdO1xuICAgIGlmIChib2R5KSB7XG4gICAgICBub2RlQm9kaWVzW25vZGVJZF0gPSBudWxsO1xuICAgICAgZGVsZXRlIG5vZGVCb2RpZXNbbm9kZUlkXTtcblxuICAgICAgcGh5c2ljc1NpbXVsYXRvci5yZW1vdmVCb2R5KGJvZHkpO1xuICAgICAgaWYgKGdyYXBoLmdldE5vZGVzQ291bnQoKSA9PT0gMCkge1xuICAgICAgICBncmFwaFJlY3QueDEgPSBncmFwaFJlY3QueTEgPSAwO1xuICAgICAgICBncmFwaFJlY3QueDIgPSBncmFwaFJlY3QueTIgPSAwO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGluaXRMaW5rKGxpbmspIHtcbiAgICB1cGRhdGVCb2R5TWFzcyhsaW5rLmZyb21JZCk7XG4gICAgdXBkYXRlQm9keU1hc3MobGluay50b0lkKTtcblxuICAgIHZhciBmcm9tQm9keSA9IG5vZGVCb2RpZXNbbGluay5mcm9tSWRdLFxuICAgICAgICB0b0JvZHkgID0gbm9kZUJvZGllc1tsaW5rLnRvSWRdLFxuICAgICAgICBzcHJpbmcgPSBwaHlzaWNzU2ltdWxhdG9yLmFkZFNwcmluZyhmcm9tQm9keSwgdG9Cb2R5LCBsaW5rLmxlbmd0aCk7XG5cbiAgICBzcHJpbmdzW2xpbmsuaWRdID0gc3ByaW5nO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVsZWFzZUxpbmsobGluaykge1xuICAgIHZhciBzcHJpbmcgPSBzcHJpbmdzW2xpbmsuaWRdO1xuICAgIGlmIChzcHJpbmcpIHtcbiAgICAgIHZhciBmcm9tID0gZ3JhcGguZ2V0Tm9kZShsaW5rLmZyb21JZCksXG4gICAgICAgICAgdG8gPSBncmFwaC5nZXROb2RlKGxpbmsudG9JZCk7XG5cbiAgICAgIGlmIChmcm9tKSB1cGRhdGVCb2R5TWFzcyhmcm9tLmlkKTtcbiAgICAgIGlmICh0bykgdXBkYXRlQm9keU1hc3ModG8uaWQpO1xuXG4gICAgICBkZWxldGUgc3ByaW5nc1tsaW5rLmlkXTtcblxuICAgICAgcGh5c2ljc1NpbXVsYXRvci5yZW1vdmVTcHJpbmcoc3ByaW5nKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBnZXRCZXN0SW5pdGlhbE5vZGVQb3NpdGlvbihub2RlKSB7XG4gICAgLy8gVE9ETzogSW5pdGlhbCBwb3NpdGlvbiBjb3VsZCBiZSBwaWNrZWQgYmV0dGVyLCBlLmcuIHRha2UgaW50b1xuICAgIC8vIGFjY291bnQgYWxsIG5laWdoYm91cmluZyBub2Rlcy9saW5rcywgbm90IG9ubHkgb25lLlxuICAgIC8vIEhvdyBhYm91dCBjZW50ZXIgb2YgbWFzcz9cbiAgICBpZiAobm9kZS5wb3NpdGlvbikge1xuICAgICAgcmV0dXJuIG5vZGUucG9zaXRpb247XG4gICAgfVxuXG4gICAgdmFyIGJhc2VYID0gKGdyYXBoUmVjdC54MSArIGdyYXBoUmVjdC54MikgLyAyLFxuICAgICAgICBiYXNlWSA9IChncmFwaFJlY3QueTEgKyBncmFwaFJlY3QueTIpIC8gMixcbiAgICAgICAgc3ByaW5nTGVuZ3RoID0gcGh5c2ljc1NpbXVsYXRvci5zcHJpbmdMZW5ndGgoKTtcblxuICAgIGlmIChub2RlLmxpbmtzICYmIG5vZGUubGlua3MubGVuZ3RoID4gMCkge1xuICAgICAgdmFyIGZpcnN0TGluayA9IG5vZGUubGlua3NbMF0sXG4gICAgICAgICAgb3RoZXJCb2R5ID0gZmlyc3RMaW5rLmZyb21JZCAhPT0gbm9kZS5pZCA/IG5vZGVCb2RpZXNbZmlyc3RMaW5rLmZyb21JZF0gOiBub2RlQm9kaWVzW2ZpcnN0TGluay50b0lkXTtcbiAgICAgIGlmIChvdGhlckJvZHkgJiYgb3RoZXJCb2R5LnBvcykge1xuICAgICAgICBiYXNlWCA9IG90aGVyQm9keS5wb3MueDtcbiAgICAgICAgYmFzZVkgPSBvdGhlckJvZHkucG9zLnk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIHg6IGJhc2VYICsgcmFuZG9tLm5leHQoc3ByaW5nTGVuZ3RoKSAtIHNwcmluZ0xlbmd0aCAvIDIsXG4gICAgICB5OiBiYXNlWSArIHJhbmRvbS5uZXh0KHNwcmluZ0xlbmd0aCkgLSBzcHJpbmdMZW5ndGggLyAyXG4gICAgfTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHVwZGF0ZUJvZHlNYXNzKG5vZGVJZCkge1xuICAgIHZhciBib2R5ID0gbm9kZUJvZGllc1tub2RlSWRdO1xuICAgIGJvZHkubWFzcyA9IG5vZGVNYXNzKG5vZGVJZCk7XG4gIH1cblxuXG4gIGZ1bmN0aW9uIHVwZGF0ZUdyYXBoUmVjdCgpIHtcbiAgICBpZiAoZ3JhcGguZ2V0Tm9kZXNDb3VudCgpID09PSAwKSB7XG4gICAgICAvLyBkb24ndCBoYXZlIHRvIHdvcnkgaGVyZS5cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgeDEgPSBOdW1iZXIuTUFYX1ZBTFVFLFxuICAgICAgICB5MSA9IE51bWJlci5NQVhfVkFMVUUsXG4gICAgICAgIHgyID0gTnVtYmVyLk1JTl9WQUxVRSxcbiAgICAgICAgeTIgPSBOdW1iZXIuTUlOX1ZBTFVFO1xuXG4gICAgLy8gdGhpcyBpcyBPKG4pLCBjb3VsZCBpdCBiZSBkb25lIGZhc3RlciB3aXRoIHF1YWR0cmVlP1xuICAgIGZvciAodmFyIGtleSBpbiBub2RlQm9kaWVzKSB7XG4gICAgICBpZiAobm9kZUJvZGllcy5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgIC8vIGhvdyBhYm91dCBwaW5uZWQgbm9kZXM/XG4gICAgICAgIHZhciBib2R5ID0gbm9kZUJvZGllc1trZXldO1xuICAgICAgICBpZiAoaXNCb2R5UGlubmVkKGJvZHkpKSB7XG4gICAgICAgICAgYm9keS5wb3MueCA9IGJvZHkucHJldlBvcy54O1xuICAgICAgICAgIGJvZHkucG9zLnkgPSBib2R5LnByZXZQb3MueTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBib2R5LnByZXZQb3MueCA9IGJvZHkucG9zLng7XG4gICAgICAgICAgYm9keS5wcmV2UG9zLnkgPSBib2R5LnBvcy55O1xuICAgICAgICB9XG4gICAgICAgIGlmIChib2R5LnBvcy54IDwgeDEpIHtcbiAgICAgICAgICB4MSA9IGJvZHkucG9zLng7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGJvZHkucG9zLnggPiB4Mikge1xuICAgICAgICAgIHgyID0gYm9keS5wb3MueDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoYm9keS5wb3MueSA8IHkxKSB7XG4gICAgICAgICAgeTEgPSBib2R5LnBvcy55O1xuICAgICAgICB9XG4gICAgICAgIGlmIChib2R5LnBvcy55ID4geTIpIHtcbiAgICAgICAgICB5MiA9IGJvZHkucG9zLnk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBncmFwaFJlY3QueDEgPSB4MTtcbiAgICBncmFwaFJlY3QueDIgPSB4MjtcbiAgICBncmFwaFJlY3QueTEgPSB5MTtcbiAgICBncmFwaFJlY3QueTIgPSB5MjtcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVja3Mgd2hldGhlciBncmFwaCBub2RlIGhhcyBpbiBpdHMgc2V0dGluZ3MgcGlubmVkIGF0dHJpYnV0ZSxcbiAgICogd2hpY2ggbWVhbnMgbGF5b3V0IGFsZ29yaXRobSBjYW5ub3QgbW92ZSBpdC4gTm9kZSBjYW4gYmUgcHJlY29uZmlndXJlZFxuICAgKiBhcyBwaW5uZWQsIGlmIGl0IGhhcyBcImlzUGlubmVkXCIgYXR0cmlidXRlLCBvciB3aGVuIG5vZGUuZGF0YSBoYXMgaXQuXG4gICAqXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBub2RlIGEgZ3JhcGggbm9kZSB0byBjaGVja1xuICAgKiBAcmV0dXJuIHtCb29sZWFufSB0cnVlIGlmIG5vZGUgc2hvdWxkIGJlIHRyZWF0ZWQgYXMgcGlubmVkOyBmYWxzZSBvdGhlcndpc2UuXG4gICAqL1xuICBmdW5jdGlvbiBpc05vZGVPcmlnaW5hbGx5UGlubmVkKG5vZGUpIHtcbiAgICByZXR1cm4gKG5vZGUgJiYgKG5vZGUuaXNQaW5uZWQgfHwgKG5vZGUuZGF0YSAmJiBub2RlLmRhdGEuaXNQaW5uZWQpKSk7XG4gIH1cblxuICAvKipcbiAgICogQ2hlY2tzIHdoZXRoZXIgZ2l2ZW4gcGh5c2ljYWwgYm9keSBzaG91bGQgYmUgdHJlYXRlZCBhcyBwaW5uZWQuIFVubGlua2VcbiAgICogYGlzTm9kZU9yaWdpbmFsbHlQaW5uZWRgIHRoaXMgb3BlcmF0ZXMgb24gYm9keSBvYmplY3QsIHdoaWNoIGlzIHNwZWNpZmljIHRvIGxheW91dFxuICAgKiBpbnN0YW5jZS4gVGh1cyB0d28gbGF5b3V0ZXJzIGNhbiBpbmRlcGVuZG50bHkgcGluIGJvZGllcywgd2hpY2ggcmVwcmVzZW50XG4gICAqIHNhbWUgbm9kZSBvZiBhIHNvdXJjZSBncmFwaC5cbiAgICpcbiAgICogQHBhcmFtIHtuZ3JhcGgucGh5c2ljcy5Cb2R5fSBib2R5IC0gYm9keSB0byBjaGVja1xuICAgKiBAcmV0dXJuIHtCb29sZWFufSB0cnVlIGlmIGJvZHkgc2hvdWxkIGJlIHRyZWF0ZWQgYXMgcGlubmVkOyBmYWxzZSBvdGhlcndpc2UuXG4gICAqL1xuICBmdW5jdGlvbiBpc0JvZHlQaW5uZWQgKGJvZHkpIHtcbiAgICByZXR1cm4gYm9keS5pc1Bpbm5lZDtcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldEluaXRpYWxpemVkQm9keShub2RlSWQpIHtcbiAgICB2YXIgYm9keSA9IG5vZGVCb2RpZXNbbm9kZUlkXTtcbiAgICBpZiAoIWJvZHkpIHtcbiAgICAgIGluaXRCb2R5KG5vZGVJZCk7XG4gICAgICBib2R5ID0gbm9kZUJvZGllc1tub2RlSWRdO1xuICAgIH1cbiAgICByZXR1cm4gYm9keTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDYWxjdWxhdGVzIG1hc3Mgb2YgYSBib2R5LCB3aGljaCBjb3JyZXNwb25kcyB0byBub2RlIHdpdGggZ2l2ZW4gaWQuXG4gICAqXG4gICAqIEBwYXJhbSB7U3RyaW5nfE51bWJlcn0gbm9kZUlkIGlkZW50aWZpZXIgb2YgYSBub2RlLCBmb3Igd2hpY2ggYm9keSBtYXNzIG5lZWRzIHRvIGJlIGNhbGN1bGF0ZWRcbiAgICogQHJldHVybnMge051bWJlcn0gcmVjb21tZW5kZWQgbWFzcyBvZiB0aGUgYm9keTtcbiAgICovXG4gIGZ1bmN0aW9uIG5vZGVNYXNzKG5vZGVJZCkge1xuICAgIHJldHVybiAxICsgZ3JhcGguZ2V0TGlua3Mobm9kZUlkKS5sZW5ndGggLyAzLjA7XG4gIH1cbn1cbiIsIm1vZHVsZS5leHBvcnRzID0ge1xuICBCb2R5OiBCb2R5LFxuICBWZWN0b3IyZDogVmVjdG9yMmRcbiAgLy8gdGhhdCdzIGl0IGZvciBub3dcbn07XG5cbmZ1bmN0aW9uIEJvZHkoeCwgeSkge1xuICB0aGlzLnBvcyA9IG5ldyBWZWN0b3IyZCh4LCB5KTtcbiAgdGhpcy5mb3JjZSA9IG5ldyBWZWN0b3IyZCgpO1xuICB0aGlzLnZlbG9jaXR5ID0gbmV3IFZlY3RvcjJkKCk7XG4gIHRoaXMubWFzcyA9IDE7XG59XG5cbmZ1bmN0aW9uIFZlY3RvcjJkKHgsIHkpIHtcbiAgdGhpcy54ID0gdHlwZW9mIHggPT09ICdudW1iZXInID8geCA6IDA7XG4gIHRoaXMueSA9IHR5cGVvZiB5ID09PSAnbnVtYmVyJyA/IHkgOiAwO1xufVxuIiwibW9kdWxlLmV4cG9ydHMgPSB7XG4gIHJhbmRvbTogcmFuZG9tLFxuICByYW5kb21JdGVyYXRvcjogcmFuZG9tSXRlcmF0b3Jcbn07XG5cbi8qKlxuICogQ3JlYXRlcyBzZWVkZWQgUFJORyB3aXRoIHR3byBtZXRob2RzOlxuICogICBuZXh0KCkgYW5kIG5leHREb3VibGUoKVxuICovXG5mdW5jdGlvbiByYW5kb20oaW5wdXRTZWVkKSB7XG4gIHZhciBzZWVkID0gdHlwZW9mIGlucHV0U2VlZCA9PT0gJ251bWJlcicgPyBpbnB1dFNlZWQgOiAoKyBuZXcgRGF0ZSgpKTtcbiAgdmFyIHJhbmRvbUZ1bmMgPSBmdW5jdGlvbigpIHtcbiAgICAgIC8vIFJvYmVydCBKZW5raW5zJyAzMiBiaXQgaW50ZWdlciBoYXNoIGZ1bmN0aW9uLlxuICAgICAgc2VlZCA9ICgoc2VlZCArIDB4N2VkNTVkMTYpICsgKHNlZWQgPDwgMTIpKSAgJiAweGZmZmZmZmZmO1xuICAgICAgc2VlZCA9ICgoc2VlZCBeIDB4Yzc2MWMyM2MpIF4gKHNlZWQgPj4+IDE5KSkgJiAweGZmZmZmZmZmO1xuICAgICAgc2VlZCA9ICgoc2VlZCArIDB4MTY1NjY3YjEpICsgKHNlZWQgPDwgNSkpICAgJiAweGZmZmZmZmZmO1xuICAgICAgc2VlZCA9ICgoc2VlZCArIDB4ZDNhMjY0NmMpIF4gKHNlZWQgPDwgOSkpICAgJiAweGZmZmZmZmZmO1xuICAgICAgc2VlZCA9ICgoc2VlZCArIDB4ZmQ3MDQ2YzUpICsgKHNlZWQgPDwgMykpICAgJiAweGZmZmZmZmZmO1xuICAgICAgc2VlZCA9ICgoc2VlZCBeIDB4YjU1YTRmMDkpIF4gKHNlZWQgPj4+IDE2KSkgJiAweGZmZmZmZmZmO1xuICAgICAgcmV0dXJuIChzZWVkICYgMHhmZmZmZmZmKSAvIDB4MTAwMDAwMDA7XG4gIH07XG5cbiAgcmV0dXJuIHtcbiAgICAgIC8qKlxuICAgICAgICogR2VuZXJhdGVzIHJhbmRvbSBpbnRlZ2VyIG51bWJlciBpbiB0aGUgcmFuZ2UgZnJvbSAwIChpbmNsdXNpdmUpIHRvIG1heFZhbHVlIChleGNsdXNpdmUpXG4gICAgICAgKlxuICAgICAgICogQHBhcmFtIG1heFZhbHVlIE51bWJlciBSRVFVSVJFRC4gT21taXR0aW5nIHRoaXMgbnVtYmVyIHdpbGwgcmVzdWx0IGluIE5hTiB2YWx1ZXMgZnJvbSBQUk5HLlxuICAgICAgICovXG4gICAgICBuZXh0IDogZnVuY3Rpb24gKG1heFZhbHVlKSB7XG4gICAgICAgICAgcmV0dXJuIE1hdGguZmxvb3IocmFuZG9tRnVuYygpICogbWF4VmFsdWUpO1xuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBHZW5lcmF0ZXMgcmFuZG9tIGRvdWJsZSBudW1iZXIgaW4gdGhlIHJhbmdlIGZyb20gMCAoaW5jbHVzaXZlKSB0byAxIChleGNsdXNpdmUpXG4gICAgICAgKiBUaGlzIGZ1bmN0aW9uIGlzIHRoZSBzYW1lIGFzIE1hdGgucmFuZG9tKCkgKGV4Y2VwdCB0aGF0IGl0IGNvdWxkIGJlIHNlZWRlZClcbiAgICAgICAqL1xuICAgICAgbmV4dERvdWJsZSA6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICByZXR1cm4gcmFuZG9tRnVuYygpO1xuICAgICAgfVxuICB9O1xufVxuXG4vKlxuICogQ3JlYXRlcyBpdGVyYXRvciBvdmVyIGFycmF5LCB3aGljaCByZXR1cm5zIGl0ZW1zIG9mIGFycmF5IGluIHJhbmRvbSBvcmRlclxuICogVGltZSBjb21wbGV4aXR5IGlzIGd1YXJhbnRlZWQgdG8gYmUgTyhuKTtcbiAqL1xuZnVuY3Rpb24gcmFuZG9tSXRlcmF0b3IoYXJyYXksIGN1c3RvbVJhbmRvbSkge1xuICAgIHZhciBsb2NhbFJhbmRvbSA9IGN1c3RvbVJhbmRvbSB8fCByYW5kb20oKTtcbiAgICBpZiAodHlwZW9mIGxvY2FsUmFuZG9tLm5leHQgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignY3VzdG9tUmFuZG9tIGRvZXMgbm90IG1hdGNoIGV4cGVjdGVkIEFQSTogbmV4dCgpIGZ1bmN0aW9uIGlzIG1pc3NpbmcnKTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBmb3JFYWNoIDogZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICAgICAgICB2YXIgaSwgaiwgdDtcbiAgICAgICAgICAgIGZvciAoaSA9IGFycmF5Lmxlbmd0aCAtIDE7IGkgPiAwOyAtLWkpIHtcbiAgICAgICAgICAgICAgICBqID0gbG9jYWxSYW5kb20ubmV4dChpICsgMSk7IC8vIGkgaW5jbHVzaXZlXG4gICAgICAgICAgICAgICAgdCA9IGFycmF5W2pdO1xuICAgICAgICAgICAgICAgIGFycmF5W2pdID0gYXJyYXlbaV07XG4gICAgICAgICAgICAgICAgYXJyYXlbaV0gPSB0O1xuXG4gICAgICAgICAgICAgICAgY2FsbGJhY2sodCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChhcnJheS5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhhcnJheVswXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNodWZmbGVzIGFycmF5IHJhbmRvbWx5LCBpbiBwbGFjZS5cbiAgICAgICAgICovXG4gICAgICAgIHNodWZmbGUgOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgaSwgaiwgdDtcbiAgICAgICAgICAgIGZvciAoaSA9IGFycmF5Lmxlbmd0aCAtIDE7IGkgPiAwOyAtLWkpIHtcbiAgICAgICAgICAgICAgICBqID0gbG9jYWxSYW5kb20ubmV4dChpICsgMSk7IC8vIGkgaW5jbHVzaXZlXG4gICAgICAgICAgICAgICAgdCA9IGFycmF5W2pdO1xuICAgICAgICAgICAgICAgIGFycmF5W2pdID0gYXJyYXlbaV07XG4gICAgICAgICAgICAgICAgYXJyYXlbaV0gPSB0O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gYXJyYXk7XG4gICAgICAgIH1cbiAgICB9O1xufVxuIiwiLyoqXG4gKiBAZmlsZU92ZXJ2aWV3IENvbnRhaW5zIGRlZmluaXRpb24gb2YgdGhlIGNvcmUgZ3JhcGggb2JqZWN0LlxuICovXG5cbi8qKlxuICogQGV4YW1wbGVcbiAqICB2YXIgZ3JhcGggPSByZXF1aXJlKCduZ3JhcGguZ3JhcGgnKSgpO1xuICogIGdyYXBoLmFkZE5vZGUoMSk7ICAgICAvLyBncmFwaCBoYXMgb25lIG5vZGUuXG4gKiAgZ3JhcGguYWRkTGluaygyLCAzKTsgIC8vIG5vdyBncmFwaCBjb250YWlucyB0aHJlZSBub2RlcyBhbmQgb25lIGxpbmsuXG4gKlxuICovXG5tb2R1bGUuZXhwb3J0cyA9IGNyZWF0ZUdyYXBoO1xuXG52YXIgZXZlbnRpZnkgPSByZXF1aXJlKCduZ3JhcGguZXZlbnRzJyk7XG5cbi8qKlxuICogQ3JlYXRlcyBhIG5ldyBncmFwaFxuICovXG5mdW5jdGlvbiBjcmVhdGVHcmFwaChvcHRpb25zKSB7XG4gIC8vIEdyYXBoIHN0cnVjdHVyZSBpcyBtYWludGFpbmVkIGFzIGRpY3Rpb25hcnkgb2Ygbm9kZXNcbiAgLy8gYW5kIGFycmF5IG9mIGxpbmtzLiBFYWNoIG5vZGUgaGFzICdsaW5rcycgcHJvcGVydHkgd2hpY2hcbiAgLy8gaG9sZCBhbGwgbGlua3MgcmVsYXRlZCB0byB0aGF0IG5vZGUuIEFuZCBnZW5lcmFsIGxpbmtzXG4gIC8vIGFycmF5IGlzIHVzZWQgdG8gc3BlZWQgdXAgYWxsIGxpbmtzIGVudW1lcmF0aW9uLiBUaGlzIGlzIGluZWZmaWNpZW50XG4gIC8vIGluIHRlcm1zIG9mIG1lbW9yeSwgYnV0IHNpbXBsaWZpZXMgY29kaW5nLlxuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgaWYgKG9wdGlvbnMudW5pcXVlTGlua0lkID09PSB1bmRlZmluZWQpIHtcbiAgICAvLyBSZXF1ZXN0IGVhY2ggbGluayBpZCB0byBiZSB1bmlxdWUgYmV0d2VlbiBzYW1lIG5vZGVzLiBUaGlzIG5lZ2F0aXZlbHlcbiAgICAvLyBpbXBhY3RzIGBhZGRMaW5rKClgIHBlcmZvcm1hbmNlIChPKG4pLCB3aGVyZSBuIC0gbnVtYmVyIG9mIGVkZ2VzIG9mIGVhY2hcbiAgICAvLyB2ZXJ0ZXgpLCBidXQgbWFrZXMgb3BlcmF0aW9ucyB3aXRoIG11bHRpZ3JhcGhzIG1vcmUgYWNjZXNzaWJsZS5cbiAgICBvcHRpb25zLnVuaXF1ZUxpbmtJZCA9IHRydWU7XG4gIH1cblxuICB2YXIgbm9kZXMgPSB0eXBlb2YgT2JqZWN0LmNyZWF0ZSA9PT0gJ2Z1bmN0aW9uJyA/IE9iamVjdC5jcmVhdGUobnVsbCkgOiB7fSxcbiAgICBsaW5rcyA9IFtdLFxuICAgIC8vIEhhc2ggb2YgbXVsdGktZWRnZXMuIFVzZWQgdG8gdHJhY2sgaWRzIG9mIGVkZ2VzIGJldHdlZW4gc2FtZSBub2Rlc1xuICAgIG11bHRpRWRnZXMgPSB7fSxcbiAgICBub2Rlc0NvdW50ID0gMCxcbiAgICBzdXNwZW5kRXZlbnRzID0gMCxcblxuICAgIGZvckVhY2hOb2RlID0gY3JlYXRlTm9kZUl0ZXJhdG9yKCksXG4gICAgY3JlYXRlTGluayA9IG9wdGlvbnMudW5pcXVlTGlua0lkID8gY3JlYXRlVW5pcXVlTGluayA6IGNyZWF0ZVNpbmdsZUxpbmssXG5cbiAgICAvLyBPdXIgZ3JhcGggQVBJIHByb3ZpZGVzIG1lYW5zIHRvIGxpc3RlbiB0byBncmFwaCBjaGFuZ2VzLiBVc2VycyBjYW4gc3Vic2NyaWJlXG4gICAgLy8gdG8gYmUgbm90aWZpZWQgYWJvdXQgY2hhbmdlcyBpbiB0aGUgZ3JhcGggYnkgdXNpbmcgYG9uYCBtZXRob2QuIEhvd2V2ZXJcbiAgICAvLyBpbiBzb21lIGNhc2VzIHRoZXkgZG9uJ3QgdXNlIGl0LiBUbyBhdm9pZCB1bm5lY2Vzc2FyeSBtZW1vcnkgY29uc3VtcHRpb25cbiAgICAvLyB3ZSB3aWxsIG5vdCByZWNvcmQgZ3JhcGggY2hhbmdlcyB1bnRpbCB3ZSBoYXZlIGF0IGxlYXN0IG9uZSBzdWJzY3JpYmVyLlxuICAgIC8vIENvZGUgYmVsb3cgc3VwcG9ydHMgdGhpcyBvcHRpbWl6YXRpb24uXG4gICAgLy9cbiAgICAvLyBBY2N1bXVsYXRlcyBhbGwgY2hhbmdlcyBtYWRlIGR1cmluZyBncmFwaCB1cGRhdGVzLlxuICAgIC8vIEVhY2ggY2hhbmdlIGVsZW1lbnQgY29udGFpbnM6XG4gICAgLy8gIGNoYW5nZVR5cGUgLSBvbmUgb2YgdGhlIHN0cmluZ3M6ICdhZGQnLCAncmVtb3ZlJyBvciAndXBkYXRlJztcbiAgICAvLyAgbm9kZSAtIGlmIGNoYW5nZSBpcyByZWxhdGVkIHRvIG5vZGUgdGhpcyBwcm9wZXJ0eSBpcyBzZXQgdG8gY2hhbmdlZCBncmFwaCdzIG5vZGU7XG4gICAgLy8gIGxpbmsgLSBpZiBjaGFuZ2UgaXMgcmVsYXRlZCB0byBsaW5rIHRoaXMgcHJvcGVydHkgaXMgc2V0IHRvIGNoYW5nZWQgZ3JhcGgncyBsaW5rO1xuICAgIGNoYW5nZXMgPSBbXSxcbiAgICByZWNvcmRMaW5rQ2hhbmdlID0gbm9vcCxcbiAgICByZWNvcmROb2RlQ2hhbmdlID0gbm9vcCxcbiAgICBlbnRlck1vZGlmaWNhdGlvbiA9IG5vb3AsXG4gICAgZXhpdE1vZGlmaWNhdGlvbiA9IG5vb3A7XG5cbiAgLy8gdGhpcyBpcyBvdXIgcHVibGljIEFQSTpcbiAgdmFyIGdyYXBoUGFydCA9IHtcbiAgICAvKipcbiAgICAgKiBBZGRzIG5vZGUgdG8gdGhlIGdyYXBoLiBJZiBub2RlIHdpdGggZ2l2ZW4gaWQgYWxyZWFkeSBleGlzdHMgaW4gdGhlIGdyYXBoXG4gICAgICogaXRzIGRhdGEgaXMgZXh0ZW5kZWQgd2l0aCB3aGF0ZXZlciBjb21lcyBpbiAnZGF0YScgYXJndW1lbnQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gbm9kZUlkIHRoZSBub2RlJ3MgaWRlbnRpZmllci4gQSBzdHJpbmcgb3IgbnVtYmVyIGlzIHByZWZlcnJlZC5cbiAgICAgKiAgIG5vdGU6IElmIHlvdSByZXF1ZXN0IG9wdGlvbnMudW5pcXVlTGlua0lkLCB0aGVuIG5vZGUgaWQgc2hvdWxkIG5vdFxuICAgICAqICAgY29udGFpbiAn8J+RiSAnLiBUaGlzIHdpbGwgYnJlYWsgbGluayBpZGVudGlmaWVyc1xuICAgICAqIEBwYXJhbSBbZGF0YV0gYWRkaXRpb25hbCBkYXRhIGZvciB0aGUgbm9kZSBiZWluZyBhZGRlZC4gSWYgbm9kZSBhbHJlYWR5XG4gICAgICogICBleGlzdHMgaXRzIGRhdGEgb2JqZWN0IGlzIGF1Z21lbnRlZCB3aXRoIHRoZSBuZXcgb25lLlxuICAgICAqXG4gICAgICogQHJldHVybiB7bm9kZX0gVGhlIG5ld2x5IGFkZGVkIG5vZGUgb3Igbm9kZSB3aXRoIGdpdmVuIGlkIGlmIGl0IGFscmVhZHkgZXhpc3RzLlxuICAgICAqL1xuICAgIGFkZE5vZGU6IGFkZE5vZGUsXG5cbiAgICAvKipcbiAgICAgKiBBZGRzIGEgbGluayB0byB0aGUgZ3JhcGguIFRoZSBmdW5jdGlvbiBhbHdheXMgY3JlYXRlIGEgbmV3XG4gICAgICogbGluayBiZXR3ZWVuIHR3byBub2Rlcy4gSWYgb25lIG9mIHRoZSBub2RlcyBkb2VzIG5vdCBleGlzdHNcbiAgICAgKiBhIG5ldyBub2RlIGlzIGNyZWF0ZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gZnJvbUlkIGxpbmsgc3RhcnQgbm9kZSBpZDtcbiAgICAgKiBAcGFyYW0gdG9JZCBsaW5rIGVuZCBub2RlIGlkO1xuICAgICAqIEBwYXJhbSBbZGF0YV0gYWRkaXRpb25hbCBkYXRhIHRvIGJlIHNldCBvbiB0aGUgbmV3IGxpbms7XG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHtsaW5rfSBUaGUgbmV3bHkgY3JlYXRlZCBsaW5rXG4gICAgICovXG4gICAgYWRkTGluazogYWRkTGluayxcblxuICAgIC8qKlxuICAgICAqIFJlbW92ZXMgbGluayBmcm9tIHRoZSBncmFwaC4gSWYgbGluayBkb2VzIG5vdCBleGlzdCBkb2VzIG5vdGhpbmcuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gbGluayAtIG9iamVjdCByZXR1cm5lZCBieSBhZGRMaW5rKCkgb3IgZ2V0TGlua3MoKSBtZXRob2RzLlxuICAgICAqXG4gICAgICogQHJldHVybnMgdHJ1ZSBpZiBsaW5rIHdhcyByZW1vdmVkOyBmYWxzZSBvdGhlcndpc2UuXG4gICAgICovXG4gICAgcmVtb3ZlTGluazogcmVtb3ZlTGluayxcblxuICAgIC8qKlxuICAgICAqIFJlbW92ZXMgbm9kZSB3aXRoIGdpdmVuIGlkIGZyb20gdGhlIGdyYXBoLiBJZiBub2RlIGRvZXMgbm90IGV4aXN0IGluIHRoZSBncmFwaFxuICAgICAqIGRvZXMgbm90aGluZy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBub2RlSWQgbm9kZSdzIGlkZW50aWZpZXIgcGFzc2VkIHRvIGFkZE5vZGUoKSBmdW5jdGlvbi5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHRydWUgaWYgbm9kZSB3YXMgcmVtb3ZlZDsgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqL1xuICAgIHJlbW92ZU5vZGU6IHJlbW92ZU5vZGUsXG5cbiAgICAvKipcbiAgICAgKiBHZXRzIG5vZGUgd2l0aCBnaXZlbiBpZGVudGlmaWVyLiBJZiBub2RlIGRvZXMgbm90IGV4aXN0IHVuZGVmaW5lZCB2YWx1ZSBpcyByZXR1cm5lZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBub2RlSWQgcmVxdWVzdGVkIG5vZGUgaWRlbnRpZmllcjtcbiAgICAgKlxuICAgICAqIEByZXR1cm4ge25vZGV9IGluIHdpdGggcmVxdWVzdGVkIGlkZW50aWZpZXIgb3IgdW5kZWZpbmVkIGlmIG5vIHN1Y2ggbm9kZSBleGlzdHMuXG4gICAgICovXG4gICAgZ2V0Tm9kZTogZ2V0Tm9kZSxcblxuICAgIC8qKlxuICAgICAqIEdldHMgbnVtYmVyIG9mIG5vZGVzIGluIHRoaXMgZ3JhcGguXG4gICAgICpcbiAgICAgKiBAcmV0dXJuIG51bWJlciBvZiBub2RlcyBpbiB0aGUgZ3JhcGguXG4gICAgICovXG4gICAgZ2V0Tm9kZXNDb3VudDogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gbm9kZXNDb3VudDtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogR2V0cyB0b3RhbCBudW1iZXIgb2YgbGlua3MgaW4gdGhlIGdyYXBoLlxuICAgICAqL1xuICAgIGdldExpbmtzQ291bnQ6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIGxpbmtzLmxlbmd0aDtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogR2V0cyBhbGwgbGlua3MgKGluYm91bmQgYW5kIG91dGJvdW5kKSBmcm9tIHRoZSBub2RlIHdpdGggZ2l2ZW4gaWQuXG4gICAgICogSWYgbm9kZSB3aXRoIGdpdmVuIGlkIGlzIG5vdCBmb3VuZCBudWxsIGlzIHJldHVybmVkLlxuICAgICAqXG4gICAgICogQHBhcmFtIG5vZGVJZCByZXF1ZXN0ZWQgbm9kZSBpZGVudGlmaWVyLlxuICAgICAqXG4gICAgICogQHJldHVybiBBcnJheSBvZiBsaW5rcyBmcm9tIGFuZCB0byByZXF1ZXN0ZWQgbm9kZSBpZiBzdWNoIG5vZGUgZXhpc3RzO1xuICAgICAqICAgb3RoZXJ3aXNlIG51bGwgaXMgcmV0dXJuZWQuXG4gICAgICovXG4gICAgZ2V0TGlua3M6IGdldExpbmtzLFxuXG4gICAgLyoqXG4gICAgICogSW52b2tlcyBjYWxsYmFjayBvbiBlYWNoIG5vZGUgb2YgdGhlIGdyYXBoLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbihub2RlKX0gY2FsbGJhY2sgRnVuY3Rpb24gdG8gYmUgaW52b2tlZC4gVGhlIGZ1bmN0aW9uXG4gICAgICogICBpcyBwYXNzZWQgb25lIGFyZ3VtZW50OiB2aXNpdGVkIG5vZGUuXG4gICAgICovXG4gICAgZm9yRWFjaE5vZGU6IGZvckVhY2hOb2RlLFxuXG4gICAgLyoqXG4gICAgICogSW52b2tlcyBjYWxsYmFjayBvbiBldmVyeSBsaW5rZWQgKGFkamFjZW50KSBub2RlIHRvIHRoZSBnaXZlbiBvbmUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gbm9kZUlkIElkZW50aWZpZXIgb2YgdGhlIHJlcXVlc3RlZCBub2RlLlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb24obm9kZSwgbGluayl9IGNhbGxiYWNrIEZ1bmN0aW9uIHRvIGJlIGNhbGxlZCBvbiBhbGwgbGlua2VkIG5vZGVzLlxuICAgICAqICAgVGhlIGZ1bmN0aW9uIGlzIHBhc3NlZCB0d28gcGFyYW1ldGVyczogYWRqYWNlbnQgbm9kZSBhbmQgbGluayBvYmplY3QgaXRzZWxmLlxuICAgICAqIEBwYXJhbSBvcmllbnRlZCBpZiB0cnVlIGdyYXBoIHRyZWF0ZWQgYXMgb3JpZW50ZWQuXG4gICAgICovXG4gICAgZm9yRWFjaExpbmtlZE5vZGU6IGZvckVhY2hMaW5rZWROb2RlLFxuXG4gICAgLyoqXG4gICAgICogRW51bWVyYXRlcyBhbGwgbGlua3MgaW4gdGhlIGdyYXBoXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9uKGxpbmspfSBjYWxsYmFjayBGdW5jdGlvbiB0byBiZSBjYWxsZWQgb24gYWxsIGxpbmtzIGluIHRoZSBncmFwaC5cbiAgICAgKiAgIFRoZSBmdW5jdGlvbiBpcyBwYXNzZWQgb25lIHBhcmFtZXRlcjogZ3JhcGgncyBsaW5rIG9iamVjdC5cbiAgICAgKlxuICAgICAqIExpbmsgb2JqZWN0IGNvbnRhaW5zIGF0IGxlYXN0IHRoZSBmb2xsb3dpbmcgZmllbGRzOlxuICAgICAqICBmcm9tSWQgLSBub2RlIGlkIHdoZXJlIGxpbmsgc3RhcnRzO1xuICAgICAqICB0b0lkIC0gbm9kZSBpZCB3aGVyZSBsaW5rIGVuZHMsXG4gICAgICogIGRhdGEgLSBhZGRpdGlvbmFsIGRhdGEgcGFzc2VkIHRvIGdyYXBoLmFkZExpbmsoKSBtZXRob2QuXG4gICAgICovXG4gICAgZm9yRWFjaExpbms6IGZvckVhY2hMaW5rLFxuXG4gICAgLyoqXG4gICAgICogU3VzcGVuZCBhbGwgbm90aWZpY2F0aW9ucyBhYm91dCBncmFwaCBjaGFuZ2VzIHVudGlsXG4gICAgICogZW5kVXBkYXRlIGlzIGNhbGxlZC5cbiAgICAgKi9cbiAgICBiZWdpblVwZGF0ZTogZW50ZXJNb2RpZmljYXRpb24sXG5cbiAgICAvKipcbiAgICAgKiBSZXN1bWVzIGFsbCBub3RpZmljYXRpb25zIGFib3V0IGdyYXBoIGNoYW5nZXMgYW5kIGZpcmVzXG4gICAgICogZ3JhcGggJ2NoYW5nZWQnIGV2ZW50IGluIGNhc2UgdGhlcmUgYXJlIGFueSBwZW5kaW5nIGNoYW5nZXMuXG4gICAgICovXG4gICAgZW5kVXBkYXRlOiBleGl0TW9kaWZpY2F0aW9uLFxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlcyBhbGwgbm9kZXMgYW5kIGxpbmtzIGZyb20gdGhlIGdyYXBoLlxuICAgICAqL1xuICAgIGNsZWFyOiBjbGVhcixcblxuICAgIC8qKlxuICAgICAqIERldGVjdHMgd2hldGhlciB0aGVyZSBpcyBhIGxpbmsgYmV0d2VlbiB0d28gbm9kZXMuXG4gICAgICogT3BlcmF0aW9uIGNvbXBsZXhpdHkgaXMgTyhuKSB3aGVyZSBuIC0gbnVtYmVyIG9mIGxpbmtzIG9mIGEgbm9kZS5cbiAgICAgKiBOT1RFOiB0aGlzIGZ1bmN0aW9uIGlzIHN5bm9uaW0gZm9yIGdldExpbmsoKVxuICAgICAqXG4gICAgICogQHJldHVybnMgbGluayBpZiB0aGVyZSBpcyBvbmUuIG51bGwgb3RoZXJ3aXNlLlxuICAgICAqL1xuICAgIGhhc0xpbms6IGdldExpbmssXG5cbiAgICAvKipcbiAgICAgKiBHZXRzIGFuIGVkZ2UgYmV0d2VlbiB0d28gbm9kZXMuXG4gICAgICogT3BlcmF0aW9uIGNvbXBsZXhpdHkgaXMgTyhuKSB3aGVyZSBuIC0gbnVtYmVyIG9mIGxpbmtzIG9mIGEgbm9kZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBmcm9tSWQgbGluayBzdGFydCBpZGVudGlmaWVyXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHRvSWQgbGluayBlbmQgaWRlbnRpZmllclxuICAgICAqXG4gICAgICogQHJldHVybnMgbGluayBpZiB0aGVyZSBpcyBvbmUuIG51bGwgb3RoZXJ3aXNlLlxuICAgICAqL1xuICAgIGdldExpbms6IGdldExpbmtcbiAgfTtcblxuICAvLyB0aGlzIHdpbGwgYWRkIGBvbigpYCBhbmQgYGZpcmUoKWAgbWV0aG9kcy5cbiAgZXZlbnRpZnkoZ3JhcGhQYXJ0KTtcblxuICBtb25pdG9yU3Vic2NyaWJlcnMoKTtcblxuICByZXR1cm4gZ3JhcGhQYXJ0O1xuXG4gIGZ1bmN0aW9uIG1vbml0b3JTdWJzY3JpYmVycygpIHtcbiAgICB2YXIgcmVhbE9uID0gZ3JhcGhQYXJ0Lm9uO1xuXG4gICAgLy8gcmVwbGFjZSByZWFsIGBvbmAgd2l0aCBvdXIgdGVtcG9yYXJ5IG9uLCB3aGljaCB3aWxsIHRyaWdnZXIgY2hhbmdlXG4gICAgLy8gbW9kaWZpY2F0aW9uIG1vbml0b3Jpbmc6XG4gICAgZ3JhcGhQYXJ0Lm9uID0gb247XG5cbiAgICBmdW5jdGlvbiBvbigpIHtcbiAgICAgIC8vIG5vdyBpdCdzIHRpbWUgdG8gc3RhcnQgdHJhY2tpbmcgc3R1ZmY6XG4gICAgICBncmFwaFBhcnQuYmVnaW5VcGRhdGUgPSBlbnRlck1vZGlmaWNhdGlvbiA9IGVudGVyTW9kaWZpY2F0aW9uUmVhbDtcbiAgICAgIGdyYXBoUGFydC5lbmRVcGRhdGUgPSBleGl0TW9kaWZpY2F0aW9uID0gZXhpdE1vZGlmaWNhdGlvblJlYWw7XG4gICAgICByZWNvcmRMaW5rQ2hhbmdlID0gcmVjb3JkTGlua0NoYW5nZVJlYWw7XG4gICAgICByZWNvcmROb2RlQ2hhbmdlID0gcmVjb3JkTm9kZUNoYW5nZVJlYWw7XG5cbiAgICAgIC8vIHRoaXMgd2lsbCByZXBsYWNlIGN1cnJlbnQgYG9uYCBtZXRob2Qgd2l0aCByZWFsIHB1Yi9zdWIgZnJvbSBgZXZlbnRpZnlgLlxuICAgICAgZ3JhcGhQYXJ0Lm9uID0gcmVhbE9uO1xuICAgICAgLy8gZGVsZWdhdGUgdG8gcmVhbCBgb25gIGhhbmRsZXI6XG4gICAgICByZXR1cm4gcmVhbE9uLmFwcGx5KGdyYXBoUGFydCwgYXJndW1lbnRzKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiByZWNvcmRMaW5rQ2hhbmdlUmVhbChsaW5rLCBjaGFuZ2VUeXBlKSB7XG4gICAgY2hhbmdlcy5wdXNoKHtcbiAgICAgIGxpbms6IGxpbmssXG4gICAgICBjaGFuZ2VUeXBlOiBjaGFuZ2VUeXBlXG4gICAgfSk7XG4gIH1cblxuICBmdW5jdGlvbiByZWNvcmROb2RlQ2hhbmdlUmVhbChub2RlLCBjaGFuZ2VUeXBlKSB7XG4gICAgY2hhbmdlcy5wdXNoKHtcbiAgICAgIG5vZGU6IG5vZGUsXG4gICAgICBjaGFuZ2VUeXBlOiBjaGFuZ2VUeXBlXG4gICAgfSk7XG4gIH1cblxuICBmdW5jdGlvbiBhZGROb2RlKG5vZGVJZCwgZGF0YSkge1xuICAgIGlmIChub2RlSWQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIG5vZGUgaWRlbnRpZmllcicpO1xuICAgIH1cblxuICAgIGVudGVyTW9kaWZpY2F0aW9uKCk7XG5cbiAgICB2YXIgbm9kZSA9IGdldE5vZGUobm9kZUlkKTtcbiAgICBpZiAoIW5vZGUpIHtcbiAgICAgIC8vIFRPRE86IFNob3VsZCBJIGNoZWNrIGZvciDwn5GJICBoZXJlP1xuICAgICAgbm9kZSA9IG5ldyBOb2RlKG5vZGVJZCk7XG4gICAgICBub2Rlc0NvdW50Kys7XG4gICAgICByZWNvcmROb2RlQ2hhbmdlKG5vZGUsICdhZGQnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVjb3JkTm9kZUNoYW5nZShub2RlLCAndXBkYXRlJyk7XG4gICAgfVxuXG4gICAgbm9kZS5kYXRhID0gZGF0YTtcblxuICAgIG5vZGVzW25vZGVJZF0gPSBub2RlO1xuXG4gICAgZXhpdE1vZGlmaWNhdGlvbigpO1xuICAgIHJldHVybiBub2RlO1xuICB9XG5cbiAgZnVuY3Rpb24gZ2V0Tm9kZShub2RlSWQpIHtcbiAgICByZXR1cm4gbm9kZXNbbm9kZUlkXTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlbW92ZU5vZGUobm9kZUlkKSB7XG4gICAgdmFyIG5vZGUgPSBnZXROb2RlKG5vZGVJZCk7XG4gICAgaWYgKCFub2RlKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgZW50ZXJNb2RpZmljYXRpb24oKTtcblxuICAgIHdoaWxlIChub2RlLmxpbmtzLmxlbmd0aCkge1xuICAgICAgdmFyIGxpbmsgPSBub2RlLmxpbmtzWzBdO1xuICAgICAgcmVtb3ZlTGluayhsaW5rKTtcbiAgICB9XG5cbiAgICBkZWxldGUgbm9kZXNbbm9kZUlkXTtcbiAgICBub2Rlc0NvdW50LS07XG5cbiAgICByZWNvcmROb2RlQ2hhbmdlKG5vZGUsICdyZW1vdmUnKTtcblxuICAgIGV4aXRNb2RpZmljYXRpb24oKTtcblxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cblxuICBmdW5jdGlvbiBhZGRMaW5rKGZyb21JZCwgdG9JZCwgZGF0YSkge1xuICAgIGVudGVyTW9kaWZpY2F0aW9uKCk7XG5cbiAgICB2YXIgZnJvbU5vZGUgPSBnZXROb2RlKGZyb21JZCkgfHwgYWRkTm9kZShmcm9tSWQpO1xuICAgIHZhciB0b05vZGUgPSBnZXROb2RlKHRvSWQpIHx8IGFkZE5vZGUodG9JZCk7XG5cbiAgICB2YXIgbGluayA9IGNyZWF0ZUxpbmsoZnJvbUlkLCB0b0lkLCBkYXRhKTtcblxuICAgIGxpbmtzLnB1c2gobGluayk7XG5cbiAgICAvLyBUT0RPOiB0aGlzIGlzIG5vdCBjb29sLiBPbiBsYXJnZSBncmFwaHMgcG90ZW50aWFsbHkgd291bGQgY29uc3VtZSBtb3JlIG1lbW9yeS5cbiAgICBmcm9tTm9kZS5saW5rcy5wdXNoKGxpbmspO1xuICAgIGlmIChmcm9tSWQgIT09IHRvSWQpIHtcbiAgICAgIC8vIG1ha2Ugc3VyZSB3ZSBhcmUgbm90IGR1cGxpY2F0aW5nIGxpbmtzIGZvciBzZWxmLWxvb3BzXG4gICAgICB0b05vZGUubGlua3MucHVzaChsaW5rKTtcbiAgICB9XG5cbiAgICByZWNvcmRMaW5rQ2hhbmdlKGxpbmssICdhZGQnKTtcblxuICAgIGV4aXRNb2RpZmljYXRpb24oKTtcblxuICAgIHJldHVybiBsaW5rO1xuICB9XG5cbiAgZnVuY3Rpb24gY3JlYXRlU2luZ2xlTGluayhmcm9tSWQsIHRvSWQsIGRhdGEpIHtcbiAgICB2YXIgbGlua0lkID0gZnJvbUlkLnRvU3RyaW5nKCkgKyB0b0lkLnRvU3RyaW5nKCk7XG4gICAgcmV0dXJuIG5ldyBMaW5rKGZyb21JZCwgdG9JZCwgZGF0YSwgbGlua0lkKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNyZWF0ZVVuaXF1ZUxpbmsoZnJvbUlkLCB0b0lkLCBkYXRhKSB7XG4gICAgdmFyIGxpbmtJZCA9IGZyb21JZC50b1N0cmluZygpICsgJ/CfkYkgJyArIHRvSWQudG9TdHJpbmcoKTtcbiAgICB2YXIgaXNNdWx0aUVkZ2UgPSBtdWx0aUVkZ2VzLmhhc093blByb3BlcnR5KGxpbmtJZCk7XG4gICAgaWYgKGlzTXVsdGlFZGdlIHx8IGdldExpbmsoZnJvbUlkLCB0b0lkKSkge1xuICAgICAgaWYgKCFpc011bHRpRWRnZSkge1xuICAgICAgICBtdWx0aUVkZ2VzW2xpbmtJZF0gPSAwO1xuICAgICAgfVxuICAgICAgbGlua0lkICs9ICdAJyArICgrK211bHRpRWRnZXNbbGlua0lkXSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBMaW5rKGZyb21JZCwgdG9JZCwgZGF0YSwgbGlua0lkKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldExpbmtzKG5vZGVJZCkge1xuICAgIHZhciBub2RlID0gZ2V0Tm9kZShub2RlSWQpO1xuICAgIHJldHVybiBub2RlID8gbm9kZS5saW5rcyA6IG51bGw7XG4gIH1cblxuICBmdW5jdGlvbiByZW1vdmVMaW5rKGxpbmspIHtcbiAgICBpZiAoIWxpbmspIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgdmFyIGlkeCA9IGluZGV4T2ZFbGVtZW50SW5BcnJheShsaW5rLCBsaW5rcyk7XG4gICAgaWYgKGlkeCA8IDApIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBlbnRlck1vZGlmaWNhdGlvbigpO1xuXG4gICAgbGlua3Muc3BsaWNlKGlkeCwgMSk7XG5cbiAgICB2YXIgZnJvbU5vZGUgPSBnZXROb2RlKGxpbmsuZnJvbUlkKTtcbiAgICB2YXIgdG9Ob2RlID0gZ2V0Tm9kZShsaW5rLnRvSWQpO1xuXG4gICAgaWYgKGZyb21Ob2RlKSB7XG4gICAgICBpZHggPSBpbmRleE9mRWxlbWVudEluQXJyYXkobGluaywgZnJvbU5vZGUubGlua3MpO1xuICAgICAgaWYgKGlkeCA+PSAwKSB7XG4gICAgICAgIGZyb21Ob2RlLmxpbmtzLnNwbGljZShpZHgsIDEpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICh0b05vZGUpIHtcbiAgICAgIGlkeCA9IGluZGV4T2ZFbGVtZW50SW5BcnJheShsaW5rLCB0b05vZGUubGlua3MpO1xuICAgICAgaWYgKGlkeCA+PSAwKSB7XG4gICAgICAgIHRvTm9kZS5saW5rcy5zcGxpY2UoaWR4LCAxKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZWNvcmRMaW5rQ2hhbmdlKGxpbmssICdyZW1vdmUnKTtcblxuICAgIGV4aXRNb2RpZmljYXRpb24oKTtcblxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgZnVuY3Rpb24gZ2V0TGluayhmcm9tTm9kZUlkLCB0b05vZGVJZCkge1xuICAgIC8vIFRPRE86IFVzZSBzb3J0ZWQgbGlua3MgdG8gc3BlZWQgdGhpcyB1cFxuICAgIHZhciBub2RlID0gZ2V0Tm9kZShmcm9tTm9kZUlkKSxcbiAgICAgIGk7XG4gICAgaWYgKCFub2RlKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBmb3IgKGkgPSAwOyBpIDwgbm9kZS5saW5rcy5sZW5ndGg7ICsraSkge1xuICAgICAgdmFyIGxpbmsgPSBub2RlLmxpbmtzW2ldO1xuICAgICAgaWYgKGxpbmsuZnJvbUlkID09PSBmcm9tTm9kZUlkICYmIGxpbmsudG9JZCA9PT0gdG9Ob2RlSWQpIHtcbiAgICAgICAgcmV0dXJuIGxpbms7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG51bGw7IC8vIG5vIGxpbmsuXG4gIH1cblxuICBmdW5jdGlvbiBjbGVhcigpIHtcbiAgICBlbnRlck1vZGlmaWNhdGlvbigpO1xuICAgIGZvckVhY2hOb2RlKGZ1bmN0aW9uKG5vZGUpIHtcbiAgICAgIHJlbW92ZU5vZGUobm9kZS5pZCk7XG4gICAgfSk7XG4gICAgZXhpdE1vZGlmaWNhdGlvbigpO1xuICB9XG5cbiAgZnVuY3Rpb24gZm9yRWFjaExpbmsoY2FsbGJhY2spIHtcbiAgICB2YXIgaSwgbGVuZ3RoO1xuICAgIGlmICh0eXBlb2YgY2FsbGJhY2sgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGZvciAoaSA9IDAsIGxlbmd0aCA9IGxpbmtzLmxlbmd0aDsgaSA8IGxlbmd0aDsgKytpKSB7XG4gICAgICAgIGNhbGxiYWNrKGxpbmtzW2ldKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBmb3JFYWNoTGlua2VkTm9kZShub2RlSWQsIGNhbGxiYWNrLCBvcmllbnRlZCkge1xuICAgIHZhciBub2RlID0gZ2V0Tm9kZShub2RlSWQpO1xuXG4gICAgaWYgKG5vZGUgJiYgbm9kZS5saW5rcyAmJiB0eXBlb2YgY2FsbGJhY2sgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGlmIChvcmllbnRlZCkge1xuICAgICAgICByZXR1cm4gZm9yRWFjaE9yaWVudGVkTGluayhub2RlLmxpbmtzLCBub2RlSWQsIGNhbGxiYWNrKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBmb3JFYWNoTm9uT3JpZW50ZWRMaW5rKG5vZGUubGlua3MsIG5vZGVJZCwgY2FsbGJhY2spO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGZvckVhY2hOb25PcmllbnRlZExpbmsobGlua3MsIG5vZGVJZCwgY2FsbGJhY2spIHtcbiAgICB2YXIgcXVpdEZhc3Q7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsaW5rcy5sZW5ndGg7ICsraSkge1xuICAgICAgdmFyIGxpbmsgPSBsaW5rc1tpXTtcbiAgICAgIHZhciBsaW5rZWROb2RlSWQgPSBsaW5rLmZyb21JZCA9PT0gbm9kZUlkID8gbGluay50b0lkIDogbGluay5mcm9tSWQ7XG5cbiAgICAgIHF1aXRGYXN0ID0gY2FsbGJhY2sobm9kZXNbbGlua2VkTm9kZUlkXSwgbGluayk7XG4gICAgICBpZiAocXVpdEZhc3QpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7IC8vIENsaWVudCBkb2VzIG5vdCBuZWVkIG1vcmUgaXRlcmF0aW9ucy4gQnJlYWsgbm93LlxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGZvckVhY2hPcmllbnRlZExpbmsobGlua3MsIG5vZGVJZCwgY2FsbGJhY2spIHtcbiAgICB2YXIgcXVpdEZhc3Q7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsaW5rcy5sZW5ndGg7ICsraSkge1xuICAgICAgdmFyIGxpbmsgPSBsaW5rc1tpXTtcbiAgICAgIGlmIChsaW5rLmZyb21JZCA9PT0gbm9kZUlkKSB7XG4gICAgICAgIHF1aXRGYXN0ID0gY2FsbGJhY2sobm9kZXNbbGluay50b0lkXSwgbGluayk7XG4gICAgICAgIGlmIChxdWl0RmFzdCkge1xuICAgICAgICAgIHJldHVybiB0cnVlOyAvLyBDbGllbnQgZG9lcyBub3QgbmVlZCBtb3JlIGl0ZXJhdGlvbnMuIEJyZWFrIG5vdy5cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIHdlIHdpbGwgbm90IGZpcmUgYW55dGhpbmcgdW50aWwgdXNlcnMgb2YgdGhpcyBsaWJyYXJ5IGV4cGxpY2l0bHkgY2FsbCBgb24oKWBcbiAgLy8gbWV0aG9kLlxuICBmdW5jdGlvbiBub29wKCkge31cblxuICAvLyBFbnRlciwgRXhpdCBtb2RpZmljYXRpb24gYWxsb3dzIGJ1bGsgZ3JhcGggdXBkYXRlcyB3aXRob3V0IGZpcmluZyBldmVudHMuXG4gIGZ1bmN0aW9uIGVudGVyTW9kaWZpY2F0aW9uUmVhbCgpIHtcbiAgICBzdXNwZW5kRXZlbnRzICs9IDE7XG4gIH1cblxuICBmdW5jdGlvbiBleGl0TW9kaWZpY2F0aW9uUmVhbCgpIHtcbiAgICBzdXNwZW5kRXZlbnRzIC09IDE7XG4gICAgaWYgKHN1c3BlbmRFdmVudHMgPT09IDAgJiYgY2hhbmdlcy5sZW5ndGggPiAwKSB7XG4gICAgICBncmFwaFBhcnQuZmlyZSgnY2hhbmdlZCcsIGNoYW5nZXMpO1xuICAgICAgY2hhbmdlcy5sZW5ndGggPSAwO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGNyZWF0ZU5vZGVJdGVyYXRvcigpIHtcbiAgICAvLyBPYmplY3Qua2V5cyBpdGVyYXRvciBpcyAxLjN4IGZhc3RlciB0aGFuIGBmb3IgaW5gIGxvb3AuXG4gICAgLy8gU2VlIGBodHRwczovL2dpdGh1Yi5jb20vYW52YWthL25ncmFwaC5ncmFwaC90cmVlL2JlbmNoLWZvci1pbi12cy1vYmota2V5c2BcbiAgICAvLyBicmFuY2ggZm9yIHBlcmYgdGVzdFxuICAgIHJldHVybiBPYmplY3Qua2V5cyA/IG9iamVjdEtleXNJdGVyYXRvciA6IGZvckluSXRlcmF0b3I7XG4gIH1cblxuICBmdW5jdGlvbiBvYmplY3RLZXlzSXRlcmF0b3IoY2FsbGJhY2spIHtcbiAgICBpZiAodHlwZW9mIGNhbGxiYWNrICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyhub2Rlcyk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBrZXlzLmxlbmd0aDsgKytpKSB7XG4gICAgICBpZiAoY2FsbGJhY2sobm9kZXNba2V5c1tpXV0pKSB7XG4gICAgICAgIHJldHVybiB0cnVlOyAvLyBjbGllbnQgZG9lc24ndCB3YW50IHRvIHByb2NlZWQuIFJldHVybi5cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBmb3JJbkl0ZXJhdG9yKGNhbGxiYWNrKSB7XG4gICAgaWYgKHR5cGVvZiBjYWxsYmFjayAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgbm9kZTtcblxuICAgIGZvciAobm9kZSBpbiBub2Rlcykge1xuICAgICAgaWYgKGNhbGxiYWNrKG5vZGVzW25vZGVdKSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTsgLy8gY2xpZW50IGRvZXNuJ3Qgd2FudCB0byBwcm9jZWVkLiBSZXR1cm4uXG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbi8vIG5lZWQgdGhpcyBmb3Igb2xkIGJyb3dzZXJzLiBTaG91bGQgdGhpcyBiZSBhIHNlcGFyYXRlIG1vZHVsZT9cbmZ1bmN0aW9uIGluZGV4T2ZFbGVtZW50SW5BcnJheShlbGVtZW50LCBhcnJheSkge1xuICBpZiAoYXJyYXkuaW5kZXhPZikge1xuICAgIHJldHVybiBhcnJheS5pbmRleE9mKGVsZW1lbnQpO1xuICB9XG5cbiAgdmFyIGxlbiA9IGFycmF5Lmxlbmd0aCxcbiAgICBpO1xuXG4gIGZvciAoaSA9IDA7IGkgPCBsZW47IGkgKz0gMSkge1xuICAgIGlmIChhcnJheVtpXSA9PT0gZWxlbWVudCkge1xuICAgICAgcmV0dXJuIGk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIC0xO1xufVxuXG4vKipcbiAqIEludGVybmFsIHN0cnVjdHVyZSB0byByZXByZXNlbnQgbm9kZTtcbiAqL1xuZnVuY3Rpb24gTm9kZShpZCkge1xuICB0aGlzLmlkID0gaWQ7XG4gIHRoaXMubGlua3MgPSBbXTtcbiAgdGhpcy5kYXRhID0gbnVsbDtcbn1cblxuXG4vKipcbiAqIEludGVybmFsIHN0cnVjdHVyZSB0byByZXByZXNlbnQgbGlua3M7XG4gKi9cbmZ1bmN0aW9uIExpbmsoZnJvbUlkLCB0b0lkLCBkYXRhLCBpZCkge1xuICB0aGlzLmZyb21JZCA9IGZyb21JZDtcbiAgdGhpcy50b0lkID0gdG9JZDtcbiAgdGhpcy5kYXRhID0gZGF0YTtcbiAgdGhpcy5pZCA9IGlkO1xufVxuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihzdWJqZWN0KSB7XG4gIHZhbGlkYXRlU3ViamVjdChzdWJqZWN0KTtcblxuICB2YXIgZXZlbnRzU3RvcmFnZSA9IGNyZWF0ZUV2ZW50c1N0b3JhZ2Uoc3ViamVjdCk7XG4gIHN1YmplY3Qub24gPSBldmVudHNTdG9yYWdlLm9uO1xuICBzdWJqZWN0Lm9mZiA9IGV2ZW50c1N0b3JhZ2Uub2ZmO1xuICBzdWJqZWN0LmZpcmUgPSBldmVudHNTdG9yYWdlLmZpcmU7XG4gIHJldHVybiBzdWJqZWN0O1xufTtcblxuZnVuY3Rpb24gY3JlYXRlRXZlbnRzU3RvcmFnZShzdWJqZWN0KSB7XG4gIC8vIFN0b3JlIGFsbCBldmVudCBsaXN0ZW5lcnMgdG8gdGhpcyBoYXNoLiBLZXkgaXMgZXZlbnQgbmFtZSwgdmFsdWUgaXMgYXJyYXlcbiAgLy8gb2YgY2FsbGJhY2sgcmVjb3Jkcy5cbiAgLy9cbiAgLy8gQSBjYWxsYmFjayByZWNvcmQgY29uc2lzdHMgb2YgY2FsbGJhY2sgZnVuY3Rpb24gYW5kIGl0cyBvcHRpb25hbCBjb250ZXh0OlxuICAvLyB7ICdldmVudE5hbWUnID0+IFt7Y2FsbGJhY2s6IGZ1bmN0aW9uLCBjdHg6IG9iamVjdH1dIH1cbiAgdmFyIHJlZ2lzdGVyZWRFdmVudHMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXG4gIHJldHVybiB7XG4gICAgb246IGZ1bmN0aW9uIChldmVudE5hbWUsIGNhbGxiYWNrLCBjdHgpIHtcbiAgICAgIGlmICh0eXBlb2YgY2FsbGJhY2sgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdjYWxsYmFjayBpcyBleHBlY3RlZCB0byBiZSBhIGZ1bmN0aW9uJyk7XG4gICAgICB9XG4gICAgICB2YXIgaGFuZGxlcnMgPSByZWdpc3RlcmVkRXZlbnRzW2V2ZW50TmFtZV07XG4gICAgICBpZiAoIWhhbmRsZXJzKSB7XG4gICAgICAgIGhhbmRsZXJzID0gcmVnaXN0ZXJlZEV2ZW50c1tldmVudE5hbWVdID0gW107XG4gICAgICB9XG4gICAgICBoYW5kbGVycy5wdXNoKHtjYWxsYmFjazogY2FsbGJhY2ssIGN0eDogY3R4fSk7XG5cbiAgICAgIHJldHVybiBzdWJqZWN0O1xuICAgIH0sXG5cbiAgICBvZmY6IGZ1bmN0aW9uIChldmVudE5hbWUsIGNhbGxiYWNrKSB7XG4gICAgICB2YXIgd2FudFRvUmVtb3ZlQWxsID0gKHR5cGVvZiBldmVudE5hbWUgPT09ICd1bmRlZmluZWQnKTtcbiAgICAgIGlmICh3YW50VG9SZW1vdmVBbGwpIHtcbiAgICAgICAgLy8gS2lsbGluZyBvbGQgZXZlbnRzIHN0b3JhZ2Ugc2hvdWxkIGJlIGVub3VnaCBpbiB0aGlzIGNhc2U6XG4gICAgICAgIHJlZ2lzdGVyZWRFdmVudHMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgICAgICByZXR1cm4gc3ViamVjdDtcbiAgICAgIH1cblxuICAgICAgaWYgKHJlZ2lzdGVyZWRFdmVudHNbZXZlbnROYW1lXSkge1xuICAgICAgICB2YXIgZGVsZXRlQWxsQ2FsbGJhY2tzRm9yRXZlbnQgPSAodHlwZW9mIGNhbGxiYWNrICE9PSAnZnVuY3Rpb24nKTtcbiAgICAgICAgaWYgKGRlbGV0ZUFsbENhbGxiYWNrc0ZvckV2ZW50KSB7XG4gICAgICAgICAgZGVsZXRlIHJlZ2lzdGVyZWRFdmVudHNbZXZlbnROYW1lXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB2YXIgY2FsbGJhY2tzID0gcmVnaXN0ZXJlZEV2ZW50c1tldmVudE5hbWVdO1xuICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY2FsbGJhY2tzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICBpZiAoY2FsbGJhY2tzW2ldLmNhbGxiYWNrID09PSBjYWxsYmFjaykge1xuICAgICAgICAgICAgICBjYWxsYmFja3Muc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gc3ViamVjdDtcbiAgICB9LFxuXG4gICAgZmlyZTogZnVuY3Rpb24gKGV2ZW50TmFtZSkge1xuICAgICAgdmFyIGNhbGxiYWNrcyA9IHJlZ2lzdGVyZWRFdmVudHNbZXZlbnROYW1lXTtcbiAgICAgIGlmICghY2FsbGJhY2tzKSB7XG4gICAgICAgIHJldHVybiBzdWJqZWN0O1xuICAgICAgfVxuXG4gICAgICB2YXIgZmlyZUFyZ3VtZW50cztcbiAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgICAgICBmaXJlQXJndW1lbnRzID0gQXJyYXkucHJvdG90eXBlLnNwbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgICB9XG4gICAgICBmb3IodmFyIGkgPSAwOyBpIDwgY2FsbGJhY2tzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIHZhciBjYWxsYmFja0luZm8gPSBjYWxsYmFja3NbaV07XG4gICAgICAgIGNhbGxiYWNrSW5mby5jYWxsYmFjay5hcHBseShjYWxsYmFja0luZm8uY3R4LCBmaXJlQXJndW1lbnRzKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHN1YmplY3Q7XG4gICAgfVxuICB9O1xufVxuXG5mdW5jdGlvbiB2YWxpZGF0ZVN1YmplY3Qoc3ViamVjdCkge1xuICBpZiAoIXN1YmplY3QpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0V2ZW50aWZ5IGNhbm5vdCB1c2UgZmFsc3kgb2JqZWN0IGFzIGV2ZW50cyBzdWJqZWN0Jyk7XG4gIH1cbiAgdmFyIHJlc2VydmVkV29yZHMgPSBbJ29uJywgJ2ZpcmUnLCAnb2ZmJ107XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgcmVzZXJ2ZWRXb3Jkcy5sZW5ndGg7ICsraSkge1xuICAgIGlmIChzdWJqZWN0Lmhhc093blByb3BlcnR5KHJlc2VydmVkV29yZHNbaV0pKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJTdWJqZWN0IGNhbm5vdCBiZSBldmVudGlmaWVkLCBzaW5jZSBpdCBhbHJlYWR5IGhhcyBwcm9wZXJ0eSAnXCIgKyByZXNlcnZlZFdvcmRzW2ldICsgXCInXCIpO1xuICAgIH1cbiAgfVxufVxuIiwiLyoqXG4gKiBNYW5hZ2VzIGEgc2ltdWxhdGlvbiBvZiBwaHlzaWNhbCBmb3JjZXMgYWN0aW5nIG9uIGJvZGllcyBhbmQgc3ByaW5ncy5cbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBwaHlzaWNzU2ltdWxhdG9yO1xuXG5mdW5jdGlvbiBwaHlzaWNzU2ltdWxhdG9yKHNldHRpbmdzKSB7XG4gIHZhciBTcHJpbmcgPSByZXF1aXJlKCcuL2xpYi9zcHJpbmcnKTtcbiAgdmFyIGNyZWF0ZVF1YWRUcmVlID0gcmVxdWlyZSgnbmdyYXBoLnF1YWR0cmVlYmgnKTtcbiAgdmFyIGNyZWF0ZURyYWdGb3JjZSA9IHJlcXVpcmUoJy4vbGliL2RyYWdGb3JjZScpO1xuICB2YXIgY3JlYXRlU3ByaW5nRm9yY2UgPSByZXF1aXJlKCcuL2xpYi9zcHJpbmdGb3JjZScpO1xuICB2YXIgaW50ZWdyYXRlID0gcmVxdWlyZSgnLi9saWIvZXVsZXJJbnRlZ3JhdG9yJyk7XG4gIHZhciBleHBvc2UgPSByZXF1aXJlKCcuL2xpYi9leHBvc2VQcm9wZXJ0aWVzJyk7XG4gIHZhciBtZXJnZSA9IHJlcXVpcmUoJ25ncmFwaC5tZXJnZScpO1xuXG4gIHNldHRpbmdzID0gbWVyZ2Uoc2V0dGluZ3MsIHtcbiAgICAgIC8qKlxuICAgICAgICogSWRlYWwgbGVuZ3RoIGZvciBsaW5rcyAoc3ByaW5ncyBpbiBwaHlzaWNhbCBtb2RlbCkuXG4gICAgICAgKi9cbiAgICAgIHNwcmluZ0xlbmd0aDogODAsXG5cbiAgICAgIC8qKlxuICAgICAgICogSG9vaydzIGxhdyBjb2VmZmljaWVudC4gMSAtIHNvbGlkIHNwcmluZy5cbiAgICAgICAqL1xuICAgICAgc3ByaW5nQ29lZmY6IDAuMDAwMixcblxuICAgICAgLyoqXG4gICAgICAgKiBDb3Vsb21iJ3MgbGF3IGNvZWZmaWNpZW50LiBJdCdzIHVzZWQgdG8gcmVwZWwgbm9kZXMgdGh1cyBzaG91bGQgYmUgbmVnYXRpdmVcbiAgICAgICAqIGlmIHlvdSBtYWtlIGl0IHBvc2l0aXZlIG5vZGVzIHN0YXJ0IGF0dHJhY3QgZWFjaCBvdGhlciA6KS5cbiAgICAgICAqL1xuICAgICAgZ3Jhdml0eTogLTEuMixcblxuICAgICAgLyoqXG4gICAgICAgKiBUaGV0YSBjb2VmZmllY2llbnQgZnJvbSBCYXJuZXMgSHV0IHNpbXVsYXRpb24uIFJhbmdlZCBiZXR3ZWVuICgwLCAxKS5cbiAgICAgICAqIFRoZSBjbG9zZXIgaXQncyB0byAxIHRoZSBtb3JlIG5vZGVzIGFsZ29yaXRobSB3aWxsIGhhdmUgdG8gZ28gdGhyb3VnaC5cbiAgICAgICAqIFNldHRpbmcgaXQgdG8gb25lIG1ha2VzIEJhcm5lcyBIdXQgc2ltdWxhdGlvbiBubyBkaWZmZXJlbnQgZnJvbVxuICAgICAgICogYnJ1dGUtZm9yY2UgZm9yY2VzIGNhbGN1bGF0aW9uIChlYWNoIG5vZGUgaXMgY29uc2lkZXJlZCkuXG4gICAgICAgKi9cbiAgICAgIHRoZXRhOiAwLjgsXG5cbiAgICAgIC8qKlxuICAgICAgICogRHJhZyBmb3JjZSBjb2VmZmljaWVudC4gVXNlZCB0byBzbG93IGRvd24gc3lzdGVtLCB0aHVzIHNob3VsZCBiZSBsZXNzIHRoYW4gMS5cbiAgICAgICAqIFRoZSBjbG9zZXIgaXQgaXMgdG8gMCB0aGUgbGVzcyB0aWdodCBzeXN0ZW0gd2lsbCBiZS5cbiAgICAgICAqL1xuICAgICAgZHJhZ0NvZWZmOiAwLjAyLFxuXG4gICAgICAvKipcbiAgICAgICAqIERlZmF1bHQgdGltZSBzdGVwIChkdCkgZm9yIGZvcmNlcyBpbnRlZ3JhdGlvblxuICAgICAgICovXG4gICAgICB0aW1lU3RlcCA6IDIwXG4gIH0pO1xuXG4gIHZhciBib2RpZXMgPSBbXSwgLy8gQm9kaWVzIGluIHRoaXMgc2ltdWxhdGlvbi5cbiAgICAgIHNwcmluZ3MgPSBbXSwgLy8gU3ByaW5ncyBpbiB0aGlzIHNpbXVsYXRpb24uXG4gICAgICBxdWFkVHJlZSA9IGNyZWF0ZVF1YWRUcmVlKHNldHRpbmdzKSxcbiAgICAgIHNwcmluZ0ZvcmNlID0gY3JlYXRlU3ByaW5nRm9yY2Uoc2V0dGluZ3MpLFxuICAgICAgZHJhZ0ZvcmNlID0gY3JlYXRlRHJhZ0ZvcmNlKHNldHRpbmdzKTtcblxuICB2YXIgcHVibGljQXBpID0ge1xuICAgIC8qKlxuICAgICAqIEFycmF5IG9mIGJvZGllcywgcmVnaXN0ZXJlZCB3aXRoIGN1cnJlbnQgc2ltdWxhdG9yXG4gICAgICpcbiAgICAgKiBOb3RlOiBUbyBhZGQgbmV3IGJvZHksIHVzZSBhZGRCb2R5KCkgbWV0aG9kLiBUaGlzIHByb3BlcnR5IGlzIG9ubHlcbiAgICAgKiBleHBvc2VkIGZvciB0ZXN0aW5nL3BlcmZvcm1hbmNlIHB1cnBvc2VzLlxuICAgICAqL1xuICAgIGJvZGllczogYm9kaWVzLFxuXG4gICAgLyoqXG4gICAgICogUGVyZm9ybXMgb25lIHN0ZXAgb2YgZm9yY2Ugc2ltdWxhdGlvbi5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtOdW1iZXJ9IFRvdGFsIG1vdmVtZW50IG9mIHRoZSBzeXN0ZW0uIENhbGN1bGF0ZWQgYXM6XG4gICAgICogICAodG90YWwgZGlzdGFuY2UgdHJhdmVsZWQgYnkgYm9kaWVzKV4yLyh0b3RhbCAjIG9mIGJvZGllcylcbiAgICAgKi9cbiAgICBzdGVwOiBmdW5jdGlvbiAoKSB7XG4gICAgICAvLyBJJ20gcmVsdWN0YW50IHRvIGNoZWNrIHRpbWVTdGVwIGhlcmUsIHNpbmNlIHRoaXMgbWV0aG9kIGlzIGdvaW5nIHRvIGJlXG4gICAgICAvLyBzdXBlciBob3QsIEkgZG9uJ3Qgd2FudCB0byBhZGQgbW9yZSBjb21wbGV4aXR5IHRvIGl0XG4gICAgICBhY2N1bXVsYXRlRm9yY2VzKCk7XG4gICAgICByZXR1cm4gaW50ZWdyYXRlKGJvZGllcywgc2V0dGluZ3MudGltZVN0ZXApO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBBZGRzIGJvZHkgdG8gdGhlIHN5c3RlbVxuICAgICAqXG4gICAgICogQHBhcmFtIHtuZ3JhcGgucGh5c2ljcy5wcmltaXRpdmVzLkJvZHl9IGJvZHkgcGh5c2ljYWwgYm9keVxuICAgICAqXG4gICAgICogQHJldHVybnMge25ncmFwaC5waHlzaWNzLnByaW1pdGl2ZXMuQm9keX0gYWRkZWQgYm9keVxuICAgICAqL1xuICAgIGFkZEJvZHk6IGZ1bmN0aW9uIChib2R5KSB7XG4gICAgICBpZiAoIWJvZHkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdCb2R5IGlzIHJlcXVpcmVkJyk7XG4gICAgICB9XG4gICAgICBib2RpZXMucHVzaChib2R5KTtcblxuICAgICAgcmV0dXJuIGJvZHk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJlbW92ZXMgYm9keSBmcm9tIHRoZSBzeXN0ZW1cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bmdyYXBoLnBoeXNpY3MucHJpbWl0aXZlcy5Cb2R5fSBib2R5IHRvIHJlbW92ZVxuICAgICAqXG4gICAgICogQHJldHVybnMge0Jvb2xlYW59IHRydWUgaWYgYm9keSBmb3VuZCBhbmQgcmVtb3ZlZC4gZmFsc3kgb3RoZXJ3aXNlO1xuICAgICAqL1xuICAgIHJlbW92ZUJvZHk6IGZ1bmN0aW9uIChib2R5KSB7XG4gICAgICBpZiAoIWJvZHkpIHsgcmV0dXJuOyB9XG4gICAgICB2YXIgaWR4ID0gYm9kaWVzLmluZGV4T2YoYm9keSk7XG4gICAgICBpZiAoaWR4ID4gLTEpIHtcbiAgICAgICAgYm9kaWVzLnNwbGljZShpZHgsIDEpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQWRkcyBhIHNwcmluZyB0byB0aGlzIHNpbXVsYXRpb24uXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSAtIGEgaGFuZGxlIGZvciBhIHNwcmluZy4gSWYgeW91IHdhbnQgdG8gbGF0ZXIgcmVtb3ZlXG4gICAgICogc3ByaW5nIHBhc3MgaXQgdG8gcmVtb3ZlU3ByaW5nKCkgbWV0aG9kLlxuICAgICAqL1xuICAgIGFkZFNwcmluZzogZnVuY3Rpb24gKGJvZHkxLCBib2R5Miwgc3ByaW5nTGVuZ3RoLCBzcHJpbmdXZWlnaHQsIHNwcmluZ0NvZWZmaWNpZW50KSB7XG4gICAgICBpZiAoIWJvZHkxIHx8ICFib2R5Mikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBhZGQgbnVsbCBzcHJpbmcgdG8gZm9yY2Ugc2ltdWxhdG9yJyk7XG4gICAgICB9XG5cbiAgICAgIGlmICh0eXBlb2Ygc3ByaW5nTGVuZ3RoICE9PSAnbnVtYmVyJykge1xuICAgICAgICBzcHJpbmdMZW5ndGggPSAtMTsgLy8gYXNzdW1lIGdsb2JhbCBjb25maWd1cmF0aW9uXG4gICAgICB9XG5cbiAgICAgIHZhciBzcHJpbmcgPSBuZXcgU3ByaW5nKGJvZHkxLCBib2R5Miwgc3ByaW5nTGVuZ3RoLCBzcHJpbmdDb2VmZmljaWVudCA+PSAwID8gc3ByaW5nQ29lZmZpY2llbnQgOiAtMSwgc3ByaW5nV2VpZ2h0KTtcbiAgICAgIHNwcmluZ3MucHVzaChzcHJpbmcpO1xuXG4gICAgICAvLyBUT0RPOiBjb3VsZCBtYXJrIHNpbXVsYXRvciBhcyBkaXJ0eS5cbiAgICAgIHJldHVybiBzcHJpbmc7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJlbW92ZXMgc3ByaW5nIGZyb20gdGhlIHN5c3RlbVxuICAgICAqXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHNwcmluZyB0byByZW1vdmUuIFNwcmluZyBpcyBhbiBvYmplY3QgcmV0dXJuZWQgYnkgYWRkU3ByaW5nXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gdHJ1ZSBpZiBzcHJpbmcgZm91bmQgYW5kIHJlbW92ZWQuIGZhbHN5IG90aGVyd2lzZTtcbiAgICAgKi9cbiAgICByZW1vdmVTcHJpbmc6IGZ1bmN0aW9uIChzcHJpbmcpIHtcbiAgICAgIGlmICghc3ByaW5nKSB7IHJldHVybjsgfVxuICAgICAgdmFyIGlkeCA9IHNwcmluZ3MuaW5kZXhPZihzcHJpbmcpO1xuICAgICAgaWYgKGlkeCA+IC0xKSB7XG4gICAgICAgIHNwcmluZ3Muc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH0sXG5cbiAgICBncmF2aXR5OiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgIGlmICh2YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHNldHRpbmdzLmdyYXZpdHkgPSB2YWx1ZTtcbiAgICAgICAgcXVhZFRyZWUub3B0aW9ucyh7Z3Jhdml0eTogdmFsdWV9KTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gc2V0dGluZ3MuZ3Jhdml0eTtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgdGhldGE6IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgaWYgKHZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgc2V0dGluZ3MudGhldGEgPSB2YWx1ZTtcbiAgICAgICAgcXVhZFRyZWUub3B0aW9ucyh7dGhldGE6IHZhbHVlfSk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHNldHRpbmdzLnRoZXRhO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIGFsbG93IHNldHRpbmdzIG1vZGlmaWNhdGlvbiB2aWEgcHVibGljIEFQSTpcbiAgZXhwb3NlKHNldHRpbmdzLCBwdWJsaWNBcGkpO1xuXG4gIHJldHVybiBwdWJsaWNBcGk7XG5cbiAgZnVuY3Rpb24gYWNjdW11bGF0ZUZvcmNlcygpIHtcbiAgICAvLyBBY2N1bXVsYXRlIGZvcmNlcyBhY3Rpbmcgb24gYm9kaWVzLlxuICAgIHZhciBib2R5LFxuICAgICAgICBpID0gYm9kaWVzLmxlbmd0aDtcblxuICAgIGlmIChpKSB7XG4gICAgICAvLyBvbmx5IGFkZCBib2RpZXMgaWYgdGhlcmUgdGhlIGFycmF5IGlzIG5vdCBlbXB0eTpcbiAgICAgIHF1YWRUcmVlLmluc2VydEJvZGllcyhib2RpZXMpOyAvLyBwZXJmb3JtYW5jZTogTyhuICogbG9nIG4pXG4gICAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgIGJvZHkgPSBib2RpZXNbaV07XG4gICAgICAgIGJvZHkuZm9yY2UueCA9IDA7XG4gICAgICAgIGJvZHkuZm9yY2UueSA9IDA7XG5cbiAgICAgICAgcXVhZFRyZWUudXBkYXRlQm9keUZvcmNlKGJvZHkpO1xuICAgICAgICBkcmFnRm9yY2UudXBkYXRlKGJvZHkpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGkgPSBzcHJpbmdzLmxlbmd0aDtcbiAgICB3aGlsZShpLS0pIHtcbiAgICAgIHNwcmluZ0ZvcmNlLnVwZGF0ZShzcHJpbmdzW2ldKTtcbiAgICB9XG4gIH1cbn07XG4iLCIvKipcbiAqIFJlcHJlc2VudHMgZHJhZyBmb3JjZSwgd2hpY2ggcmVkdWNlcyBmb3JjZSB2YWx1ZSBvbiBlYWNoIHN0ZXAgYnkgZ2l2ZW5cbiAqIGNvZWZmaWNpZW50LlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zIGZvciB0aGUgZHJhZyBmb3JjZVxuICogQHBhcmFtIHtOdW1iZXI9fSBvcHRpb25zLmRyYWdDb2VmZiBkcmFnIGZvcmNlIGNvZWZmaWNpZW50LiAwLjEgYnkgZGVmYXVsdFxuICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gIHZhciBtZXJnZSA9IHJlcXVpcmUoJ25ncmFwaC5tZXJnZScpLFxuICAgICAgZXhwb3NlID0gcmVxdWlyZSgnLi9leHBvc2VQcm9wZXJ0aWVzJyk7XG5cbiAgb3B0aW9ucyA9IG1lcmdlKG9wdGlvbnMsIHtcbiAgICBkcmFnQ29lZmY6IDAuMDJcbiAgfSk7XG5cbiAgdmFyIGFwaSA9IHtcbiAgICB1cGRhdGUgOiBmdW5jdGlvbiAoYm9keSkge1xuICAgICAgYm9keS5mb3JjZS54IC09IG9wdGlvbnMuZHJhZ0NvZWZmICogYm9keS52ZWxvY2l0eS54O1xuICAgICAgYm9keS5mb3JjZS55IC09IG9wdGlvbnMuZHJhZ0NvZWZmICogYm9keS52ZWxvY2l0eS55O1xuICAgIH1cbiAgfTtcblxuICAvLyBsZXQgZWFzeSBhY2Nlc3MgdG8gZHJhZ0NvZWZmOlxuICBleHBvc2Uob3B0aW9ucywgYXBpLCBbJ2RyYWdDb2VmZiddKTtcblxuICByZXR1cm4gYXBpO1xufTtcbiIsIi8qKlxuICogUGVyZm9ybXMgZm9yY2VzIGludGVncmF0aW9uLCB1c2luZyBnaXZlbiB0aW1lc3RlcC4gVXNlcyBFdWxlciBtZXRob2QgdG8gc29sdmVcbiAqIGRpZmZlcmVudGlhbCBlcXVhdGlvbiAoaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9FdWxlcl9tZXRob2QgKS5cbiAqXG4gKiBAcmV0dXJucyB7TnVtYmVyfSBzcXVhcmVkIGRpc3RhbmNlIG9mIHRvdGFsIHBvc2l0aW9uIHVwZGF0ZXMuXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBpbnRlZ3JhdGU7XG5cbmZ1bmN0aW9uIGludGVncmF0ZShib2RpZXMsIHRpbWVTdGVwKSB7XG4gIHZhciBkeCA9IDAsIHR4ID0gMCxcbiAgICAgIGR5ID0gMCwgdHkgPSAwLFxuICAgICAgaSxcbiAgICAgIG1heCA9IGJvZGllcy5sZW5ndGg7XG5cbiAgZm9yIChpID0gMDsgaSA8IG1heDsgKytpKSB7XG4gICAgdmFyIGJvZHkgPSBib2RpZXNbaV0sXG4gICAgICAgIGNvZWZmID0gdGltZVN0ZXAgLyBib2R5Lm1hc3M7XG5cbiAgICBib2R5LnZlbG9jaXR5LnggKz0gY29lZmYgKiBib2R5LmZvcmNlLng7XG4gICAgYm9keS52ZWxvY2l0eS55ICs9IGNvZWZmICogYm9keS5mb3JjZS55O1xuICAgIHZhciB2eCA9IGJvZHkudmVsb2NpdHkueCxcbiAgICAgICAgdnkgPSBib2R5LnZlbG9jaXR5LnksXG4gICAgICAgIHYgPSBNYXRoLnNxcnQodnggKiB2eCArIHZ5ICogdnkpO1xuXG4gICAgaWYgKHYgPiAxKSB7XG4gICAgICBib2R5LnZlbG9jaXR5LnggPSB2eCAvIHY7XG4gICAgICBib2R5LnZlbG9jaXR5LnkgPSB2eSAvIHY7XG4gICAgfVxuXG4gICAgZHggPSB0aW1lU3RlcCAqIGJvZHkudmVsb2NpdHkueDtcbiAgICBkeSA9IHRpbWVTdGVwICogYm9keS52ZWxvY2l0eS55O1xuXG4gICAgYm9keS5wb3MueCArPSBkeDtcbiAgICBib2R5LnBvcy55ICs9IGR5O1xuXG4gICAgLy8gVE9ETzogdGhpcyBpcyBub3QgYWNjdXJhdGUuIFRvdGFsIHZhbHVlIHNob3VsZCBiZSBhYnNvbHV0ZVxuICAgIHR4ICs9IGR4OyB0eSArPSBkeTtcbiAgfVxuXG4gIHJldHVybiAodHggKiB0eCArIHR5ICogdHkpL2JvZGllcy5sZW5ndGg7XG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGV4cG9zZVByb3BlcnRpZXM7XG5cbi8qKlxuICogQXVnbWVudHMgYHRhcmdldGAgb2JqZWN0IHdpdGggZ2V0dGVyL3NldHRlciBmdW5jdGlvbnMsIHdoaWNoIG1vZGlmeSBzZXR0aW5nc1xuICpcbiAqIEBleGFtcGxlXG4gKiAgdmFyIHRhcmdldCA9IHt9O1xuICogIGV4cG9zZVByb3BlcnRpZXMoeyBhZ2U6IDQyfSwgdGFyZ2V0KTtcbiAqICB0YXJnZXQuYWdlKCk7IC8vIHJldHVybnMgNDJcbiAqICB0YXJnZXQuYWdlKDI0KTsgLy8gbWFrZSBhZ2UgMjQ7XG4gKlxuICogIHZhciBmaWx0ZXJlZFRhcmdldCA9IHt9O1xuICogIGV4cG9zZVByb3BlcnRpZXMoeyBhZ2U6IDQyLCBuYW1lOiAnSm9obid9LCBmaWx0ZXJlZFRhcmdldCwgWyduYW1lJ10pO1xuICogIGZpbHRlcmVkVGFyZ2V0Lm5hbWUoKTsgLy8gcmV0dXJucyAnSm9obidcbiAqICBmaWx0ZXJlZFRhcmdldC5hZ2UgPT09IHVuZGVmaW5lZDsgLy8gdHJ1ZVxuICovXG5mdW5jdGlvbiBleHBvc2VQcm9wZXJ0aWVzKHNldHRpbmdzLCB0YXJnZXQsIGZpbHRlcikge1xuICB2YXIgbmVlZHNGaWx0ZXIgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoZmlsdGVyKSA9PT0gJ1tvYmplY3QgQXJyYXldJztcbiAgaWYgKG5lZWRzRmlsdGVyKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBmaWx0ZXIubGVuZ3RoOyArK2kpIHtcbiAgICAgIGF1Z21lbnQoc2V0dGluZ3MsIHRhcmdldCwgZmlsdGVyW2ldKTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgZm9yICh2YXIga2V5IGluIHNldHRpbmdzKSB7XG4gICAgICBhdWdtZW50KHNldHRpbmdzLCB0YXJnZXQsIGtleSk7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGF1Z21lbnQoc291cmNlLCB0YXJnZXQsIGtleSkge1xuICBpZiAoc291cmNlLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICBpZiAodHlwZW9mIHRhcmdldFtrZXldID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAvLyB0aGlzIGFjY2Vzc29yIGlzIGFscmVhZHkgZGVmaW5lZC4gSWdub3JlIGl0XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHRhcmdldFtrZXldID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICBpZiAodmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBzb3VyY2Vba2V5XSA9IHZhbHVlO1xuICAgICAgICByZXR1cm4gdGFyZ2V0O1xuICAgICAgfVxuICAgICAgcmV0dXJuIHNvdXJjZVtrZXldO1xuICAgIH1cbiAgfVxufVxuIiwibW9kdWxlLmV4cG9ydHMgPSBTcHJpbmc7XG5cbi8qKlxuICogUmVwcmVzZW50cyBhIHBoeXNpY2FsIHNwcmluZy4gU3ByaW5nIGNvbm5lY3RzIHR3byBib2RpZXMsIGhhcyByZXN0IGxlbmd0aFxuICogc3RpZmZuZXNzIGNvZWZmaWNpZW50IGFuZCBvcHRpb25hbCB3ZWlnaHRcbiAqL1xuZnVuY3Rpb24gU3ByaW5nKGZyb21Cb2R5LCB0b0JvZHksIGxlbmd0aCwgY29lZmYsIHdlaWdodCkge1xuICAgIHRoaXMuZnJvbSA9IGZyb21Cb2R5O1xuICAgIHRoaXMudG8gPSB0b0JvZHk7XG4gICAgdGhpcy5sZW5ndGggPSBsZW5ndGg7XG4gICAgdGhpcy5jb2VmZiA9IGNvZWZmO1xuXG4gICAgdGhpcy53ZWlnaHQgPSB0eXBlb2Ygd2VpZ2h0ID09PSAnbnVtYmVyJyA/IHdlaWdodCA6IDE7XG59O1xuIiwiLyoqXG4gKiBSZXByZXNlbnRzIHNwcmluZyBmb3JjZSwgd2hpY2ggdXBkYXRlcyBmb3JjZXMgYWN0aW5nIG9uIHR3byBib2RpZXMsIGNvbm50ZWN0ZWRcbiAqIGJ5IGEgc3ByaW5nLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zIGZvciB0aGUgc3ByaW5nIGZvcmNlXG4gKiBAcGFyYW0ge051bWJlcj19IG9wdGlvbnMuc3ByaW5nQ29lZmYgc3ByaW5nIGZvcmNlIGNvZWZmaWNpZW50LlxuICogQHBhcmFtIHtOdW1iZXI9fSBvcHRpb25zLnNwcmluZ0xlbmd0aCBkZXNpcmVkIGxlbmd0aCBvZiBhIHNwcmluZyBhdCByZXN0LlxuICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gIHZhciBtZXJnZSA9IHJlcXVpcmUoJ25ncmFwaC5tZXJnZScpO1xuICB2YXIgcmFuZG9tID0gcmVxdWlyZSgnbmdyYXBoLnJhbmRvbScpLnJhbmRvbSg0Mik7XG4gIHZhciBleHBvc2UgPSByZXF1aXJlKCcuL2V4cG9zZVByb3BlcnRpZXMnKTtcblxuICBvcHRpb25zID0gbWVyZ2Uob3B0aW9ucywge1xuICAgIHNwcmluZ0NvZWZmOiAwLjAwMDIsXG4gICAgc3ByaW5nTGVuZ3RoOiA4MFxuICB9KTtcblxuICB2YXIgYXBpID0ge1xuICAgIC8qKlxuICAgICAqIFVwc2F0ZXMgZm9yY2VzIGFjdGluZyBvbiBhIHNwcmluZ1xuICAgICAqL1xuICAgIHVwZGF0ZSA6IGZ1bmN0aW9uIChzcHJpbmcpIHtcbiAgICAgIHZhciBib2R5MSA9IHNwcmluZy5mcm9tLFxuICAgICAgICAgIGJvZHkyID0gc3ByaW5nLnRvLFxuICAgICAgICAgIGxlbmd0aCA9IHNwcmluZy5sZW5ndGggPCAwID8gb3B0aW9ucy5zcHJpbmdMZW5ndGggOiBzcHJpbmcubGVuZ3RoLFxuICAgICAgICAgIGR4ID0gYm9keTIucG9zLnggLSBib2R5MS5wb3MueCxcbiAgICAgICAgICBkeSA9IGJvZHkyLnBvcy55IC0gYm9keTEucG9zLnksXG4gICAgICAgICAgciA9IE1hdGguc3FydChkeCAqIGR4ICsgZHkgKiBkeSk7XG5cbiAgICAgIGlmIChyID09PSAwKSB7XG4gICAgICAgICAgZHggPSAocmFuZG9tLm5leHREb3VibGUoKSAtIDAuNSkgLyA1MDtcbiAgICAgICAgICBkeSA9IChyYW5kb20ubmV4dERvdWJsZSgpIC0gMC41KSAvIDUwO1xuICAgICAgICAgIHIgPSBNYXRoLnNxcnQoZHggKiBkeCArIGR5ICogZHkpO1xuICAgICAgfVxuXG4gICAgICB2YXIgZCA9IHIgLSBsZW5ndGg7XG4gICAgICB2YXIgY29lZmYgPSAoKCFzcHJpbmcuY29lZmYgfHwgc3ByaW5nLmNvZWZmIDwgMCkgPyBvcHRpb25zLnNwcmluZ0NvZWZmIDogc3ByaW5nLmNvZWZmKSAqIGQgLyByICogc3ByaW5nLndlaWdodDtcblxuICAgICAgYm9keTEuZm9yY2UueCArPSBjb2VmZiAqIGR4O1xuICAgICAgYm9keTEuZm9yY2UueSArPSBjb2VmZiAqIGR5O1xuXG4gICAgICBib2R5Mi5mb3JjZS54IC09IGNvZWZmICogZHg7XG4gICAgICBib2R5Mi5mb3JjZS55IC09IGNvZWZmICogZHk7XG4gICAgfVxuICB9O1xuXG4gIGV4cG9zZShvcHRpb25zLCBhcGksIFsnc3ByaW5nQ29lZmYnLCAnc3ByaW5nTGVuZ3RoJ10pO1xuICByZXR1cm4gYXBpO1xufVxuIiwibW9kdWxlLmV4cG9ydHMgPSBtZXJnZTtcblxuLyoqXG4gKiBBdWdtZW50cyBgdGFyZ2V0YCB3aXRoIHByb3BlcnRpZXMgaW4gYG9wdGlvbnNgLiBEb2VzIG5vdCBvdmVycmlkZVxuICogdGFyZ2V0J3MgcHJvcGVydGllcyBpZiB0aGV5IGFyZSBkZWZpbmVkIGFuZCBtYXRjaGVzIGV4cGVjdGVkIHR5cGUgaW4gXG4gKiBvcHRpb25zXG4gKlxuICogQHJldHVybnMge09iamVjdH0gbWVyZ2VkIG9iamVjdFxuICovXG5mdW5jdGlvbiBtZXJnZSh0YXJnZXQsIG9wdGlvbnMpIHtcbiAgdmFyIGtleTtcbiAgaWYgKCF0YXJnZXQpIHsgdGFyZ2V0ID0ge307IH1cbiAgaWYgKG9wdGlvbnMpIHtcbiAgICBmb3IgKGtleSBpbiBvcHRpb25zKSB7XG4gICAgICBpZiAob3B0aW9ucy5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgIHZhciB0YXJnZXRIYXNJdCA9IHRhcmdldC5oYXNPd25Qcm9wZXJ0eShrZXkpLFxuICAgICAgICAgICAgb3B0aW9uc1ZhbHVlVHlwZSA9IHR5cGVvZiBvcHRpb25zW2tleV0sXG4gICAgICAgICAgICBzaG91bGRSZXBsYWNlID0gIXRhcmdldEhhc0l0IHx8ICh0eXBlb2YgdGFyZ2V0W2tleV0gIT09IG9wdGlvbnNWYWx1ZVR5cGUpO1xuXG4gICAgICAgIGlmIChzaG91bGRSZXBsYWNlKSB7XG4gICAgICAgICAgdGFyZ2V0W2tleV0gPSBvcHRpb25zW2tleV07XG4gICAgICAgIH0gZWxzZSBpZiAob3B0aW9uc1ZhbHVlVHlwZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAvLyBnbyBkZWVwLCBkb24ndCBjYXJlIGFib3V0IGxvb3BzIGhlcmUsIHdlIGFyZSBzaW1wbGUgQVBJITpcbiAgICAgICAgICB0YXJnZXRba2V5XSA9IG1lcmdlKHRhcmdldFtrZXldLCBvcHRpb25zW2tleV0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRhcmdldDtcbn1cbiIsIi8qKlxuICogVGhpcyBpcyBCYXJuZXMgSHV0IHNpbXVsYXRpb24gYWxnb3JpdGhtLiBJbXBsZW1lbnRhdGlvblxuICogaXMgYWRvcHRlZCB0byBub24tcmVjdXJzaXZlIHNvbHV0aW9uLCBzaW5jZSBjZXJ0YWluIGJyb3dzZXJzXG4gKiBoYW5kbGUgcmVjdXJzaW9uIGV4dHJlbWx5IGJhZC5cbiAqXG4gKiBodHRwOi8vd3d3LmNzLnByaW5jZXRvbi5lZHUvY291cnNlcy9hcmNoaXZlL2ZhbGwwMy9jczEyNi9hc3NpZ25tZW50cy9iYXJuZXMtaHV0Lmh0bWxcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gICAgb3B0aW9ucy5ncmF2aXR5ID0gdHlwZW9mIG9wdGlvbnMuZ3Jhdml0eSA9PT0gJ251bWJlcicgPyBvcHRpb25zLmdyYXZpdHkgOiAtMTtcbiAgICBvcHRpb25zLnRoZXRhID0gdHlwZW9mIG9wdGlvbnMudGhldGEgPT09ICdudW1iZXInID8gb3B0aW9ucy50aGV0YSA6IDAuODtcblxuICAgIC8vIHdlIHJlcXVpcmUgZGV0ZXJtaW5pc3RpYyByYW5kb21uZXNzIGhlcmVcbiAgICB2YXIgcmFuZG9tID0gcmVxdWlyZSgnbmdyYXBoLnJhbmRvbScpLnJhbmRvbSgxOTg0KSxcbiAgICAgICAgTm9kZSA9IHJlcXVpcmUoJy4vbm9kZScpLFxuICAgICAgICBJbnNlcnRTdGFjayA9IHJlcXVpcmUoJy4vaW5zZXJ0U3RhY2snKSxcbiAgICAgICAgaXNTYW1lUG9zaXRpb24gPSByZXF1aXJlKCcuL2lzU2FtZVBvc2l0aW9uJyk7XG5cbiAgICB2YXIgZ3Jhdml0eSA9IG9wdGlvbnMuZ3Jhdml0eSxcbiAgICAgICAgdXBkYXRlUXVldWUgPSBbXSxcbiAgICAgICAgaW5zZXJ0U3RhY2sgPSBuZXcgSW5zZXJ0U3RhY2soKSxcbiAgICAgICAgdGhldGEgPSBvcHRpb25zLnRoZXRhLFxuXG4gICAgICAgIG5vZGVzQ2FjaGUgPSBbXSxcbiAgICAgICAgY3VycmVudEluQ2FjaGUgPSAwLFxuICAgICAgICBuZXdOb2RlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgLy8gVG8gYXZvaWQgcHJlc3N1cmUgb24gR0Mgd2UgcmV1c2Ugbm9kZXMuXG4gICAgICAgICAgICB2YXIgbm9kZSA9IG5vZGVzQ2FjaGVbY3VycmVudEluQ2FjaGVdO1xuICAgICAgICAgICAgaWYgKG5vZGUpIHtcbiAgICAgICAgICAgICAgICBub2RlLnF1YWRzWzBdID0gbnVsbDtcbiAgICAgICAgICAgICAgICBub2RlLnF1YWRzWzFdID0gbnVsbDtcbiAgICAgICAgICAgICAgICBub2RlLnF1YWRzWzJdID0gbnVsbDtcbiAgICAgICAgICAgICAgICBub2RlLnF1YWRzWzNdID0gbnVsbDtcbiAgICAgICAgICAgICAgICBub2RlLmJvZHkgPSBudWxsO1xuICAgICAgICAgICAgICAgIG5vZGUubWFzcyA9IG5vZGUubWFzc1ggPSBub2RlLm1hc3NZID0gMDtcbiAgICAgICAgICAgICAgICBub2RlLmxlZnQgPSBub2RlLnJpZ2h0ID0gbm9kZS50b3AgPSBub2RlLmJvdHRvbSA9IDA7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG5vZGUgPSBuZXcgTm9kZSgpO1xuICAgICAgICAgICAgICAgIG5vZGVzQ2FjaGVbY3VycmVudEluQ2FjaGVdID0gbm9kZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgKytjdXJyZW50SW5DYWNoZTtcbiAgICAgICAgICAgIHJldHVybiBub2RlO1xuICAgICAgICB9LFxuXG4gICAgICAgIHJvb3QgPSBuZXdOb2RlKCksXG5cbiAgICAgICAgLy8gSW5zZXJ0cyBib2R5IHRvIHRoZSB0cmVlXG4gICAgICAgIGluc2VydCA9IGZ1bmN0aW9uIChuZXdCb2R5KSB7XG4gICAgICAgICAgICBpbnNlcnRTdGFjay5yZXNldCgpO1xuICAgICAgICAgICAgaW5zZXJ0U3RhY2sucHVzaChyb290LCBuZXdCb2R5KTtcblxuICAgICAgICAgICAgd2hpbGUgKCFpbnNlcnRTdGFjay5pc0VtcHR5KCkpIHtcbiAgICAgICAgICAgICAgICB2YXIgc3RhY2tJdGVtID0gaW5zZXJ0U3RhY2sucG9wKCksXG4gICAgICAgICAgICAgICAgICAgIG5vZGUgPSBzdGFja0l0ZW0ubm9kZSxcbiAgICAgICAgICAgICAgICAgICAgYm9keSA9IHN0YWNrSXRlbS5ib2R5O1xuXG4gICAgICAgICAgICAgICAgaWYgKCFub2RlLmJvZHkpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gVGhpcyBpcyBpbnRlcm5hbCBub2RlLiBVcGRhdGUgdGhlIHRvdGFsIG1hc3Mgb2YgdGhlIG5vZGUgYW5kIGNlbnRlci1vZi1tYXNzLlxuICAgICAgICAgICAgICAgICAgICB2YXIgeCA9IGJvZHkucG9zLng7XG4gICAgICAgICAgICAgICAgICAgIHZhciB5ID0gYm9keS5wb3MueTtcbiAgICAgICAgICAgICAgICAgICAgbm9kZS5tYXNzID0gbm9kZS5tYXNzICsgYm9keS5tYXNzO1xuICAgICAgICAgICAgICAgICAgICBub2RlLm1hc3NYID0gbm9kZS5tYXNzWCArIGJvZHkubWFzcyAqIHg7XG4gICAgICAgICAgICAgICAgICAgIG5vZGUubWFzc1kgPSBub2RlLm1hc3NZICsgYm9keS5tYXNzICogeTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBSZWN1cnNpdmVseSBpbnNlcnQgdGhlIGJvZHkgaW4gdGhlIGFwcHJvcHJpYXRlIHF1YWRyYW50LlxuICAgICAgICAgICAgICAgICAgICAvLyBCdXQgZmlyc3QgZmluZCB0aGUgYXBwcm9wcmlhdGUgcXVhZHJhbnQuXG4gICAgICAgICAgICAgICAgICAgIHZhciBxdWFkSWR4ID0gMCwgLy8gQXNzdW1lIHdlIGFyZSBpbiB0aGUgMCdzIHF1YWQuXG4gICAgICAgICAgICAgICAgICAgICAgICBsZWZ0ID0gbm9kZS5sZWZ0LFxuICAgICAgICAgICAgICAgICAgICAgICAgcmlnaHQgPSAobm9kZS5yaWdodCArIGxlZnQpIC8gMixcbiAgICAgICAgICAgICAgICAgICAgICAgIHRvcCA9IG5vZGUudG9wLFxuICAgICAgICAgICAgICAgICAgICAgICAgYm90dG9tID0gKG5vZGUuYm90dG9tICsgdG9wKSAvIDI7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHggPiByaWdodCkgeyAvLyBzb21ld2hlcmUgaW4gdGhlIGVhc3Rlcm4gcGFydC5cbiAgICAgICAgICAgICAgICAgICAgICAgIHF1YWRJZHggPSBxdWFkSWR4ICsgMTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBvbGRMZWZ0ID0gbGVmdDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxlZnQgPSByaWdodDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJpZ2h0ID0gcmlnaHQgKyAocmlnaHQgLSBvbGRMZWZ0KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAoeSA+IGJvdHRvbSkgeyAvLyBhbmQgaW4gc291dGguXG4gICAgICAgICAgICAgICAgICAgICAgICBxdWFkSWR4ID0gcXVhZElkeCArIDI7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgb2xkVG9wID0gdG9wO1xuICAgICAgICAgICAgICAgICAgICAgICAgdG9wID0gYm90dG9tO1xuICAgICAgICAgICAgICAgICAgICAgICAgYm90dG9tID0gYm90dG9tICsgKGJvdHRvbSAtIG9sZFRvcCk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICB2YXIgY2hpbGQgPSBub2RlLnF1YWRzW3F1YWRJZHhdO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWNoaWxkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBUaGUgbm9kZSBpcyBpbnRlcm5hbCBidXQgdGhpcyBxdWFkcmFudCBpcyBub3QgdGFrZW4uIEFkZFxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gc3Vibm9kZSB0byBpdC5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNoaWxkID0gbmV3Tm9kZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2hpbGQubGVmdCA9IGxlZnQ7XG4gICAgICAgICAgICAgICAgICAgICAgICBjaGlsZC50b3AgPSB0b3A7XG4gICAgICAgICAgICAgICAgICAgICAgICBjaGlsZC5yaWdodCA9IHJpZ2h0O1xuICAgICAgICAgICAgICAgICAgICAgICAgY2hpbGQuYm90dG9tID0gYm90dG9tO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2hpbGQuYm9keSA9IGJvZHk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIG5vZGUucXVhZHNbcXVhZElkeF0gPSBjaGlsZDtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNvbnRpbnVlIHNlYXJjaGluZyBpbiB0aGlzIHF1YWRyYW50LlxuICAgICAgICAgICAgICAgICAgICAgICAgaW5zZXJ0U3RhY2sucHVzaChjaGlsZCwgYm9keSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBXZSBhcmUgdHJ5aW5nIHRvIGFkZCB0byB0aGUgbGVhZiBub2RlLlxuICAgICAgICAgICAgICAgICAgICAvLyBXZSBoYXZlIHRvIGNvbnZlcnQgY3VycmVudCBsZWFmIGludG8gaW50ZXJuYWwgbm9kZVxuICAgICAgICAgICAgICAgICAgICAvLyBhbmQgY29udGludWUgYWRkaW5nIHR3byBub2Rlcy5cbiAgICAgICAgICAgICAgICAgICAgdmFyIG9sZEJvZHkgPSBub2RlLmJvZHk7XG4gICAgICAgICAgICAgICAgICAgIG5vZGUuYm9keSA9IG51bGw7IC8vIGludGVybmFsIG5vZGVzIGRvIG5vdCBjYXJ5IGJvZGllc1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChpc1NhbWVQb3NpdGlvbihvbGRCb2R5LnBvcywgYm9keS5wb3MpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBQcmV2ZW50IGluZmluaXRlIHN1YmRpdmlzaW9uIGJ5IGJ1bXBpbmcgb25lIG5vZGVcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFueXdoZXJlIGluIHRoaXMgcXVhZHJhbnRcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChub2RlLnJpZ2h0IC0gbm9kZS5sZWZ0IDwgMWUtOCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFRoaXMgaXMgdmVyeSBiYWQsIHdlIHJhbiBvdXQgb2YgcHJlY2lzaW9uLlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGlmIHdlIGRvIG5vdCByZXR1cm4gZnJvbSB0aGUgbWV0aG9kIHdlJ2xsIGdldCBpbnRvXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gaW5maW5pdGUgbG9vcCBoZXJlLiBTbyB3ZSBzYWNyaWZpY2UgY29ycmVjdG5lc3Mgb2YgbGF5b3V0LCBhbmQga2VlcCB0aGUgYXBwIHJ1bm5pbmdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBOZXh0IGxheW91dCBpdGVyYXRpb24gc2hvdWxkIGdldCBsYXJnZXIgYm91bmRpbmcgYm94IGluIHRoZSBmaXJzdCBzdGVwIGFuZCBmaXggdGhpc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGRvIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgb2Zmc2V0ID0gcmFuZG9tLm5leHREb3VibGUoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgZHggPSAobm9kZS5yaWdodCAtIG5vZGUubGVmdCkgKiBvZmZzZXQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGR5ID0gKG5vZGUuYm90dG9tIC0gbm9kZS50b3ApICogb2Zmc2V0O1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb2xkQm9keS5wb3MueCA9IG5vZGUubGVmdCArIGR4O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9sZEJvZHkucG9zLnkgPSBub2RlLnRvcCArIGR5O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIE1ha2Ugc3VyZSB3ZSBkb24ndCBidW1wIGl0IG91dCBvZiB0aGUgYm94LiBJZiB3ZSBkbywgbmV4dCBpdGVyYXRpb24gc2hvdWxkIGZpeCBpdFxuICAgICAgICAgICAgICAgICAgICAgICAgfSB3aGlsZSAoaXNTYW1lUG9zaXRpb24ob2xkQm9keS5wb3MsIGJvZHkucG9zKSk7XG5cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAvLyBOZXh0IGl0ZXJhdGlvbiBzaG91bGQgc3ViZGl2aWRlIG5vZGUgZnVydGhlci5cbiAgICAgICAgICAgICAgICAgICAgaW5zZXJ0U3RhY2sucHVzaChub2RlLCBvbGRCb2R5KTtcbiAgICAgICAgICAgICAgICAgICAgaW5zZXJ0U3RhY2sucHVzaChub2RlLCBib2R5KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgIH1cbiAgICAgICAgfSxcblxuICAgICAgICB1cGRhdGUgPSBmdW5jdGlvbiAoc291cmNlQm9keSkge1xuICAgICAgICAgICAgdmFyIHF1ZXVlID0gdXBkYXRlUXVldWUsXG4gICAgICAgICAgICAgICAgdixcbiAgICAgICAgICAgICAgICBkeCxcbiAgICAgICAgICAgICAgICBkeSxcbiAgICAgICAgICAgICAgICByLFxuICAgICAgICAgICAgICAgIHF1ZXVlTGVuZ3RoID0gMSxcbiAgICAgICAgICAgICAgICBzaGlmdElkeCA9IDAsXG4gICAgICAgICAgICAgICAgcHVzaElkeCA9IDE7XG5cbiAgICAgICAgICAgIHF1ZXVlWzBdID0gcm9vdDtcblxuICAgICAgICAgICAgd2hpbGUgKHF1ZXVlTGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgdmFyIG5vZGUgPSBxdWV1ZVtzaGlmdElkeF0sXG4gICAgICAgICAgICAgICAgICAgIGJvZHkgPSBub2RlLmJvZHk7XG5cbiAgICAgICAgICAgICAgICBxdWV1ZUxlbmd0aCAtPSAxO1xuICAgICAgICAgICAgICAgIHNoaWZ0SWR4ICs9IDE7XG4gICAgICAgICAgICAgICAgLy8gdGVjaG5pY2FsbHkgdGhlcmUgc2hvdWxkIGJlIGV4dGVybmFsIFwiaWYgKGJvZHkgIT09IHNvdXJjZUJvZHkpIHtcIlxuICAgICAgICAgICAgICAgIC8vIGJ1dCBpbiBwcmFjdGljZSBpdCBnaXZlcyBzbGlnaHRnaGx5IHdvcnNlIHBlcmZvcm1hbmNlLCBhbmQgZG9lcyBub3RcbiAgICAgICAgICAgICAgICAvLyBoYXZlIGltcGFjdCBvbiBsYXlvdXQgY29ycmVjdG5lc3NcbiAgICAgICAgICAgICAgICBpZiAoYm9keSAmJiBib2R5ICE9PSBzb3VyY2VCb2R5KSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIElmIHRoZSBjdXJyZW50IG5vZGUgaXMgYSBsZWFmIG5vZGUgKGFuZCBpdCBpcyBub3Qgc291cmNlIGJvZHkpLFxuICAgICAgICAgICAgICAgICAgICAvLyBjYWxjdWxhdGUgdGhlIGZvcmNlIGV4ZXJ0ZWQgYnkgdGhlIGN1cnJlbnQgbm9kZSBvbiBib2R5LCBhbmQgYWRkIHRoaXNcbiAgICAgICAgICAgICAgICAgICAgLy8gYW1vdW50IHRvIGJvZHkncyBuZXQgZm9yY2UuXG4gICAgICAgICAgICAgICAgICAgIGR4ID0gYm9keS5wb3MueCAtIHNvdXJjZUJvZHkucG9zLng7XG4gICAgICAgICAgICAgICAgICAgIGR5ID0gYm9keS5wb3MueSAtIHNvdXJjZUJvZHkucG9zLnk7XG4gICAgICAgICAgICAgICAgICAgIHIgPSBNYXRoLnNxcnQoZHggKiBkeCArIGR5ICogZHkpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChyID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBQb29yIG1hbidzIHByb3RlY3Rpb24gYWdhaW5zdCB6ZXJvIGRpc3RhbmNlLlxuICAgICAgICAgICAgICAgICAgICAgICAgZHggPSAocmFuZG9tLm5leHREb3VibGUoKSAtIDAuNSkgLyA1MDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGR5ID0gKHJhbmRvbS5uZXh0RG91YmxlKCkgLSAwLjUpIC8gNTA7XG4gICAgICAgICAgICAgICAgICAgICAgICByID0gTWF0aC5zcXJ0KGR4ICogZHggKyBkeSAqIGR5KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIFRoaXMgaXMgc3RhbmRhcmQgZ3Jhdml0aW9uIGZvcmNlIGNhbGN1bGF0aW9uIGJ1dCB3ZSBkaXZpZGVcbiAgICAgICAgICAgICAgICAgICAgLy8gYnkgcl4zIHRvIHNhdmUgdHdvIG9wZXJhdGlvbnMgd2hlbiBub3JtYWxpemluZyBmb3JjZSB2ZWN0b3IuXG4gICAgICAgICAgICAgICAgICAgIHYgPSBncmF2aXR5ICogYm9keS5tYXNzICogc291cmNlQm9keS5tYXNzIC8gKHIgKiByICogcik7XG4gICAgICAgICAgICAgICAgICAgIHNvdXJjZUJvZHkuZm9yY2UueCArPSB2ICogZHg7XG4gICAgICAgICAgICAgICAgICAgIHNvdXJjZUJvZHkuZm9yY2UueSArPSB2ICogZHk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gT3RoZXJ3aXNlLCBjYWxjdWxhdGUgdGhlIHJhdGlvIHMgLyByLCAgd2hlcmUgcyBpcyB0aGUgd2lkdGggb2YgdGhlIHJlZ2lvblxuICAgICAgICAgICAgICAgICAgICAvLyByZXByZXNlbnRlZCBieSB0aGUgaW50ZXJuYWwgbm9kZSwgYW5kIHIgaXMgdGhlIGRpc3RhbmNlIGJldHdlZW4gdGhlIGJvZHlcbiAgICAgICAgICAgICAgICAgICAgLy8gYW5kIHRoZSBub2RlJ3MgY2VudGVyLW9mLW1hc3NcbiAgICAgICAgICAgICAgICAgICAgZHggPSBub2RlLm1hc3NYIC8gbm9kZS5tYXNzIC0gc291cmNlQm9keS5wb3MueDtcbiAgICAgICAgICAgICAgICAgICAgZHkgPSBub2RlLm1hc3NZIC8gbm9kZS5tYXNzIC0gc291cmNlQm9keS5wb3MueTtcbiAgICAgICAgICAgICAgICAgICAgciA9IE1hdGguc3FydChkeCAqIGR4ICsgZHkgKiBkeSk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHIgPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFNvcnJ5IGFib3V0IGNvZGUgZHVwbHVjYXRpb24uIEkgZG9uJ3Qgd2FudCB0byBjcmVhdGUgbWFueSBmdW5jdGlvbnNcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHJpZ2h0IGF3YXkuIEp1c3Qgd2FudCB0byBzZWUgcGVyZm9ybWFuY2UgZmlyc3QuXG4gICAgICAgICAgICAgICAgICAgICAgICBkeCA9IChyYW5kb20ubmV4dERvdWJsZSgpIC0gMC41KSAvIDUwO1xuICAgICAgICAgICAgICAgICAgICAgICAgZHkgPSAocmFuZG9tLm5leHREb3VibGUoKSAtIDAuNSkgLyA1MDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHIgPSBNYXRoLnNxcnQoZHggKiBkeCArIGR5ICogZHkpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIC8vIElmIHMgLyByIDwgzrgsIHRyZWF0IHRoaXMgaW50ZXJuYWwgbm9kZSBhcyBhIHNpbmdsZSBib2R5LCBhbmQgY2FsY3VsYXRlIHRoZVxuICAgICAgICAgICAgICAgICAgICAvLyBmb3JjZSBpdCBleGVydHMgb24gYm9keSBiLCBhbmQgYWRkIHRoaXMgYW1vdW50IHRvIGIncyBuZXQgZm9yY2UuXG4gICAgICAgICAgICAgICAgICAgIGlmICgobm9kZS5yaWdodCAtIG5vZGUubGVmdCkgLyByIDwgdGhldGEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGluIHRoZSBpZiBzdGF0ZW1lbnQgYWJvdmUgd2UgY29uc2lkZXIgbm9kZSdzIHdpZHRoIG9ubHlcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGJlY2F1c2UgdGhlIHJlZ2lvbiB3YXMgc3F1YXJpZmllZCBkdXJpbmcgdHJlZSBjcmVhdGlvbi5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFRodXMgdGhlcmUgaXMgbm8gZGlmZmVyZW5jZSBiZXR3ZWVuIHVzaW5nIHdpZHRoIG9yIGhlaWdodC5cbiAgICAgICAgICAgICAgICAgICAgICAgIHYgPSBncmF2aXR5ICogbm9kZS5tYXNzICogc291cmNlQm9keS5tYXNzIC8gKHIgKiByICogcik7XG4gICAgICAgICAgICAgICAgICAgICAgICBzb3VyY2VCb2R5LmZvcmNlLnggKz0gdiAqIGR4O1xuICAgICAgICAgICAgICAgICAgICAgICAgc291cmNlQm9keS5mb3JjZS55ICs9IHYgKiBkeTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIE90aGVyd2lzZSwgcnVuIHRoZSBwcm9jZWR1cmUgcmVjdXJzaXZlbHkgb24gZWFjaCBvZiB0aGUgY3VycmVudCBub2RlJ3MgY2hpbGRyZW4uXG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEkgaW50ZW50aW9uYWxseSB1bmZvbGRlZCB0aGlzIGxvb3AsIHRvIHNhdmUgc2V2ZXJhbCBDUFUgY3ljbGVzLlxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG5vZGUucXVhZHNbMF0pIHsgcXVldWVbcHVzaElkeF0gPSBub2RlLnF1YWRzWzBdOyBxdWV1ZUxlbmd0aCArPSAxOyBwdXNoSWR4ICs9IDE7IH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChub2RlLnF1YWRzWzFdKSB7IHF1ZXVlW3B1c2hJZHhdID0gbm9kZS5xdWFkc1sxXTsgcXVldWVMZW5ndGggKz0gMTsgcHVzaElkeCArPSAxOyB9XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobm9kZS5xdWFkc1syXSkgeyBxdWV1ZVtwdXNoSWR4XSA9IG5vZGUucXVhZHNbMl07IHF1ZXVlTGVuZ3RoICs9IDE7IHB1c2hJZHggKz0gMTsgfVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG5vZGUucXVhZHNbM10pIHsgcXVldWVbcHVzaElkeF0gPSBub2RlLnF1YWRzWzNdOyBxdWV1ZUxlbmd0aCArPSAxOyBwdXNoSWR4ICs9IDE7IH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcblxuICAgICAgICBpbnNlcnRCb2RpZXMgPSBmdW5jdGlvbiAoYm9kaWVzKSB7XG4gICAgICAgICAgICB2YXIgeDEgPSBOdW1iZXIuTUFYX1ZBTFVFLFxuICAgICAgICAgICAgICAgIHkxID0gTnVtYmVyLk1BWF9WQUxVRSxcbiAgICAgICAgICAgICAgICB4MiA9IE51bWJlci5NSU5fVkFMVUUsXG4gICAgICAgICAgICAgICAgeTIgPSBOdW1iZXIuTUlOX1ZBTFVFLFxuICAgICAgICAgICAgICAgIGksXG4gICAgICAgICAgICAgICAgbWF4ID0gYm9kaWVzLmxlbmd0aDtcblxuICAgICAgICAgICAgLy8gVG8gcmVkdWNlIHF1YWQgdHJlZSBkZXB0aCB3ZSBhcmUgbG9va2luZyBmb3IgZXhhY3QgYm91bmRpbmcgYm94IG9mIGFsbCBwYXJ0aWNsZXMuXG4gICAgICAgICAgICBpID0gbWF4O1xuICAgICAgICAgICAgd2hpbGUgKGktLSkge1xuICAgICAgICAgICAgICAgIHZhciB4ID0gYm9kaWVzW2ldLnBvcy54O1xuICAgICAgICAgICAgICAgIHZhciB5ID0gYm9kaWVzW2ldLnBvcy55O1xuICAgICAgICAgICAgICAgIGlmICh4IDwgeDEpIHsgeDEgPSB4OyB9XG4gICAgICAgICAgICAgICAgaWYgKHggPiB4MikgeyB4MiA9IHg7IH1cbiAgICAgICAgICAgICAgICBpZiAoeSA8IHkxKSB7IHkxID0geTsgfVxuICAgICAgICAgICAgICAgIGlmICh5ID4geTIpIHsgeTIgPSB5OyB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFNxdWFyaWZ5IHRoZSBib3VuZHMuXG4gICAgICAgICAgICB2YXIgZHggPSB4MiAtIHgxLFxuICAgICAgICAgICAgICAgIGR5ID0geTIgLSB5MTtcbiAgICAgICAgICAgIGlmIChkeCA+IGR5KSB7IHkyID0geTEgKyBkeDsgfSBlbHNlIHsgeDIgPSB4MSArIGR5OyB9XG5cbiAgICAgICAgICAgIGN1cnJlbnRJbkNhY2hlID0gMDtcbiAgICAgICAgICAgIHJvb3QgPSBuZXdOb2RlKCk7XG4gICAgICAgICAgICByb290LmxlZnQgPSB4MTtcbiAgICAgICAgICAgIHJvb3QucmlnaHQgPSB4MjtcbiAgICAgICAgICAgIHJvb3QudG9wID0geTE7XG4gICAgICAgICAgICByb290LmJvdHRvbSA9IHkyO1xuXG4gICAgICAgICAgICBpID0gbWF4IC0gMTtcbiAgICAgICAgICAgIGlmIChpID4gMCkge1xuICAgICAgICAgICAgICByb290LmJvZHkgPSBib2RpZXNbaV07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgICAgICAgICAgaW5zZXJ0KGJvZGllc1tpXSwgcm9vdCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBpbnNlcnRCb2RpZXMgOiBpbnNlcnRCb2RpZXMsXG4gICAgICAgIHVwZGF0ZUJvZHlGb3JjZSA6IHVwZGF0ZSxcbiAgICAgICAgb3B0aW9ucyA6IGZ1bmN0aW9uIChuZXdPcHRpb25zKSB7XG4gICAgICAgICAgICBpZiAobmV3T3B0aW9ucykge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgbmV3T3B0aW9ucy5ncmF2aXR5ID09PSAnbnVtYmVyJykgeyBncmF2aXR5ID0gbmV3T3B0aW9ucy5ncmF2aXR5OyB9XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBuZXdPcHRpb25zLnRoZXRhID09PSAnbnVtYmVyJykgeyB0aGV0YSA9IG5ld09wdGlvbnMudGhldGE7IH1cblxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4ge2dyYXZpdHkgOiBncmF2aXR5LCB0aGV0YSA6IHRoZXRhfTtcbiAgICAgICAgfVxuICAgIH07XG59O1xuXG4iLCJtb2R1bGUuZXhwb3J0cyA9IEluc2VydFN0YWNrO1xuXG4vKipcbiAqIE91ciBpbXBsbWVudGF0aW9uIG9mIFF1YWRUcmVlIGlzIG5vbi1yZWN1cnNpdmUgKHJlY3Vyc2lvbiBoYW5kbGVkIG5vdCByZWFsbHlcbiAqIHdlbGwgaW4gb2xkIGJyb3dzZXJzKS4gVGhpcyBkYXRhIHN0cnVjdHVyZSByZXByZXNlbnQgc3RhY2sgb2YgZWxlbW50c1xuICogd2hpY2ggd2UgYXJlIHRyeWluZyB0byBpbnNlcnQgaW50byBxdWFkIHRyZWUuIEl0IGFsc28gYXZvaWRzIHVubmVjZXNzYXJ5XG4gKiBtZW1vcnkgcHJlc3N1ZSB3aGVuIHdlIGFyZSBhZGRpbmcgbW9yZSBlbGVtZW50c1xuICovXG5mdW5jdGlvbiBJbnNlcnRTdGFjayAoKSB7XG4gICAgdGhpcy5zdGFjayA9IFtdO1xuICAgIHRoaXMucG9wSWR4ID0gMDtcbn1cblxuSW5zZXJ0U3RhY2sucHJvdG90eXBlID0ge1xuICAgIGlzRW1wdHk6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5wb3BJZHggPT09IDA7XG4gICAgfSxcbiAgICBwdXNoOiBmdW5jdGlvbiAobm9kZSwgYm9keSkge1xuICAgICAgICB2YXIgaXRlbSA9IHRoaXMuc3RhY2tbdGhpcy5wb3BJZHhdO1xuICAgICAgICBpZiAoIWl0ZW0pIHtcbiAgICAgICAgICAgIC8vIHdlIGFyZSB0cnlpbmcgdG8gYXZvaWQgbWVtb3J5IHByZXNzdWU6IGNyZWF0ZSBuZXcgZWxlbWVudFxuICAgICAgICAgICAgLy8gb25seSB3aGVuIGFic29sdXRlbHkgbmVjZXNzYXJ5XG4gICAgICAgICAgICB0aGlzLnN0YWNrW3RoaXMucG9wSWR4XSA9IG5ldyBJbnNlcnRTdGFja0VsZW1lbnQobm9kZSwgYm9keSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpdGVtLm5vZGUgPSBub2RlO1xuICAgICAgICAgICAgaXRlbS5ib2R5ID0gYm9keTtcbiAgICAgICAgfVxuICAgICAgICArK3RoaXMucG9wSWR4O1xuICAgIH0sXG4gICAgcG9wOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICh0aGlzLnBvcElkeCA+IDApIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnN0YWNrWy0tdGhpcy5wb3BJZHhdO1xuICAgICAgICB9XG4gICAgfSxcbiAgICByZXNldDogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLnBvcElkeCA9IDA7XG4gICAgfVxufTtcblxuZnVuY3Rpb24gSW5zZXJ0U3RhY2tFbGVtZW50KG5vZGUsIGJvZHkpIHtcbiAgICB0aGlzLm5vZGUgPSBub2RlOyAvLyBRdWFkVHJlZSBub2RlXG4gICAgdGhpcy5ib2R5ID0gYm9keTsgLy8gcGh5c2ljYWwgYm9keSB3aGljaCBuZWVkcyB0byBiZSBpbnNlcnRlZCB0byBub2RlXG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGlzU2FtZVBvc2l0aW9uKHBvaW50MSwgcG9pbnQyKSB7XG4gICAgdmFyIGR4ID0gTWF0aC5hYnMocG9pbnQxLnggLSBwb2ludDIueCk7XG4gICAgdmFyIGR5ID0gTWF0aC5hYnMocG9pbnQxLnkgLSBwb2ludDIueSk7XG5cbiAgICByZXR1cm4gKGR4IDwgMWUtOCAmJiBkeSA8IDFlLTgpO1xufTtcbiIsIi8qKlxuICogSW50ZXJuYWwgZGF0YSBzdHJ1Y3R1cmUgdG8gcmVwcmVzZW50IDJEIFF1YWRUcmVlIG5vZGVcbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBOb2RlKCkge1xuICAvLyBib2R5IHN0b3JlZCBpbnNpZGUgdGhpcyBub2RlLiBJbiBxdWFkIHRyZWUgb25seSBsZWFmIG5vZGVzIChieSBjb25zdHJ1Y3Rpb24pXG4gIC8vIGNvbnRhaW4gYm9pZGVzOlxuICB0aGlzLmJvZHkgPSBudWxsO1xuXG4gIC8vIENoaWxkIG5vZGVzIGFyZSBzdG9yZWQgaW4gcXVhZHMuIEVhY2ggcXVhZCBpcyBwcmVzZW50ZWQgYnkgbnVtYmVyOlxuICAvLyAwIHwgMVxuICAvLyAtLS0tLVxuICAvLyAyIHwgM1xuICB0aGlzLnF1YWRzID0gW107XG5cbiAgLy8gVG90YWwgbWFzcyBvZiBjdXJyZW50IG5vZGVcbiAgdGhpcy5tYXNzID0gMDtcblxuICAvLyBDZW50ZXIgb2YgbWFzcyBjb29yZGluYXRlc1xuICB0aGlzLm1hc3NYID0gMDtcbiAgdGhpcy5tYXNzWSA9IDA7XG5cbiAgLy8gYm91bmRpbmcgYm94IGNvb3JkaW5hdGVzXG4gIHRoaXMubGVmdCA9IDA7XG4gIHRoaXMudG9wID0gMDtcbiAgdGhpcy5ib3R0b20gPSAwO1xuICB0aGlzLnJpZ2h0ID0gMDtcblxuICAvLyBOb2RlIGlzIGludGVybmFsIHdoZW4gaXQgaXMgbm90IGEgbGVhZlxuICB0aGlzLmlzSW50ZXJuYWwgPSBmYWxzZTtcbn07XG4iLCJ2YXIgYnVuZGxlRm4gPSBhcmd1bWVudHNbM107XG52YXIgc291cmNlcyA9IGFyZ3VtZW50c1s0XTtcbnZhciBjYWNoZSA9IGFyZ3VtZW50c1s1XTtcblxudmFyIHN0cmluZ2lmeSA9IEpTT04uc3RyaW5naWZ5O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChmbikge1xuICAgIHZhciBrZXlzID0gW107XG4gICAgdmFyIHdrZXk7XG4gICAgdmFyIGNhY2hlS2V5cyA9IE9iamVjdC5rZXlzKGNhY2hlKTtcbiAgICBcbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IGNhY2hlS2V5cy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgdmFyIGtleSA9IGNhY2hlS2V5c1tpXTtcbiAgICAgICAgaWYgKGNhY2hlW2tleV0uZXhwb3J0cyA9PT0gZm4pIHtcbiAgICAgICAgICAgIHdrZXkgPSBrZXk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgIH1cbiAgICBcbiAgICBpZiAoIXdrZXkpIHtcbiAgICAgICAgd2tleSA9IE1hdGguZmxvb3IoTWF0aC5wb3coMTYsIDgpICogTWF0aC5yYW5kb20oKSkudG9TdHJpbmcoMTYpO1xuICAgICAgICB2YXIgd2NhY2hlID0ge307XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gY2FjaGVLZXlzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgdmFyIGtleSA9IGNhY2hlS2V5c1tpXTtcbiAgICAgICAgICAgIHdjYWNoZVtrZXldID0ga2V5O1xuICAgICAgICB9XG4gICAgICAgIHNvdXJjZXNbd2tleV0gPSBbXG4gICAgICAgICAgICBGdW5jdGlvbihbJ3JlcXVpcmUnLCdtb2R1bGUnLCdleHBvcnRzJ10sICcoJyArIGZuICsgJykoc2VsZiknKSxcbiAgICAgICAgICAgIHdjYWNoZVxuICAgICAgICBdO1xuICAgIH1cbiAgICB2YXIgc2tleSA9IE1hdGguZmxvb3IoTWF0aC5wb3coMTYsIDgpICogTWF0aC5yYW5kb20oKSkudG9TdHJpbmcoMTYpO1xuICAgIFxuICAgIHZhciBzY2FjaGUgPSB7fTsgc2NhY2hlW3drZXldID0gd2tleTtcbiAgICBzb3VyY2VzW3NrZXldID0gW1xuICAgICAgICBGdW5jdGlvbihbJ3JlcXVpcmUnXSwncmVxdWlyZSgnICsgc3RyaW5naWZ5KHdrZXkpICsgJykoc2VsZiknKSxcbiAgICAgICAgc2NhY2hlXG4gICAgXTtcbiAgICBcbiAgICB2YXIgc3JjID0gJygnICsgYnVuZGxlRm4gKyAnKSh7J1xuICAgICAgICArIE9iamVjdC5rZXlzKHNvdXJjZXMpLm1hcChmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgICAgICByZXR1cm4gc3RyaW5naWZ5KGtleSkgKyAnOlsnXG4gICAgICAgICAgICAgICAgKyBzb3VyY2VzW2tleV1bMF1cbiAgICAgICAgICAgICAgICArICcsJyArIHN0cmluZ2lmeShzb3VyY2VzW2tleV1bMV0pICsgJ10nXG4gICAgICAgICAgICA7XG4gICAgICAgIH0pLmpvaW4oJywnKVxuICAgICAgICArICd9LHt9LFsnICsgc3RyaW5naWZ5KHNrZXkpICsgJ10pJ1xuICAgIDtcbiAgICBcbiAgICB2YXIgVVJMID0gd2luZG93LlVSTCB8fCB3aW5kb3cud2Via2l0VVJMIHx8IHdpbmRvdy5tb3pVUkwgfHwgd2luZG93Lm1zVVJMO1xuICAgIFxuICAgIHJldHVybiBuZXcgV29ya2VyKFVSTC5jcmVhdGVPYmplY3RVUkwoXG4gICAgICAgIG5ldyBCbG9iKFtzcmNdLCB7IHR5cGU6ICd0ZXh0L2phdmFzY3JpcHQnIH0pXG4gICAgKSk7XG59O1xuIiwidmFyIGdyYXBoID0gcmVxdWlyZSgnbmdyYXBoLmdyYXBoJykoKTtcbnZhciBub2RlUG9zaXRpb25zID0ge307XG5cbnZhciBjcmVhdGVMYXlvdXQgPSBmdW5jdGlvbiAoZ3JhcGgpIHtcbiAgICB2YXIgbGF5b3V0ID0gcmVxdWlyZSgnbmdyYXBoLmZvcmNlbGF5b3V0JyksXG4gICAgICAgIHBoeXNpY3MgPSByZXF1aXJlKCduZ3JhcGgucGh5c2ljcy5zaW11bGF0b3InKTtcblxuICAgIHJldHVybiBsYXlvdXQoZ3JhcGgsIHBoeXNpY3Moe1xuICAgICAgICBzcHJpbmdMZW5ndGg6IDMwLFxuICAgICAgICBzcHJpbmdDb2VmZjogMC4wMDAxLFxuICAgICAgICBkcmFnQ29lZmY6IDAuMDEsXG4gICAgICAgIGdyYXZpdHk6IC0wLjUsXG4gICAgICAgIHRoZXRhOiAwLjVcbiAgICB9KSk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChzZWxmKSB7XG4gICAgdmFyIF9qTm9kZUlkcyA9IHt9O1xuICAgIHZhciBsYXlvdXQgPSBjcmVhdGVMYXlvdXQoZ3JhcGgpO1xuXG4gICAgc2VsZi5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgZnVuY3Rpb24gKGV2KSB7XG4gICAgICAgIHZhciBkYXRhID0gZXYuZGF0YS5qc29uRGF0YTtcblxuICAgICAgICBkYXRhLm5vZGVzLmZvckVhY2goZnVuY3Rpb24gKGpOb2RlLCBpKSB7XG4gICAgICAgICAgICAvL19ub2Rlc0J5SWRbbm9kZS5pZF0gPSBub2RlO1xuICAgICAgICAgICAgdmFyIHZOb2RlID0gZ3JhcGguYWRkTm9kZShqTm9kZS5pZCk7XG4gICAgICAgICAgICBfak5vZGVJZHNbdk5vZGUuaWRdID0gak5vZGUuaWQ7XG4gICAgICAgIH0pO1xuICAgICAgICBkYXRhLmVkZ2VzLmZvckVhY2goZnVuY3Rpb24gKGVkZ2UsIGkpIHtcbiAgICAgICAgICAgIC8vaWYgKGVkZ2Uud2VpZ2h0IDwgNikgcmV0dXJuO1xuICAgICAgICAgICAgZ3JhcGguYWRkTGluayhlZGdlLnNvdXJjZSwgZWRnZS50YXJnZXQsIHtjb25uZWN0aW9uU3RyZW5ndGg6IGVkZ2Uud2VpZ2h0fSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGdyYXBoLmZvckVhY2hOb2RlKGZ1bmN0aW9uIChub2RlKSB7XG4gICAgICAgICAgICBub2RlUG9zaXRpb25zW19qTm9kZUlkc1tub2RlLmlkXV0gPSBsYXlvdXQuZ2V0Tm9kZVBvc2l0aW9uKG5vZGUuaWQpO1xuICAgICAgICB9KTtcblxuICAgICAgICB2YXIgaXRlcmF0aW9ucyA9IHBhcnNlSW50KGV2LmRhdGEuaXRlcmF0aW9ucyk7IC8vIGV2LmRhdGE9NCBmcm9tIG1haW4uanNcblxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGl0ZXJhdGlvbnM7IGkrKykge1xuICAgICAgICAgICAgbGF5b3V0LnN0ZXAoKTtcbiAgICAgICAgICAgIGlmIChpICUgZXYuZGF0YS5zdGVwc1Blck1lc3NhZ2UgPT09IDApIHtcbiAgICAgICAgICAgICAgICAvL2JlY2F1c2UgdGhlIGxheW91dCBjYW4gaGFwcGVuIG11Y2ggZmFzdGVyIHRoYW4gdGhlIHJlbmRlciBsb29wLCByZWR1Y2Ugb3ZlcmhlYWQgYnkgbm90IHBhc3NpbmcgZXZlcnkgbG9vcFxuICAgICAgICAgICAgICAgIHNlbGYucG9zdE1lc3NhZ2Uoe2k6IGksIG5vZGVQb3NpdGlvbnM6IG5vZGVQb3NpdGlvbnN9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBzZWxmLnBvc3RNZXNzYWdlKHtpOiBpdGVyYXRpb25zLCBub2RlUG9zaXRpb25zOiBub2RlUG9zaXRpb25zfSk7XG4gICAgfSk7XG5cbn07XG5cbiJdfQ==
