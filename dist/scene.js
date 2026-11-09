import * as T from './vendor/three.module.js';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';

const surface = 1.91;
const v = (x, y, z) => new T.Vector3(x, y, z);
const material = (color, roughness = .75, metalness = 0) => new T.MeshStandardMaterial({ color, roughness, metalness });
const pigment = (color, map, bumpMap, bumpScale) => new T.MeshStandardMaterial({ color, map, bumpMap, bumpScale, roughness: .88 });

function texture(width, height, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext('2d'), width, height);
  const result = new T.CanvasTexture(canvas);
  result.colorSpace = T.SRGBColorSpace;
  result.anisotropy = 8;
  return result;
}

function random(seed) {
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function grain(wood) {
  return texture(512, 512, (ctx, w, h) => {
    const rand = random(wood ? 301 : 1934);
    ctx.fillStyle = wood ? '#ad6c45' : '#c8ae90';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 2200; i++) {
      const x = rand() * w, y = rand() * h, size = rand() * 13 + 1;
      ctx.fillStyle = rand() > .46 ? 'rgba(250,229,196,.07)' : 'rgba(46,26,14,.09)';
      ctx.fillRect(x, y, wood ? size * 12 : size, wood ? .7 : size / 2);
    }
    for (let i = 0; i < 24000; i++) {
      ctx.fillStyle = rand() > .5 ? '#25170d20' : '#fff3ce22';
      ctx.fillRect(rand() * w, rand() * h, 1.4, 1);
    }
    if (!wood) return;
    for (let i = 0; i < 115; i++) {
      const y = rand() * h, a = 1 + rand() * 9, freq = rand() * .023;
      ctx.strokeStyle = i % 3 ? '#401c1225' : '#e7b08138';
      ctx.lineWidth = rand() * 1.9 + .35;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 4) ctx.lineTo(x, y + a * Math.sin(x * freq + i));
      ctx.stroke();
    }
  });
}

function put(parent, geometry, mat, x, y, z) {
  const item = new T.Mesh(geometry, mat);
  item.position.set(x, y, z);
  item.castShadow = item.receiveShadow = true;
  parent.add(item);
  return item;
}

function box(parent, mat, x, y, z, w, h, d) {
  const smallest = Math.min(w, h, d);
  const shape = smallest >= .026 ? new RoundedBoxGeometry(w, h, d, 2, Math.min(.024, smallest * .2)) : new T.BoxGeometry(w, h, d);
  return put(parent, shape, mat, x, y, z);
}

function lathe(parent, mat, x, y, z, profile) {
  return put(parent, new T.LatheGeometry(profile.map(([r, h]) => new T.Vector2(r, h)), 36), mat, x, y, z);
}

function sphere(parent, mat, x, y, z, sx, sy = sx, sz = sx) {
  const item = put(parent, new T.SphereGeometry(1, 20, 14), mat, x, y, z);
  item.scale.set(sx, sy, sz);
  return item;
}

function line(parent, mat, points, radius) {
  const path = new T.CatmullRomCurve3(points.map(p => v(...p)));
  return put(parent, new T.TubeGeometry(path, 28, radius, 8), mat, 0, 0, 0);
}

function group(parent, x, y, z, id) {
  const item = new T.Group();
  item.position.set(x, y, z);
  if (id) item.userData.object = id;
  parent.add(item);
  return item;
}

