const T_SUN = 5778;

// const SUN = '🌞';
const SUN = '☉';

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

//document.addEventListener('DOMContentLoaded', function () {
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
  function normalizeX(x) {
    if (x > R || x < L) {
      console.error(`Error: x=${x} must be between L=${L} and R=${R}.`);
    }
    return (x - L) / (R - L)
  }

  // takes an input in range [B,T] and intepolates to range [0,1]
  function normalizeY(y) {
    if (y > B || y < T) {
      console.error(`Error: y=${y} must be between B=${B} and T=${T}.`);
    }
    return (y - B) / (T - B)
  }

  function invNormalizeX(normalizedX) {
    if (normalizedX < 0 || normalizedX > 1) {
      console.error(`Error: normalizedX=${normalizedX} must be between 0 and 1.`);
    }
    return normalizedX * (R-L) + L;
  }

  function invNormalizeY(normalizedY) {
    if (normalizedY < 0 || normalizedY > 1) {
      console.error(`Error: normalizedY=${normalizedY} must be between 0 and 1.`);
    }
    return normalizedY * (T-B) + B;
  }

  // takes an input x in range [0,1] and exponentially interpolates to range [a, b]
  function expInterpolate(x, a, b) {
    if (x < 0 || x > 1) {
      console.error(`Error: x=${x} must be between 0 and 1.`);
    }
    return a * Math.pow(b / a, x);
  }

  function invExpInterpolate(interpolatedX, a, b) {
    if ((interpolatedX < a && interpolatedX < b) || (interpolatedX > a && interpolatedX > b)) {
      console.error(`Error: interpolatedX=${interpolatedX} must be between a=${a} and b=${b}.`);
    }
    return Math.log(interpolatedX / a) / Math.log(b / a);
  }

  function xyToTempLum(x, y) {
    const temperature = x != null ? expInterpolate(normalizeX(x), 40000, 2300) : null;  
    const luminosity = y != null ? expInterpolate(normalizeY(y), 1e-4, 1e6) : null;
    return [temperature, luminosity];
  }

  function tempLumToXY(temperature, luminosity) {
    const t = temperature;
    const l = luminosity;
    const x = t != null ? invNormalizeX(invExpInterpolate(t, 40000, 2300)) : null;
    const y = l != null ? invNormalizeY(invExpInterpolate(l, 1e-4, 1e6)) : null;
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
    _drawXAxisLabels();
    _drawYAxisLabels();
    _drawConstantRadiusLines(20, 50);
  }

    // Function to draw x-axis labels
  function _drawXAxisLabels() {
    const labels = [40000, 20000, 10000, 5000, 2300];
    const tickWidth = 8;

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
  function _drawYAxisLabels() {
    const gap = (canvas.height - TOP_GAP - BOTTOM_GAP) / 10;
    const tickWidth = 8;

    for (let i = 0; i < 11; i++) {
      const y = B - i * gap;
      const label = new fabric.Text(`10${i - 4} `, {
        left: L - tickWidth, // Adjusted position
        top: y,
        fontSize: FONT_SIZE,
        selectable: false,
        originY: 'center',
        originX: 'right'
      }).setSuperscript(2,4);
      const tick = new fabric.Line([L, y, L - tickWidth, y], AXIS_STYLE);
      canvas.add(label, tick);
    }
  }

  // Function to draw lines of constant radius
  function _drawConstantRadiusLines() {
    const offset = 180;
    const radii = [0.001, 0.01, 0.1, 1, 10, 100, 1000];
    const m = getConstRadiusSlope();

    const [leftEdgeTemp, _] = xyToTempLum(0, null);
    console.log(`leftEdgeTemp=${leftEdgeTemp}`);
    for (let i = 0; i < radii.length; i++) {
      // b is where the line meets the left edge of the canvas. As such, we must calculate
      // the temperature at the left edge of the canvas, to get the luminosity at that 
      // point, to convert to to xy coords.
      const interceptLum = radii[i]**2 * (leftEdgeTemp / T_SUN)**4;
      const [_, interceptY] = tempLumToXY(null, interceptLum);
      console.log(`interceptLum=${interceptLum}, interceptY=${interceptY}`);

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
        subscript: { size: 0.8, baseline: 0.12 },
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
    const r = radius**Math.log10(2)*30; // doubles for every 10x increase in radius
    star.set({
      radius: r,
      left: x,
      top: y,
      fill: `rgb(${x}, 0, 0)`,
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
    coords.set({styles: {}}); // clear subscript formatting
    for (i = 0; i < text.length; i++) {
      if (text[i] == SUN) {
        coords.setSubscript(i, i + 1);
      }
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
    if (x >= L && x <= R && y >= T && y <= B && isMouseDown) {
      moveStar(x, y);
    }
  });

  canvas.on('mouse:up', function () {
    isMouseDown = false;
  });

  // Update canvas dimensions on window resize
  window.addEventListener('resize', () => {
    redrawCanvas();
  });
//});

function debounce(func, timeout = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => { func.apply(this, args); }, timeout);
  };
}