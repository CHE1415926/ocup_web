import * as T from './vendor/three.module.js';
import { createScene } from './scene.js';
import { requestReply } from './telegraph.js';

const papers = [
  { type:'案头文稿 / 一', title:'出发前', number:1, lines:['油灯未熄，地图已折好。','将各小组联络方式抄清，','随队保管，途中随时查阅。'] },
  { type:'案头文稿 / 二', title:'途中联络', number:2, lines:['到达约定地点后，先察地形。','遇有变动，及时简报，','注明方位与联络时间。'] },
  { type:'案头文稿 / 三', title:'行装清点', number:3, lines:['纸笔、备用电池与地图。','散页收好，电台试通。','待回执后，将记录归档。'] }
];
const diary = [
  { type:'随行日记 / 左', title:'灯下', number:1, lines:['天还没有亮。','桌面上摊着昨夜抄的字，','我把纸角压平，合上笔记。'] },
  { type:'随行日记 / 右', title:'启程', number:2, lines:['门外传来集合的声音。','远处山影还在雾里，','我们沿着那条小路出发。'] }
];
const $ = id => document.getElementById(id);
const canvas = $('scene');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const v = (x, y, z) => new T.Vector3(x, y, z);
const clamp = x => Math.min(1, Math.max(0, x));
const ease = x => x * x * (3 - 2 * x);
const byObject = [...document.querySelectorAll('[data-object]')];
const direction = v(0, 1, 0);
const overhead = v(0, 0, -1);
const pointer = new T.Vector2();
const sway = new T.Vector2();
const ray = new T.Raycaster();
const terminal = $('terminal');
const messages = $('messages');
const input = $('telegram');
let room;
let view = 'room';
let flight;
let moving = false;
let overview;
let seated;
let overviewProgress = 0;
let scrollTarget = 0;
let mouseInside = false;
let frameTime;
let lampOn = false;
let lightAmount = 0;
let focusAmount = 0;
let coverAmount = 0;
let pageIndex = 0;
let turning;
let signal;
let signalPhase = '';
let hover = null;

function cameraPose(id) {
  const mobile = canvas.clientWidth <= 760;
  const fit = (width, height) => Math.max(width / room.camera.aspect, height) / (2 * Math.tan(T.MathUtils.degToRad(room.camera.fov / 2)));
  if (id === 'room') {
    const target = v(-.72, 1.96, .2);
    const distance = fit(mobile ? 6.65 : 6.8, mobile ? 5.95 : 5.74);
    const offset = v(mobile ? 3.69 : 2.85, mobile ? .49 : 1.22, 7.68).normalize().multiplyScalar(distance);
    return { target, eye:target.clone().add(offset), up:direction, shift:0 };
  }
  if (id === 'seated') {
    const target = v(mobile ? -.45 : .17, 2.12, .16);
    return { target, eye:target.clone().add(v(0,.52,fit(mobile ? 6.3 : 5.9,4.30))), up:direction, shift:0 };
  }
  if (id === 'paper') {
    const target = v(-1.27, 1.95, .43);
    return { target, eye:target.clone().add(v(0,fit(1.27,1.15),0)), up:overhead, shift:0 };
  }
  if (id === 'diary') {
    const target = room.diary.localToWorld(v(-.31, .10, 0));
    const up = overhead.clone().applyAxisAngle(direction, room.diary.rotation.y);
    return { target, eye:target.clone().add(v(0,fit(1.63,1.13),0)), up, shift:0 };
  }
  if (id === 'map') {
    const target = v(.04, 3.12, -.957);
    return { target, eye:target.clone().add(v(0,0,fit(2.54,2.17))), up:direction, shift:0 };
  }
  const target = v(1.24, 2.32, .12);
  return { target, eye:target.clone().add(v(0,0,fit(1.73,1.63))), up:direction, shift:mobile ? .12 : .035 };
}

function orientation(pose) {
  return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().lookAt(pose.eye, pose.target, pose.up));
}

