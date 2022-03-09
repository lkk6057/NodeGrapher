window.onload = initialize;
var main;
var chart;
var camera;
var tools;
var toolsHead;
var toolsBody;
var hudStats;
var properties = {};
var cameraPos = {
    x: 0,
    y: 0
}
var domObserver;
var effectsElement;
var cameraNodes;
var chartPos = {
    x: 0,
    y: 0
};
var scale = 1;
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
    XAXIS: 88,
    BACKSPACE: 8,
    DELETE: 46,
    LEFT: 37,
    UP: 38,
    RIGHT: 39,
    DOWN: 40,
    COPY: 67,
    PASTE: 86

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
    initializeObserver();
    initializeSettings();
    initializeProperties();
    repositionElements();
    load();
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
    hudStats = document.getElementById("hudStats");
    properties.style = document.getElementById("propertyStyle");
    properties.fontSize = document.getElementById("propertyFontSize");
    properties.fontColor = document.getElementById("propertyFontColor");
    properties.backgroundColor = document.getElementById("propertyBackgroundColor");
    properties.text = document.getElementById("propertyText");
    initializeTools();
    initializeToolItems();
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
    return document.documentElement.clientWidth;
}

function getWindowHeight() {
    return document.documentElement.clientHeight;
}

function initializeKeybinds() {
    var isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    if (isMac) {
        for (var prop in MacKeyBinds) {
            KeyBinds[prop] = MacKeyBinds[prop];
        }
    }
}

function initializeObserver() {
    domObserver = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
            var nodeParent = getNodeParent(mutation.target);
            if (nodeParent != null) {
                changedText(nodeParent);
            }
        });
    });
    var config = {
        characterData: true,
        subtree: true,
        childList: true
    };
    domObserver.observe(chart, config);
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
    repositionTools();
    toolsRender();
}

