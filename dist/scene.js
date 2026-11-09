import * as T from './vendor/three.module.js';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';
import { EffectComposer } from './vendor/postprocessing/EffectComposer.js';
import { OutlinePass } from './vendor/postprocessing/OutlinePass.js';
import { OutputPass } from './vendor/postprocessing/OutputPass.js';
import { RenderPass } from './vendor/postprocessing/RenderPass.js';

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

function makeSpine(diary, leather, trim) {
  const section = new T.Shape();
  section.moveTo(-.282, .102);
  section.bezierCurveTo(-.395, .103, -.395, .006, -.282, .005);
  section.lineTo(-.282, .023);
  section.bezierCurveTo(-.366, .024, -.366, .084, -.282, .084);
  section.closePath();

  const depth = .748;
  const shell = new T.ExtrudeGeometry(section, {
    depth, curveSegments: 16, bevelThickness: .005, bevelSize: .004, bevelSegments: 2
  });
  put(diary, shell, leather, 0, 0, -depth / 2);
  const band = new T.ExtrudeGeometry(section, {
    depth: .017, curveSegments: 12, bevelThickness: .003, bevelSize: .003, bevelSegments: 2
  });
  for (const z of [-.257, .24]) put(diary, band, trim, -.006, 0, z);
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
  return { model:lamp, flame, core, light };
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
  return { model:radio, lever, led };
}

function windowWall(room, plaster, timber) {
  const x = -3.24, thickness = .48;
  const back = -1.04, front = 10.5, height = 11;
  const z = .68, sill = 1.53, opening = 2.16;
  const start = z - opening / 2, end = z + opening / 2, lintel = sill + opening;
  const mud = pigment('#c4a98c', plaster, plaster, .10);
  const stone = pigment('#a99174', plaster, plaster, .07);
  const panel = (y, depthCenter, h, d) => put(room, new T.BoxGeometry(thickness, h, d), mud, x, y, depthCenter);
  panel(height / 2, (back + start) / 2, height, start - back);
  panel(height / 2, (end + front) / 2, height, front - end);
  panel(sill / 2, z, sill, opening);
  panel((height + lintel) / 2, z, height - lintel, opening);

  box(room, stone, x + .03, sill + .016, z, .65, .094, opening + .13);
  const frameX = x - .075;
  for (const side of [-1, 1]) {
    box(room, timber, frameX, sill + opening / 2, z + side * (opening / 2 - .038), .10, opening, .076);
    box(room, timber, frameX, sill + opening / 2 + side * (opening / 2 - .039), z, .10, .078, opening);
  }
}

