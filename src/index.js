window.onload = initialize;
var main;
var chart;
var camera;
var cameraPos = {
    x: 0,
    y: 0
}
var effectsElement;
var cameraNodes;
var chartPos = {
    x: 0,
    y: 0
};
var scale = 1;
const KeyCode = {
    SHIFT: 16,
    CTRL: 17,
    ALT: 18,
    A: 65,
    Z: 90,
    B: 66,
    C: 67,
    R: 82,
    S: 83,
    V: 86,
    X: 88,
    Y: 89,
    Z: 90
}
var mousePos = {
    x: 0,
    y: 0
};
var keyStates = [];
var settings = {
    scaleMode: "mouse",
    grid: false,
    gridSize: 40,
    circleFactor: 1,
    circleOffset: 0

}
var data = {
    library: {},
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
    effectsElement = document.getElementById("effects");
    cameraNodes = document.getElementById("elements");
    document.addEventListener("mousedown", click);

    document.addEventListener("mousemove", mouseMove);

    document.addEventListener("keydown", keyDown);

    document.addEventListener("keyup", keyUp);

    document.onwheel = zoom;
    repositionElements();
    load();
    renderGrid();
    render();
}

function zoom(event) {
    if (!nodeFocused()) {
        var delta = event.deltaY;
        var deltaMag = Math.abs(delta);
        var zoomFactor = 1 - (delta * 0.001);
        if (!keyStates[KeyCode.SHIFT] || selected.length == 0) {
            scale *= zoomFactor;
            scale = Math.min(Math.max(0.001, scale), 10);
        } else {
            if (keyStates[KeyCode.C]) {
                var changeRate = 0.0002;
                if (keyStates[KeyCode.ALT]) {
                    settings.circleOffset += delta * changeRate;
                    if (settings.circleOffset > 1) {
                        settings.circleOffset = 0;
                    } else if (settings.circleOffset < 0) {
                        settings.circleOffset = 1;
                    }
                    circleScaleSelected(0.5);
                } else if (keyStates[KeyCode.S]) {
                    settings.circleFactor -= delta * changeRate;
                    settings.circleFactor = clamp(settings.circleFactor, 0, 1);
                    circleScaleSelected(0.5);
                } else {
                    if (delta > 0) {
                        settings.circleFactor = 1;
                        settings.circleOffset = 0;
                    }
                    circleScaleSelected(0.5);
                }
            } else if (keyStates[KeyCode.R]) {
                rotateSelected(delta);
            } else {
                scaleSelected(zoomFactor);
            }
        }
        camera.style.transform = `scale(${scale})`;
        cameraPos = {
            x: 0,
            y: 0
        };
        shiftElements();
        renderGrid();
        render();
    }
}

function clamp(value, min, max) {
    return Math.max(Math.min(value, max), min);
}

function scaleSelected(zoomFactor) {
    var selectedNodes = [];
    var totX = 0;
    var totY = 0;
    for (var i = 0; i < selected.length; i++) {
        var node = getNodeById(selected[i]);
        if (node != null) {
            selectedNodes.push(node);
            totX += node.position.x;
            totY += node.position.y;
        }
    }
    var averagePos = {
        x: totX / selectedNodes.length,
        y: totY / selectedNodes.length
    };
    for (var i = 0; i < selectedNodes.length; i++) {
        var node = selectedNodes[i];
        var newPosition;
        switch (settings.scaleMode) {
            case "average":
                var averageOffset = {
                    x: node.position.x - averagePos.x,
                    y: node.position.y - averagePos.y
                };
                var scaledOffset = multiplyVector(averageOffset, zoomFactor);
                newPosition = {
                    x: averagePos.x + scaledOffset.x,
                    y: averagePos.y + scaledOffset.y
                };
                break
            case "mouse":
                var mouseWorld = screenToWorldPos(mousePos);
                var mouseOffset = {
                    x: node.position.x - mouseWorld.x,
                    y: node.position.y - mouseWorld.y
                };
                var scaledOffset = multiplyVector(mouseOffset, zoomFactor);
                newPosition = {
                    x: mouseWorld.x + scaledOffset.x,
                    y: mouseWorld.y + scaledOffset.y
                };

                break;
        }
        if (keyStates[KeyCode.X]) {
            newPosition.y = node.position.y;
        } else if (keyStates[KeyCode.Z]) {
            newPosition.x = node.position.x;
        }
        shiftNode(node, newPosition);
    }
}