function printPage({ type, title, lines, number }) {
  const map = texture(768, 960, (ctx, w, h) => {
    const rand = random(11 + number);
    const tone = ctx.createRadialGradient(w / 2, h / 2, 100, w / 2, h / 2, 635);
    tone.addColorStop(0, '#f0dcad');
    tone.addColorStop(.72, '#e5ca94');
    tone.addColorStop(1, '#ae7f4d');
    ctx.fillStyle = tone;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 13000; i++) {
      ctx.fillStyle = i % 3 ? '#784f2924' : '#fff7d55c';
      ctx.fillRect(rand() * w, rand() * h, rand() * 3, rand() * 2);
    }
    ctx.fillStyle = '#713324';
    ctx.font = '24px "SimSun", serif';
    ctx.fillText(type, 73, 98);
    ctx.strokeStyle = '#984e37aa';
    ctx.lineWidth = 2;
    ctx.strokeRect(56, 45, 656, 862);
    ctx.beginPath(); ctx.moveTo(73, 124); ctx.lineTo(694, 124); ctx.stroke();
    ctx.font = 'bold 55px "SimSun", serif';
    ctx.fillStyle = '#322218';
    ctx.fillText(title, 73, 225);
    ctx.font = '33px "SimSun", serif';
    lines.forEach((text, i) => {
      const y = 332 + i * 73;
      ctx.strokeStyle = '#87572c3a';
      ctx.beginPath(); ctx.moveTo(73, y + 16); ctx.lineTo(694, y + 16); ctx.stroke();
      ctx.fillText(text, 78, y);
    });
    ctx.fillStyle = '#824531';
    ctx.font = '23px "SimSun", serif';
    ctx.fillText('情境创作 · 非原始史料', 73, 856);
    ctx.textAlign = 'right';
    ctx.fillText(String(number).padStart(2, '0'), 692, 856);
  });
  return new T.MeshStandardMaterial({ map, roughness: 1, side: T.DoubleSide });
}

function sheet(parent, mat, x, y, z, w, h) {
  const item = put(parent, new T.PlaneGeometry(w, h), mat, x, y, z);
  item.rotation.x = -Math.PI / 2;
  return item;
}

function furniture(room, mats) {
  const { wood, trim, shadowWood, felt, iron } = mats;
  box(room, wood, 0, 1.85, 0, 4.16, .12, 1.92);
  box(room, felt, 0, 1.91, 0, 3.88, .018, 1.67);
  for (const z of [-.95, .95]) {
    box(room, trim, 0, 1.86, z, 4.21, .055, .062);
    box(room, shadowWood, 0, 1.79, z * .99, 4.10, .035, .042);
  }
  box(room, wood, -.67, 1.61, .85, 2.61, .34, .14);
  box(room, shadowWood, -.67, 1.65, .931, 2.48, .239, .028);
  box(room, wood, -.67, 1.65, .95, 2.43, .206, .036);
  sphere(room, iron, -.63, 1.65, .998, .037, .037, .046);
  for (const z of [-.79, .79]) box(room, wood, -1.92, .88, z, .145, 1.72, .16);
  box(room, trim, -1.92, .37, 0, .10, .115, 1.60);
  for (const z of [-.58, -.45, -.32]) box(room, wood, -1.92, .99, z, .068, 1.18, .061);
  box(room, shadowWood, .03, 1.65, -.85, 3.95, .29, .12);
  box(room, shadowWood, 1.39, .90, .01, 1.24, 1.74, 1.73);
  box(room, wood, 2.02, .93, .01, .078, 1.73, 1.77);
  box(room, trim, 2.064, .91, .02, .017, 1.43, 1.43);
  box(room, wood, 2.08, .91, .02, .012, 1.34, 1.34);
  box(room, wood, 1.39, 1.62, .90, 1.23, .29, .09);
  box(room, shadowWood, 1.39, 1.65, .957, 1.09, .24, .025);
  box(room, wood, 1.39, 1.65, .975, 1.05, .213, .045);
  sphere(room, iron, 1.39, 1.65, 1.017, .037, .037, .048);
  box(room, wood, 1.39, .79, .92, 1.17, 1.29, .11);
  box(room, shadowWood, 1.39, .79, .984, 1.01, 1.15, .035);
  box(room, wood, 1.39, .78, 1.007, .96, 1.09, .03);
  box(room, shadowWood, 1.39, .64, 1.025, .70, .69, .016);
  box(room, wood, 1.39, .64, 1.036, .66, .64, .019);
  for (let i = 0; i < 3; i++) box(room, felt, 1.14 + i * .25, 1.17, 1.026, .20, .15, .025);
  for (const y of [.44, 1.17]) box(room, iron, 1.91, y, 1.027, .021, .093, .022);
  sphere(room, iron, .99, .84, 1.07, .043, .043, .05);
  box(room, wood, 1.39, .15, .017, 1.34, .20, 1.84);
  for (const x of [.81, 1.96]) for (const z of [-.77, .82]) box(room, trim, x, .061, z, .22, .122, .22);

  const chair = group(room, -.63, 0, 1.22);
  chair.rotation.y = -.10;
  box(chair, wood, 0, .88, 0, 1.02, .116, .94);
  box(chair, trim, 0, .79, 0, .94, .12, .86);
  for (const x of [-.415, .415]) {
    box(chair, wood, x, .42, -.37, .097, .84, .098).rotation.z = -Math.sign(x) * .048;
    box(chair, wood, x, .76, .39, .093, 1.52, .093).rotation.z = -Math.sign(x) * .035;
  }
  box(chair, wood, 0, 1.43, .389, 1.04, .224, .105);
  box(chair, trim, 0, 1.547, .39, 1.06, .036, .11);
}

