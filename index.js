// Colors representing light and dark on the canvas for visualisation
const LIGHT_VAL = 255;
const DARK_VAL = 0;
const THRESH = 120; // Threshold between light and dark
// Helper function to get the index to access the canvas
// There are 4 values red green blue alpha, this index points to the first
function getIndex(imageData, x, y) {
    return (y * imageData.width + x) * 4;
}
// Threshold and put to canvas
function threshold(data) {
    for (let i = 0; i < data.length; i += 4) { // For each pixel
        let val = LIGHT_VAL;
        if (data[i] < THRESH && data[i + 1] < THRESH && data[i + 2] < THRESH) {
            val = DARK_VAL; // Threshold
        }
        data[i] = val; // Write to rgb values of imageData
        data[i + 1] = val;
        data[i + 2] = val;
        data[i + 3] = 255;
    }
}
// Returns frequency count of each element in arr
// Input: [1, 1, 1, 2, 4] Output: {1: 3, 2: 1, 4: 1}
function count(arr) {
    const count = {};
    arr.forEach(e => (count[e] = (count[e] ?? 0) + 1));
    return count;
}
// Helper function for getCrossoverLengths
// Returns array of dark and light lengths of i coordinate
function getWidths(getVal, iStart, jStart, iEnd, jEnd) {
    let light = [];
    let dark = [];
    for (let j = jStart; j < jEnd; j++) { // Scan line for each row/column
        let prev = getVal(iStart, j);
        let pos = 0;
        for (let i = iStart + 1; i < iEnd; i++) { // Each pixel
            const curr = getVal(i, j);
            if (pos == 0 && prev != curr) {
                // Distance from start to first transition is probably not part of a module, so ignore
                pos = i; // Save transition position
            } else if (prev == LIGHT_VAL && curr != LIGHT_VAL) { // If color switched
                light.push(i - pos); // Push distance from last transition
                pos = i; // Save transition position
            } else if (prev == DARK_VAL && curr != DARK_VAL) {
                dark.push(i - pos);
                pos = i;
            }
            prev = curr; // Set new color
        }
    }
    return {light, dark};
}
// Returns frequency count of widths and heights from canvas data
function getCrossoverLengths(imageData, xStart, yStart, xEnd, yEnd) {
    if (xStart == undefined) {
        xStart = 0;
        yStart = 0;
        xEnd = imageData.width;
        yEnd = imageData.height;
    } else {
        xStart = Math.round(xStart);
        yStart = Math.round(yStart);
        xEnd = Math.round(xEnd);
        yEnd = Math.round(yEnd);
    }
    const data = imageData.data;
    const widths = getWidths((i, j) => data[getIndex(imageData, i, j)], xStart, yStart, xEnd, yEnd);
    const heights = getWidths((i, j) => data[getIndex(imageData, j, i)], yStart, xStart, yEnd, xEnd);
    return {
        lightWidths: count(widths.light),
        darkWidths: count(widths.dark),
        lightHeights: count(heights.light),
        darkHeights: count(heights.dark)
    };
}
function argmax(obj) {
    let maxI;
    let maxE = Number.NEGATIVE_INFINITY;
    for (const [i, e] of Object.entries(obj)) {
        if (e > maxE) {
            maxI = i;
            maxE = e;
        }
    }
    return maxI;
}
// Gets precise peak
function averagePeak(obj, maxI) {
    maxI ??= parseInt(argmax(obj)); // Find peak if not given
    const radius = Math.round(maxI / 5);
    let count = 0;
    let total = 0;
    // Average values weighted by frequency
    for (let i = maxI - radius; i <= maxI + radius; i++) {
        const c = obj[i] ?? 0;
        count += c;
        total += c * i; // Frequency * value
    }
    return total / count;
}
// Returns average width of modules from canvas
// May return NaN if there are no corresponding lengths
// size: Given initial size to find a similar size
function getModuleSize(imageData, xStart, yStart, xEnd, yEnd, size) {
    const lengths = getCrossoverLengths(imageData, xStart, yStart, xEnd, yEnd);
    console.log(lengths);
    return {
        lightWidth: averagePeak(lengths.lightWidths, size?.lightWidth),
        darkWidth: averagePeak(lengths.darkWidths, size?.darkWidth),
        lightHeight: averagePeak(lengths.lightHeights, size?.lightHeight),
        darkHeight: averagePeak(lengths.darkHeights, size?.darkHeight)
    };
}
// Finds first row/column of modules
// size: module size
// isX: True if finding first x coordinate, otherwise y
// isReversed: True if finding last coordinate instead of first
function getFirstCoord(imageData, size, isX, isReversed) {
    const data = imageData.data;
    const radius = isX ? size.darkWidth / 2 : size.darkHeight / 2;
    const thresh = radius;
    const i_max = isX ? imageData.width : imageData.height;
    const j_max = isX ? imageData.height : imageData.width;
    let getVal_1 = (x, y) => data[getIndex(imageData, x, y)]; // Default canvas access
    if (isReversed) {
        // Flip both x and y to search from the back
        getVal_1 = (x, y) => data[getIndex(imageData, imageData.width - x - 1, imageData.height - y - 1)];
    }
    let getVal = getVal_1; // Could probably use closures to be able to reference getVal_1 later but this works
    if (isX) {
        // Code below is interested in second coordinate e.g. if second coordinate in pair is y, it returns y coordinate of first module
        // If x coordinate is needed, need to swap them around
        getVal = (j, i) => getVal_1(i, j);
    }
    for (let i = 0; i < i_max; i++) { // Loop through each coordinate of interest
        let count = 0;
        for (let j = 0; j < j_max; j++) { // Find first row/col with enough dark pixels
            const curr = getVal(j, i);
            if (curr == DARK_VAL) {
                count++;
                if (count > thresh) { // Enough dark pixels
                    const coord = i + radius;
                    if (isReversed) {
                        return i_max - coord - 1;
                        // staircase indentation
                    }
                    return coord;
                }
            }
        }
    }
}
// Finds first and last rows and columns
function getRange(imageData, size) {
    const xFirst = getFirstCoord(imageData, size, true, false);
    const yFirst = getFirstCoord(imageData, size, false, false);
    const xLast = getFirstCoord(imageData, size, true, true);
    const yLast = getFirstCoord(imageData, size, false, true);
    return {xFirst, yFirst, xLast, yLast};
}
function drawCircle(ctx, x, y, color = 'green') {
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.stroke();
}
// Draw lines on canvas to visualise detected positions
function drawLines(canv, ctx, size, range) {
    const {xFirst, yFirst, xLast, yLast} = range;
    ctx.strokeStyle = 'green';
    const width = (size.darkWidth + size.lightWidth) / 2;
    const height = (size.darkHeight + size.lightHeight) / 2;
    // Horizontal lines
    const yLimit = yLast + height / 2;
    ctx.beginPath(); // Line showing last pixel location
    ctx.moveTo(0, yLimit);
    ctx.lineTo(canv.width, yLimit);
    ctx.stroke();
    for (let i = 0; yFirst + i * height < yLimit; i++) {
        ctx.beginPath();
        ctx.moveTo(0, yFirst + i * height);
        ctx.lineTo(canv.width, yFirst + i * height);
        ctx.stroke();
    }
    // Vertical lines
    const xLimit = xLast + width / 2;
    ctx.beginPath(); // Line showing last pixel location
    ctx.moveTo(xLimit, 0);
    ctx.lineTo(xLimit, canv.height);
    ctx.stroke();
    for (let i = 0; xFirst + i * width < xLimit; i++) {
        ctx.beginPath();
        ctx.moveTo(xFirst + i * width, 0);
        ctx.lineTo(xFirst + i * width, canv.height);
        ctx.stroke();
    }
}

