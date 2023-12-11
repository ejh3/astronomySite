// Result of VizieR Search with 3 ANDed constraints (Gr: "!=") AND (B-V: "!=") AND (Lum: "!=")

let emojiSun = true;

const T_SUN = 5778;

const SUN = emojiSun ? '🌞' : '☉';
// that code is the unicode for the sun emoji 🌞

const LEFT_GAP = 50;
const RIGHT_GAP = 50;
const TOP_GAP = 50;
const BOTTOM_GAP = 70;

const FONT_SIZE = 14;
const AXIS_STYLE = {
  stroke: '#000',
  strokeWidth: 2,
  selectable: false,
  objectType: 'axis',
}
const SUN_SUBSCRIPT = emojiSun ? 
  { size: 0.9, baseline: 0.16 } : 
  { size: 0.8, baseline: 0.12 };

  ////////////////////////////////// INIT //////////////////////////////////

  // Initialize Fabric.js canvas
  const canvas = new fabric.Canvas('hrCanvas', { 
    selection: false, 
    // renderOnAddRemove: false
  });
  // Set initial canvas dimensions and draw initial elements
  canvas.setDimensions({ width: window.innerWidth, height: window.innerHeight });

  var L = LEFT_GAP;
  var T = TOP_GAP;
  var R = canvas.width - RIGHT_GAP;
  var B = canvas.height - BOTTOM_GAP;
  
  var r = 0;

  var coords;
  var star;
  var isMouseDown;
  
  drawStarAndCoords(0.25,0.25)
  redrawCanvas();


//////////////////////////////////  MATH HELPERS  //////////////////////////////////

// Function modified from https://gist.github.com/paulkaplan/5184275
function kelvinToRGB(kelvin) {
  const temperature = kelvin / 100;
  let red, green, blue;

  if (temperature <= 66) {
    red = 255;
    green = 99.4708025861 * Math.log(temperature) - 161.1195681661, 255;
    if (temperature <= 19){
      blue = 0;
    } 
    else {
      blue = temperature - 10;
      blue = 138.5177312231 * Math.log(blue) - 305.0447927307;
    }
  } 
  else {
    red = 329.698727446 * Math.pow(temperature - 60, -0.1332047592);
    green = 288.1221695283 * Math.pow(temperature - 60, -0.0755148492);
    blue = 255;
  }

  // Ensure values are within the valid RGB range
  red = Math.min(255, Math.max(0, red));
  green = Math.min(255, Math.max(0, green));
  blue = Math.min(255, Math.max(0, blue));

  return [Math.round(red), Math.round(green), Math.round(blue)];
}

// m and b refer to the values in the equation y = m*x + b
function fitLineWithinBorders(m, b) {
  console.log(`m=${m}, b=${b}`);
  const x1a = L;
  const x1b = (T - b) / m;
  const x1 = x1a > x1b ? x1a : x1b; // intersect with left or top
  const y1 = x1a > x1b ? m * L + b : T;

  const x2a = R;
  const x2b = (B - b) / m;
  const x2 = x2a < x2b ? x2a : x2b; // intersect with right or bottom
  const y2 = x2a < x2b ? m * R + b : B;
  return [x1, y1, x2, y2]
}

// takes an input in range [L,R] and intepolates to range [0,1]
function normalizeX(x, ignoreOOB=false) {
  if ((x > R || x < L) && !ignoreOOB) {
    console.error(`Error: x=${x} must be between L=${L} and R=${R}.`);
  }
  return (x - L) / (R - L)
}

// takes an input in range [B,T] and intepolates to range [0,1]
function normalizeY(y, ignoreOOB=false) {
  if ((y > B || y < T) && !ignoreOOB) {
    console.error(`Error: y=${y} must be between B=${B} and T=${T}.`);
  }
  return (y - B) / (T - B)
}