function makeLamp(scene, room, mats) {
  const lamp = group(room, -1.27, surface, -.43, 'lamp');
  const brass = mats.brass;
  lathe(lamp, brass, 0, 0, 0, [[0, 0], [.175, 0], [.187,.025], [.176,.058], [.154,.077], [.147,.123], [.109,.155], [.075,.17], [.079,.218], [.103,.239], [.097,.27], [0,.275]]);
  for (const y of [.036, .088, .245]) lathe(lamp, mats.gold, 0, 0, 0, [[.159 - y * .26,y], [.173 - y * .26,y + .006], [.159 - y * .26,y + .011]]);
  sphere(lamp, mats.iron, .124, .176, 0, .037, .022, .025);
  const glass = new T.MeshPhysicalMaterial({ color:'#f4dcc2', emissive:'#d9b696', emissiveIntensity:.24, transparent:true, opacity:.32, roughness:.19, metalness:.08, side:T.DoubleSide, depthWrite:false });
  const chimney = lathe(lamp, glass, 0, 0, 0, [[.075,.244],[.104,.284],[.123,.333],[.121,.39],[.105,.44],[.067,.501],[.058,.604],[.064,.626]]);
  chimney.castShadow = false;
  lathe(lamp, new T.MeshStandardMaterial({ color:'#e7c9a6', transparent:true, opacity:.5 }), 0, 0, 0, [[.061,.614],[.072,.619],[.073,.63],[.061,.631]]);
  const flame = sphere(lamp, new T.MeshBasicMaterial({ color: '#ffb244' }), 0, .331, 0, .026, .061, .024);
  const core = sphere(lamp, new T.MeshBasicMaterial({ color: '#fff1b2' }), 0, .314, .016, .017, .037, .015);
  flame.castShadow = core.castShadow = false;
  const light = new T.PointLight('#ffad52', 0, 3.9, 2);
  light.position.copy(lamp.position).add(v(0, .37, .035));
  scene.add(light);
  return { flame, core, light };
}