// New fit method specific functions

// Draw circles and lines to visualise fit positions
function drawFit(ctx, positions) {
    positions.flat().forEach(pos => drawCircle(ctx, pos.x, pos.y,
        pos.bad ? 'red' :
        pos.bound.top || pos.bound.bottom ? 'green' :
        pos.bound.left || pos.bound.right ? 'blue' :
        'yellow'));
    positions.forEach(r => r.reduce((p, c) => {
        ctx.strokeStyle = 'grey';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(c.x, c.y);
        ctx.stroke();
        return c;
    }));
}

// Counts pixel values in range
function countPixels(imageData, xStart, yStart, xEnd, yEnd) {
    const obj = {};
    for (let x = xStart; x < xEnd; x++) { // For each pixel in range
        for (let y = yStart; y < yEnd; y++) {
            const val = imageData.data[getIndex(imageData, x, y)];
            obj[val] = (obj[val] ?? 0) + 1; // Increment count for pixel value
        }
    }
    return obj;
}
// Extract code from image
// Returns 2d array
function getCode(imageData, size, range) {
    const {xFirst, yFirst, xLast, yLast} = range;
    // Calculate positions
    const width = (size.darkWidth + size.lightWidth) / 2;
    const height = (size.darkHeight + size.lightHeight) / 2;
    const xSize = Math.round((xLast - xFirst) / width + 1);
    const ySize = Math.round((yLast - yFirst) / height + 1);
    const code = [];
    for (let y = 0; y < ySize; y++) {
        const yStart = Math.round(yFirst + (y - 0.5) * height);
        const yEnd = yStart + Math.round(height);
        const row = [];
        for (let x = 0; x < xSize; x++) { // For each position
            const xStart = Math.round(xFirst + (x - 0.5) * width);
            const xEnd = xStart + Math.round(width);
            const count = countPixels(imageData, xStart, yStart, xEnd, yEnd);
            const maxVal = argmax(count);
            row.push(maxVal == DARK_VAL ? 1 : 0); // Determine if light or dark
        }
        code.push(row);
    }
    return code;
}
// Takes in coordinates and returns coordinates of best fit
// expectedValue: forces finding a dark or light module
function bestFitModule(imageData, size, oldX, oldY, expectedValue) {
    // Ratios
    const VAL_R = 0.7; // Radius of rectangle to determine value
    const COUNT_R = 0.87; // Radius of counting rectangle
    const PERP_R = 1; // Radius of counting rectangle perpendicular to moving direction, in addition to COUNT_R
    const LIMIT = 0.5;
    let x = Math.round(oldX);
    let y = Math.round(oldY);

    // Divide by 2 for radius and a bit more, centre portion is more likely to be the module color
    const vW = Math.floor(Math.min(size.darkWidth, size.lightWidth) / 2 * VAL_R);
    const vH = Math.floor(Math.min(size.darkHeight, size.lightHeight) / 2 * VAL_R);
    const val = expectedValue ?? argmax(countPixels(imageData, x - vW, y - vH, x + vW, y + vH));
    const otherVal = val == DARK_VAL ? LIGHT_VAL : DARK_VAL;
    // radius width/height
    const calculateRadius = length => Math.max(1, Math.round(length / 2 * COUNT_R)); // Prevent divide by zero
    const w = calculateRadius(val == DARK_VAL ? size.darkWidth : size.lightWidth);
    const h = calculateRadius(val == DARK_VAL ? size.darkHeight : size.lightHeight);

    // Prevent moving too much
    const xMoveLimit = Math.round((size.darkWidth + size.lightWidth) / 2 * LIMIT); // Divide by 2 for average
    const yMoveLimit = Math.round((size.darkHeight + size.lightHeight) / 2 * LIMIT);

    function move() {
        // Move horizontally
        const yS = Math.round(y - h * PERP_R);
        const yE = Math.round(y + h * PERP_R);
        const leftWant = countPixels(imageData, x - w * 2, yS, x - w, yE)[val] ?? 0;
        const leftNot = countPixels(imageData, x - w, yS, x, yE)[otherVal] ?? 0; // E.g. left 1 col inside not wanted (other val)
        const rightNot = countPixels(imageData, x, yS, x + w, yE)[otherVal] ?? 0;
        const rightWant = countPixels(imageData, x + w, yS, x + w * 2, yE)[val] ?? 0; // right 4 cols outside wanted
        const xMove = Math.round((Math.min(rightWant, leftNot) - Math.min(leftWant, rightNot)) / (yE - yS)); // Move min(1, 4) = 1 column
        // Move vertically
        const xS = Math.round(x - w * PERP_R);
        const xE = Math.round(x + w * PERP_R);
        const topWant = countPixels(imageData, xS, y - h * 2, xE, y - h)[val] ?? 0;
        const topNot = countPixels(imageData, xS, y - h, xE, y)[otherVal] ?? 0;
        const bottomNot = countPixels(imageData, xS, y, xE, y + h)[otherVal] ?? 0;
        const bottomWant = countPixels(imageData, xS, y + h, xE, y + h * 2)[val] ?? 0;
        const yMove = Math.round((Math.min(bottomWant, topNot) - Math.min(topWant, bottomNot)) / (xE - xS));
        // Calculate move information
        const bound = {left: leftWant < h * 4, right: rightWant < h * 4, top: topWant < w * 4, bottom: bottomWant < w * 4}; // Boundary found, position is probably reliable
        const bad = Math.abs(xMove) >= xMoveLimit || Math.abs(yMove) >= yMoveLimit; // Move limit was reached
        if (bad && expectedValue == undefined) {
            return {x, y, bound, bad};
        }
        return {x: x + xMove, y: y + yMove, bound, bad};
    }
    if (expectedValue != undefined) {
        ({x, y} = move()); // Move 2 times
    }
    return move();
}
// Find a fit of positions
function fitPositions(imageData, size, base) {
    const overallWidth = (size.darkWidth + size.lightWidth) / 2;
    const overallHeight = (size.darkHeight + size.lightHeight) / 2;
    const xFirst = getFirstCoord(imageData, size, true, false);
    const yFirst = getFirstCoord(imageData, size, false, false);
    // Find width and height by looking at image with getModuleSize
    function getModuleWidthHeight(xStart, yStart, xEnd, yEnd, peak) {
        const size = getModuleSize(imageData, xStart, yStart, xEnd, yEnd, peak);
        let width = (size.darkWidth + size.lightWidth) / 2;
        let height = (size.darkHeight + size.lightHeight) / 2;
        if (isNaN(width)) width = undefined;
        if (isNaN(height)) height = undefined;
        return {width, height};
    }
    const {width: firstWidth, height: firstHeight} = getModuleWidthHeight(xFirst, yFirst, xFirst + overallWidth * 9, yFirst + overallHeight * 9);
    function smallDifference(a, b, ratio = 0.2) {
        return Math.abs(a - b) < Math.max(2, Math.abs(b) * ratio);
    }
    function average(arr) {
        if (arr.length == 0) {
            return;
        }
        return arr.reduce((a, c) => a + c) / arr.length;
    }
    // Find width/height by looking at previous ?? current fit
    // x, y are array indices
    // dimension is 'width' or 'height'
    function getLengths(x, y, dimension, radius = 3) {
        const source = base ?? arr;
        const lengths = [];
        for (let i = -radius; i <= radius; i++) {
            for (let j = -radius; j <= radius; j++) {
                const module = source?.[y + i]?.[x + j];
                if (module) {
                    lengths.push(module[dimension]);
                }
            }
        }
        return average(lengths);
    }
    // Scale light and dark lengths according to single width/height
    function scaledSize(width, height) {
        return {
            lightWidth: size.lightWidth / overallWidth * width,
            darkWidth: size.darkWidth / overallWidth * width,
            lightHeight: size.lightHeight / overallHeight * height,
            darkHeight: size.darkHeight / overallHeight * height
        };
    }
    // Even out y coordinates to the left
    // To be called if bound found at current position
    function leftPropagate(arr, xI, yI) {
        if (!arr[yI - 1]?.[xI]) return; // Return if top does not exist
        let height = arr[yI][xI].y - arr[yI - 1][xI].y; // Distance from current position to top position
        if (!smallDifference(height, arr[yI][xI].height, 0.5)) return;
        let leftX = xI - 1; // Find first x to the left to not be refit, want to refit modules without vertical bounds
        while (leftX >= 0 && !arr[yI][leftX].bound.top && !arr[yI][leftX].bound.bottom) {
            leftX--;
        }
        // All x in (leftX, xI) will be refit
        for (let i = leftX + 1; i < xI; i++) {
            if (leftX >= 0) {
                // Proportional y for i between leftX and xI: (end y - start y) * index / total index + start y, minus y at top module to get height
                height = (arr[yI][xI].y - arr[yI][leftX].y) * (i - leftX) / (xI - leftX) + arr[yI][leftX].y - arr[yI - 1][i].y;
            }
            arr[yI][i] = fit(arr, i, yI, undefined, height);
        }
    }
    function fit(arr, xI, yI, width, height) {
        let x, y, expectedValue;
        const topModule = arr[yI - 1]?.[xI];
        const leftModule = arr[yI][xI - 1];
        const heightGiven = height != undefined;
        width ??= getLengths(xI, yI, 'width');
        height ??= getLengths(xI, yI, 'height');
        if (xI == 0 && yI == 0) { // First column and first row
            width ??= firstWidth;
            height ??= firstHeight;
            x = xFirst;
            y = yFirst;
            expectedValue = DARK_VAL;
        } else if (xI == 0 && yI > 0) { // First column and not first row
            width ??= topModule.width;
            height ??= topModule.height;
            x = topModule.x;
            y = topModule.y + height;
        } else if (topModule?.bad == false) { // Not first column, top module exists and is not bad
            width ??= topModule.width;
            height ??= topModule.height;
            x = (leftModule.x + width + topModule.x) / 2;
            if (heightGiven) {
                y = topModule.y + height;
            } else {
                y = (leftModule.y + topModule.y + height) / 2;
            }
        } else { // Not first column, top module unavailable
            width ??= leftModule.width;
            height ??= leftModule.height;
            x = leftModule.x + width;
            y = leftModule.y;
        }
        const pos = bestFitModule(imageData, scaledSize(width, height), x, y, expectedValue);
        pos.width = width;
        pos.height = height;
        // Update width and height properties
        const horizontalBound = m => m?.bound.left || m?.bound.right;
        const verticalBound = m => m?.bound.top || m?.bound.bottom;
        if (horizontalBound(pos) && horizontalBound(leftModule) && smallDifference(width, pos.x - leftModule.x, 0.3)) {
            pos.width = pos.x - leftModule.x;
        }
        if (verticalBound(pos) && verticalBound(topModule) && smallDifference(height, pos.y - topModule.y, 0.3)) {
            pos.height = pos.y - topModule.y;
        }
        return pos;
    }
    // Loop to find all modules
    const arr = [];
    let x, y, width, height;
    do { // Each row
        const row = [];
        arr.push(row);
        do { // Each column (single module)
            const pos = fit(arr, row.length, arr.length - 1);
            row.push(pos);
            ({x, y, width, height} = pos);
            if (pos.bound.top || pos.bound.bottom) {
                leftPropagate(arr, row.length - 1, arr.length - 1);
            }
        } while (x + width < imageData.width);
    } while (y + height < imageData.height);
    return arr;
}
// Get best fit module positions
function getPositions(imageData, size) {
    const n = 3; // Run fitPositions n times
    return [...Array(n + 1)].reduce(a => fitPositions(imageData, size, a));
}
// Takes in 2D array of positions, looks in canvas and returns 2D barcode
function getCodeFit(imageData, size, arr) {
    // radius width/height
    const w = Math.round((size.darkWidth + size.lightWidth) / 2 / 2);
    const h = Math.round((size.darkHeight + size.lightHeight) / 2 / 2);
    return arr.map(row => row.map(pos => // For each module
        argmax(countPixels(imageData, pos.x - w, pos.y - h, pos.x + w, pos.y + h)) == DARK_VAL // Determine if light or dark
        ? 1 : 0
    ));
}
// Draw code to new canvas
function drawCode(canv, code) {
    const ctx = canv.getContext('2d');
    const length = 10;
    const xSize = code[0].length;
    const ySize = code.length;
    canv.width = xSize * length;
    canv.height = ySize * length;
    for (let y = 0; y < ySize; y++) {
        for (let x = 0; x < xSize; x++) {
            if (code[y][x] == 1) {
                // Fill square corresponding to pixel
                ctx.fillRect(x * length, y * length, length, length);
            }
        }
    }
}

const img = document.getElementById('abc');
function main() {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = parseInt(img.width);
    canvas.height = parseInt(img.height);
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    // Main code
    threshold(imageData.data);
    ctx.putImageData(imageData, 0, 0);
    const size = getModuleSize(imageData);
    // Simple grid
    const range = getRange(imageData, size);
    const code = getCode(imageData, size, range);
    // Fit
    const positions = getPositions(imageData, size);
    const codeFit = getCodeFit(imageData, size, positions);
    // Drawing on ctx before getCode may affect result, all drawing below this comment
    //drawLines(canvas, ctx, size, range);
    drawFit(ctx, positions);
    console.log('Bad modules: ' + positions.flat().filter(pos => pos.bad).length);
    const result = document.getElementById('result');
    drawCode(result, code);
    const resultFit = document.getElementById('fit');
    drawCode(fit, codeFit);
}

const imageInput = document.getElementById('imageInput');
imageInput.onchange = function () {
    if (this.files.length == 0) {
        return;
    }
    img.src = URL.createObjectURL(this.files[0]);
    img.onload = function () {
        URL.revokeObjectURL(img.src);
        main();
    }
}

if (img.complete) {
    main()
} else {
    img.addEventListener('load', main);
}
