// Seeded Random Number Generator - Deterministic for replayability
// Park-Miller LCG with 32-bit state

export function createRandom(seed = Date.now()) {
  let state = seed >>> 0;
  
  // Ensure non-zero seed
  if (state === 0) state = 1;
  
  return function random() {
    // Park-Miller LCG: state = (state * 16807) % 2147483647
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646; // Return [0, 1)
  };
}

export function createRandom32(seed = Date.now()) {
  let state = seed >>> 0;
  if (state === 0) state = 1;
  
  return {
    next: () => {
      // Xorshift32
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return state >>> 0;
    },
    float: () => {
      return (createRandom32().next() >>> 0) / 0x100000000;
    },
    int: (min, max) => {
      return min + Math.floor(createRandom32().float() * (max - min + 1));
    },
    bool: (prob = 0.5) => createRandom32().float() < prob,
    choice: (arr) => arr[Math.floor(createRandom32().float() * arr.length)],
    shuffle: (arr) => {
      const result = [...arr];
      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(createRandom32().float() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
      }
      return result;
    },
  };
}

// Deterministic noise functions
export function createNoise(seed) {
  const random = createRandom(seed);
  const perm = new Array(512);
  const grad3 = [
    [1,1,0], [-1,1,0], [1,-1,0], [-1,-1,0],
    [1,0,1], [-1,0,1], [1,0,-1], [-1,0,-1],
    [0,1,1], [0,-1,1], [0,1,-1], [0,-1,-1],
  ];
  
  for (let i = 0; i < 256; i++) perm[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
  
  function dot(g, x, y, z) {
    return g[0]*x + g[1]*y + g[2]*z;
  }
  
  function mix(a, b, t) {
    return a + t * (b - a);
  }
  
  function fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }
  
  return {
    simplex2D: (x, y) => {
      // Simplified 2D simplex noise
      const F2 = 0.5 * (Math.sqrt(3) - 1);
      const G2 = (3 - Math.sqrt(3)) / 6;
      
      const s = (x + y) * F2;
      const i = Math.floor(x + s);
      const j = Math.floor(y + s);
      const t = (i + j) * G2;
      const X0 = i - t;
      const Y0 = j - t;
      const x0 = x - X0;
      const y0 = y - Y0;
      
      let i1, j1;
      if (x0 > y0) { i1 = 1; j1 = 0; }
      else { i1 = 0; j1 = 1; }
      
      const x1 = x0 - i1 + G2;
      const y1 = y0 - j1 + G2;
      const x2 = x0 - 1 + 2 * G2;
      const y2 = y0 - 1 + 2 * G2;
      
      const ii = i & 255;
      const jj = j & 255;
      
      const gi0 = perm[ii + perm[jj]] % 12;
      const gi1 = perm[ii + i1 + perm[jj + j1]] % 12;
      const gi2 = perm[ii + 1 + perm[jj + 1]] % 12;
      
      let t0 = 0.5 - x0*x0 - y0*y0;
      let n0 = 0;
      if (t0 > 0) {
        t0 *= t0;
        n0 = t0 * t0 * dot(grad3[gi0], x0, y0, 0);
      }
      
      let t1 = 0.5 - x1*x1 - y1*y1;
      let n1 = 0;
      if (t1 > 0) {
        t1 *= t1;
        n1 = t1 * t1 * dot(grad3[gi1], x1, y1, 0);
      }
      
      let t2 = 0.5 - x2*x2 - y2*y2;
      let n2 = 0;
      if (t2 > 0) {
        t2 *= t2;
        n2 = t2 * t2 * dot(grad3[gi2], x2, y2, 0);
      }
      
      return 70 * (n0 + n1 + n2);
    },
    
    fbm2D: (x, y, octaves = 4, persistence = 0.5, lacunarity = 2) => {
      let value = 0;
      let amplitude = 1;
      let frequency = 1;
      let maxValue = 0;
      
      for (let i = 0; i < octaves; i++) {
        value += amplitude * createNoise(seed + i * 1000).simplex2D(x * frequency, y * frequency);
        maxValue += amplitude;
        amplitude *= persistence;
        frequency *= lacunarity;
      }
      
      return value / maxValue;
    },
  };
}

// Weighted random selection
export function weightedRandom(weights, random = Math.random) {
  const total = weights.reduce((sum, w) => sum + w.weight, 0);
  let threshold = random() * total;
  
  for (const item of weights) {
    threshold -= item.weight;
    if (threshold <= 0) return item.value;
  }
  
  return weights[weights.length - 1].value;
}

// Gaussian random (Box-Muller transform)
export function gaussianRandom(mean = 0, stdDev = 1, random = Math.random) {
  let u = 0, v = 0;
  while (u === 0) u = random();
  while (v === 0) v = random();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return z * stdDev + mean;
}

// Random point in circle
export function randomInCircle(radius, random = Math.random) {
  const r = radius * Math.sqrt(random());
  const theta = random() * Math.PI * 2;
  return { x: r * Math.cos(theta), y: r * Math.sin(theta) };
}

// Random point in rectangle
export function randomInRect(width, height, random = Math.random) {
  return {
    x: (random() - 0.5) * width,
    y: (random() - 0.5) * height,
  };
}

// Shuffle array in place (Fisher-Yates)
export function shuffleArray(array, random = Math.random) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Unique random integers
export function uniqueRandomInts(count, min, max, random = Math.random) {
  if (count > max - min + 1) count = max - min + 1;
  const set = new Set();
  while (set.size < count) {
    set.add(min + Math.floor(random() * (max - min + 1)));
  }
  return Array.from(set);
}