function makeRadio(room, mats) {
  const radio = group(room, 1.17, surface, -.30, 'radio');
  const { iron, brass, gold, trim } = mats;
  const caseMat = material('#51503a', .81, .25);
  const inset = material('#333326', .8, .26);
  box(radio, caseMat, 0, .247, 0, .99, .47, .62);
  box(radio, inset, 0, .243, .312, .956, .437, .022);
  box(radio, caseMat, 0, .243, .33, .912, .402, .025);
  for (const x of [-.43,.43]) for (const y of [.062,.423]) sphere(radio, brass, x, y, .348, .018, .018, .008);
  for (let col = 0; col < 6; col++) for (let row = 0; row < 3; row++) box(radio, iron, .498, .177 + row * .061, -.19 + col * .064, .006, .015, .039);
  box(radio, iron, -.256, .303, .359, .305, .185, .028);
  const gauge = texture(360, 210, (ctx, w, h) => {
    ctx.fillStyle = '#dac08c'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#362819'; ctx.fillStyle = '#362819';
    ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(180, 180, 112, Math.PI * 1.12, Math.PI * 1.88); ctx.stroke();
    for (let i = 0; i < 11; i++) {
      const angle = Math.PI * (1.12 + .076 * i);
      ctx.beginPath(); ctx.moveTo(180 + 92 * Math.cos(angle), 180 + 92 * Math.sin(angle));
      ctx.lineTo(180 + 110 * Math.cos(angle), 180 + 110 * Math.sin(angle)); ctx.stroke();
    }
    ctx.font = '22px serif'; ctx.fillText('mA', 162, 138);
    ctx.strokeStyle = '#8b2921'; ctx.beginPath(); ctx.moveTo(180, 180); ctx.lineTo(229, 81); ctx.stroke();
  });
  put(radio, new T.PlaneGeometry(.258,.135), new T.MeshStandardMaterial({ map:gauge, emissive:'#cb8e4d', emissiveIntensity:.15 }), -.256, .303, .375);
  const dial = (mat, x, y, z, r, d) => {
    const item = put(radio, new T.CylinderGeometry(r,r,d,36), mat,x,y,z);
    item.rotation.x = Math.PI / 2;
    return item;
  };
  dial(trim, .204,.252,.363,.161,.05);
  for (let i = 0; i < 22; i++) {
    const a = i * Math.PI * 2 / 22;
    box(radio, gold, .204 + .135 * Math.cos(a), .252 + .135 * Math.sin(a), .39, .016,.004,.003).rotation.z = a;
  }
  dial(brass,.204,.252,.408,.071,.058);
  dial(iron,-.294,.127,.377,.045,.058);
  dial(iron,-.126,.127,.377,.031,.045);
  const led = sphere(radio, new T.MeshStandardMaterial({color:'#933f24',emissive:'#e35722',emissiveIntensity:.25}), .427,.127,.351,.017);
  line(radio, brass, [[.388,.474,-.22],[.388,.67,-.22],[.388,.88,-.22]], .012);
  line(radio, brass, [[.155,.879,-.22],[.388,.879,-.22],[.625,.879,-.22]], .009);
  sphere(radio, brass, .388,.879,-.22,.029);
  line(radio, iron, [[-.31,.518,.09],[-.27,.6,-.08],[-.07,.63,-.15],[.13,.6,-.11],[.23,.525,.03]], .036);
  sphere(radio, iron, -.30,.529,.09,.082,.069,.066);
  sphere(radio, iron, .23,.526,.038,.078,.064,.06);
  const key = group(radio, .40, .014, .50);
  box(key, trim, 0,.022,0,.43,.045,.21);
  for (const x of [-.14, .09]) box(key, brass, x,.055,0,.051,.074,.065);
  const lever = box(key, gold, 0,.099,0,.30,.021,.029);
  sphere(key, iron, .157,.107,0,.046,.018,.035);
  line(radio, iron, [[.34,.043,.55],[.63,.03,.44],[.67,.026,.15],[.49,.047,-.14]], .012);
  return { lever, led };
}