function overviewPose() {
  return {
    target: overview.target.clone().lerp(seated.target, overviewProgress),
    eye: overview.eye.clone().lerp(seated.eye, overviewProgress),
    up: direction,
    shift: 0
  };
}

function projection(shift) {
  const { clientWidth:width, clientHeight:height } = canvas;
  room.camera.setViewOffset(width, height, 0, shift * height, width, height);
}

function flightTo(id) {
  const camera = room.camera;
  const pose = id === 'room' ? overviewPose() : cameraPose(id);
  const start = camera.position.clone();
  const stage = pose.eye.clone().lerp(start,.38);
  if (id === 'paper' || id === 'diary') stage.y = Math.max(pose.eye.y + .26, stage.y);
  const startShift = (camera.view?.offsetY || 0) / canvas.clientHeight;
  const curve = new T.CatmullRomCurve3([start, stage, pose.eye], false, 'centripetal');
  const startRotation = camera.quaternion.clone();
  const endRotation = orientation(pose);
  flight = { curve, startRotation, endRotation, startShift, shift:pose.shift, from:performance.now(), duration:reduced.matches ? 0 : 980 };
  moving = true;
  sway.set(0, 0);
}

function settle() {
  moving = false;
  flight = null;
  $('pager').hidden = view !== 'paper';
  terminal.hidden = view !== 'radio';
  if (view === 'paper') updatePager();
}

function select(id) {
  if (!room) return;
  if (id === 'lamp') {
    lampOn = !lampOn;
    byObject.find(item => item.dataset.object === 'lamp').setAttribute('aria-pressed', lampOn);
    $('reading').textContent = lampOn ? '油灯已点亮' : '油灯已熄灭';
    return;
  }
  if (view === id) return;
  if (view === 'radio') cancelSignal();
  const previous = view;
  const fromKeyboard = document.activeElement?.matches(':focus-visible');
  view = id;
  document.body.dataset.view = view;
  $('back').hidden = view === 'room';
  $('objects').hidden = view !== 'room';
  $('pager').hidden = terminal.hidden = true;
  $('reading').textContent = '';
  if (fromKeyboard) {
    const nextFocus = view === 'room' ? byObject.find(item => item.dataset.object === previous) : $('back');
    nextFocus?.focus({ preventScroll:true });
  }
  if (view === 'diary') $('reading').textContent = diary.map(p => [p.title, ...p.lines].join('。')).join('。');
  flightTo(id);
}

function updatePager() {
  $('prev').disabled = Boolean(turning) || pageIndex === 0;
  $('next').disabled = Boolean(turning) || pageIndex === papers.length - 1;
  $('page-number').textContent = `${String(pageIndex + 1).padStart(2,'0')} / ${String(papers.length).padStart(2,'0')}`;
  $('reading').textContent = [papers[pageIndex].title, ...papers[pageIndex].lines].join('。');
}

function flip(step) {
  const next = pageIndex + step;
  if (view !== 'paper' || moving || turning || next < 0 || next >= papers.length) return;
  room.arriving.material = room.paperMats[next];
  room.arriving.visible = true;
  turning = { next, step, start:performance.now() };
  updatePager();
}

function animatePaper(now) {
  const { page, arriving } = room;
  if (!turning) {
    const lift = hover === 'paper' && view === 'room' && !reduced.matches ? .021 : 0;
    page.position.y = T.MathUtils.lerp(page.position.y, .016 + lift, .12);
    return;
  }
  const t = reduced.matches ? 1 : clamp((now - turning.start) / 780);
  const spread = t < .43 ? ease(t / .43) : 1 - ease((t - .43) / .57);
  const lift = Math.sin(Math.PI * t);
  page.position.set(-.27 * spread * turning.step, T.MathUtils.lerp(.016,.01,t), .024 * spread);
  page.rotation.z = -.078 * spread * turning.step;
  arriving.position.set(.27 * spread * turning.step, .010 + .075 * lift + .011 * t, -.015 * spread);
  arriving.rotation.z = .14 * spread * turning.step;
  if (t < 1) return;
  pageIndex = turning.next;
  turning = null;
  page.material = room.paperMats[pageIndex];
  page.position.set(0,.016,0);
  page.rotation.z = 0;
  arriving.visible = false;
  updatePager();
}