function invNormalizeX(normalizedX, ignoreOOB=false) {
  if ((normalizedX < 0 || normalizedX > 1) && !ignoreOOB) {
    console.error(`Error: normalizedX=${normalizedX} must be between 0 and 1.`);
  }
  return normalizedX * (R-L) + L;
}

function invNormalizeY(normalizedY, ignoreOOB=false) {
  if ((normalizedY < 0 || normalizedY > 1) && !ignoreOOB) {
    console.error(`Error: normalizedY=${normalizedY} must be between 0 and 1.`);
  }
  return normalizedY * (T-B) + B;
}

// takes an input x in range [0,1] and exponentially interpolates to range [a, b]
function expInterpolate(x, a, b, ignoreOOB=false) {
  if ((x < 0 || x > 1) && !ignoreOOB) {
    console.error(`Error: x=${x} must be between 0 and 1.`);
  }
  return a * Math.pow(b / a, x);
}

function invExpInterpolate(interpolatedX, a, b, ignoreOOB=false) {
  if (((interpolatedX < a && interpolatedX < b) || (interpolatedX > a && interpolatedX > b))
      && !ignoreOOB) {
    console.error(`Error: interpolatedX=${interpolatedX} must be between a=${a} and b=${b}.`);
  }
  return Math.log(interpolatedX / a) / Math.log(b / a);
}

function xyToTempLum(x, y, ignoreOOB=false) {
  const temperature = x != null ? 
    expInterpolate(normalizeX(x, ignoreOOB), 40000, 2300, ignoreOOB) : 
    null;  
  const luminosity = y != null ? 
    expInterpolate(normalizeY(y, ignoreOOB), 1e-4, 1e6, ignoreOOB) : 
    null;
  return [temperature, luminosity];
}

function tempLumToXY(temperature, luminosity, ignoreOOB=false) {
  const t = temperature;
  const l = luminosity;
  const x = t != null ? 
    invNormalizeX(invExpInterpolate(t, 40000, 2300, ignoreOOB), ignoreOOB) : 
    null;
  const y = l != null ? 
    invNormalizeY(invExpInterpolate(l, 1e-4, 1e6, ignoreOOB), ignoreOOB) : 
    null;
  return [x, y];
}

function shortNum(x) {
  return Number(x.toPrecision(3));
}

// The equation governing the relationship between luminosity, radius and temperature is
// L = R^2 * T^4 where L, T and R are in solar units.
// Interestingly, when radius is fixed and both the x and y axes are logarithmic, the slope
// of the line is constant. This function returns that constant slope in terms of pixel units.
// To do so, it empirically finds the slope in pixels between two points on the line.
function getConstRadiusSlope() {
  // Let radius be 1 solar radius, then we just have L = T^4. We pick T=5 and T=2 for our points
  const [x1, y1] = tempLumToXY(2 * T_SUN, 2**4);
  const [x2, y2] = tempLumToXY(5 * T_SUN, 5**4);
  const m = (y2 - y1) / (x2 - x1);
  drawSimpleStar(10000, 10, '#aaf');

  return m;
}

function getRadiusFromTempLum(temp, lum) {
  return Math.sqrt(lum / (temp / T_SUN)**4);
}


////////////////////////////////////  DRAWING  ////////////////////////////////////

// Function to draw x and y axes
function drawDiagram() {
  const xAxis = new fabric.Line([L, B, R, B], AXIS_STYLE);
  const yAxis = new fabric.Line([L, T, L, B], AXIS_STYLE);
  canvas.add(
    new fabric.Line([L, B, R, B], AXIS_STYLE), // x-axis
    new fabric.Line([L, T, L, B], AXIS_STYLE), // y-axis
  );
  _drawXAxisLabels([40000, 20000, 10000, 5000, 2300]);
  _drawYAxisLabels([1e-4, 1e-3, 1e-2, 1e-1, 1e0, 1e1, 1e2, 1e3, 1e4, 1e5, 1e6]);
  _drawConstantRadiusLines([0.001, 0.01, 0.1, 1, 10, 100, 1000]);
}

  // Function to draw x-axis labels