function makeWalker(parent, offset, carryingHoe) {
  const figure = group(parent, 0, 0, 0);
  const torso = group(figure, 0, 0, 0);
  const flat = color => new T.MeshBasicMaterial({ color });
  const skin = flat('#b68466');
  const hair = flat('#2c2925');
  const jacket = flat(carryingHoe ? '#687b8b' : '#596b79');
  const seams = flat('#455765');
  const trousers = flat('#667681');
  const gaiters = flat('#4f5b5e');
  const shoes = flat('#332e27');
  const belt = flat('#604636');
  const buckle = flat('#b29565');
  const red = flat('#a4312e');
  const wood = flat('#846644');
  const metal = flat('#8c918f');
  const clothBag = flat('#9a876a');
  const segment = (holder, mat, x, y, z, r1, r2, height) =>
    put(holder, new T.CylinderGeometry(r1, r2, height, 12), mat, x, y, z);

  segment(torso, jacket, 0, 1.082, 0, .172, .125, .35).scale.z = .72;
  segment(torso, jacket, 0, .905, 0, .125, .151, .15).scale.z = .79;
  segment(torso, belt, 0, .986, 0, .133, .135, .043).scale.z = .79;
  box(torso, buckle, 0, .984, .109, .052, .034, .015);
  for (const side of [-1, 1]) {
    box(torso, seams, side * .071, 1.132, .112, .072, .080, .018);
    box(torso, jacket, side * .071, 1.165, .125, .077, .025, .012);
    box(torso, red, side * .053, 1.258, .098, .050, .042, .029).rotation.z = side * .23;
  }
  segment(torso, skin, 0, 1.307, 0, .052, .059, .095);
  sphere(torso, skin, 0, 1.425, .006, .088, .115, .086);
  sphere(torso, skin, 0, 1.411, .083, .021, .028, .022);
  for (const x of [-.084,.084]) sphere(torso, skin, x, 1.420, -.007, .015, .026, .020);
  sphere(torso, hair, 0, 1.48, -.025, .091, .075, .075);
  if (carryingHoe) {
    sphere(torso, hair, 0, 1.394, -.084, .057, .089, .045);
    sphere(torso, hair, 0, 1.34, -.103, .041, .050, .039);
    segment(torso, wood, -.165, 1.305, -.102, .016, .016, 1.11).rotation.x = Math.PI / 2;
    box(torso, metal, -.165, 1.249, -.635, .176, .137, .023).rotation.x = -.16;
  } else {
    segment(torso, jacket, 0, 1.532, -.012, .079, .100, .071).scale.z = .94;
    box(torso, seams, 0, 1.501, .064, .168, .021, .098);
    box(torso, red, 0, 1.533, .074, .026, .029, .012);
    box(torso, clothBag, .122, .934, -.073, .16, .21, .145);
    box(torso, belt, .029, 1.115, .123, .028, .286, .011).rotation.z = .52;
  }

  const up = v(0, 1, 0);
  const axis = v(0, 0, 0);
  function poseSegment(mesh, low, high, length) {
    mesh.position.copy(low).lerp(high, .5);
    axis.subVectors(high, low);
    mesh.scale.y = axis.length() / length;
    mesh.quaternion.setFromUnitVectors(up, axis.normalize());
  }

  const upper = .38, lower = .38;
  const limbs = [-1, 1].map(side => {
    const thigh = segment(figure, trousers, 0, 0, 0, .071, .054, upper);
    const shin = segment(figure, gaiters, 0, 0, 0, .052, .035, lower);
    const shoe = box(figure, shoes, 0, 0, 0, .091, .066, .191);
    const arm = group(torso, side * .155, 1.236, -.006);
    sphere(arm, jacket, 0, 0, 0, .065);
    segment(arm, jacket, side * .017, -.123, 0, .058, .042, .25).rotation.z = side * .13;
    const forearm = group(arm, side * .031, -.235, 0);
    segment(forearm, jacket, 0, -.112, 0, .046, .032, .23);
    sphere(forearm, skin, 0, -.246, .002, .036, .048, .035);
    if (carryingHoe && side === -1) {
      arm.rotation.x = -1.03;
      forearm.rotation.x = -1.45;
    }
    return { side, thigh, shin, shoe, arm, forearm, hip:v(side*.078,0,0), knee:v(side*.078,0,0), ankle:v(side*.078,0,0) };
  });
  const shadow = new T.Mesh(new T.CircleGeometry(.5, 24),
    new T.MeshBasicMaterial({color:'#614b36',transparent:true,opacity:.25,depthWrite:false}));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = .007;
  shadow.scale.set(.58,.41,1);
  figure.add(shadow);
  figure.traverse(mesh => { if (mesh.isMesh) mesh.castShadow = false; });
  const colors = [skin,hair,jacket,seams,trousers,gaiters,shoes,belt,buckle,red,wood,metal,clothBag].map(mat => [mat, mat.color.clone()]);
  const speed = .45, cycle = 1.17, stance = .62;
  const stride = speed * cycle;
  const reach = stride * stance / 2;

  return (seconds, visibility, shade, still) => {
    const travel = (seconds * speed + offset) % 6.2 - 3.1;
    const heading = carryingHoe ? 1 : -1;
    const gait = (seconds / cycle + offset * .26) % 1;
    const bob = still ? 0 : .013 * Math.sin(gait * Math.PI * 4);
    figure.visible = visibility;
    figure.position.set(travel * heading, .713, carryingHoe ? 3.7 : 4.35);
    figure.rotation.y = heading * Math.PI / 2;
    torso.position.y = bob;
    for (const {side,thigh,shin,shoe,arm,forearm,hip,knee,ankle} of limbs) {
      const step = (gait + (side === 1 ? .5 : 0)) % 1;
      const swing = Math.max(0, (step - stance) / (1 - stance));
      const forward = step <= stance ? reach - stride * step : -reach * Math.cos(Math.PI * swing);
      const lift = .107 * Math.sin(Math.PI * swing);
      hip.setY(.822 + bob);
      ankle.set(hip.x, .087 + (still ? 0 : lift), still ? 0 : forward);
      const dy = ankle.y - hip.y, dz = ankle.z - hip.z;
      const distance = Math.hypot(dy, dz);
      const along = (upper * upper - lower * lower + distance * distance) / (2 * distance);
      const bend = Math.sqrt(Math.max(0, upper * upper - along * along));
      knee.set(hip.x, hip.y + (dy * along + dz * bend) / distance, (dz * along - dy * bend) / distance);
      poseSegment(thigh, knee, hip, upper);
      poseSegment(shin, ankle, knee, lower);
      shoe.position.set(ankle.x, ankle.y - .052, ankle.z + .041);
      shoe.rotation.x = still ? 0 : -.28 * Math.sin(Math.PI * 2 * swing);
      if (!carryingHoe || side === 1) {
        arm.rotation.x = still ? .02 : .26 * Math.cos(step * Math.PI * 2);
        forearm.rotation.x = -.24;
      }
    }
    for (const [mat, color] of colors) mat.color.copy(color).multiply(shade);
  };
}