function trackPointer(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2);
}

function pick() {
  if (!room || moving) return null;
  ray.setFromCamera(pointer, room.camera);
  const hit = ray.intersectObjects(room.pickRoots, true).find(({ object }) => object.visible);
  for (let node = hit?.object; node; node = node.parent) {
    if (node.userData.object) return node.userData.object;
  }
  return null;
}

function moveOverview(delta) {
  const follow = mouseInside && !reduced.matches;
  overviewProgress = reduced.matches ? scrollTarget : T.MathUtils.damp(overviewProgress, scrollTarget, 7, delta);
  sway.x = T.MathUtils.damp(sway.x, follow ? pointer.x : 0, 6, delta);
  sway.y = T.MathUtils.damp(sway.y, follow ? pointer.y : 0, 6, delta);
  const pose = overviewPose();
  const swayScale = T.MathUtils.lerp(1, .4, overviewProgress);
  room.camera.position.copy(pose.eye);
  room.camera.position.x += sway.x * .39 * swayScale;
  room.camera.position.y += sway.y * .24 * swayScale;
  room.camera.lookAt(pose.target);
}

function resize() {
  if (!room) return;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) return;
  room.setSize(width, height);
  room.camera.aspect = width / height;
  overview = cameraPose('room');
  seated = cameraPose('seated');
  const pose = view === 'room' ? overviewPose() : cameraPose(view);
  room.camera.position.copy(pose.eye);
  room.camera.quaternion.copy(orientation(pose));
  projection(pose.shift);
  settle();
}

function frame(now) {
  const delta = Math.min(.05, (now - (frameTime ?? now)) / 1000);
  frameTime = now;
  if (flight) {
    const progress = flight.duration ? clamp((now - flight.from) / flight.duration) : 1;
    const t = ease(progress);
    room.camera.position.copy(flight.curve.getPoint(t));
    room.camera.quaternion.copy(flight.startRotation).slerp(flight.endRotation, t);
    projection(T.MathUtils.lerp(flight.startShift, flight.shift, t));
    if (progress === 1) settle();
  } else if (view === 'room') {
    moveOverview(delta);
  }
  room.camera.updateMatrixWorld();
  const underPointer = mouseInside && (view === 'room' || view === 'paper') ? pick() : null;
  hover = view === 'room' ? underPointer : null;
  canvas.style.cursor = hover || (view === 'paper' && underPointer === 'paper') ? 'pointer' : '';
  const blend = reduced.matches ? 1 : .08;
  focusAmount = T.MathUtils.lerp(focusAmount, view === 'map' ? 1 : 0, blend);
  const diaryOpen = view === 'diary' && (!flight || now > flight.from + flight.duration * .73);
  coverAmount = T.MathUtils.lerp(coverAmount, diaryOpen ? 1 : 0, blend);
  lightAmount = T.MathUtils.lerp(lightAmount, lampOn ? 1 : 0, blend);
  room.updateEnvironment(now, focusAmount, reduced.matches);
  room.posterMat.emissiveIntensity = .14 + .93 * focusAmount;
  room.hinge.rotation.z = Math.PI * coverAmount;
  room.lamp.flame.visible = room.lamp.core.visible = lightAmount > .045;
  const flicker = reduced.matches ? 0 : Math.sin(now * .012) + Math.sin(now * .021);
  room.lamp.flame.scale.y = .061 + .005 * flicker;
  room.lamp.light.intensity = (19 + 1.25 * flicker) * lightAmount * (1 - .94 * focusAmount);
  room.radio.lever.rotation.z = signalPhase === 'tx' ? -.095 * (1 + Math.sin(now / 39)) : 0;
  room.radio.led.material.emissiveIntensity = signalPhase ? 1.3 + .95 * Math.sin(now / 100) : .24;
  animatePaper(now);
  const focused = view === 'room' && !moving && document.activeElement?.matches('[data-object]:focus-visible')
    ? document.activeElement.dataset.object : null;
  room.render(hover || focused);
}