function circleScaleSelected(zoomFactor) {
    var baseAngle = (((2 * Math.PI) * settings.circleFactor) / selected.length);
    var width = document.body.clientWidth;
    var height = document.body.clientHeight;
    var least = Math.min(width, height);
    var radius = (least / 3)/scale;
    for (var i = 0; i < selected.length; i++) {
        var angle = -baseAngle * i;
        angle += (2 * Math.PI) * settings.circleOffset;
        angle -= (Math.PI / 2);
        var x = Math.cos(angle);
        var y = Math.sin(angle);
        var circleVector = setMagnitudeVector({
            x: x,
            y: y
        }, radius);
        var mouseWorld = screenToWorldPos(mousePos);
        var targetPos = {
            x: mouseWorld.x + circleVector.x,
            y: mouseWorld.y + circleVector.y
        };

        var node = getNodeById(selected[i]);
        var targetOffset = {
            x: targetPos.x - node.position.x,
            y: targetPos.y - node.position.y
        };
        var scaledOffset = multiplyVector(targetOffset, zoomFactor);
        var newPos = addVector(node.position, scaledOffset);
        shiftNode(node, newPos);
    }
}

function rotateSelected(delta) {
var mouseWorld = screenToWorldPos(mousePos);
var rotDelta = (delta*0.0002)*(2*Math.PI);
for(var i = 0;i<selected.length;i++){
    var node = getNodeById(selected[i]);
    var mouseOffset = {x:node.position.x-mouseWorld.x,y:node.position.y-mouseWorld.y};
    var rotatedVector = rotateVector(mouseOffset,rotDelta);
    var newPos = {x:mouseWorld.x+rotatedVector.x,y: mouseWorld.y+rotatedVector.y};
    shiftNode(node,newPos);
}
}
function orderSelected(){
var minWidth = 0;
var minHeight = 0;
var mouseWorld = screenToWorldPos(mousePos);
var selectedElements = [];
for(var i = 0;i<selected.length;i++){
    var element = document.getElementById(selected[i]);
    selectedElements.push(element);
    if(element.offsetWidth>minWidth){
       minWidth = element.offsetWidth;
       }
    if(element.offsetHeight>minHeight){
       minHeight = element.offsetHeight;
       }
}
    var minSize = Math.max(minWidth,minHeight);
    if(keyStates[KeyCode.ALT]){
                   var widthOffset = 0;
       for(var i = 0;i<selected.length;i++){
           var node = getNodeById(selected[i]);
           var newPos = {x:mouseWorld.x+widthOffset,y:mouseWorld.y};
           shiftNode(node,newPos);
           if(i<selected.length+1){
           widthOffset += (selectedElements[i].offsetWidth+selectedElements[i+1].offsetWidth)/2;
       }
           else{
               widthOffset += selectedElements[i].offsetWidth;
           }
       }
       }
    else{
        var rowSize = Math.ceil(Math.sqrt(selected.length));
        var columnCount = Math.ceil(selected.length/rowSize);
        for(var y = 0;y<columnCount;y++){
            for(var x = 0;x<rowSize;x++){
                var index = (rowSize*y)+x;
                if(index<selected.length){
                   var node = getNodeById(selected[index]);
                    var newPos = {x:mouseWorld.x+(x*minSize),y:mouseWorld.y+(y*minSize)};
                    shiftNode(node,newPos);
                   }
                   else{
                   break;
                   }
            }
        }
    }
}
function keyDown(e) {

    keyStates[e.keyCode] = true;
    inputKey(e.keyCode);

}

function keyUp(e) {

    keyStates[e.keyCode] = false;

}

function nodeFocused() {
    return document.activeElement.tagName == "NODE";
}

function unfocus() {
    document.activeElement.blur();
}

