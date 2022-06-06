// Colors representing light and dark on the canvas for visualisation
const LIGHT_VAL = 255;
const DARK_VAL = 0;
// Helper function to get the index to access the canvas
// There are 4 values red green blue alpha, this index points to the first
function getIndex(imageData, x, y) {
    return (y * imageData.width + x) * 4;
}
// Threshold and put to canvas
function threshold(data) {
    for (let i = 0; i < data.length; i += 4) { // For each pixel
        let val = LIGHT_VAL;
        if (data[i] < 120 && data[i + 1] < 120 && data[i + 2] < 120) {
            val = DARK_VAL; // Threshold
        }
        data[i] = val; // Write to rgb values of imageData
        data[i + 1] = val;
        data[i + 2] = val;
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
// Returns array of dark and light widths
function getWidths(getVal, iStart, jStart, iEnd, jEnd) {
    let light = [];
    let dark = [];
    // Currently only horizontal scanlines, can add vertical (heights?)
    for (let j = jStart; j < jEnd; j++) { // For each row
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
function averagePeak(obj) {
    const radius = 2;
    let maxI = parseInt(argmax(obj)); // Find peak
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
function getModuleSize(imageData, xStart, yStart, xEnd, yEnd) {
    const lengths = getCrossoverLengths(imageData, xStart, yStart, xEnd, yEnd);
    console.log(lengths);
    return {
        lightWidth: averagePeak(lengths.lightWidths),
        darkWidth: averagePeak(lengths.darkWidths),
        lightHeight: averagePeak(lengths.lightHeights),
        darkHeight: averagePeak(lengths.darkHeights)
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
        // Code below is interested in second coordinate
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
    let x = Math.round(oldX);
    let y = Math.round(oldY);

    // r related to pixel count (similar to radius)
    // Divide by 2 for radius + a bit more, centre portion is more likely to be the module color
    const r = Math.floor(Math.min(size.darkWidth, size.lightWidth) / 3); 
    const val = expectedValue ?? argmax(countPixels(imageData, x - r, y - r, x + r, y + r));
    // radius width/height
    const w = Math.round((val == DARK_VAL ? size.darkWidth : size.lightWidth) / 2);
    const h = Math.round((val == DARK_VAL ? size.darkHeight : size.lightHeight) / 2);
    const thresholdToMoveX = w; // Don't want to move just because a side has one more pixel than the other
    const thresholdToMoveY = h;

    // averageWidth related to move limit
    const averageWidth = Math.round((size.darkWidth + size.lightWidth + size.darkHeight + size.lightHeight) / 4);
    const moveLimit = Math.round(averageWidth / (expectedValue == null ? 2 : 1)); // Prevent moving too much

    let xMove = 0, yMove = 0; // Move counter
    let prevX, prevY; // Variable to check if actually moved
    const bound = {left: false, right: false, top: false, bottom: false}; // Boundary found, position is probably reliable
    do { // Move horizontally
        prevX = x;
        xMove++;
        // A[xxxxxS] Try to move left
        const leftAdd = countPixels(imageData, x - w - 1, y - h, x - w, y + h)[val] ?? 0;
        const leftSub = countPixels(imageData, x + w - 1, y - h, x + w, y + h)[val] ?? 0;
        if (leftAdd - leftSub > thresholdToMoveX) {
            x--;
        } else if (leftAdd - leftSub < -thresholdToMoveX) {
            bound.left = true;
        }
        // [Sxxxxx]A Note x coord for lA + 1 = rS, lS + 1 = rA, no infinite loop
        const rightAdd = countPixels(imageData, x + w, y - h, x + w + 1, y + h)[val] ?? 0;
        const rightSub = countPixels(imageData, x - w, y - h, x - w + 1, y + h)[val] ?? 0;
        if (rightAdd - rightSub > thresholdToMoveX) {
            x++;
        } else if (rightAdd - rightSub < -thresholdToMoveX) {
            bound.right = true;
        }
    } while (prevX != x && xMove <= moveLimit);
    do { // Move vertically
        prevY = y;
        yMove++;
        const upAdd = countPixels(imageData, x - w, y - h - 1, x + w, y - h)[val] ?? 0;
        const upSub = countPixels(imageData, x - w, y + h - 1, x + w, y + h)[val] ?? 0;
        if (upAdd - upSub > thresholdToMoveY) {
            y--;
        } else if (upAdd - upSub < -thresholdToMoveY) {
            bound.top = true;
        }
        const downAdd = countPixels(imageData, x - w, y + h, x + w, y + h + 1)[val] ?? 0;
        const downSub = countPixels(imageData, x - w, y - h, x + w, y - h + 1)[val] ?? 0;
        if (downAdd - downSub > thresholdToMoveY) {
            y++;
        } else if (downAdd - downSub < -thresholdToMoveY) {
            bound.bottom = true;
        }
    } while (prevY != y && yMove <= moveLimit);
    if (xMove > moveLimit || yMove > moveLimit) { // Move limit was reached
        return {x: oldX, y: oldY, bound, bad: true}; // Assume bad alignment
    }
    return {x, y, bound, bad: false};
}
// Get best fit module positions
function getPositions(imageData, size) {
    const width = (size.darkWidth + size.lightWidth) / 2;
    const height = (size.darkHeight + size.lightHeight) / 2;
    const xFirst = getFirstCoord(imageData, size, true, false);
    const yFirst = getFirstCoord(imageData, size, false, false);
    const firstSize = getModuleSize(imageData, xFirst, yFirst, xFirst + width * 7, yFirst + height * 7);
    console.log(firstSize);
    const firstWidth = (firstSize.darkWidth + firstSize.lightWidth) / 2;
    const firstHeight = (firstSize.darkHeight + firstSize.lightHeight) / 2;
    const arr = [];
    function calculateHeight(currPos, currHeight) {
        const hasBound = currPos.bound.top || currPos.bound.bottom;
        // If hasBound:
        // Prevent rounding error if too close module is chosen
        // Positions are snapped to integer values by fit algorithm
        // Ignore last (3 - 1) rows of arr, first row accepted is 3 rows away
        // If !hasBound:
        // Should not correct for rounding error if position has been affected by module with bound earlier
        // So, should take nearest module with bound
        // No rows of arr ignored, first row accepted is 1 row away (closest row)
        const exclude = hasBound ? 3 : 1;
        if (arr.length < exclude) {
            return currHeight;
        }
        let i = arr.length - exclude;
        while (i > 0) {
            const module = arr[i][0];
            if (module.bound.top || module.bound.bottom) {
                break;
            }
            i--;
        }
        const module = arr[i][0];
        if (!hasBound) {
            // Correct for rounding error
            // Intended length from previous bound - current length
            console.log(arr.length, i, 'nearest');
            return module.height * (arr.length - i + 1) - (currPos.y - module.y);
        }
        console.log(arr.length, i, currPos.y - module.y, 'round');
        return (currPos.y - module.y) / (arr.length - i);
    }
    function calculateWidth(currPos, currWidth, row) {
        const hasBound = currPos.bound.left || currPos.bound.right;
        const exclude = hasBound ? 3 : 1;
        if (row.length < exclude) {
            return currWidth;
        }
        let i = row.length - exclude;
        while (i > 0) {
            const module = row[i];
            if (module.bound.left || module.bound.right) {
                break;
            }
            i--;
        }
        const module = row[i];
        if (!hasBound) {
            //console.log(row.length, i, (currPos.x - module.x), (row.length - i));
            return module.width * (row.length - i + 1) - (currPos.x - module.x);
        }
        return (currPos.x - module.x) / (row.length - i);
    }
    let x, y;
    do { // Each row
        const row = [];
        do { // Each column (single module)
            let expectedValue, width, height;
            const topModule = arr[arr.length - 1]?.[row.length];
            const leftModule = row[row.length - 1];
            if (row.length == 0 && arr.length == 0) { // First column and first row
                x = xFirst;
                y = yFirst;
                width = firstWidth;
                height = firstHeight;
                expectedValue = DARK_VAL;
            } else if (row.length == 0 && arr.length > 0) { // First column and not first row
                x = topModule.x;
                y = topModule.y + topModule.height;
                width = topModule.width;
                height = topModule.height;
            } else if (topModule?.bad == false) { // Not first column, top module exists and is not bad
                x = (x + topModule.width + topModule.x) / 2;
                y = (y + topModule.y + topModule.height) / 2;
                width = topModule.width;
                height = topModule.height;
            } else if (row.length > 0) { // Not first column, top module unavailable
                x += leftModule.width;
                width = leftModule.width;
                height = leftModule.height;
            }
            const pos = bestFitModule(imageData, size, x, y, expectedValue);
            if (arr.length == 0) {
                width = calculateWidth(pos, width, row);
                //console.log(width, x);
            }
            if (row.length == 0) {
                height = calculateHeight(pos, height);
                console.log(arr.length, height, y);
            }
            pos.width = width;
            pos.height = height;
            row.push(pos);
            ({x, y} = pos);
        } while (x + width < imageData.width);
        arr.push(row);
    } while (y + height < imageData.height);
    return arr;
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
    const range = getRange(imageData, size);
    const code = getCode(imageData, size, range);
    const positions = getPositions(imageData, size);
    const codeFit = getCodeFit(imageData, size, positions);
    //drawLines(canvas, ctx, size, range); // drawing before getCode may affect result
    positions.flat().forEach(pos => drawCircle(ctx, pos.x, pos.y));
    positions.flat().filter(pos => pos.bad).forEach(pos => drawCircle(ctx, pos.x, pos.y, 'red'));
    positions.forEach(r => r.reduce((p, c) => {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(c.x, c.y);
        ctx.stroke();
        return c;
    }));
    console.log('Bad modules: ' + positions.flat().filter(pos => pos.bad).length);
    const result = document.getElementById('result');
    drawCode(result, code);
    const resultFit = document.getElementById('fit');
    drawCode(fit, codeFit);
}
if (img.complete) {
    main()
} else {
    img.addEventListener('load', main);
}
