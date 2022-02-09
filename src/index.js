window.onload = initialize;
var main;
var chart;
var camera;
var tools;
var toolsHead;
var toolsBody;
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
const KeyBinds = {
    CTRL: 17,
    UNDO: 90,
    MOVE: 16,
    ALTERNATE: 18,
    CIRCLESCALE: 67,
    RADIUS: 83,
    ROTATE: 82,
    BOXSELECT: 66,
    SELECTALL: 65,
    RESET: 70,
    ORDERSORT: 86,
    YAXIS: 90,
    XAXIS: 88,

}
const MacKeyBinds = {
    CTRL: 91
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
    camera: {
        position: {
            x: 0,
            y: 0
        }
    }
};
var selected = [];

function initialize() {
    initializeDocument();
    initializeKeybinds();
    repositionElements();
    load();
    renderGrid();
    render();
}

function initializeDocument() {
    main = document.getElementById("main");
    chart = document.getElementById("chart");
    camera = document.getElementById("camera");
    effectsElement = document.getElementById("effects");
    cameraNodes = document.getElementById("elements");
    tools = document.getElementById("tools");
    toolsHead = document.getElementById("toolsHead");
    toolsBody = document.getElementById("toolsBody");
    initializeTools();
    document.addEventListener("mousedown", click);

    document.addEventListener("mousemove", mouseMove);

    document.addEventListener("keydown", keyDown);

    document.addEventListener("keyup", keyUp);

    window.addEventListener("unload", saveCamera);

    window.addEventListener("blur", unfocusWindow);

    window.addEventListener("resize", resizeWindow);
    document.onwheel = zoom;

    windowSize = {
        width: getWindowWidth(),
        height: getWindowHeight()
    };
}

function getWindowWidth() {
    return window.innerWidth;
}

function getWindowHeight() {
    return window.innerHeight
}

function initializeKeybinds() {
    var isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    if (isMac) {
        for (var prop in MacKeyBinds) {
            KeyBinds[prop] = MacKeyBinds[prop];
        }
    }
}

function unfocusWindow(e) {
    keyStates = [];
}
var windowSize;

function resizeWindow(e) {
    centerCamera();
    var width = getWindowWidth();
    var height = getWindowHeight();
    var xScale = width / windowSize.width;
    var yScale = height / windowSize.height;
    windowSize.width = width;
    windowSize.height = height;

}