function inputKey(keyCode) {
    if (!nodeFocused()) {
        switch (keyCode) {
            case KeyCode.Z:
                if (keyStates[KeyCode.CTRL] && !updated) {
                    if (keyStates[KeyCode.SHIFT]) {
                        redo();
                    } else {
                        undo();
                    }
                }
                break;
            case KeyCode.A:
                toggleAllSelect();
                break;
            case KeyCode.V:
                orderSelected();
            break;
        }
    }
}

var saves = [];
var currentSave = 0;

function saveState() {
    var saveState = JSON.stringify(data.library);
    if (saves[currentSave] != saveState) {
        saves.splice(currentSave + 1);
        saves.push(saveState);
        currentSave = saves.length - 1;
    }
}

function undo() {
    currentSave = Math.max(0, currentSave - 1);
    loadSave();
}

function redo() {
    currentSave = Math.min(saves.length - 1, currentSave + 1);
    loadSave();
}

function loadSave() {
    data.library = JSON.parse(saves[currentSave]);
    recreateElements();
    renderAllLines();
}
var queueClear = false;

function click(e) {
    queueClear = false;
    var range = 3;
    var target;
    for (var i = 0; i < Math.min(e.path.length, range); i++) {
        var potential = e.path[i];
        if (potential.tagName == "NODE") {
            target = potential
        }
    }
    if (keyStates[KeyCode.CTRL]) {
        if (target != null) {
            setParents(target.id);
        } else {
            clearParents();
        }
    } else {
        if (target != null) {
            if (!keyStates[KeyCode.SHIFT]) {
                clearSelection();
            }
            selectElement(target);

        } else {
            if (!keyStates[KeyCode.SHIFT]) {
                queueClear = true;
            }
        }
    }
}

function clearSelection() {
    var selectedIds = [...selected];
    for (var i = 0; i < selectedIds.length; i++) {
        var selectedId = selectedIds[i];
        var element = document.getElementById(selectedId);
        selectElement(element, 1);
    }
}

function toggleAllSelect() {
    if (selected.length > 0) {
        clearSelection();
    } else {
        var allElements = getAllElements();
        for (var i = 0; i < allElements.length; i++) {
            var element = allElements[i];
            selectElement(element, 0);
        }
    }
}

function setParents(nodeId) {
    var node = getNodeById(nodeId);
    var selectedIds = [...selected];
    var duplicateIndex = selectedIds.indexOf(nodeId);
    if (duplicateIndex >= 0) {
        selectedIds.splice(duplicateIndex, 1);
    }
    for (var i = 0; i < selectedIds.length; i++) {
        var toChild = getNodeById(selectedIds[i]);
        appendChild(node, toChild);
    }
    renderAllLines();
}

function clearParents() {
    for (var i = 0; i < selected.length; i++) {
        var child = getNodeById(selected[i]);
        clearParent(child);
    }
    renderAllLines();
}

function selectElement(element, mode = -1) {
    if (element.tagName == "NODE") {
        if (mode == -1) {
            if (!selected.includes(element.id)) {
                mode = 0;
            } else {
                mode = 1
            }
        }
        switch (mode) {
            case 0:
                if (!selected.includes(element.id)) {
                    selected.push(element.id);
                }
                break;
            case 1:
                selected.splice(selected.indexOf(element.id), 1);
                break;
        }
        highlightElement(element);
    }
}

function highlightElement(element) {
    if (selected.includes(element.getAttribute("id"))) {
        element.setAttribute("contenteditable", "true");
        element.setAttribute("unselectable", "on");
        element.classList.add("selected");
    } else {
        element.setAttribute("contenteditable", "false");
        element.setAttribute("unselectable", "on");
        element.classList.remove("selected");
    }
}

function mouseMove(e) {
    mousePos.x = e.clientX;
    mousePos.y = e.clientY;
    var width = document.body.clientWidth;
    var height = document.body.clientHeight;
}

function load() {
    var origin = generateTextNode("origin");
    var area = 2000;
    for (var i = 0; i < 30; i++) {
        var x = getRandomInt(-area, area);
        var y = getRandomInt(-area, area);
        var position = {
            x: x,
            y: y
        };

        var childEle = generateTextNode(`${x} ${y} ${i}`, position);
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
    cameraNodes.innerHTML = [];
    var nodes = getAllNodes();
    for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        var element = generateNodeElement(node);
        cameraNodes.appendChild(element);
    }
}

