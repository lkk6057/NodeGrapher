window.onload = initialize;
var main;
var chart;
var camera;
var cameraPos = {
    x: 0,
    y: 0
}
var chartPos = {
    x: 0,
    y: 0
};
var scale = 1;
const KeyCode = {
    SHIFT: 16,
    CTRL: 17,
    Z: 90
}
var mousePos = {
    x: 0,
    y: 0
};
var keyStates = [];
var data = {
    dom: {
        elements: []
    },
    camera: {
        position: {
            x: 0,
            y: 0
        }
    }
};
var selected = [];
function initialize() {
    main = document.getElementById("main");
    chart = document.getElementById("chart");
    camera = document.getElementById("camera");
    document.addEventListener("mousedown",click);
    
    document.addEventListener("mousemove", mouseMove);

    document.addEventListener("keydown", keyDown);

    document.addEventListener("keyup", keyUp);

    document.onwheel = zoom;
    repositionElements();
    load();
    render();
}

function zoom(event) {
    var zoomFactor = 1 - (event.deltaY * 0.001);
    scale *= zoomFactor;

    scale = Math.min(Math.max(0.001, scale), 10);
    camera.style.transform = `scale(${scale})`;
    var cMouse = centerPos(mousePos);
    var mouseWorld = screenToWorldPos(mousePos);
    var offset = {
        x: mouseWorld.x - data.camera.position.x,
        y: mouseWorld.y - data.camera.position.y
    };
    var mag = magnitude(offset);

    var width = document.body.clientWidth;
    var height = document.body.clientHeight;

    var normalOff = normalizeVector(offset);
    var traverse = 5;

    //data.camera.position.x+=offset.x/10;
    //data.camera.position.y+=offset.y/10;
    shiftElements();
    render();
}

function keyDown(e) {

    keyStates[e.keyCode] = true;
    inputKey(e.keyCode);

}

function keyUp(e) {

    keyStates[e.keyCode] = false;

}

function inputKey(keyCode) {
    switch (keyCode) {
        case KeyCode.Z:
        if (keyStates[KeyCode.CTRL]&&!updated) {
            if (keyStates[KeyCode.SHIFT]) {
                redo();
            } else {
                undo();
            }
        }
        break;
    }
}

var saves = [];
var currentSave = 0;
function saveState() {
saves.splice(currentSave+1);
var saveState = JSON.stringify(data);
saves.push(saveState);
currentSave = saves.length-1;
console.log(JSON.stringify(saves).length);
}

function undo() {
currentSave = Math.max(0,currentSave-1);
loadSave();
}

function redo() {
currentSave = Math.min(saves.length-1,currentSave+1);
loadSave();
}
function loadSave(){
data = JSON.parse(saves[currentSave]);
recreateElements();
}
function click(e){
    var target = e.path[0];
    if(!keyStates[KeyCode.SHIFT]){
       clearSelection();
       }
    else{
target.blur();
    }
        if(target.tagName=="NODE"){
        selectElement(target);
            
       }
else{
       for(var i = 0;i<selected.length;i++){
var selectedElement = selected[i];       
if(selectedElement!=null){
          selectedElement.blur();
          }
   }
}
}
function clearSelection(){
    for(var i = 0;i<selected.length;i++){
        var selectedElement = document.getElementById(selected[i]);
        if(selectedElement!=null){
           selectedElement.classList.remove("selected");
           }
    }
   selected = []; 
}
function selectElement(element){
if(!selected.includes(element.id)){
           selected.push(element.id);
}
else{
    selected.splice(selected.indexOf(element.id),1);
}
highlightElement(element);
}
function highlightElement(element){
    if(selected.includes(element.getAttribute("id"))){
        element.classList.add("selected");
}
    else{
                element.classList.remove("selected");
    }
}
function mouseMove(e) {
    mousePos.x = e.clientX;
    mousePos.y = e.clientY;
    var width = document.body.clientWidth;
    var height = document.body.clientHeight;
    var worldPos = screenToWorldPos(mousePos);
}

function load() {
    data.dom.elements.push({
        type: "text",
        id: generateUUID(),
        text: "origin",
        position: {
            x: 0,
            y: 0
        }

    });


    var area = 4000;
    for (var i = 0; i < 100; i++) {
        var x = getRandomInt(-area, area);
        var y = getRandomInt(-area, area);
        data.dom.elements.push({
            type: "text",
            id: generateUUID(),
            text: `${x} ${y}`,
            position: {
                x: x,
                y: y
            }

        });
    }

}