function addMessage(style, text) {
  const item = document.createElement('li');
  item.className = style;
  item.textContent = text;
  messages.append(item);
  messages.scrollTop = messages.scrollHeight;
  return item;
}

function setSignal(phase, label) {
  signalPhase = phase;
  terminal.dataset.busy = Boolean(phase);
  $('signal-status').textContent = label;
  $('send').disabled = Boolean(phase);
}

function pause(ms, abort) {
  return new Promise(resolve => {
    if (abort.aborted) return resolve(false);
    function finish(result) {
      clearTimeout(timer);
      abort.removeEventListener('abort', cancel);
      resolve(result);
    }
    const timer = setTimeout(() => finish(true), ms);
    const cancel = () => finish(false);
    abort.addEventListener('abort', cancel, { once:true });
  });
}

function cancelSignal() {
  if (signal) {
    signal.abort();
    signal = null;
    addMessage('system','本次收发已中止。');
  }
  setSignal('', '待机');
}

$('telegraph-form').addEventListener('submit', async event => {
  event.preventDefault();
  const message = input.value.trim();
  if (!message || signal) return;
  const controller = new AbortController();
  const abort = controller.signal;
  signal = controller;
  input.value = '';
  addMessage('tx', `发报 › ${message}`);
  setSignal('tx', '发报中 ···');
  try {
    if (!await pause(reduced.matches ? 80 : 760, abort)) return;
    setSignal('rx', '接收中 ···');
    const reply = await requestReply(message, { signal:abort });
    if (!await pause(reduced.matches ? 80 : 510, abort)) return;
    addMessage('rx', `回执 ‹ ${reply}`);
    setSignal('', '收发完成');
  } catch {
    if (!abort.aborted) {
      addMessage('system', '接收失败，请重新发报。');
      setSignal('', '接收失败');
    }
  } finally {
    if (signal === controller) signal = null;
  }
});

for (const item of byObject) item.addEventListener('click', () => select(item.dataset.object));
$('back').addEventListener('click', () => select('room'));
$('prev').addEventListener('click', () => flip(-1));
$('next').addEventListener('click', () => flip(1));
canvas.addEventListener('pointermove', event => {
  if (event.pointerType === 'touch') return;
  mouseInside = true;
  trackPointer(event);
});
canvas.addEventListener('pointerleave', () => { mouseInside = false; });
canvas.addEventListener('wheel', event => {
  if (!room || view !== 'room' || event.ctrlKey) return;
  event.preventDefault();
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1;
  scrollTarget = clamp(scrollTarget + event.deltaY * unit / 640);
}, { passive:false });
canvas.addEventListener('click', event => {
  trackPointer(event);
  const id = pick();
  if (view === 'room' && id) select(id);
  else if (view === 'paper' && id === 'paper') flip(pageIndex === papers.length - 1 ? -(papers.length - 1) : 1);
});
window.addEventListener('keydown', event => {
  if (event.key === 'Escape' && view !== 'room') select('room');
  if (view === 'paper' && event.key === 'ArrowLeft') flip(-1);
  if (view === 'paper' && event.key === 'ArrowRight') flip(1);
});

try {
  room = await createScene(canvas, papers, diary);
  resize();
  $('objects').hidden = false;
  window.addEventListener('resize', resize);
  room.renderer.setAnimationLoop(frame);
  $('notice').textContent = '';
} catch (error) {
  console.error(error);
  $('notice').textContent = '3D 场景加载失败，请使用支持 WebGL 2 的浏览器重新打开。';
}