function makeGreenHills(landscape, materials) {
  const towerX = -.16, towerDepth = 13.25;
  const base = .69, columns = 120, rows = 12;
  const crest = (x, height, seed) =>
    height + .46 * Math.sin(x * .53 + seed) + .22 * Math.sin(x * 1.26 + seed) + .10 * Math.sin(x * 2.77);
  const slopePosition = (x, fraction, depth, height, seed) =>
    v(x, T.MathUtils.lerp(base, crest(x, height, seed), fraction), depth - (1 - fraction) ** 1.5 * 3.6);
  const hills = [
    [21.5, 3.32, '#819995', '#4c736b', 1.7],
    [17.4, 2.70, '#788465', '#476253', 2.8],
    [13.50, 2.28, '#b39764', '#426047', 2.23],
    [10.10, 1.49, '#a68b59', '#597048', 3.3]
  ];
  const rand = random(1937);
  const tint = new T.Color();
  for (const [depth, height, bottom, top, seed] of hills) {
    const positions = [], colors = [], indices = [];
    const shade = new T.Color(bottom), canopy = new T.Color(top);
    for (let row = 0; row <= rows; row++) {
      const fraction = row / rows;
      for (let column = 0; column <= columns; column++) {
        const x = column / columns * 35 - 17.5;
        const point = slopePosition(x, fraction, depth, height, seed);
        positions.push(point.x, point.y, point.z);
        const growth = T.MathUtils.clamp(.15 + .81 * fraction + .13 * Math.sin(x * 1.4 + row * .44), 0, 1);
        tint.copy(shade).lerp(canopy, growth).multiplyScalar(.83 + rand() * .29);
        colors.push(tint.r, tint.g, tint.b);
        if (column < columns && row < rows) {
          const i = row * (columns + 1) + column;
          indices.push(i, i + 1, i + columns + 1, i + 1, i + columns + 2, i + columns + 1);
        }
      }
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    const terrain = new T.MeshBasicMaterial({vertexColors:true, side:T.DoubleSide});
    landscape.add(new T.Mesh(geometry, terrain));
    materials.push(terrain);
  }

  const leafMaterial = new T.MeshBasicMaterial({color:'#ffffff'});
  const shrubs = new T.InstancedMesh(new T.IcosahedronGeometry(1, 0), leafMaterial, 275);
  const dummy = new T.Object3D();
  for (let i = 0; i < shrubs.count; i++) {
    const [depth, height,, canopy, seed] = i < 180 ? hills[2] : hills[3];
    const x = (rand() - .5) * 16;
    const onSlope = .33 + rand() * .66;
    dummy.position.copy(slopePosition(x, onSlope, depth, height, seed));
    const size = .065 + rand() * .13;
    dummy.scale.set(size * 1.48, size * .68, size);
    dummy.rotation.y = rand() * Math.PI;
    dummy.updateMatrix();
    shrubs.setMatrixAt(i, dummy.matrix);
    shrubs.setColorAt(i, tint.set(canopy).multiplyScalar(.58 + rand() * .67));
  }
  landscape.add(shrubs);
  materials.push(leafMaterial);

  const brick = new T.MeshBasicMaterial({color:'#a29478'});
  const eaves = new T.MeshBasicMaterial({color:'#665a49'});
  const openings = new T.MeshBasicMaterial({color:'#393a30'});
  const [,towerHillHeight,,,towerHillSeed] = hills[2];
  const tower = group(landscape, towerX, crest(towerX, towerHillHeight, towerHillSeed) - .14, towerDepth);
  tower.scale.y = .60;
  const towerRing = (mat, y, top, bottom, height) =>
    put(tower, new T.CylinderGeometry(top, bottom, height, 8, 1), mat, 0, y, 0);
  towerRing(eaves, .06, .35, .40, .12);
  for (let tier = 0; tier < 7; tier++) {
    const width = .29 - tier * .021;
    const y = .13 + tier * .237;
    towerRing(brick, y + .097, width * .88, width, .195);
    towerRing(eaves, y + .202, width * 1.12, width * 1.21, .037);
    towerRing(brick, y + .229, width * .89, width * 1.12, .024);
    box(tower, openings, 0, y + .105, -width * .84, .063, .085, .020);
  }
  towerRing(eaves, 1.91, .037, .202, .22);
  towerRing(brick, 2.035, .012, .038, .06);
  tower.traverse(mesh => { if (mesh.isMesh) mesh.castShadow = false; });
  materials.push(brick, eaves, openings);
}

function makeCaveFront(landscape, plaster, materials) {
  const stone = texture(640, 448, (ctx, w, h) => {
    const rand = random(270);
    ctx.fillStyle = '#8f7554';
    ctx.fillRect(0, 0, w, h);
    for (let row = 0; row < 9; row++) {
      const y = row * 52;
      for (let x = row % 2 ? -55 : 0; x < w;) {
        const width = 68 + rand() * 53;
        ctx.fillStyle = ['#c4a57a','#c9ae86','#b99c74','#d1b58d'][Math.floor(rand() * 4)];
        ctx.fillRect(x + 1, y + 1, width - 2, 50);
        x += width;
      }
    }
    for (let i = 0; i < 12500; i++) {
      ctx.fillStyle = i % 2 ? '#634a321c' : '#fff3d321';
      ctx.fillRect(rand() * w, rand() * h, rand() * 2, rand() * 3);
    }
  });
  const facade = new T.MeshBasicMaterial({color:'#e6caa2',map:stone,side:T.DoubleSide});
  const trim = new T.MeshBasicMaterial({color:'#ad8c62',map:plaster,side:T.DoubleSide});
  const band = new T.MeshBasicMaterial({color:'#d1ad79'});
  const recess = new T.MeshBasicMaterial({color:'#412f25',side:T.DoubleSide});
  const slats = new T.MeshBasicMaterial({color:'#775139'});
  const center = .10, depth = 7.05, ground = .712;
  const arches = [-1.38, 0, 1.38];
  const facadeWidth = 5.22, facadeHeight = 1.62;
  const wall = new T.Shape();
  wall.moveTo(-facadeWidth / 2, 0);
  wall.lineTo(facadeWidth / 2, 0);
  wall.lineTo(facadeWidth / 2, facadeHeight);
  wall.lineTo(-facadeWidth / 2, facadeHeight);
  wall.closePath();

  function traceArch(path, x, halfWidth, bottom) {
    path.moveTo(x - halfWidth, bottom);
    path.lineTo(x - halfWidth, .71);
    path.absarc(x, .71, halfWidth, Math.PI, 0, true);
    path.lineTo(x + halfWidth, bottom);
    path.closePath();
    return path;
  }
  const archesGroup = group(landscape, center, ground, depth);
  const stoneUV = geometry => {
    const positions = geometry.getAttribute('position');
    const uv = geometry.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, positions.getX(i) / facadeWidth + .5, positions.getY(i) / facadeHeight);
    return geometry;
  };
  for (const x of arches) {
    wall.holes.push(traceArch(new T.Path(), x, .46, .025));
    const surround = traceArch(new T.Shape(), x, .525, .015);
    surround.holes.push(traceArch(new T.Path(), x, .46, .025));
    put(archesGroup, new T.ShapeGeometry(surround), band, 0, 0, -.016);
    const inner = traceArch(new T.Shape(), x, .46, .026);
    put(archesGroup, new T.ShapeGeometry(inner), recess, 0, 0, .28);
    for (const bar of [-.29,-.145,0,.145,.29]) {
      box(archesGroup, slats, x + bar, .78, .261, .020, .28 + .39 * (1 - Math.abs(bar) / .38), .021);
    }
    box(archesGroup, slats, x, .71, .247, .86, .039, .024);
    box(archesGroup, trim, x, .025, -.013, .94, .051, .35);
  }
  const masonry = new T.ExtrudeGeometry(wall, {depth:.25,bevelEnabled:false,curveSegments:18,material:0,extrudeMaterial:1});
  put(archesGroup, stoneUV(masonry), [facade,trim], 0, 0, 0);
  box(archesGroup, trim, 0, facadeHeight + .02, .12, facadeWidth + .20, .075, .42);
  box(archesGroup, band, 0, facadeHeight + .084, .12, facadeWidth + .32, .065, .49);
  for (let x = -2.32; x <= 2.34; x += .19) box(archesGroup, trim, x, 1.465, -.014, .070, .085, .030);
  archesGroup.traverse(mesh => { if (mesh.isMesh) mesh.castShadow = false; });
  materials.push(facade, trim, band, recess, slats);
}