function removeElementsByName(name) {
    const elements = document.getElementsByName(name);
    while (elements.length > 0) {
        elements[0].parentNode.removeChild(elements[0]);
    }
}

function removeElementsByTagName(tagName) {
    const elements = document.getElementsByTagName(tagName);
    while (elements.length > 0) {
        elements[0].parentNode.removeChild(elements[0]);
    }
}

function renderAllLines() {
    removeElementsByTagName("LINE");
    var allNodes = getAllNodes();
    for (var i = 0; i < allNodes.length; i++) {
        var node = allNodes[i];
        renderLines(node);
    }
}

function renderLines(node) {
    for (var i = 0; i < node.children.length; i++) {
        var child = getChildNode(node, i);
        renderLine(node, child);
    }
}

function renderLine(node, targetNode) {
    var lineName = node.id + "/" + targetNode.id + "line";
    removeElementsByName(lineName);
    var offset = {
        x: targetNode.position.x - node.position.x,
        y: targetNode.position.y - node.position.y
    };
    var line = generateLineElement(offset, node.position);
    line.setAttribute("name", lineName);
    effectsElement.appendChild(line);
}

function generateLineElement(offset, pos, color = "black", thickness = 3) {
    var line = document.createElement("LINE");
    var length = magnitude(offset);
    var angle = Math.atan2(offset.y, offset.x);
    line.style.width = `${length}px`;
    line.style.height = `${thickness}px`;
    line.style.top = `${pos.y}px`;
    line.style.left = `${pos.x}px`;
    line.style.transform = `rotate(${angle}rad)`;
    return line;
}

function repositionElements() {
    renderCamera();
}

function renderCamera() {
    var screenPos = centerPos(cameraPos, false);
    camera.style.left = (screenPos.x) + "px";
    camera.style.top = (screenPos.y) + "px";
}

function shiftElements() {

    var allNodes = getAllNodes();
    for (var i = 0; i < allNodes.length; i++) {
        var node = allNodes[i];
        var cameraOffset = multiplyVector(cameraPos, -1 / scale);
        var screenPos = addVector(worldToScreenPos(node.position), cameraOffset);

        var nodeEle = document.getElementById(node.id);
        nodeEle.style.left = screenPos.x + "px";
        nodeEle.style.top = screenPos.y + "px";
    }
    effectsElement.style.left = -data.camera.position.x + "px";
    effectsElement.style.top = -data.camera.position.y + "px";
    renderCamera();
}