function _drawXAxisLabels(labels, tickWidth=8) {
  for (let i = 0; i < labels.length; i++) {
    const [x, _] = tempLumToXY(labels[i], null);
    const label = new fabric.Text(`${labels[i]}`, {
      left: x,
      top: B + tickWidth,// + FONT_SIZE/2, // Adjusted position
      fontSize: FONT_SIZE,
      selectable: false,
      originX: 'center',
      originY: 'top',
    });
    const tick = new fabric.Line([x, B, x, B + tickWidth], AXIS_STYLE);
    canvas.add(label, tick);
  }

  // Add "Temperature (K)" label
  const tempLabel = new fabric.Text("Temperature (K)", {
    left: (canvas.width - L - RIGHT_GAP) / 2 + L,
    top: B + tickWidth + FONT_SIZE,
    fontSize: FONT_SIZE * 1.4,
    selectable: false,
    originX: 'center',
    originY: 'top',
  });

  canvas.add(tempLabel);
}

// Function to draw y-axis labels
function _drawYAxisLabels(labels, tickWidth=8) {
  for (let i = 0; i < labels.length; i++) {
    const [_, y] = tempLumToXY(null, labels[i]);
    const label = new fabric.Text(`${10}${Math.log10(labels[i])}`, {
      left: L - tickWidth, // Adjusted position
      top: y,
      fontSize: FONT_SIZE,
      selectable: false,
      originY: 'center',
      originX: 'right'
    }).setSuperscript(2, 4);
    const tick = new fabric.Line([L, y, L - tickWidth, y], AXIS_STYLE);
    canvas.add(label, tick);
  }
}

// Function to draw lines of constant radius
function _drawConstantRadiusLines(radii) {
  const m = getConstRadiusSlope();

  const [leftEdgeTemp, _] = xyToTempLum(0, null, true);
  console.log(`leftEdgeTemp=${leftEdgeTemp}`);
  for (let i = 0; i < radii.length; i++) {
    // b is where the line meets the left edge of the canvas. As such, we must calculate
    // the temperature at the left edge of the canvas, to get the luminosity at that 
    // point, to convert to to xy coords.
    const interceptLum = radii[i]**2 * (leftEdgeTemp / T_SUN)**4;
    const [_, interceptY] = tempLumToXY(null, interceptLum, true);
    // console.log(`interceptLum=${interceptLum}, interceptY=${interceptY}`); // dbug

    // const b = (B) - (i)*100 - offset;

    const [x1, y1, x2, y2] = fitLineWithinBorders(m, interceptY);
    const line = new fabric.Line([x1, y1, x2, y2], {
      stroke: '#faa',
      strokeWidth: 1,
      selectable: false
    });

    const label = new fabric.Text(` ${radii[i]}`, {
      fill: '#faa',
      left: x1,
      top: y1,
      originX: 'left',
      originY: 'bottom',
      fontSize: FONT_SIZE,
      selectable: false
    });

    canvas.add(line, label);
  }
}

function drawStarAndCoords(normalizedX, normalizedY) {
  if (!star) {
    star = new fabric.Circle({
      radius: 10,
      selectable: false,
      originX: 'center',
      originY: 'center',
    }); 
  }
  if (!coords) {
    coords = new fabric.Text(`none`, {
      fontSize: FONT_SIZE * 1.4,
      selectable: false,
      originX: 'left',
      originY: 'bottom',
      left: L,
      top: B,
      subscript: SUN_SUBSCRIPT,
    });
  }
  // console.log(`Added star at ${x}, ${y}`);
  const x = invNormalizeX(normalizedX);
  const y = invNormalizeY(normalizedY);
  moveStar(x, y);
  canvas.add(star);
  canvas.add(coords);
}