export async function createScene(canvas, papers, diaryPages) {
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.09;
  const scene = new T.Scene();
  scene.background = new T.Color('#493627');
  const camera = new T.PerspectiveCamera(38, 1, .05, 45);
  const room = group(scene, 0, 0, 0);
  const woodGrain = grain(true);
  const plaster = grain(false);
  const mats = {
    wood: pigment('#b27a50', woodGrain, woodGrain, .037),
    trim: pigment('#885834', woodGrain, woodGrain, .027),
    shadowWood: pigment('#6f3c27', woodGrain, woodGrain, .028),
    felt: pigment('#676845', plaster, plaster, .018),
    iron: material('#27241b', .6, .44),
    brass: material('#907047', .52, .69),
    gold: material('#ae8a4e', .45, .64)
  };
  const floor = plaster.clone();
  floor.wrapS = floor.wrapT = T.RepeatWrapping; floor.repeat.set(11, 10); floor.needsUpdate = true;
  const wall = plaster.clone();
  wall.wrapS = wall.wrapT = T.RepeatWrapping; wall.repeat.set(11, 4); wall.needsUpdate = true;
  sheet(room, pigment('#a2876d', floor, floor, .10), 0, 0, 0, 28, 24);
  put(room, new T.PlaneGeometry(30, 11), pigment('#d2bba2', wall, wall, .15), 0, 5.5, -1.03);
  box(room, material('#6f5843'), 0, .036, -1.025, 27, .072, .018);
  furniture(room, mats);

  const ambient = new T.HemisphereLight('#ffe9d0', '#554334', 1.56);
  const key = new T.DirectionalLight('#ffe4c2', 2.35);
  key.position.set(-3.4, 6, 4.6);
  key.castShadow = true;
  key.shadow.mapSize.set(1536, 1536);
  Object.assign(key.shadow.camera, { left:-5, right:5, top:5, bottom:-5, near:.1, far:19 });
  key.shadow.normalBias = .022;
  key.shadow.bias = -.00012;
  scene.add(ambient, key);

  const paper = group(room, -1.27, surface + .017, .43, 'paper');
  paper.rotation.y = -.16;
  const paperMats = papers.map(printPage);
  const blank = material('#cbb181');
  for (let i = 0; i < 3; i++) box(paper, blank, -.013 * i, .0035 * i, .014 * i, .59, .004, .76).rotation.y = i * .027;
  const page = sheet(paper, paperMats[0], 0, .016, 0, .59, .76);
  const arriving = sheet(paper, paperMats[1], 0, .011, 0, .59, .76);
  arriving.visible = false;

  const diary = group(room, -.14, surface + .011, .24, 'diary');
  diary.rotation.y = .11;
  const leather = pigment('#583829', woodGrain, woodGrain, .06);
  const edge = material('#b08b5b');
  box(diary, leather, 0, .012, 0, .63, .028, .76);
  box(diary, edge, .012, .054, 0, .59, .065, .709);
  for (let i = 0; i < 7; i++) box(diary, material(i % 2 ? '#b18b58' : '#caac79'), .311, .027 + .008 * i, 0, .003, .003, .699);
  const hinge = group(diary, -.312, .093, 0);
  box(hinge, leather, .307, .018, 0, .634, .034, .766);
  for (const z of [-.347,.347]) box(hinge, mats.trim, .307,.038,z,.583,.003,.008);
  for (const x of [.021,.593]) box(hinge, mats.trim, x,.038,0,.008,.003,.69);
  const left = sheet(hinge, printPage(diaryPages[0]), .307, -.003, 0, .599, .71);
  left.rotation.x = Math.PI / 2;
  left.rotation.z = Math.PI;
  sheet(diary, printPage(diaryPages[1]), .005,.087,0,.591,.707);
  line(diary, leather, [[-.32,.026,-.36],[-.329,.044,0],[-.32,.074,.36]], .027);

  const lamp = makeLamp(scene, room, mats);
  const radio = makeRadio(room, mats);
  const map = group(scene, .04, 3.12, -.995, 'map');
  const poster = await new T.TextureLoader().loadAsync('./assets/route-map.webp');
  poster.colorSpace = T.SRGBColorSpace;
  poster.anisotropy = 8;
  box(map, material('#4d251c'), 0, 0, 0, 2.22, 1.494, .035);
  const posterMat = new T.MeshStandardMaterial({ map:poster, emissive:'#ffffff', emissiveMap:poster, emissiveIntensity:.14, roughness:1 });
  put(map, new T.PlaneGeometry(2.22, 1.494), posterMat, 0, 0, .0185);

  return { renderer, scene, camera, ambient, key, paperMats, page, arriving, hinge, lamp, radio, map, posterMat,
    anchors: {paper:v(-1.35, surface+.095, .62), diary:v(-.22,surface+.17,.42), lamp:v(-1.46,surface+.43,-.42), radio:v(1.22,surface+.42,.12), map:v(1.13,3.58,-.96)} };
}