var nodeCount = -1;

function render() {
    var newNodeCount = getNodeCount();
    if (nodeCount != newNodeCount) {
        recreateElements();
        saveState();
    } else {
        repositionElements();
    }
    nodeCount = newNodeCount;
}

function recreateElements() {
    camera.innerHTML = [];
    for (var i = 0; i < data.dom.elements.length; i++) {
        var node = data.dom.elements[i];
        camera.appendChild(generateNodeElement(node));
    }
}

function repositionElements() {
    /*var allNodes = getAllNodes();
     for(var i = 0;i<allNodes.length;i++){
         var node = allNodes[i];
         var screenPos = worldToScreenPos(node.position);
         var nodeEle = document.getElementById(node.id);
     nodeEle.style.left = screenPos.x+"px";
     nodeEle.style.top = screenPos.y+"px";
     }*/
    var screenPos = centerPos(multiplyVector(cameraPos, -1), false);
    camera.style.left = (screenPos.x) + "px";
    camera.style.top = (screenPos.y) + "px";
}

function shiftElements() {
    cameraPos = {
        x: 0,
        y: 0
    };
    var screenPos = centerPos(multiplyVector(cameraPos, -1), false);
    camera.style.left = (screenPos.x) + "px";
    camera.style.top = (screenPos.y) + "px";

    var allNodes = getAllNodes();
    for (var i = 0; i < allNodes.length; i++) {
        var node = allNodes[i];
        var screenPos = worldToScreenPos(node.position);
        var nodeEle = document.getElementById(node.id);
        nodeEle.style.left = screenPos.x + "px";
        nodeEle.style.top = screenPos.y + "px";
    }
}

function generateUUID() {
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min) + min); //The maximum is exclusive and the minimum is inclusive
}

function generateTextNode(text, position = {
    x: 0,
    y: 0
}) {
    var node = {
        type: "text",
        id: generateUUID(),
        text: text,
        position: position

    }
    return node;
}

function generateNodeElement(node) {
    var nodeEle;
    var nodeStyle = "";
    switch (node.type) {
        case "text":
            nodeEle = document.createElement("node");
            nodeEle.innerHTML = node.text;
            nodeEle.setAttribute("contenteditable", "true");
            nodeEle.setAttribute("spellcheck", "false");
            nodeEle.addEventListener("DOMCharacterDataModified", function (event) {
                editedText(event);
            }, false);
            break;
    }
    nodeEle.className = "absolute";
    var nodeScreenPos = worldToScreenPos(node.position);
    nodeEle.style.left = nodeScreenPos.x + "px";
    nodeEle.style.top = nodeScreenPos.y + "px";

    if (node.children != null) {
        for (var i = 0; i < node.children.length; i++) {
            var child = node.children[i];
            var childEle = generateNodeElement(child);
            chart.appendChild(childEle);
        }
    }
    dragElement(nodeEle);
    nodeEle.setAttribute("id", node.id);
    highlightElement(nodeEle);
    return nodeEle;
}

function worldToScreenPos(pos) {
    var screenPos = {};

    screenPos.x = (pos.x - data.camera.position.x);
    screenPos.y = (pos.y - data.camera.position.y);
    return screenPos;
}

function screenToWorldPos(pos) {
    var worldPos = {};

    var cPos = centerPos(pos);
    worldPos.x = (cPos.x / scale) + data.camera.position.x;
    worldPos.y = (cPos.y / scale) + data.camera.position.y;
    return worldPos;
}

function magnitude(vector) {
    return Math.sqrt(vector.x ** 2 + vector.y ** 2);
}

function multiplyVector(vector, factor) {
    var multiplied = {
        x: vector.x * factor,
        y: vector.y * factor
    };
    return multiplied;
}

function normalizeVector(vector) {
    var mag = magnitude(vector);
    return multiplyVector(vector, 1 / mag);
}

function centerPos(pos, center = true) {
    var centerFactor = center ? -1 : 1;
    var halfWidth = document.body.clientWidth / 2;
    var halfHeight = document.body.clientHeight / 2;
    var processedPos = {
        x: pos.x + (halfWidth * centerFactor),
        y: pos.y + (halfHeight * centerFactor)
    };
    return processedPos;
}

function nodeToScreenPos() {

}
var updated = false;

