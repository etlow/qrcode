// Colors representing light and dark on the canvas for visualisation
const LIGHT_VAL = 255;
const DARK_VAL = 0;
// Helper function to get the index to access the canvas
// There are 4 values red green blue alpha, this index points to the first
function getIndex(canv, x, y) {
    return (y * canv.width + x) * 4;
}
// Threshold and put to canvas
function threshold(canv, ct) {
    const imageData = ct.getImageData(0, 0, canv.width, canv.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) { // For each pixel
        let val = LIGHT_VAL;
        if (data[i] < 80 && data[i + 1] < 80 && data[i + 2] < 80) {
            val = DARK_VAL; // Threshold
        }
        data[i] = val; // Write to rgb values of imageData
        data[i + 1] = val;
        data[i + 2] = val;
    }
    ct.putImageData(imageData, 0, 0);
}
// Returns frequency count of each element in arr
// Input: [1, 1, 1, 2, 4] Output: {1: 3, 2: 1, 4: 1} 
function count(arr) {
    const count = {};
    arr.forEach(e => (count[e] = (count[e] ?? 0) + 1));
    return count;
}
// Returns frequency count of widths from canvas data
function getCrossoverWidths(canv, data) {
    const lightWidths = [];
    const darkWidths = [];
    // Currently only horizontal scanlines, can add vertical (heights?)
    for (let y = 0; y < canv.height; y++) { // For each row
        let prev = data[getIndex(canv, 0, y)];
        let pos = 0;
        for (let x = 1; x < canv.width; x++) { // Each pixel
            const curr = data[getIndex(canv, x, y)];
            if (prev == LIGHT_VAL && curr != LIGHT_VAL) { // If color switched
                lightWidths.push(x - pos); // Push distance from last transition
                pos = x; // Save transition position
            } else if (prev == DARK_VAL && curr != DARK_VAL) {
                darkWidths.push(x - pos);
                pos = x;
            }
            prev = curr; // Set new color
        }
    }
    const lightCounts = count(lightWidths);
    const darkCounts = count(darkWidths);
    return {lightCounts, darkCounts};
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
function getModuleSize(canv, ct) {
    const imageData = ct.getImageData(0, 0, canv.width, canv.height);
    const data = imageData.data;
    const widths = getCrossoverWidths(canv, data);
    console.log(widths);
    const {lightCounts, darkCounts} = widths;
    const lightWidth = averagePeak(lightCounts);
    const darkWidth = averagePeak(darkCounts);
    ct.putImageData(imageData, 0, 0);
    return {lightWidth, darkWidth};
}
// Finds first row/column of modules
// size: module size
// isX: True if finding first x coordinate, otherwise y
// isReversed: True if finding last coordinate instead of first
function getFirstCoord(canv, ct, size, isX, isReversed) {
    const imageData = ct.getImageData(0, 0, canv.width, canv.height);
    const data = imageData.data;
    const thresh = size.darkWidth / 2;
    const i_max = isX ? canv.width : canv.height;
    const j_max = isX ? canv.height : canv.width;
    let getI_1 = getIndex; // Default canvas access
    if (isReversed) {
        // Flip both x and y to search from the back
        getI_1 = (c, x, y) => getIndex(c, c.width - x - 1, c.height - y - 1);
    }
    let getI = getI_1; // Could probably use closures to be able to reference getI_1 but this works
    if (isX) {
        // Code below is interested in second coordinate
        // If x coordinate is needed, need to swap them around
        getI = (c, j, i) => getI_1(c, i, j);
    }
    for (let i = 0; i < i_max; i++) { // Loop through each coordinate of interest
        let count = 0;
        for (let j = 0; j < j_max; j++) { // Find first row/col with enough dark pixels
            const curr = data[getI(canv, j, i)];
            if (curr == DARK_VAL) {
                count++;
                if (count > thresh) { // Enough dark pixels
                    const coord = i + size.darkWidth / 2;
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
function getRange(canv, ctx, size) {
    const xFirst = getFirstCoord(canv, ctx, size, true, false);
    const yFirst = getFirstCoord(canv, ctx, size, false, false);
    const xLast = getFirstCoord(canv, ctx, size, true, true);
    const yLast = getFirstCoord(canv, ctx, size, false, true);
    return {xFirst, yFirst, xLast, yLast};
}
// Draw lines on canvas to visualise detected positions
function drawLines(canv, ctx, size, range) {
    const {xFirst, yFirst, xLast, yLast} = range;
    ctx.strokeStyle = 'green';
    ctx.beginPath(); // Circle in first module
    ctx.arc(xFirst, yFirst, 5, 0, Math.PI * 2);
    ctx.stroke();
    const width = (size.darkWidth + size.lightWidth) / 2;
    // Horizontal lines
    const yLimit = yLast + width / 2;
    ctx.beginPath(); // Line showing last pixel location
    ctx.moveTo(0, yLimit);
    ctx.lineTo(canv.width, yLimit);
    ctx.stroke();
    for (let i = 0; yFirst + i * width < yLimit; i++) {
        ctx.beginPath();
        ctx.moveTo(0, yFirst + i * width);
        ctx.lineTo(canv.width, yFirst + i * width);
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
function countPixels(canv, data, xStart, yStart, xEnd, yEnd) {
    const obj = {};
    for (let x = xStart; x < xEnd; x++) { // For each pixel in range
        for (let y = yStart; y < yEnd; y++) {
            const val = data[getIndex(canv, x, y)];
            obj[val] = (obj[val] ?? 0) + 1; // Increment count for pixel value
        }
    }
    return obj;
}
// Extract code from image
// Returns 2d array
function getCode(canv, ct, size, range) {
    const imageData = ct.getImageData(0, 0, canv.width, canv.height);
    const data = imageData.data;
    const {xFirst, yFirst, xLast, yLast} = range;
    // Calculate positions
    const width = (size.darkWidth + size.lightWidth) / 2;
    const xSize = Math.round((xLast - xFirst) / width + 1);
    const ySize = Math.round((yLast - yFirst) / width + 1);
    const code = [];
    for (let y = 0; y < ySize; y++) {
        const yStart = Math.round(yFirst + (y - 0.5) * width);
        const yEnd = yStart + Math.round(width);
        const row = [];
        for (let x = 0; x < xSize; x++) { // For each position
            const xStart = Math.round(xFirst + (x - 0.5) * width);
            const xEnd = xStart + Math.round(width);
            const count = countPixels(canv, data, xStart, yStart, xEnd, yEnd);
            const maxVal = argmax(count); // simple argmax for now
            row.push(maxVal == DARK_VAL ? 1 : 0); // Determine if light or dark
        }
        code.push(row);
    }
    return code;
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
    // Main code
    threshold(canvas, ctx);
    const size = getModuleSize(canvas, ctx);
    const range = getRange(canvas, ctx, size);
    const code = getCode(canvas, ctx, size, range);
    drawLines(canvas, ctx, size, range); // drawing before getCode may affect result
    const result = document.getElementById('result');
    drawCode(result, code);
}
if (img.complete) {
    main()
} else {
    img.addEventListener('load', main);
}
