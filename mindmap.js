var stroke=getElementById("stroke").value;

function init() {

  
  var $ = go.GraphObject.make;

  myDiagram =
    $(go.Diagram, "myDiagramDiv",
      {
        "commandHandler.copiesTree": true,
        "commandHandler.copiesParentKey": true,
        "commandHandler.deletesTree": true,
        "draggingTool.dragsTree": true,
        "undoManager.isEnabled": true
      });

  myDiagram.addDiagramListener("Modified", function(e) {
    var button = document.getElementById("SaveButton");
    if (button) button.disabled = !myDiagram.isModified;
    var idx = document.title.indexOf("*");
    if (myDiagram.isModified) {
      if (idx < 0) document.title += "*";
    } else {
      if (idx >= 0) document.title = document.title.substr(0, idx);
    }
  });

  myDiagram.nodeTemplate =
    $(go.Node, "Auto",
      { selectionObjectName: "TEXT"},
      $(go.Shape,"Circle",
        {
          fill:"white",
          stretch: go.GraphObject.Horizontal,
          strokeWidth: 5,
          maxSize:new go.Size(150,150),
          // this line shape is the port -- what links connect with
          portId: "", fromSpot: go.Spot.LeftRightSides, toSpot: go.Spot.LeftRightSides
        },
        new go.Binding("stroke", "brush"),
        // make sure links come in from the proper direction and go out appropriately
        new go.Binding("fromSpot", "dir", function(d) { return spotConverter(d, true); }),
        new go.Binding("toSpot", "dir", function(d) { return spotConverter(d, false); })),
      // remember the locations of each node in the node data
      new go.Binding("location", "loc", go.Point.parse).makeTwoWay(go.Point.stringify),
      // make sure text "grows" in the desired direction
      new go.Binding("locationSpot", "dir", function(d) { return spotConverter(d, false); }),

      $(go.TextBlock,
        {
          overflow: go.TextBlock.OverflowClip,
          name: "TEXT",
          maxSize: new go.Size(60, 60),
          editable: true
        },
        new go.Binding("text", "text").makeTwoWay(),
        new go.Binding("scale", "scale").makeTwoWay(),
        new go.Binding("font", "font").makeTwoWay())
    );

  myDiagram.nodeTemplate.selectionAdornmentTemplate =
    $(go.Adornment, "Spot",
      $(go.Panel, "Auto",
        $(go.Shape,"Circle", { fill: null, stroke: "dodgerblue", strokeWidth: 5 }),
        $(go.Placeholder, { margin: new go.Margin(0) }),
      ),
      $("Button",
        {
          alignment: go.Spot.Right,
          alignmentFocus: go.Spot.Left,
          click: addNodeAndLink  
        },
        $(go.TextBlock, "+", 
          {stroke:"blue", font: "bold 8pt sans-serif" })
      )
    );

  myDiagram.nodeTemplate.contextMenu =
    $("ContextMenu",
      $("ContextMenuButton",
        $(go.TextBlock, "Bigger"),
        { click: function(e, obj) { changeTextSize(obj, 1.1); } }),
      $("ContextMenuButton",
        $(go.TextBlock, "Smaller"),
        { click: function(e, obj) { changeTextSize(obj, 1 / 1.1); } }),
      $("ContextMenuButton",
        $(go.TextBlock, "Bold/Normal"),
        { click: function(e, obj) { toggleTextWeight(obj); } }),
      $("ContextMenuButton",
        $(go.TextBlock, "Copy"),
        { click: function(e, obj) { e.diagram.commandHandler.copySelection(); } }),
      $("ContextMenuButton",
        $(go.TextBlock, "Delete"),
        { click: function(e, obj) { e.diagram.commandHandler.deleteSelection(); } }),
      $("ContextMenuButton",
        $(go.TextBlock, "Undo"),
        { click: function(e, obj) { e.diagram.commandHandler.undo(); } }),
      $("ContextMenuButton",
        $(go.TextBlock, "Redo"),
        { click: function(e, obj) { e.diagram.commandHandler.redo(); } }),
      $("ContextMenuButton",
        $(go.TextBlock, "Sort"),
        {
          click: function(e, obj) {
            var adorn = obj.part;
            adorn.diagram.startTransaction("Subtree Layout");
            layoutTree(adorn.adornedPart);
            adorn.diagram.commitTransaction("Subtree Layout");
          }
        }
      )
    );

  myDiagram.linkTemplate =
    $(go.Link,
      {
        curve: go.Link.Bezier,
        fromShortLength: -6,
        toShortLength: -6,
        selectable: false
      },
      $(go.Shape,
        { strokeWidth: 10 },
        new go.Binding("stroke", "toNode", function(n) {
          if (n.data.brush) return n.data.brush;
          return "black";
        }).ofObject())
    );

  myDiagram.contextMenu =
    $("ContextMenu",
      $("ContextMenuButton",
        $(go.TextBlock, "Paste"),
        { click: function(e, obj) { e.diagram.commandHandler.pasteSelection(e.diagram.lastInput.documentPoint); } }),
      $("ContextMenuButton",
        $(go.TextBlock, "Undo"),
        { click: function(e, obj) { e.diagram.commandHandler.undo(); } },
        new go.Binding("visible", "", function(o) { return o.diagram && o.diagram.commandHandler.canUndo(); }).ofObject()),
      $("ContextMenuButton",
        $(go.TextBlock, "Redo"),
        { click: function(e, obj) { e.diagram.commandHandler.redo(); } },
        new go.Binding("visible", "", function(o) { return o.diagram && o.diagram.commandHandler.canRedo(); }).ofObject()),
      $("ContextMenuButton",
        $(go.TextBlock, "Save"),
        { click: function(e, obj) { save(); } }),
      $("ContextMenuButton",
        $(go.TextBlock, "Load"),
        { click: function(e, obj) { load(); } })
    );

  myDiagram.addDiagramListener("SelectionMoved", function(e) {
    var rootX = myDiagram.findNodeForKey(0).location.x;
    myDiagram.selection.each(function(node) {
      if (node.data.parent !== 0) return;
      var nodeX = node.location.x;
      if (rootX < nodeX && node.data.dir !== "right") {
        updateNodeDirection(node, "right");
      } else if (rootX > nodeX && node.data.dir !== "left") {
        updateNodeDirection(node, "left");
      }
      layoutTree(node);
    });
  });

  load();
}

