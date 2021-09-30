const LIGHT_VAL = 255;
const DARK_VAL = 0;
function getIndex(canv, x, y) {
    return (y * canv.width + x) * 4;
}
// Threshold and put to canvas
function threshold(canv, ct) {
    const imageData = ct.getImageData(0, 0, canv.width, canv.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        let val = LIGHT_VAL;
        if (data[i] < 80 && data[i + 1] < 80 && data[i + 2] < 80) {
            val = DARK_VAL;
        }
        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
    }
    ct.putImageData(imageData, 0, 0);
}
// Returns frequency count of each element in arr
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
    for (let y = 0; y < canv.height; y++) {
        let prev = data[getIndex(canv, 0, y)];
        let pos = 0;
        for (let x = 1; x < canv.width; x++) {
            const curr = data[getIndex(canv, x, y)];
            if (prev == LIGHT_VAL && curr != LIGHT_VAL) {
                lightWidths.push(x - pos);
                pos = x;
            } else if (prev == DARK_VAL && curr != DARK_VAL) {
                darkWidths.push(x - pos);
                pos = x;
            }
            prev = curr;
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
function average_peak(obj) {
    const radius = 2;
    let maxI = parseInt(argmax(obj));
    let count = 0;
    let total = 0;
    for (let i = maxI - radius; i <= maxI + radius; i++) {
        const c = obj[i] ?? 0;
        count += c;
        total += c * i;
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
    const lightWidth = average_peak(lightCounts);
    const darkWidth = average_peak(darkCounts);
    ct.putImageData(imageData, 0, 0);
    return {lightWidth, darkWidth};
}
// Finds first row/column of modules
function getFirstCoord(canv, ct, size, isX, isReversed) {
    const imageData = ct.getImageData(0, 0, canv.width, canv.height);
    const data = imageData.data;
    const thresh = size.darkWidth / 2;
    const i_max = isX ? canv.width : canv.height;
    const j_max = isX ? canv.height : canv.width;
    let getI_1 = getIndex;
    if (isReversed) {
        getI_1 = (c, x, y) => getIndex(c, c.width - x - 1, c.height - y - 1);
    }
    let getI = getI_1; // Could probably use closures but this works
    if (isX) {
        getI = (c, j, i) => getI_1(c, i, j);
    }
    for (let i = 0; i < i_max; i++) {
        let count = 0;
        for (let j = 0; j < j_max; j++) {
            const curr = data[getI(canv, j, i)];
            if (curr == DARK_VAL) {
                count++;
                if (count > thresh) {
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
    ctx.beginPath();
    ctx.arc(xFirst, yFirst, 5, 0, Math.PI * 2);
    ctx.stroke();
    const width = (size.darkWidth + size.lightWidth) / 2;
    const yLimit = yLast + width / 2;
    ctx.beginPath();
    ctx.moveTo(0, yLimit);
    ctx.lineTo(canv.width, yLimit);
    ctx.stroke();
    for (let i = 0; yFirst + i * width < yLimit; i++) {
        ctx.beginPath();
        ctx.moveTo(0, yFirst + i * width);
        ctx.lineTo(canv.width, yFirst + i * width);
        ctx.stroke();
    }
    const xLimit = xLast + width / 2;
    ctx.beginPath();
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
    for (let x = xStart; x < xEnd; x++) {
        for (let y = yStart; y < yEnd; y++) {
            const val = data[getIndex(canv, x, y)];
            obj[val] = (obj[val] ?? 0) + 1;
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
    const width = (size.darkWidth + size.lightWidth) / 2;
    const xSize = Math.round((xLast - xFirst) / width + 1);
    const ySize = Math.round((yLast - yFirst) / width + 1);
    const code = [];
    for (let y = 0; y < ySize; y++) {
        const yStart = Math.round(yFirst + (y - 0.5) * width);
        const yEnd = yStart + Math.round(width);
        const row = [];
        for (let x = 0; x < xSize; x++) {
            const xStart = Math.round(xFirst + (x - 0.5) * width);
            const xEnd = xStart + Math.round(width);
            const count = countPixels(canv, data, xStart, yStart, xEnd, yEnd);
            const maxVal = argmax(count); // simple argmax for now
            row.push(maxVal == DARK_VAL ? 1 : 0);
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