function shiftNode(node, pos) {
    unfocus();
    node.position = pos;
    var ele = document.getElementById(node.id);
    var screenPos = worldToScreenPos(node.position);
    ele.style.left = screenPos.x + "px";
    ele.style.top = screenPos.y + "px";

    renderLines(node);
    var parentNode = getParentNode(node);
    if (parentNode != null) {
        renderLine(parentNode, node)
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
    return Math.floor(Math.random() * (max - min) + min);
}

function generateTextNode(text, position = {
    x: 0,
    y: 0
}, styles = [{
    name: "backgroundColor",
    value: "white"
        }]) {
    var data = {
        text: text
    }
    return generateNode("text", data, position, styles);
}

function generateNode(type, data, position, styles = []) {
    var node = {
        type: "text",
        id: generateUUID(),
        data: data,
        position: position,
        children: [],
        styles: styles,
        parent: "",
        enabled: true
    }
    return updateLibrary(node);
}

function updateLibrary(node) {
    data.library[node.id] = node;
    return data.library[node.id];
}

function generateNodeElement(node) {
    var nodeEle;
    var nodeStyle = "";
    switch (node.type) {
        case "text":
            nodeEle = document.createElement("node");
            nodeEle.innerHTML = formatNodeText(node.data.text);
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

    dragElement(nodeEle);
    nodeEle.setAttribute("id", node.id);
    if (node.style != null) {
        for (var i = 0; i < node.style.length; i++) {
            var style = node.style[i];
            nodeEle.style[style.name] = style.value;
        }
    }
    highlightElement(nodeEle);
    renderLines(node);
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

function distance(vector1, vector2) {
    var offsetVector = {
        x: vector1.x - vector2.x,
        y: vector1.y - vector2.y
    };
    return magnitude(offsetVector);
}

function multiplyVector(vector, factor) {
    var multiplied = {
        x: vector.x * factor,
        y: vector.y * factor
    };
    return multiplied;
}

function addVector(vector1, vector2) {
    var added = {
        x: vector1.x + vector2.x,
        y: vector1.y + vector2.y
    };
    return added;
}
function rotateVector(vector,deltaRad){
    var mag = magnitude(vector);
    var originalAngle = Math.atan2(vector.y,vector.x);
    var newAngle = originalAngle+deltaRad;
    var unitVector = {x:Math.cos(newAngle),y:Math.sin(newAngle)};
    var scaledVector = setMagnitudeVector(unitVector,mag);
    return scaledVector;
    
}
function normalizeVector(vector) {
    setMagnitudeVector(vector,1);
}

function setMagnitudeVector(vector, targetMagnitude) {
    var mag = magnitude(vector);
    return multiplyVector(vector, (1 / mag) * targetMagnitude);
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
    var node = getNodeById(ele.id);
    if (node != null) {

        var breaks = (ele.innerText.match(/\n/g) || []).length;
        var unescaped = formatNodeText(ele.innerText);
        console.log(unescaped);
        node.data.text = unescaped;
        updated = true;
    }
}

function formatNodeText(text) {
    return "<pre>" + text + "</pre>";
}

function setCursor(ele, pos) {

    var setpos = document.createRange();

    var set = window.getSelection();

    setpos.setStart(ele.childNodes[0], pos);


    setpos.collapse(true);


    set.removeAllRanges();


    set.addRange(setpos);


    ele.focus();
}

function getNodeById(id) {
    var node = data.library[id];
    return node;
}

function getNodes(ids) {
    var nodes = [];
    for (var i = 0; i < ids.length; i++) {
        var node = getNodeById(ids[i]);
        nodes.push(node);
    }
    return nodes;
}

function getParentNode(node) {
    var parentNode = getNodeById(node.parent);
    return parentNode;
}

function getChildNode(node, index) {
    var childId = node.children[index];
    var childNode = getNodeById(childId);
    return childNode;
}

function getAllChildren(node) {
    var children = [];
    for (var i = 0; i < node.children.length; i++) {
        var childId = node.children[i];
        var childNode = getNodeById(childId);
        children.push(childNode);
    }
    return children;
}

function clearParent(child) {
    var oldParent = getNodeById(child.parent);
    if (oldParent != null) {
        removeChild(oldParent, child);
    }
}

function appendChild(parent, child) {
    if (child.parent != parent.id) {
        clearParent(child);
        child.parent = parent.id;
    }
    if (!parent.children.includes(child.id)) {
        parent.children.push(child.id);
    }
}

function removeChild(parent, child) {
    child.parent = "";
    var childIndex = parent.children.indexOf(child.id)
    if (childIndex >= 0) {
        parent.children.splice(childIndex, 1);
    }
}


function getNodeCount() {
    var libraryLength = Object.keys(data.library).length;
    return libraryLength;
}

function getSelectedNodes() {
    return getNodes(selected);
}

function getAllNodes() {
    var allNodes = [];
    for (var key in data.library) {
        allNodes.push(data.library[key]);
    }
    return allNodes;
}

function getAllElements() {
    var allElements = [];
    for (var key in data.library) {
        var element = document.getElementById(key);
        allElements.push(element);
    }
    return allElements;
}

function getAllIds() {
    return Object.keys(data.library);
}


var nodeCache = [];

function selectElementBox(origin, end) {
    var worldOrigin = screenToWorldPos(origin);
    var worldEnd = screenToWorldPos(end);
    for (var i = 0; i < nodeCache.length; i++) {
        var node = nodeCache[i];
        var pos = node.position;
        if (pos.x >= worldOrigin.x && pos.x < worldEnd.x && pos.y >= worldOrigin.y && pos.y < worldEnd.y) {
            var element = document.getElementById(node.id);
            if (element != null) {
                selectElement(element, 0);
                highlightElement(element);
            }
        }
    }
}
var startSelectPos = {
    x: 0,
    y: 0
};
var endSelectPos = {
    x: 0,
    y: 0
};
var selecting = false;

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
            document.onmousemove = elementDrag;
        }
    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        var nodes = [];
        if (selected.length == 0) {
            var node = getNodeById(elmnt.id);
            nodes.push(node);
        } else {
            for (var i = 0; i < selected.length; i++) {
                var retrieved = getNodeById(selected[i]);
                if (retrieved != null) {
                    nodes.push(retrieved);
                }
            }
        }
        for (var i = 0; i < nodes.length; i++) {
            var node = nodes[i];
            var newPos = {
                x: node.position.x + (e.movementX / scale),
                y: node.position.y + (e.movementY / scale)
            };
            shiftNode(node, newPos);
        }
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
        selecting = false;
        if (queueClear) {
            clearSelection();
        }
        queueClear = false;
        drawSelection();
        var cMouse = centerPos(mousePos);
        cameraPos = {
            x: 0,
            y: 0
        };
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
        if (!keyStates[KeyCode.SHIFT]) {
            if (e.path[0].tagName != "NODE") {
                cameraDragMouseDown(e);
            }
        } else if (selecting || keyStates[KeyCode.B] || selected.length == 0) {
            selectDragMouseDown(e);
        } else if (selected.length > 0) {
            dragMouseDown(e);
        }
    }

    function selectDragMouseDown(e) {
        nodeCache = getAllNodes();
        selecting = true;
        startSelectPos = {
            x: e.clientX,
            y: e.clientY
        };
        document.onmouseup = closeDragElement;
        document.onmousemove = function (e) {
            selectDrag(e);
        }
    }

    function selectDrag(e) {
        endSelectPos = {
            x: e.clientX,
            y: e.clientY
        };
        drawSelection();

    }

    function drawSelection() {
        var selectionBox = document.getElementById("selection");
        if (selecting) {
            selectionBox.style.visibility = "visible";
            var trueStartPos = {
                x: Math.min(startSelectPos.x, endSelectPos.x),
                y: Math.min(startSelectPos.y, endSelectPos.y)
            }
            var width = Math.abs(startSelectPos.x - endSelectPos.x);
            var height = Math.abs(startSelectPos.y - endSelectPos.y);
            selectionBox.style.left = `${trueStartPos.x}px`;
            selectionBox.style.top = `${trueStartPos.y}px`;
            selectionBox.style.width = `${width}px`;
            selectionBox.style.height = `${height}px`;
            var trueEndPos = {
                x: trueStartPos.x + width,
                y: trueStartPos.y + height
            };
            selectElementBox(trueStartPos, trueEndPos);
        } else {
            selectionBox.style.width = 0;
            selectionBox.style.height = 0;
            selectionBox.style.visibility = "hidden";
        }
        unfocus();
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
        if (magnitude(offset) > 20) {
            queueClear = false;
        }
        var deltaX = e.movementX;
        var deltaY = e.movementY;

        data.camera.position.x -= deltaX / scale;
        data.camera.position.y -= deltaY / scale;
        cameraPos.x += deltaX;
        cameraPos.y += deltaY;
        unfocus();
        renderGrid();
        render();
    }
}

function renderGrid() {
    if (settings.grid) {
        var baseGridHeight = settings.gridSize;
        var baseGridWidth = settings.gridSize;
        var scaledWidth = (document.body.clientWidth / 2);
        var scaledHeight = (document.body.clientHeight / 2);
        document.body.style.backgroundSize = `${baseGridWidth*scale}px ${baseGridHeight*scale}px`;
        document.body.style.backgroundPosition = `top ${(-data.camera.position.y*scale)+scaledHeight}px left ${(-data.camera.position.x*scale)+scaledWidth}`;
        document.body.style.backgroundImage = "";
    } else {
        document.body.style.backgroundImage = "none";
    }
}