function spotConverter(dir, from) {
  if (dir === "left") {
    return (from ? go.Spot.Left : go.Spot.Right);
  } else {
    return (from ? go.Spot.Right : go.Spot.Left);
  }
}

function changeTextSize(obj, factor) {
  var adorn = obj.part;
  adorn.diagram.startTransaction("Change Text Size");
  var node = adorn.adornedPart;
  var tb = node.findObject("TEXT");
  tb.scale *= factor;
  adorn.diagram.commitTransaction("Change Text Size");
}

function toggleTextWeight(obj) {
  var adorn = obj.part;
  adorn.diagram.startTransaction("Change Text Weight");
  var node = adorn.adornedPart;
  var tb = node.findObject("TEXT");
  var idx = tb.font.indexOf("bold");
  if (idx < 0) {
    tb.font = "bold " + tb.font;
  } else {
    tb.font = tb.font.substr(idx + 5);
  }
  adorn.diagram.commitTransaction("Change Text Weight");
}

function updateNodeDirection(node, dir) {
  myDiagram.model.setDataProperty(node.data, "dir", dir);
  var chl = node.findTreeChildrenNodes(); 
  while (chl.next()) {
    updateNodeDirection(chl.value, dir);
  }
}

function addNodeAndLink(e, obj) {
  var adorn = obj.part;
  var diagram = adorn.diagram;
  diagram.startTransaction("Add Node");
  var oldnode = adorn.adornedPart;
  var olddata = oldnode.data;
  var newdata = { text: "idea", brush: olddata.brush, dir: olddata.dir, parent: olddata.key };
  if(newdata.parent==0){
    newdata.brush="#"+Math.round(Math.random()*0xffffff).toString(16);
  }
  diagram.model.addNodeData(newdata);
  layoutTree(oldnode);
  diagram.commitTransaction("Add Node");

  var newnode = diagram.findNodeForData(newdata);
  if (newnode !== null) diagram.scrollToRect(newnode.actualBounds);
}

function layoutTree(node) {
  if (node.data.key === 0) { 
    layoutAll();  
  } else {  
    var parts = node.findTreeParts();
    layoutAngle(parts, node.data.dir === "left" ? 180 : 0);
  }
}

function layoutAngle(parts, angle) {
  var layout = go.GraphObject.make(go.TreeLayout,
    {
      angle: angle,
      arrangement: go.TreeLayout.ArrangementFixedRoots,
      nodeSpacing: 5,
      layerSpacing: 20,
      setsPortSpot: false, 
      setsChildPortSpot: false
    });
  layout.doLayout(parts);
}

function layoutAll() {
  var root = myDiagram.findNodeForKey(0);
  if (root === null) return;
  myDiagram.startTransaction("Layout");
  var rightward = new go.Set();
  var leftward = new go.Set();
  root.findLinksConnected().each(function(link) {
    var child = link.toNode;
    if (child.data.dir === "left") {
      leftward.add(root); 
      leftward.add(link);
      leftward.addAll(child.findTreeParts());
    } else {
      rightward.add(root); 
      rightward.add(link);
      rightward.addAll(child.findTreeParts());
    }
  });
  layoutAngle(rightward, 0);
  layoutAngle(leftward, 180);
  myDiagram.commitTransaction("Layout");
}

function save() {
  document.getElementById("mySavedModel").value = myDiagram.model.toJson();
  myDiagram.isModified = false;
  
}
function load() {
  myDiagram.model = go.Model.fromJson(document.getElementById("mySavedModel").value);
  layoutAll();
}