function editedText(event) {
    var ele = event.srcElement.parentElement;
    if (ele.id.length == 0) {
        ele = event.srcElement.parentElement.offsetParent;
    }
    //console.log(event);
    var node = getNodeById(ele.id);
    if (node != null) {
        ;
        var breaks = (ele.innerText.match(/\n/g) || []).length;
        var unescaped = breaks > 0 ? "<pre>" + ele.innerText + "</pre>" : ele.innerText;
        node.text = unescaped;
        console.log(unescaped);
        updated = true;
    }
}

function setCursor(ele, pos) {


    // Creates range object
    var setpos = document.createRange();

    // Creates object for selection
    var set = window.getSelection();

    // Set start position of range
    setpos.setStart(ele.childNodes[0], pos);

    // Collapse range within its boundary points
    // Returns boolean
    setpos.collapse(true);

    // Remove all ranges set
    set.removeAllRanges();

    // Add range with respect to range object.
    set.addRange(setpos);

    // Set cursor on focus
    ele.focus();
}

function getNodeById(id) {
    var node = searchNode(data.dom.elements, id);
    return node;
}

function searchNode(nodes, id) {
    for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        if (node.id == id) {
            return node;
        }
        if (node.children != null) {
            var childSearch = searchNode(node.children, id);
            if (childSearch != null) {
                return childSearch;
            }
        }
    }
    return null;
}

function getNodeCount() {
    var nodes = data.dom.elements;

    var nodeCount = countNodes(nodes);
    //var nodeCount = document.getElementsByTagName("NODE").length;
    return nodeCount;
}

function getAllNodes() {
    var allNodes = addNodes(data.dom.elements);
    return allNodes;
}

function addNodes(nodes) {
    var allNodes = nodes;
    for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        if (node.children != null) {
            allNodes = allNodes.concat(addNodes(node.children));
        }
    }
    return allNodes;

}

function countNodes(nodes) {
    var nodeCount = nodes.length;
    for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        if (node.children != null) {
            nodeCount += countNodes(node.children);
        }
    }
    return nodeCount;
}

function dragElement(elmnt) {
    var pos1 = 0,
        pos2 = 0,
        pos3 = 0,
        pos4 = 0;
    elmnt.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        if (keyStates[KeyCode.SHIFT]) {
            e = e || window.event;
            e.preventDefault();
            document.onmouseup = closeDragElement;
            // call a function whenever the cursor moves:
            document.onmousemove = elementDrag;
        }
    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        var elements = [];
        if(selected.length==0){
        var element = getNodeById(elmnt.id);
elements.push(element);
    }
else{
    for(var i = 0;i<selected.length;i++){
var retrieved = document.getElementById(selected[i]);
if(retrieved!=null){
   elements.push(retrieved);
   }
}
}
for(var i = 0;i<elements.length;i++){
var node = elements[i];
        if (node != null) {
        var x = Number(node.style.left.replace("px", ""));
        var y = Number(node.style.top.replace("px", ""));
        var screenPos = {
            x: (x + (e.movementX / scale)),
            y: (y + (e.movementY / scale))
        };
        node.style.top = screenPos.y;
        node.style.left = screenPos.x;
            var retrievedNode = getNodeById(node.id);
            retrievedNode.position.x += (e.movementX / scale);
            retrievedNode.position.y += (e.movementY / scale);
        }
}
    }

    function closeDragElement() {
        // stop moving when mouse button is released:
        document.onmouseup = null;
        document.onmousemove = null;
        shiftElements();
        render();
        saveState();
    }
    document.documentElement.onmousedown = bodyDrag;

    function bodyDrag(e) {
        if (updated) {
            recreateElements();
            saveState();
            updated = false;
        }
        if(!keyStates[KeyCode.SHIFT]){
        if (e.path[0].id == "chart" || e.path[0].id == "main" || e.path[0].id == "camera" || e.path[0].tagName == "HTML" && e.button == 0) {
            cameraDragMouseDown(e);
        }
    }
        else if(selected.length>0){
            dragMouseDown(e);
        }
    }

    function cameraDragMouseDown(e) {
        var startPos = {
            x: e.clientX,
            y: e.clientY
        };
        document.onmouseup = closeDragElement;
        document.onmousemove = function (e) {
            cameraDrag(e, startPos)
        }
    }

    function cameraDrag(e, startPos) {
        var offset = {
            x: startPos.x - e.clientX,
            y: startPos.y - e.clientY
        };
        var deltaX = e.movementX;
        var deltaY = e.movementY;

        data.camera.position.x -= deltaX / scale;
        data.camera.position.y -= deltaY / scale;
        cameraPos.x -= deltaX;
        cameraPos.y -= deltaY;
        //shiftElements();
        render();
    }
}