function zoom(event) {
    if (!nodeFocused()) {
        var delta = event.deltaY;
        var deltaMag = Math.abs(delta);
        var zoomFactor = 1 - (delta * 0.001);
        if (!keyStates[KeyBinds.MOVE] || selected.length == 0) {
            scale *= zoomFactor;
            scale = Math.min(Math.max(0.001, scale), 10);
        } else {
            if (keyStates[KeyBinds.CIRCLESCALE]) {
                var changeRate = 0.0002;
                if (keyStates[KeyBinds.ALTERNATE]) {
                    settings.circleOffset += delta * changeRate;
                    if (settings.circleOffset > 1) {
                        settings.circleOffset = 0;
                    } else if (settings.circleOffset < 0) {
                        settings.circleOffset = 1;
                    }
                    circleScaleSelected(0.5);
                } else if (keyStates[KeyBinds.RADIUS]) {
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
            } else if (keyStates[KeyBinds.ROTATE]) {
                rotateSelected(delta);
            } else {
                scaleSelected(zoomFactor);
            }
        }
        scaleCamera();
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
        if (keyStates[KeyBinds.XAXIS]) {
            newPosition.y = node.position.y;
        } else if (keyStates[KeyBinds.YAXIS]) {
            newPosition.x = node.position.x;
        }
        shiftNode(node, newPosition);
    }
}

function circleScaleSelected(zoomFactor) {
    var baseAngle = (((2 * Math.PI) * settings.circleFactor) / selected.length);
    var width = getWindowWidth();
    var height = getWindowHeight();
    var least = Math.min(width, height);
    var radius = (least / 3) / scale;
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
    var rotDelta = (delta * 0.0002) * (2 * Math.PI);
    for (var i = 0; i < selected.length; i++) {
        var node = getNodeById(selected[i]);
        var mouseOffset = {
            x: node.position.x - mouseWorld.x,
            y: node.position.y - mouseWorld.y
        };
        var rotatedVector = rotateVector(mouseOffset, rotDelta);
        var newPos = {
            x: mouseWorld.x + rotatedVector.x,
            y: mouseWorld.y + rotatedVector.y
        };
        shiftNode(node, newPos);
    }
}

function orderSelected() {
    var minWidth = 0;
    var minHeight = 0;
    var mouseWorld = screenToWorldPos(mousePos);
    var selectedElements = [];
    for (var i = 0; i < selected.length; i++) {
        var element = document.getElementById(selected[i]);
        selectedElements.push(element);
        if (element.offsetWidth > minWidth) {
            minWidth = element.offsetWidth;
        }
        if (element.offsetHeight > minHeight) {
            minHeight = element.offsetHeight;
        }
    }
    var minSize = Math.max(minWidth, minHeight);
    if (keyStates[KeyBinds.ALTERNATE]) {
        var widthOffset = 0;
        for (var i = 0; i < selected.length; i++) {
            var node = getNodeById(selected[i]);
            var newPos = {
                x: mouseWorld.x + widthOffset,
                y: mouseWorld.y
            };
            shiftNode(node, newPos);
            if (i < selected.length + 1) {
                widthOffset += (selectedElements[i].offsetWidth + selectedElements[i + 1].offsetWidth) / 2;
            } else {
                widthOffset += selectedElements[i].offsetWidth;
            }
        }
    } else {
        var rowSize = Math.ceil(Math.sqrt(selected.length));
        var columnCount = Math.ceil(selected.length / rowSize);
        for (var y = 0; y < columnCount; y++) {
            for (var x = 0; x < rowSize; x++) {
                var index = (rowSize * y) + x;
                if (index < selected.length) {
                    var node = getNodeById(selected[index]);
                    var newPos = {
                        x: mouseWorld.x + (x * minSize),
                        y: mouseWorld.y + (y * minSize)
                    };
                    shiftNode(node, newPos);
                } else {
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
    if (document.activeElement.tagName != "BODY") {
        document.activeElement.blur();
    }
}

function inputKey(keyCode) {
    if (!nodeFocused()) {
        switch (keyCode) {
            case KeyBinds.UNDO:
                if (keyStates[KeyBinds.CTRL] && !updated) {
                    if (keyStates[KeyBinds.MOVE]) {
                        redo();
                    } else {
                        undo();
                    }
                }
                break;
            case KeyBinds.SELECTALL:
                toggleAllSelect();
                break;
            case KeyBinds.ORDERSORT:
                orderSelected();
                break;
            case KeyBinds.RESET:
                resetOrientation();
                break;
        }
    }
}

function resetOrientation() {

    scale = 1;
    data.camera.position = {
        x: 0,
        y: 0
    };
    shiftElements();
    renderCamera();

}
var saves = [];
var currentSave = 0;

function saveState() {
    var saveState = JSON.stringify(data.library);

    if (saves[currentSave] != saveState) {
        saves.splice(currentSave + 1);
        saves.push(saveState);
        currentSave = saves.length - 1;

        saveAll();
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

function saveData() {
    var library = JSON.stringify(data.library);
    localStorage.setItem("library", library);
}

function saveCamera() {
    var cam = JSON.stringify({
        position: data.camera.position,
        scale: scale
    });
    localStorage.setItem("camera", cam);
}

function saveAll() {
    saveData();
    saveCamera();
}
var queueClear = false;

function click(e) {
    //console.log(e.path);
    queueClear = false;
    var target = getNodeParent(e.path[0]);
    if (keyStates[KeyBinds.CTRL]) {
        if (target != null) {
            setParents(target.id);
        } else {
            clearParents();
        }
    } else {
        if (target != null) {
            if (!keyStates[KeyBinds.MOVE]) {
                clearSelection();
            }
            selectElement(target);

        } else {
            if (!keyStates[KeyBinds.MOVE]) {
                queueClear = true;
            }
        }
    }
}

function getNodeParent(ele, range = 10) {
    var potential = ele;
    for (var i = 0; i < range; i++) {
        if (potential.tagName == "NODE") {
            return potential;
        }
        potential = potential.parentElement;
        if (potential == null) {
            return null;
        }
    }
    return null;
}

function isDescendant(ele, ancestor, range = 10) {
    var potential = ele;
    for (var i = 0; i < range; i++) {
        if (potential == ancestor) {
            return true;
        }
        potential = potential.parentElement;
        if (potential == null) {
            return false;
        }
    }
    return false;
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
    var width = getWindowWidth();
    var height = getWindowHeight();
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

function load() {

    var origin = generateTextNode("origin");
    var area = 2000;
    for (var i = 0; i < 50; i++) {
        var x = getRandomInt(-area, area);
        var y = getRandomInt(-area, area);
        var position = {
            x: x,
            y: y
        };

        var childEle = generateTextNode(`${x} ${y} ${i}`, position);
    }

    var lib = JSON.parse(localStorage.getItem("library"));
    if (lib != null) {
        data.library = lib;

    }
    var cam = JSON.parse(localStorage.getItem("camera"));
    if (cam != null) {
        data.camera.position = cam.position;
        scale = cam.scale;
    }
    scaleCamera();
    render();
    shiftElements();
}

function scaleCamera() {
    camera.style.transform = `scale(${scale})`;
}

function renderCamera() {
    scaleCamera();
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

function rotateVector(vector, deltaRad) {
    var mag = magnitude(vector);
    var originalAngle = Math.atan2(vector.y, vector.x);
    var newAngle = originalAngle + deltaRad;
    var unitVector = {
        x: Math.cos(newAngle),
        y: Math.sin(newAngle)
    };
    var scaledVector = setMagnitudeVector(unitVector, mag);
    return scaledVector;

}

function normalizeVector(vector) {
    setMagnitudeVector(vector, 1);
}

function setMagnitudeVector(vector, targetMagnitude) {
    var mag = magnitude(vector);
    return multiplyVector(vector, (1 / mag) * targetMagnitude);
}

function centerPos(pos, center = true) {
    var centerFactor = center ? -1 : 1;
    var halfWidth = getWindowWidth() / 2;
    var halfHeight = getWindowHeight() / 2;
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

function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
    selecting = false;
    if (queueClear) {
        clearSelection();
    }
    queueClear = false;
    drawSelection();
    toolCursorLock = false;
    centerCamera();
    render();
    saveState();
}

function centerCamera() {
    cameraPos = {
        x: 0,
        y: 0
    };
    shiftElements();
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
}

function dragElement(elmnt) {
    var pos1 = 0,
        pos2 = 0,
        pos3 = 0,
        pos4 = 0;
    elmnt.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        if (keyStates[KeyBinds.MOVE]) {
            e = e || window.event;
            //e.preventDefault();
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }
    }

    function elementDrag(e) {
        e = e || window.event;
        //e.preventDefault();
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

    document.documentElement.onmousedown = bodyDrag;

    function bodyDrag(e) {
        if (updated) {
            recreateElements();
            saveState();
            updated = false;
        }
        if (!keyStates[KeyBinds.MOVE]) {
            if (e.path[0].tagName != "NODE" && e.path[1].tagName != "NODE" && e.path[0].tagName != "PRE" && !isDescendant(e.path[0], tools)) {
                cameraDragMouseDown(e);
                e.preventDefault();
                unfocus();
            }
        } else if (selecting || keyStates[KeyBinds.BOXSELECT] || selected.length == 0) {
            selectDragMouseDown(e);
        } else if (selected.length > 0) {
            dragMouseDown(e);
        }
    }

    function selectDragMouseDown(e) {
        e.preventDefault();
        nodeCache = getAllNodes();
        selecting = true;
        startSelectPos = {
            x: e.clientX,
            y: e.clientY
        };
        document.onmouseup = closeDragElement;
        document.onmousemove = selectDrag;
    }

    function selectDrag(e) {
        e.preventDefault();
        endSelectPos = {
            x: e.clientX,
            y: e.clientY
        };
        drawSelection();

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
        var scaledWidth = (getWindowWidth() / 2);
        var scaledHeight = (getWindowHeight() / 2);
        document.body.style.backgroundSize = `${baseGridWidth*scale}px ${baseGridHeight*scale}px`;
        document.body.style.backgroundPosition = `top ${(-data.camera.position.y*scale)+scaledHeight}px left ${(-data.camera.position.x*scale)+scaledWidth}`;
        document.body.style.backgroundImage = "";
    } else {
        document.body.style.backgroundImage = "none";
    }
}
toolsPos = {
    x: 0,
    y: 0
};

function initializeTools() {
    var width = getWindowWidth();
    var height = getWindowHeight();
    var maxDim = Math.max(width, height) * 0.25;
    tools.onmousedown = toolsMouseDown;
    tools.onmousemove = toolsMouseMove;
    tools.style.width = `${maxDim}`;
    tools.style.height = `${maxDim}`;

    var tabButtons = document.getElementsByTagName("TABBUTTON");
    clickTab(tabButtons[0]);
    for (var i = 0; i < tabButtons.length; i++) {
        var tabButton = tabButtons[i];
        var target = tabButton.getAttribute("target");
        if (target != null) {

            tabButton.onclick = function (e) {
                clickTab(e.path[0]);

            }
        }
    }
}
var toolCursorLock = false;
var toolCursorStyle = "";

function toolsMouseMove(e) {
    if (!toolCursorLock) {
        var dragConfig = getToolsDragSides(e);
        var cursorStyle = "";
        var verticalLetter = "";
        var horizontalLetter = "";
        verticalLetter = dragConfig.bottom ? "s" : verticalLetter;
        verticalLetter = dragConfig.top ? "n" : verticalLetter;
        horizontalLetter = dragConfig.right ? "e" : horizontalLetter;
        horizontalLetter = dragConfig.left ? "w" : horizontalLetter;
        if (verticalLetter.length > 0 || horizontalLetter.length > 0) {
            cursorStyle = `${verticalLetter}${horizontalLetter}-resize`;
        }
        toolCursorStyle = cursorStyle;
        tools.style.cursor = cursorStyle;
    }
}

function getToolsDragSides(e) {
    var dragRange = 4;
    var offX = e.clientX - toolsPos.x;
    var offY = e.clientY - toolsPos.y;
    var right = false;
    var bottom = false;
    var left = false;
    var top = false;
    if (tools.offsetWidth - offX <= dragRange) {
        right = true;
    }
    if (tools.offsetHeight - offY <= dragRange) {
        bottom = true;
    }
    if (offX <= dragRange) {
        left = true;
    }
    if (offY <= dragRange) {
        top = true;
    }
    var dragConfig = {
        right: right,
        bottom: bottom,
        left: left,
        top: top
    };
    return dragConfig;
}

function toolsMouseDown(e) {
    toolCursorLock = true;
    var offX = e.clientX - toolsPos.x;
    var offY = e.clientY - toolsPos.y;
    e.preventDefault();
    var startPos = mousePos;
    document.onmouseup = closeDragElement;
    if (e.path[0].id == "toolsHead" && toolCursorStyle.length == 0) {
        document.onmousemove = function (e) {
            toolsDrag(e, startPos)
        }
    } else {

        var dragConfig = getToolsDragSides(e);
        if (dragConfig.right || dragConfig.bottom || dragConfig.left || dragConfig.top) {
            document.onmousemove = function (e) {
                toolsResizeDrag(e, dragConfig)
            }
        }

    }

}

function toolsDrag(e, startPos) {
    var width = getWindowWidth();
    var height = getWindowHeight();
    toolsPos.x = clamp(toolsPos.x + e.movementX, 0, width - tools.offsetWidth);
    toolsPos.y = clamp(toolsPos.y + e.movementY, 0, height - tools.offsetHeight);
    toolsRender();
}

function toolsResizeDrag(e, dragConfig) {
    var width = getWindowWidth();
    var height = getWindowHeight();
    var dragX = Math.max(0, e.clientX);
    var dragY = Math.max(0, e.clientY);

    if (dragConfig.right) {
        tools.style.width = `${clampToolWidth(dragX-toolsPos.x)}px`;
    }
    if (dragConfig.bottom) {
        tools.style.height = `${clampToolHeight(dragY-toolsPos.y)}px`;
    }
    if (dragConfig.left) {
        var oldWidth = tools.clientWidth;
        tools.style.width = `${clampToolWidth(tools.clientWidth+toolsPos.x-dragX)}px`;
        toolsPos.x = clamp(toolsPos.x - (tools.clientWidth - oldWidth), 0, width - tools.offsetWidth);
    }
    if (dragConfig.top) {
        var oldHeight = tools.clientHeight;
        tools.style.height = `${clampToolHeight(tools.clientHeight+toolsPos.y-dragY)}px`;
        toolsPos.y = clamp(toolsPos.y - (tools.clientHeight - oldHeight), 0, height - tools.offsetHeight);
    }
    toolsRender();
}

function getToolsMinMax() {
    var width = getWindowWidth();
    var height = getWindowHeight();
    var maxDim = Math.max(width, height);
    var minDim = maxDim * 0.1;
    return {
        min: minDim,
        max: maxDim
    };
}

function clampToolWidth(width) {
    var dim = getToolsMinMax();
    return clamp(width, dim.min, dim.max);
}

function clampToolHeight(height) {
    var dim = getToolsMinMax();
    return clamp(height, dim.min + toolsHead.offsetHeight, dim.max);
}


function toolsRender() {
    tools.style.top = `${toolsPos.y}px`;
    tools.style.left = `${toolsPos.x}px`;
}

function clickTab(element) {
    var name = element.getAttribute("target");
    switchTab(name);
    var tabButtons = document.getElementsByTagName("TABBUTTON");
    for (var i = 0; i < tabButtons.length; i++) {
        var tabButton = tabButtons[i];
        if (tabButton == element) {
            tabButton.className = "selectedTab";
        } else {
            tabButton.className = "";
        }
    }
}
var currentTab;

function switchTab(name) {
    var tabs = document.getElementsByTagName("TAB");
    for (var i = 0; i < tabs.length; i++) {
        var tab = tabs[i];
        if (tab.getAttribute("name") == name) {
            tab.setAttribute("class", "visible");
            currentTab = tab;
        } else {
            tab.setAttribute("class", "invisible");
        }
    }
}

function scaleTab() {
    var scaleX = toolsBody.offsetWidth / currentTab.offsetWidth;
    var scaleY = toolsBody.offsetHeight / (currentTab.offsetHeight + toolsHead.offsetHeight);
    var minScale = Math.min(scaleX, scaleY);
    currentTab.style.transform = `scale(${minScale})`;


}