// Function to draw a circle at the specified position
function moveStar(x, y) {
  const [temp, lum] = xyToTempLum(x, y);
  const radius = getRadiusFromTempLum(temp, lum);
  const [r, g, b] = kelvinToRGB(temp);
  let d = normalizeY(y) * 0.5 + 0.7;
  let [rL, gL, bL] = [d*r, d*g, d*b];

  star.set({
    // displayed radius doubles for every 10x increase in real radius
    radius: radius**Math.log10(2)*30,
    left: x,
    top: y,
    // fill: `rgb(${rL}, ${gL}, ${bL})`,
    fill: `rgb(${r}, ${g}, ${b})`,
    shadow: new fabric.Shadow({
      color: `rgba(${r*0.8}, ${g*0.8}, ${b*0.8})`,
      // color: `rgba(${rL}, ${gL}, ${bL})`,
      // color: `rgba(0,0,0,0.3)`,
      blur: 10 + normalizeY(y) * 100,
      offsetX: 0,
      offsetY: 0,
    }),
  });
  _updateCoords(temp, lum, radius);
  canvas.renderAll();
}

function _updateCoords(temp, lum, radius) {
  const parts = [
    ` Temperature: ${shortNum(temp)} K`,
    ` Luminosity: ${shortNum(lum)} L${SUN}`,
    ` Radius: ${shortNum(radius)} R${SUN}`,
  ];
  const text = parts.join('\n');
  coords.set({text: text});

  // This for loop is NOT the same as using for (let i...) { text[i]... }. It
  // iterates over _code points_, not bytes. The emoji sun is actually 2 bytes.
  let i = 0;
  coords.set({styles: {}}); // clear subscript formatting
  for (const codePoint of text) {
    if (codePoint == SUN) {
      coords.setSubscript(i, i+1);
    }
    i++;
  }
  // console.log(JSON.stringify(coords.toObject().styles)); // dbug
}

function drawSimpleStar(temp, lum, color = '#faa') {
  const [x, y] = tempLumToXY(temp, lum);
  const star = new fabric.Circle({
    left: x,
    top: y,
    radius: 5,
    fill: color,
    selectable: false,
    originX: 'center',
    originY: 'center',
  });
  canvas.add(star);
}



// Function to redraw the canvas
function redrawCanvas() {
  // console.log(`resize ${r++} begin`); // dbug
  if (!star) {
    drawStarAndCoords(0.5, 0.5);
  }
  let xN = normalizeX(star.left);
  let yN = normalizeY(star.top);

  canvas.clear();
  canvas.setDimensions({ width: window.innerWidth, height: window.innerHeight });
  
  L = LEFT_GAP;
  T = TOP_GAP;
  R = canvas.width - RIGHT_GAP;
  B = canvas.height - BOTTOM_GAP;

  x = invNormalizeX(xN);
  y = invNormalizeY(yN);
  // console.log(`Old star at (${shortNum(xN)}, ${shortNum(yN)})`); // dbug
  // console.log(`New star at (${shortNum(normalizeX(x))}, ${shortNum(normalizeY(y))})`); // dbug
  drawDiagram();
  drawStarAndCoords(xN, yN);
}


////////////////////////////////// EVENT LISTENERS //////////////////////////////////

canvas.on('mouse:down', function (options) {
  isMouseDown = true;
  const pointer = canvas.getPointer(options.e);
  const [x, y] = [pointer.x, pointer.y];
  if (x >= L && x <= R && y >= T && y <= B) {
    moveStar(x, y);
  }
});

canvas.on('mouse:move', function (options) {
  const pointer = canvas.getPointer(options.e);
  const [x, y] = [pointer.x, pointer.y];
  if (isMouseDown) {
    //moveStar(x, y);
    moveStar(Math.min(R, Math.max(x, L)), Math.min(B, Math.max(y, T)));
  }
});

canvas.on('mouse:up', function () {
  isMouseDown = false;
});

// Update canvas dimensions on window resize
window.addEventListener('resize', () => {
  redrawCanvas();
});