function zoom(event) {
    if (!nodeFocused() && !toolFocused()&&!isDescendant(event.target,tools)) {
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
            if (!keyStates[KeyBinds.ALTERNATE]) {
                newPosition.y = node.position.y;
            } else {
                newPosition.x = node.position.x;
            }
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
    inputKey(e);

}

function keyUp(e) {

    keyStates[e.keyCode] = false;

}

function nodeFocused() {
    return document.activeElement.tagName == "NODE";
}

function toolFocused() {
    return isDescendant(document.activeElement, tools);
}

function unfocus() {
    if (document.activeElement.tagName != "BODY") {
        document.activeElement.blur();
    }
}

function inputKey(event) {
    if (!nodeFocused() && !toolFocused()) {

        switch (event.keyCode) {
            case KeyBinds.UNDO:
                if (!updated) {
                    event.preventDefault();
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
            case KeyBinds.COPY:
                if(!keyStates[KeyBinds.MOVE]&&keyStates[KeyBinds.CTRL]){
                   copySelected();
                   }
            break;
            case KeyBinds.ORDERSORT:
                if(!keyStates[KeyBinds.CTRL]){
                orderSelected();
        }
        else{
            pasteSelected();
        }
                break;
            case KeyBinds.RESET:
                resetOrientation();
                break;

            case KeyBinds.BACKSPACE:
            case KeyBinds.DELETE:
                deleteSelection();
                break;
            case KeyBinds.LEFT:
                cycleNode(-1);
                break;
            case KeyBinds.RIGHT:
                cycleNode(1);
                break;
        }
    }
}
var cycleIndex = 0;

function cycleNode(delta) {
    var nodeIds = Object.keys(data.library);
    cycleIndex += delta;
    var max = nodeIds.length;
    cycleIndex = wrapIndex(cycleIndex, max);
    focusNode(nodeIds[cycleIndex]);
}

function focusNode(id) {
    var node = getNodeById(id);
    if (node != null) {
        var nodeEle = document.getElementById(id);
        clearSelection();
        data.camera.position.x = node.position.x;
        data.camera.position.y = node.position.y;
        selectElement(nodeEle, 0);
        setSelectTarget(id);
        shiftElements();
        renderCamera();
        render();
    }
}

function wrapIndex(num, max) {
    if (num < 0) {
        num = max - 1;
    } else if (num >= max) {
        num = 0;
    }
    return num;
}

function resetOrientation() {

    scale = 1;
    data.camera.position = {
        x: 0,
        y: 0
    };
    shiftElements();
    renderCamera();
    render();
}

function deleteSelection() {
    var selectedCopy = [...selected];
    for (var i = 0; i < selectedCopy.length; i++) {
        removeNode(selectedCopy[i]);
    }
    renderAllLines();
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
    queueClear = false;
    var target = getNodeParent(e.target);
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
            } else {
                e.preventDefault();
            }
                            selectElement(target);
        } else {
            if (!keyStates[KeyBinds.MOVE] && currentTool == null && !isDescendant(e.target, tools)) {
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
    var err = new Error();
    var selectedIds = [...selected];
    for (var i = selectedIds.length - 1; i >= 0; i--) {
        var selectedId = selectedIds[i];
        var element = document.getElementById(selectedId);
        if(element!=null){
        selectElement(element, 1);
    }
        else{
            var nullIndex = selected.indexOf(selectedId);
            selected.splice(nullIndex,1);
        }
    }

}

function clearTextSelection() {
    var sel = window.getSelection ? window.getSelection() : document.selection;
    if (sel) {
        if (sel.removeAllRanges) {
            sel.removeAllRanges();
        } else if (sel.empty) {
            sel.empty();
        }
    }
}

function toggleAllSelect() {
    if (selected.length > 0 && !keyStates[KeyBinds.MOVE]) {
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
    clearTextSelection();
    if (element.tagName == "NODE") {
        if (mode == -1) {
            if (!selected.includes(element.id)) {
                mode = 0;
                if (selected.length == 0) {
                    setSelectTarget(element.id);
                }
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
        if(selectTargetCache.length==0){
           setSelectTarget(element.id);
           }
    }

    updateHUD();
}

function highlightElement(element) {
    if (selected.includes(element.getAttribute("id"))) {
        element.setAttribute("contenteditable", "true");
        element.setAttribute("unselectable", "off");
        element.classList.add("selected");
    } else {
        element.setAttribute("contenteditable", "true");
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
    renderGrid();
    updateHUD();
}

function recreateElements() {
    cameraNodes.innerHTML = [];
    var nodes = getAllNodes();
    for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        createNodeElement(node);
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
    var liveChildren = [];
    for (var i = 0; i < node.children.length; i++) {
        var child = getChildNode(node, i);
        if (child != null) {
            renderLine(node, child);
            liveChildren.push(node.children[i]);
        }
    }
    node.children = liveChildren;
}

function renderLine(node, targetNode) {
    var lineName = node.id + "/" + targetNode.id + "line";
    //removeElementsByName(lineName);
    var offset = {
        x: targetNode.position.x - node.position.x,
        y: targetNode.position.y - node.position.y
    };
    var line = updateLineElement(lineName, offset, node.position);
    effectsElement.appendChild(line);
}

function updateLineElement(name, offset, pos, color = "black", thickness = 1) {
    var attributes = generateLineAttributes(offset, pos, color, thickness);
    var matches = document.getElementsByName(name);
    var line;
    if (matches.length == 1) {
        line = matches[0];
    } else if (matches.length > 1) {
        removeElementsByName(name);
    }

    if (matches.length == 0) {
        line = document.createElement("LINE");
    }
    line.setAttribute("name", name);
    line.style.width = attributes.width;
    line.style.height = attributes.height;
    line.style.top = attributes.top;
    line.style.left = attributes.left;
    line.style.transform = attributes.transform;
    return line;
}

function generateLineAttributes(offset, pos, color, thickness) {
    var attributes = {};
    var length = magnitude(offset);
    var angle = Math.atan2(offset.y, offset.x);
    attributes.width = `${length}px`;
    attributes.height = `${thickness}px`;
    attributes.top = `${pos.y}px`;
    attributes.left = `${pos.x}px`;
    attributes.transform = `rotate(${angle}rad)`;
    return attributes;
}

function repositionElements() {
    renderCamera();
}

function load() {

    var origin = generateTextNode("origin");

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
    camera.style.left = pxToVMin(screenPos.x) + "vmin";
    camera.style.top = pxToVMin(screenPos.y) + "vmin";
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
    } else {
        node.parent = "";
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
}, style = {
    fontSize: "16",
    color: "#000000",
    backgroundColor: "#ffffff"
}) {
    var data = {
        text: text
    }
    return generateNode("text", data, position, style);
}

function generateNode(type, data, position, style = {}) {
    var node = {
        type: "text",
        id: generateUUID(),
        data: data,
        position: position,
        children: [],
        style: style,
        parent: "",
        enabled: true
    }
    return updateLibrary(node);
}

function updateLibrary(node) {
    data.library[node.id] = node;
    return data.library[node.id];
}

function appendNodes(nodes){
    for(var i = 0;i<nodes.length;i++){
        var node = nodes[i];
        updateLibrary(node);
    }
}
function generateNodeElement(node) {
    var nodeEle;
    var nodeStyle = "";
    switch (node.type) {
        case "text":
            nodeEle = document.createElement("node");
            nodeEle.addEventListener("focusout", function (e) {
                finishedEditingText(e.target)
            });
            break;
    }
    dragElement(nodeEle);
    updateNodeElement(node, nodeEle);
    return nodeEle;
}

function updateNodeElement(node, nodeEle = null) {
    if (nodeEle == null) {
        nodeEle = document.getElementById(node.id);
    }
    switch (node.type) {
        case "text":
            nodeEle.innerHTML = node.data.text;
            nodeEle.setAttribute("spellcheck", "false");
            break;
    }
    nodeEle.className = "absolute card";
    var nodeScreenPos = worldToScreenPos(node.position);
    nodeEle.style.left = nodeScreenPos.x + "px";
    nodeEle.style.top = nodeScreenPos.y + "px";

    nodeEle.setAttribute("id", node.id);
    if (node.style != null) {
        for (const [key, value] of Object.entries(node.style)) {
            nodeEle.style[key] = value;
        }
    }
    highlightElement(nodeEle);
    renderLines(node);
}

function createNodeElement(node) {
    var element = generateNodeElement(node);
    cameraNodes.appendChild(element);
    return element;
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

function changedText(element) {
    var node = getNodeById(element.id);
    node.data.text = unescape(element.innerText);
}

function finishedEditingText(element) {
    var node = getNodeById(element.id);
    updateNodeElement(node, element);
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

function deleteNode(id) {
    delete data.library[id];
}

function removeNode(id) {
    deleteNode(id);
    var element = document.getElementById(id);
    element.remove();
    var selectedIndex = selected.indexOf(id);
    if (selectedIndex > -1) {
        selected.splice(selectedIndex, 1);
    }
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
            if (element != null && !selected.includes(element.id)) {
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
        setSelectTarget("");
    }
    queueClear = false;
    drawSelection();
    toolCursorLock = false;
    centerCamera();
    render();
    saveState();
    toolItemUp();
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
            if (getNodeParent(e.path[0]) == null && !isDescendant(e.path[0], tools) || keyStates[KeyBinds.CTRL]) {
                cameraDragMouseDown(e);
                e.preventDefault();
                unfocus();
            }
        } else if (selecting || keyStates[KeyBinds.BOXSELECT] || selected.length == 0) {
            selectDragMouseDown(e);
        } else if (selected.length > 0 && currentTool == null) {
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
    var dragRangeX = pxToVW(dragRange);
    var dragRangeY = pxToVH(dragRange);
    var offX = pxToVW(e.clientX) - toolsPos.x;
    var offY = pxToVH(e.clientY) - toolsPos.y;
    var right = false;
    var bottom = false;
    var left = false;
    var top = false;
    if (pxToVW(tools.offsetWidth) - offX <= dragRangeX) {
        right = true;
    }
    if (pxToVH(tools.offsetHeight) - offY <= dragRangeY) {
        bottom = true;
    }
    if (offX <= dragRangeX) {
        left = true;
    }
    if (offY <= dragRangeY) {
        top = true;
    }
    var dragConfig = {
        right: right,
        bottom: bottom,
        left: left,
        top: top
    };
    var cornerDist = 2;
    var tlDist = distance(0, 0, offX, offY);
    var trDist = distance(pxToVW(tools.offsetWidth), 0, offX, offY);
    var blDist = distance(0, pxToVH(tools.offsetHeight), offX, offY);
    var brDist = distance(pxToVW(tools.offsetWidth), pxToVH(tools.offsetHeight), offX, offY);
    if (tlDist < cornerDist) {
        dragConfig.top = true;
        dragConfig.left = true;
    }
    if (trDist < cornerDist) {
        dragConfig.top = true;
        dragConfig.right = true;
    }
    if (blDist < cornerDist) {
        dragConfig.bottom = true;
        dragConfig.left = true;
    }
    if (brDist < cornerDist) {
        dragConfig.bottom = true;
        dragConfig.right = true;
    }

    return dragConfig;
}

function distance(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
}

function toolsMouseDown(e) {
    toolCursorLock = true;
    var offX = e.clientX - toolsPos.x;
    var offY = e.clientY - toolsPos.y;
    //e.preventDefault();
    var startPos = mousePos;
    document.onmouseup = closeDragElement;
    if (isDescendant(e.path[0], document.getElementById("toolsHead"), 2) && toolCursorStyle.length == 0) {
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
    var deltaX = pxToVW(e.movementX);
    var deltaY = pxToVH(e.movementY);
    repositionTools(toolsPos.x + deltaX, toolsPos.y + deltaY);
    toolsRender();
}

function repositionTools(x = toolsPos.x, y = toolsPos.y) {
    if (x != null) {
        repositionToolsX(x);
    }
    if (y != null) {
        repositionToolsY(y);
    }
}

function repositionToolsX(x) {
    var width = getWindowWidth();
    toolsPos.x = clamp(x, 0, pxToVW(width - tools.offsetWidth));
}

function repositionToolsY(y) {
    var height = getWindowHeight();
    toolsPos.y = clamp(y, 0, pxToVH(height - tools.offsetHeight));
}

function toolsResizeDrag(e, dragConfig) {
    var width = getWindowWidth();
    var height = getWindowHeight();
    var dragX = pxToVMin(Math.max(0, e.clientX));
    var dragY = pxToVMin(Math.max(0, e.clientY));

    if (dragConfig.right) {
        tools.style.width = `${clampToolWidth(dragX-pxToVMin(toolsPos.x*getVW()))}vmin`;
    }
    if (dragConfig.bottom) {
        tools.style.height = `${clampToolHeight(dragY-pxToVMin(toolsPos.y*getVH()))}vmin`;
    }
    if (dragConfig.left) {
        var oldWidth = pxToVMin(tools.clientWidth);
        var widthVmin = clampToolWidth(pxToVMin(tools.clientWidth) + pxToVMin(toolsPos.x * getVW()) - dragX, false);
        tools.style.width = `${widthVmin}vmin`;
        repositionToolsX(toolsPos.x - pxToVW((pxToVMin(tools.clientWidth) - oldWidth) * getVMin()));
    }
    if (dragConfig.top) {
        var oldHeight = pxToVMin(tools.clientHeight);
        var heightVmin = clampToolHeight(pxToVMin(tools.clientHeight) + pxToVMin(toolsPos.y * getVH()) - dragY, false);
        tools.style.height = `${heightVmin}vmin`;
        repositionToolsY(toolsPos.y - pxToVH((pxToVMin(tools.clientHeight) - oldHeight) * getVMin()));
    }
    toolsRender();
}
var minDim = 5;
var uncappedMax = 10000;

function clampToolWidth(width, capped = true) {
    var max = capped ? pxToVMin(getWindowWidth()) - pxToVMin(toolsPos.x * getVW()) : uncappedMax;
    var min = minDim;
    return clamp(width, min, max);
}

function clampToolHeight(height, capped = true) {
    var max = capped ? pxToVMin(getWindowHeight()) - pxToVMin(toolsPos.y * getVH()) : uncappedMax;
    var min = minDim + pxToVH(toolsHead.offsetHeight);
    return clamp(height, min, max);
}

function getVMin() {
    var min = Math.min(getWindowWidth(), getWindowHeight());
    var vMin = min / 100;
    return vMin;
}

function getVMax() {
    var max = Math.max(getWindowWidth(), getWindowHeight());
    var vMin = max / 100;
    return vMax;
}

function getVW() {
    var width = getWindowWidth();
    var vW = width / 100;
    return vW;
}

function getVH() {
    var height = getWindowHeight();
    var vH = height / 100;
    return vH;
}

function pxToVMin(px) {
    return px / getVMin();
}

function pxToVW(px) {
    return px / getVW();
}

function pxToVH(px) {
    return px / getVH();
}

function toolsRender() {
    tools.style.top = `${toolsPos.y}vh`;
    tools.style.left = `${toolsPos.x}vw`;
}

function correctToolScale() {
    var height = Number(currentTab.getAttribute("height"));
    var width = Number(currentTab.getAttribute("width"));
    tools.style.width = `${width}vmin`;
    var headHeight = pxToVMin(toolsHead.offsetHeight);
    tools.style.height = `${headHeight+height}vmin`;
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
            tab.classList.add("visible");
            currentTab = tab;
            correctToolScale();
        } else {
            tab.classList.remove("visible");
        }
    }
}

var currentTool;

function initializeToolItems() {
    var toolItems = document.getElementsByTagName("TOOL");
    for (var i = 0; i < toolItems.length; i++) {
        var toolItem = toolItems[i];
        toolItem.onmousedown = toolItemMouseDown;
    }
}

function toolItemMouseDown(e) {
    if (!keyStates[KeyBinds.MOVE]) {
        clearSelection();

    }
    var toolElement = e.target
    toolElement.classList.add("activeToolItem");
    var target = toolElement.getAttribute("target");
    var mouseWorld = screenToWorldPos(mousePos);
    switch (target) {
        case "text":
            currentTool = generateTextNode("", mouseWorld);
            var newNodeElement = createNodeElement(currentTool);
            selectElement(newNodeElement);
            break;
    }
    document.onmousemove = toolItemDrag;
}

function toolItemDrag(e) {
    if (currentTool != null) {
        var worldPos = screenToWorldPos({
            x: e.clientX,
            y: e.clientY
        });
        shiftNode(currentTool, worldPos);
    } else {
        toolItemUp();
    }
}

function toolItemUp() {
    var toolItems = document.getElementsByTagName("TOOL");
    for (var i = 0; i < toolItems.length; i++) {
        var toolItem = toolItems[i];
        toolItem.classList.remove("activeToolItem");
    }
    currentTool = null;
}

function initializeSettings() {
    var settingElements = document.getElementsByName("option");
    for (var i = 0; i < settingElements.length; i++) {
        var settingElement = settingElements[i];
        switch (settingElement.type) {
            case "checkbox":
                var target = settingElement.getAttribute("target");
                settingElement.checked = settings[target];
                settingElement.addEventListener('change', (event) => {
                    settings[event.currentTarget.getAttribute("target")] = event.currentTarget.checked;
                    render();
                })
                break;

            case "text":
            case "number":
                var target = settingElement.getAttribute("target");
                settingElement.value = settings[target];
                settingElement.addEventListener('change', (event) => {
                    settings[event.currentTarget.getAttribute("target")] = event.currentTarget.value;
                    render();
                })
                break;
                break;
        }
    }
}

function initializeProperties() {
    var applyButton = document.getElementById("stylePropertyApply");
    applyButton.addEventListener('click', (event) => {
        stylePropertyChanged(properties.style.value);
    });

    properties.fontSize.addEventListener('change', (event) => {
        propertyChanged("fontSize", event.currentTarget.value);
    });
    properties.fontColor.addEventListener('change', (event) => {
        propertyChanged("color", event.currentTarget.value);
    });
    properties.backgroundColor.addEventListener('change', (event) => {
        propertyChanged("backgroundColor", event.currentTarget.value);
    });

    var textApplyButton = document.getElementById("textPropertyApply");
    textApplyButton.addEventListener('click', (event) => {
        textPropertyChanged(properties.text.value);
    });
}

function textPropertyChanged(raw) {
    for (var i = 0; i < selected.length; i++) {
        var selectedNode = getNodeById(selected[i]);
        if (selectedNode.type == "text") {
            selectedNode.data.text = unescape(raw);
            updateNodeElement(selectedNode);
        }
    }
    if(selected.length>0){
        saveState();
       }
}

function stylePropertyChanged(raw) {
    var styles = raw.trim().split(";");
    var styleObject = {
        backgroundColor: "#ffffff"
    };
    for (var i = 0; i < styles.length; i++) {
        var styleSplit = styles[i].split(":");
        if (styleSplit.length > 1) {
            styleObject[styleSplit[0].trim()] = styleSplit[1].trim();
        }
    }
    for (var i = 0; i < selected.length; i++) {
        var selectedNode = getNodeById(selected[i]);
        selectedNode.style = styleObject;
        updateNodeElement(selectedNode);
    }
        if(selected.length>0){
        saveState();
       }
    updateProperties();
}

function propertyChanged(name, value) {
    for (var i = 0; i < selected.length; i++) {
        var selectedNode = getNodeById(selected[i]);
        selectedNode.style[name] = value;
        updateNodeElement(selectedNode);
        updateProperties();
    }
}
var selectTargetCache = "";

function setSelectTarget(id) {
    selectTargetCache = id;
    var nodeIds = Object.keys(data.library);
    if (nodeIds.includes(id)) {
        cycleIndex = nodeIds.indexOf(id);
        updateProperties();
    }
}

function updateProperties() {
    if (getNodeById(selectTargetCache) == null) {
        selectTargetCache = selected[0];
    }
    if (selectTargetCache != null) {
        var styleString = "";
        var node = getNodeById(selectTargetCache);
        for (const [key, value] of Object.entries(node.style)) {
            styleString += `${key}: ${value};\n`;
        }
        properties.style.value = styleString;
        if(node.style.fontSize!=null){
        properties.fontSize.value = node.style.fontSize;
        }
        if(node.style.fontColor!=null){
        properties.fontColor.value = node.style.color;
           }
                if(node.style.backgroundColor!=null){
        properties.backgroundColor.value = node.style.backgroundColor;
                }
        if (node.type == "text") {
            properties.text.value = node.data.text;
        }
    }

}

function roundToDecimal(num, decimal = 2) {
    var factor = Math.pow(10, decimal);
    return Math.round(num * factor) / factor;
}

function updateHUD() {
    var x = roundToDecimal(data.camera.position.x);
    var y = roundToDecimal(data.camera.position.y);
    var zoom = roundToDecimal(scale * 100);
    var selNodes = selected.length;
    var totNodes = Object.keys(data.library).length;
    var statString = `z:${zoom}% x: ${x} y: ${y} s:${selNodes}/${totNodes}`;
    hudStats.innerHTML = statString;
}

var clipBoard = "";
var copiedIds = [];
function copySelected(){
    if(selected.length>0){
        var clonedNodes = [];
        copiedIds = [];
        for(var i = 0;i<selected.length;i++){
            var node = getNodeById(selected[i]);
            if(node!=null){
            clonedNodes.push(node);
            copiedIds.push(node.id);
        }
        }
        clipBoard = JSON.stringify(clonedNodes);
        
       }
}

function pasteSelected(){
var jsonClones = clipBoard;
    if(copiedIds.length>0){
        var newIds = [];
        var idConversions = [];
       for(var i = 0;i<copiedIds.length;i++){
           var oldId = copiedIds[i];
           var newId = generateUUID();
           newIds.push(newId);
           jsonClones = jsonClones.replaceAll(oldId,newId);
       }
        var processedNodes = JSON.parse(jsonClones);
        for(var i = 0;i<processedNodes.length;i++){
            var processedNode = processedNodes[i];
            processedNode.children = [];
            var parentNode = getNodeById(processedNode.parent);
            if(parentNode!=null){
            appendChild(parentNode,processedNode);
        }
        }
        appendNodes(processedNodes);
        recreateElements();
        clearSelection();
        for(var i = 0;i<newIds.length;i++){
            var newId = newIds[i];
            var nodeEle = document.getElementById(newId);
            selectElement(nodeEle,0);
        }
       }
}