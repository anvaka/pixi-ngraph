var graph = require('ngraph.graph')();
var nodePositions = {};

module.exports = makeIt;
var i = 0;
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

var _jNodeIds = {};
var layout = createLayout(graph);

function makeIt(data) {
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
}

makeIt.step = function(cb) {
  layout.step();

  i++;
  var cbArgs = {
    data: {i: i, nodePositions: nodePositions}
  };
  cb(cbArgs);
}