function windowView(scene, plaster) {
  const landscape = group(scene, -3.55, 0, .67);
  landscape.rotation.y = -2.55;
  const skyMaterial = new T.ShaderMaterial({
    side:T.DoubleSide,
    uniforms:{ phase:{value:0}, daylight:{value:1}, dusk:{value:0} },
    vertexShader:`varying vec2 skyUv;
      void main(){ skyUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader:`varying vec2 skyUv;
      uniform float phase, daylight, dusk;
      void main(){
        vec2 p = skyUv;
        vec3 horizon = mix(vec3(.045,.067,.127), vec3(.47,.68,.85), daylight);
        vec3 zenith = mix(vec3(.012,.023,.066), vec3(.11,.33,.55), daylight);
        vec3 color = mix(horizon, zenith, smoothstep(.17,.58,p.y));
        color = mix(color, vec3(.87,.34,.15), dusk * (1.0-smoothstep(.30,.58,p.y)) * .65);
        vec2 cell = floor(p * vec2(260.,105.));
        float star = step(.987, fract(sin(dot(cell,vec2(12.9898,78.233))) * 43758.5453));
        color += star * (1.0 - daylight) * smoothstep(.26,.43,p.y)
          * (1.0 - smoothstep(.08,.30,length(fract(p * vec2(260.,105.))-.5))) * .42;
        float angle = phase*6.283;
        vec2 q = (p-vec2(.54 + .13*sin(angle), .28 + .16*cos(angle))) * vec2(2.5,1.0);
        color += vec3(1.,.69,.37) * (1.0-smoothstep(.008,.011,length(q))) * daylight;
        float moon = 1.0-smoothstep(.006,.009,length((p-vec2(.53,.37))*vec2(2.5,1.0)));
        color += vec3(.43,.55,.68) * moon * (1.0-daylight);
        float cloud = sin(p.x*48.+sin(angle)*.9) + .6*sin(p.x*89.-sin(angle)*1.2);
        color += vec3(.21,.20,.16) * smoothstep(0.15,1.0,cloud)
          * (1.0-smoothstep(0.0,.015,abs(p.y-.38-.012*sin(p.x*19.)))) * daylight;
        gl_FragColor = vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const sky = new T.Mesh(new T.PlaneGeometry(54, 22), skyMaterial);
  sky.position.set(0, 6, 25);
  landscape.add(sky);

  const terrain = new T.MeshBasicMaterial({ color:'#a99061', map:plaster, side:T.DoubleSide });
  const ground = sheet(landscape, terrain, 0, .70, 12.1, 24, 23.3);
  ground.castShadow = false;
  const path = new T.MeshBasicMaterial({ color:'#c9ad85', map:plaster, side:T.DoubleSide });
  const trail = sheet(landscape, path, 0, .712, 3.95, 15, 1.75);
  trail.castShadow = false;

  const outdoorMaterials = [terrain, path];
  makeGreenHills(landscape, outdoorMaterials);
  makeCaveFront(landscape, plaster, outdoorMaterials);
  const walkers = [makeWalker(landscape, 2.79, true), makeWalker(landscape, 1.7, false)];
  const outsideWall = new T.Plane(v(-1, 0, 0), -3.48);
  landscape.traverse(mesh => {
    if (!mesh.isMesh || mesh === sky) return;
    for (const mat of [mesh.material].flat()) mat.clippingPlanes = [outsideWall];
  });
  const surfaces = outdoorMaterials.map(mat => [mat, mat.color.clone()]);
  const daylightTint = new T.Color('#ffffff');
  const duskTint = new T.Color('#df996d');
  const nightTint = new T.Color('#4b628c');
  const shade = new T.Color();
  return (phase, daylight, dusk, seconds, still) => {
    skyMaterial.uniforms.phase.value = phase;
    skyMaterial.uniforms.daylight.value = daylight;
    skyMaterial.uniforms.dusk.value = dusk;
    shade.copy(nightTint).lerp(daylightTint, daylight).lerp(duskTint, dusk * .55);
    for (const [mat, color] of surfaces) mat.color.copy(color).multiply(shade);
    walkers[0](seconds, daylight > .28, shade, still);
    walkers[1](seconds, daylight > .65 && dusk < .45, shade, still);
  };
}

export async function createScene(canvas, papers, diaryPages) {
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
  renderer.localClippingEnabled = true;
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
  floor.wrapS = floor.wrapT = T.RepeatWrapping; floor.repeat.set(11, 22); floor.needsUpdate = true;
  const wall = plaster.clone();
  wall.wrapS = wall.wrapT = T.RepeatWrapping; wall.repeat.set(11, 4); wall.needsUpdate = true;
  sheet(room, pigment('#a2876d', floor, floor, .10), 6.5, 0, 10.98, 19.96, 24);
  put(room, new T.PlaneGeometry(19.96, 11), pigment('#d2bba2', wall, wall, .15), 6.5, 5.5, -1.03);
  box(room, material('#6f5843'), 6.5, .036, -1.025, 19.96, .072, .018);
  windowWall(room, plaster, mats.shadowWood);
  const updateLandscape = windowView(scene, plaster);
  furniture(room, mats);

  const ambient = new T.HemisphereLight('#ffe9d0', '#554334');
  const fill = new T.DirectionalLight('#ffe2c5');
  fill.position.set(3, 5, 5);
  const sun = new T.DirectionalLight('#fff1d2');
  sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536);
  Object.assign(sun.shadow.camera, { left:-9, right:9, top:8, bottom:-8, near:.1, far:30 });
  sun.shadow.normalBias = .012;
  sun.shadow.bias = -.00012;
  sun.target.position.set(0, 1.22, .5);
  scene.add(ambient, fill, sun, sun.target);

  const daySky = new T.Color('#fff1d2');
  const eveningSky = new T.Color('#ffad71');
  const nightSky = new T.Color('#809dce');
  const cycleStart = performance.now();
  function updateEnvironment(now, focus, still) {
    const seconds = still ? 0 : (now - cycleStart) / 1000;
    const phase = (seconds / 88) % 1;
    const angle = phase * Math.PI * 2;
    const elevation = Math.cos(angle);
    const daylight = T.MathUtils.smoothstep(elevation, -.38, .52);
    const dusk = 1 - T.MathUtils.smoothstep(Math.abs(elevation), .02, .55);
    const roomLight = 1 - .91 * focus;
    ambient.color.copy(nightSky).lerp(daySky, daylight).lerp(eveningSky, dusk * .35);
    ambient.intensity = (.55 + .71 * daylight) * roomLight;
    fill.intensity = (.34 + .57 * daylight) * roomLight;
    sun.color.copy(nightSky).lerp(daySky, daylight).lerp(eveningSky, dusk * .86);
    sun.intensity = (.24 + 2.55 * daylight + .52 * dusk) * (1 - .97 * focus);
    sun.position.set(-8, 3.32 + 1.55 * Math.max(0, elevation), .84 + .75 * Math.sin(angle));
    updateLandscape(phase, daylight, dusk, seconds, still);
  }

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
  makeSpine(diary, leather, mats.trim);

  const lamp = makeLamp(scene, room, mats);
  const radio = makeRadio(room, mats);
  const map = group(scene, .04, 3.12, -.995, 'map');
  const poster = await new T.TextureLoader().loadAsync('./assets/route-map.webp');
  poster.colorSpace = T.SRGBColorSpace;
  poster.anisotropy = 8;
  box(map, material('#4d251c'), 0, 0, 0, 2.22, 1.494, .035);
  const posterMat = new T.MeshStandardMaterial({ map:poster, emissive:'#ffffff', emissiveMap:poster, emissiveIntensity:.14, roughness:1 });
  const mapWidth = 2.22;
  const mapHeight = 1.494;
  put(map, new T.PlaneGeometry(mapWidth, mapHeight), posterMat, 0, 0, .0185);
  const mapBorder = group(map, 0, 0, .021);
  mapBorder.visible = false;
  const border = new T.MeshBasicMaterial({ color:'#ebbd84', toneMapped:false });
  const weight = .012;
  for (const side of [-1, 1]) {
    const vertical = new T.Mesh(new T.PlaneGeometry(weight, mapHeight + 2 * weight), border);
    vertical.position.x = side * (mapWidth + weight) / 2;
    const horizontal = new T.Mesh(new T.PlaneGeometry(mapWidth, weight), border);
    horizontal.position.y = side * (mapHeight + weight) / 2;
    vertical.raycast = horizontal.raycast = () => {};
    mapBorder.add(vertical, horizontal);
  }

  const selectable = { paper, diary, lamp:lamp.model, radio:radio.model };
  const composer = new EffectComposer(renderer);
  const outline = new OutlinePass(new T.Vector2(1, 1), scene, camera);
  outline.visibleEdgeColor.set('#ffd191');
  outline.hiddenEdgeColor.set(0x000000);
  outline.edgeStrength = 3.5;
  outline.edgeGlow = .95;
  outline.edgeThickness = 1;
  const paperOverlay = outline.overlayMaterial;
  const lineOverlay = paperOverlay.clone();
  lineOverlay.blending = T.NormalBlending;
  lineOverlay.uniforms.lineColor = { value:new T.Color('#ebbd84') };
  lineOverlay.uniforms.lineStep = { value:new T.Vector2() };
  lineOverlay.fragmentShader = `
    varying vec2 vUv;
    uniform sampler2D maskTexture;
    uniform vec3 lineColor;
    uniform vec2 lineStep;

    float shapeAt(vec2 uv) {
      return 1.0 - texture2D(maskTexture, uv).r;
    }

    void main() {
      float outside = texture2D(maskTexture, vUv).r;
      float nearby = 0.0;
      for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
          vec2 offset = vec2(float(x), float(y)) * lineStep;
          nearby = max(nearby, shapeAt(vUv + offset));
        }
      }
      float coverage = smoothstep(0.18, 0.8, nearby) * outside;
      gl_FragColor = vec4(lineColor, coverage);
    }
  `;
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(outline);
  composer.addPass(new OutputPass());

  function setSize(width, height) {
    renderer.setSize(width, height, false);
    composer.setSize(width, height);
    lineOverlay.uniforms.lineStep.value.set(1.45 / width, 1.45 / height);
  }

  function render(highlight) {
    mapBorder.visible = highlight === 'map';
    const model = selectable[highlight];
    if (model) {
      const isPaper = highlight === 'paper';
      outline.overlayMaterial = isPaper ? paperOverlay : lineOverlay;
      outline.edgeGlow = isPaper ? .95 : 0;
      outline.selectedObjects = [model];
      composer.render();
    } else {
      renderer.render(scene, camera);
    }
  }

  return { renderer, camera, pickRoots:[room, map], setSize, render, updateEnvironment, paperMats, page, arriving, diary, hinge, lamp, radio, posterMat };
}
