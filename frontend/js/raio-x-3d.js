/* ============================================================
   AUTOSYNC — RAIO-X 3D (motor da cena)
   Usado na prévia do index.html (opts.preview) e em raio-x.html.
   Cada peça tem `mod`: chave da categoria do modal de modificações
   (suspensao, motor, rodasPneus, escapamento, freios, eletrica) ou null.
   Requer three.js r128 + OrbitControls.
   ============================================================ */
(function () {
"use strict";
const PI = Math.PI;

const PARTS = [
  {id:'motor',mod:'motor',nome:'Motor',cat:'Motor',cor:'#8d969e',desc:'Quatro cilindros em linha, montado na longitudinal. Bloco, cabeçote, tampa de válvulas, bobinas e coletor de admissão.',itens:['Juntas e retentores','Pistões e anéis','Velas e bobinas','Kit correia dentada','Bomba de óleo','Filtros de óleo e ar']},
  {id:'arrefecimento',mod:'motor',nome:'Arrefecimento',cat:'Motor',cor:'#b4bcc3',desc:'Radiador, eletroventilador, mangueiras e reservatório de expansão mantêm o motor na temperatura de trabalho.',itens:['Radiador','Mangueiras','Válvula termostática','Eletroventilador','Bomba d’água','Aditivo']},
  {id:'escapamento',mod:'escapamento',nome:'Escapamento',cat:'Motor',cor:'#9a8573',desc:'Coletor, catalisador, intermediário e silencioso traseiro levam os gases para fora e reduzem ruído e emissões.',itens:['Catalisador','Silenciosos','Sonda lambda','Juntas do coletor','Coxins e abraçadeiras']},
  {id:'combustivel',mod:'motor',nome:'Combustível',cat:'Motor',cor:'#5f6973',desc:'Tanque com bomba elétrica, filtro e linha de alimentação até a flauta de injeção.',itens:['Bomba de combustível','Filtro de combustível','Sensor de nível','Bicos injetores','Mangueiras']},
  {id:'cambio',mod:null,nome:'Câmbio e embreagem',cat:'Transmissão',cor:'#5d7489',desc:'Caixa manual de 5 marchas acoplada ao motor pela embreagem, com alavanca no túnel central.',itens:['Kit embreagem','Atuador hidráulico','Óleo de câmbio','Coxins','Trambulador']},
  {id:'cardan',mod:null,nome:'Eixo cardã',cat:'Transmissão',cor:'#8a949c',desc:'Leva o torque da saída do câmbio até o diferencial traseiro, com cruzetas nas pontas e mancal central.',itens:['Cruzetas','Rolamento central','Junta elástica','Luva deslizante']},
  {id:'diferencial',mod:null,nome:'Diferencial e eixo traseiro',cat:'Transmissão',cor:'#8a6a3e',desc:'Divide o torque entre as rodas traseiras e deixa que girem em velocidades diferentes nas curvas.',itens:['Coroa e pinhão','Rolamentos','Retentores','Óleo de diferencial','Semieixos']},
  {id:'suspensao',mod:'suspensao',nome:'Suspensão',cat:'Chassi',cor:'#2f6fd6',desc:'Conjuntos mola-amortecedor nas quatro rodas, bandejas na dianteira e braços arrastados na traseira.',itens:['Amortecedores','Molas','Kit batente e coifa','Bandejas','Pivôs','Buchas']},
  {id:'direcao',mod:null,nome:'Direção',cat:'Chassi',cor:'#7b858f',desc:'Caixa tipo pinhão e cremalheira, barras axiais, terminais e coluna até o volante.',itens:['Caixa de direção','Terminais','Barras axiais','Coifas','Coluna de direção']},
  {id:'freios',mod:'freios',nome:'Freios',cat:'Chassi',cor:'#c0262d',desc:'Discos e pinças nas quatro rodas. Item de desgaste com reposição frequente.',itens:['Pastilhas','Discos','Pinças','Fluido DOT 4','Flexíveis','Sensor de desgaste']},
  {id:'rodas',mod:'rodasPneus',nome:'Rodas e pneus',cat:'Chassi',cor:'#c5ccd2',desc:'Rodas de liga leve aro 16 com pneus radiais.',itens:['Pneus','Rolamentos de roda','Cubos','Parafusos','Bicos de válvula']},
  {id:'eletrica',mod:'eletrica',nome:'Bateria e partida',cat:'Elétrica',cor:'#4ea0c9',desc:'Bateria de 60 Ah, alternador movido pela correia e motor de partida junto ao câmbio.',itens:['Baterias','Alternadores','Motores de partida','Cabos e terminais','Relés e fusíveis']},
  {id:'iluminacao',mod:'eletrica',nome:'Iluminação',cat:'Elétrica',cor:'#dfefff',desc:'Faróis dianteiros e lanternas traseiras.',itens:['Faróis','Lanternas','Lâmpadas e LEDs','Soquetes','Chicotes']},
  {id:'interior',mod:null,nome:'Habitáculo',cat:'Acabamento',cor:'#4a5059',desc:'Bancos, painel de instrumentos e volante.',itens:['Capas de banco','Tapetes','Volantes','Botões e comandos','Forrações']},
];
const BYID = Object.fromEntries(PARTS.map(p=>[p.id,p]));
const CATS = [...new Set(PARTS.map(p=>p.cat))];
const ORDER = CATS.flatMap(c=>PARTS.filter(p=>p.cat===c).map(p=>p.id));

function create(canvas, opts){
  opts = opts || {};
  const preview = !!opts.preview;
  const THREE = window.THREE, V3 = THREE.Vector3;
  const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const BG = 0x0d1117, ACCENT = 0xff8a00;

  let renderer;
  try { renderer = new THREE.WebGLRenderer({canvas, antialias:true}); }
  catch (err) { if (opts.onError) opts.onError(err); return null; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = !preview;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.Fog(BG, 13, 28);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  const HOME_CAM = new V3(5.6, 2.6, 6.2), HOME_TGT = new V3(0, 0.7, 0);
  camera.position.copy(HOME_CAM);
  const controls = new THREE.OrbitControls(camera, canvas);
  controls.target.copy(HOME_TGT);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.minDistance = 2.4; controls.maxDistance = 16;
  controls.maxPolarAngle = PI*0.495;
  controls.autoRotateSpeed = 0.8;
  if (preview){
    controls.enableZoom = false; controls.enablePan = false; controls.enableRotate = false;
    controls.autoRotate = !reduced; controls.autoRotateSpeed = 1.2;
  }

  scene.add(new THREE.HemisphereLight(0xe8eef5, 0x22262c, 0.85));
  const key = new THREE.DirectionalLight(0xffffff, 1.8);
  key.position.set(4, 8, 5); key.castShadow = !preview;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, {left:-5, right:5, top:5, bottom:-5, near:1, far:25});
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9cc4ff, 0.9); rim.position.set(-6, 3, -4); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffe6c8, 0.45); fill.position.set(-3, 2, 6); scene.add(fill);

  const floor = new THREE.Mesh(new THREE.CircleGeometry(7, 80), new THREE.MeshStandardMaterial({color:0x05070a, roughness:1, metalness:0}));
  floor.rotation.x = -PI/2; floor.position.y = -0.005; floor.receiveShadow = true; scene.add(floor);
  const grid = new THREE.PolarGridHelper(6.5, 24, 10, 96, 0x3a4552, 0x252d36);
  grid.material.transparent = true; grid.material.opacity = .55; grid.position.y = 0.001; scene.add(grid);

/* ---------- Helpers ---------- */
function M(color, metal=.5, rough=.45, extra){ return new THREE.MeshStandardMaterial(Object.assign({color, metalness:metal, roughness:rough}, extra||{})); }
function mesh(geo, m, x=0, y=0, z=0){ const o = new THREE.Mesh(geo, m); o.position.set(x,y,z); return o; }
function box(w,h,d,m,x,y,z){ return mesh(new THREE.BoxGeometry(w,h,d), m, x,y,z); }
function cyl(r,len,m,axis,x,y,z,seg=28,open=false){
  const g = new THREE.CylinderGeometry(r,r,len,seg,1,open);
  if(axis==='x') g.rotateZ(PI/2); else if(axis==='z') g.rotateX(PI/2);
  return mesh(g,m,x,y,z);
}
function rod(a,b,r,m,seg=12){
  const A=new V3(...a), B=new V3(...b), d=B.clone().sub(A), len=d.length();
  const o = new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,seg), m);
  o.position.copy(A).addScaledVector(d,.5);
  o.quaternion.setFromUnitVectors(new V3(0,1,0), d.normalize());
  return o;
}
function tube(pts, r, m, seg=64){
  const c = new THREE.CatmullRomCurve3(pts.map(p=>new V3(...p)));
  return new THREE.Mesh(new THREE.TubeGeometry(c, seg, r, 10, false), m);
}
function spring(a,b,r,turns,m){
  const A=new V3(...a), B=new V3(...b), d=B.clone().sub(A), len=d.length(), N=turns*20, pts=[];
  for(let i=0;i<=N;i++){ const t=i/N, ang=t*turns*PI*2; pts.push(new V3(Math.cos(ang)*r, t*len, Math.sin(ang)*r)); }
  const o = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), N*2, .012, 6, false), m);
  o.position.copy(A); o.quaternion.setFromUnitVectors(new V3(0,1,0), d.normalize());
  return o;
}
function poly(pts, P){ const s = new (P||THREE.Shape)(); s.moveTo(pts[0][0],pts[0][1]); for(let i=1;i<pts.length;i++) s.lineTo(pts[i][0],pts[i][1]); s.lineTo(pts[0][0],pts[0][1]); return s; }
function grp(x=0,y=0,z=0){ const g=new THREE.Group(); g.position.set(x,y,z); return g; }

const partsRoot = new THREE.Group(); scene.add(partsRoot);
const partGroups = {}; const movers = [];
function P(id){ const g=new THREE.Group(); g.userData.partId=id; partsRoot.add(g); partGroups[id]=g; return g; }
function put(g, obj, ex){
  obj.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } });
  obj.userData.home = obj.position.clone(); obj.userData.ex = ex ? new V3(...ex) : new V3();
  g.add(obj); movers.push(obj); return obj;
}

/* ---------- Carroceria ---------- */
const bodyGroup = new THREE.Group(); scene.add(bodyGroup);
const clipPlane = new THREE.Plane(new V3(0,0,-1), 0);
const paintMat = new THREE.MeshPhysicalMaterial({color:0x1f4e6b, metalness:.55, roughness:.3, clearcoat:1, clearcoatRoughness:.08, side:THREE.DoubleSide, transparent:true, opacity:.16, depthWrite:false});
const doorMat  = paintMat.clone(); doorMat.opacity = .38;
const glassMat = new THREE.MeshPhysicalMaterial({color:0x0e1822, metalness:.9, roughness:.05, transparent:true, opacity:.22, side:THREE.DoubleSide, depthWrite:false});
const trimMat  = M(0x26292e,.1,.85,{transparent:true, opacity:.5, depthWrite:false});
const edgeMat  = new THREE.LineBasicMaterial({color:0xbfd6e6, transparent:true, opacity:.55});

const frontDoor = [[0.02,0.4],[0.85,0.4],[0.85,0.9],[0.2,1.28],[0.02,1.32]];
const frontWin  = [[0.08,0.95],[0.68,0.95],[0.22,1.22],[0.08,1.25]];
const rearDoor  = [[-0.9,0.42],[-0.1,0.42],[-0.1,1.34],[-1.0,1.34],[-1.12,1.15],[-1.0,0.75]];
const rearWin   = [[-0.18,0.95],[-0.18,1.28],[-0.97,1.28],[-1.04,1.15],[-0.95,0.95]];

const prof = new THREE.Shape();
prof.moveTo(-2.2,0.28);
prof.lineTo(-1.77,0.28);
prof.absarc(-1.35,0.33,0.42,PI,0,true);
prof.lineTo(0.93,0.28);
prof.absarc(1.35,0.33,0.42,PI,0,true);
prof.lineTo(2.2,0.28);
prof.quadraticCurveTo(2.3,0.4,2.27,0.58);
prof.lineTo(2.15,0.82);
prof.lineTo(0.9,1.0);
prof.lineTo(0.05,1.42);
prof.quadraticCurveTo(-0.5,1.48,-1.15,1.42);
prof.lineTo(-1.85,1.02);
prof.lineTo(-2.2,0.98);
prof.quadraticCurveTo(-2.3,0.75,-2.27,0.55);
prof.lineTo(-2.2,0.28);
prof.holes.push(poly(frontDoor, THREE.Path), poly(rearDoor, THREE.Path));

const bodyGeo = new THREE.ExtrudeGeometry(prof, {depth:1.7, bevelEnabled:true, bevelThickness:.05, bevelSize:.035, bevelSegments:4, curveSegments:28});
bodyGeo.translate(0,0,-0.85);
const bodyMesh = new THREE.Mesh(bodyGeo, paintMat);
bodyGroup.add(bodyMesh);
bodyGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(bodyGeo, 28), edgeMat));

function glassQuad(a,b,off,inset,w){
  const dx=b[0]-a[0], dy=b[1]-a[1], L=Math.hypot(dx,dy), ux=dx/L, uy=dy/L, nx=dy/L, ny=-dx/L;
  const A=[a[0]+ux*inset+nx*off, a[1]+uy*inset+ny*off], B=[b[0]-ux*inset+nx*off, b[1]-uy*inset+ny*off];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([A[0],A[1],-w, A[0],A[1],w, B[0],B[1],w, B[0],B[1],-w], 3));
  g.setIndex([0,1,2, 0,2,3]); g.computeVertexNormals();
  return new THREE.Mesh(g, glassMat);
}
bodyGroup.add(glassQuad([0.9,1.0],[0.05,1.42], .058, .05, .76));
bodyGroup.add(glassQuad([-1.15,1.42],[-1.85,1.02], .058, .06, .74));

const doors = [];
function makeDoor(pts, win, hingeX, side, handleX){
  const shape = poly(pts); shape.holes.push(poly(win, THREE.Path));
  const geo = new THREE.ExtrudeGeometry(shape, {depth:.035, bevelEnabled:true, bevelThickness:.008, bevelSize:.008, bevelSegments:1, curveSegments:4});
  geo.translate(-hingeX, 0, side>0 ? 0 : -0.035);
  const pivot = grp(hingeX, 0, side*0.885);
  pivot.add(new THREE.Mesh(geo, doorMat));
  pivot.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), edgeMat));
  const gl = new THREE.ShapeGeometry(poly(win)); gl.translate(-hingeX, 0, side*0.0175);
  pivot.add(new THREE.Mesh(gl, glassMat));
  const xs = pts.map(p=>p[0]), minX = Math.min(...xs)+.06, maxX = Math.max(...xs)-.06;
  pivot.add(box(maxX-minX, .42, .012, trimMat, (minX+maxX)/2-hingeX, .66, side>0 ? -.012 : .012));
  pivot.add(box(.12,.025,.02, M(0x9aa3ab,.9,.25), handleX-hingeX, .86, side>0 ? .05 : -.05));
  pivot.userData.open = side*1.12;
  bodyGroup.add(pivot); doors.push(pivot);
}
[1,-1].forEach(s=>{ makeDoor(frontDoor, frontWin, 0.85, s, 0.14); makeDoor(rearDoor, rearWin, -0.1, s, -0.86); });

/* ---------- Peças ---------- */
const WHEELS = [[1.35,0.78],[1.35,-0.78],[-1.35,0.78],[-1.35,-0.78]];

// Motor
(function(){
  const g = P('motor'), ex=[0,0.95,0];
  const alu=M(0x7d868e,.65,.38), head=M(0x9aa3ab,.7,.32), dark=M(0x30353b,.4,.6), cover=M(0x2c3238,.6,.3), coil=M(0x7a1f22,.3,.5);
  const e = grp();
  e.add(box(.62,.34,.36,alu,1.5,.5,0));
  e.add(box(.56,.08,.30,dark,1.5,.29,0));
  e.add(box(.62,.11,.32,head,1.5,.725,0));
  e.add(box(.58,.07,.24,cover,1.5,.815,0));
  [1.29,1.43,1.57,1.71].forEach(x=>{
    e.add(cyl(.024,.07,coil,'y',x,.86,0,14));
    e.add(rod([x,.78,-.3],[x,.72,-.17],.022,alu));
  });
  e.add(cyl(.065,.52,alu,'x',1.5,.79,-.3));
  e.add(box(.22,.1,.22,dark,1.85,.74,-.48));
  e.add(tube([[1.78,.75,-.42],[1.77,.78,-.34],[1.74,.79,-.3]],.04,dark,12));
  e.add(cyl(.085,.04,M(0x5a6168,.7,.35),'x',1.83,.42,0));
  e.add(cyl(.06,.04,M(0x5a6168,.7,.35),'x',1.83,.69,0));
  put(g,e,ex);
})();

// Arrefecimento
(function(){
  const g = P('arrefecimento'), ex=[0.7,0.25,0];
  const c=document.createElement('canvas'); c.width=64; c.height=64; const x=c.getContext('2d');
  x.fillStyle='#a3abb2'; x.fillRect(0,0,64,64); x.fillStyle='#5e666d'; for(let i=0;i<64;i+=4) x.fillRect(i,0,2,64);
  const tex=new THREE.CanvasTexture(c); tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(14,3); tex.encoding=THREE.sRGBEncoding;
  const core=M(0xffffff,.6,.45,{map:tex}), plastic=M(0x1f2226,.1,.7), rubber=M(0x16181b,.05,.8);
  const r = grp();
  r.add(box(.05,.36,.88,core,2.03,.55,0));
  r.add(box(.07,.38,.06,plastic,2.03,.55,.47)); r.add(box(.07,.38,.06,plastic,2.03,.55,-.47));
  r.add(cyl(.17,.05,plastic,'x',1.975,.55,0,32,true));
  const fan=grp(1.97,.55,0);
  for(let k=0;k<5;k++){ const b=box(.012,.14,.05,plastic,0,0,0); const a=k*PI*2/5; b.position.set(0,Math.cos(a)*.08,Math.sin(a)*.08); b.rotation.x=-a; b.rotation.y=.4; fan.add(b); }
  fan.add(cyl(.035,.04,plastic,'x',0,0,0,16));
  r.add(fan);
  r.add(tube([[2.0,.68,.38],[1.92,.75,.3],[1.82,.73,.1]],.024,rubber,24));
  r.add(tube([[2.0,.42,-.38],[1.9,.37,-.25],[1.82,.4,-.08]],.024,rubber,24));
  r.add(box(.1,.12,.08,M(0xd9dde0,.0,.35,{transparent:true,opacity:.75}),1.75,.79,.48));
  put(g,r,ex);
})();

// Elétrica
(function(){
  const g = P('eletrica');
  const blk=M(0x1c1f23,.1,.6), red=M(0xb3262c,.2,.5), alu=M(0xa8b0b7,.75,.3), wire=M(0xb3262c,.1,.6);
  const b = grp();
  b.add(box(.24,.18,.16,blk,1.05,.68,.48));
  b.add(box(.245,.03,.165,M(0x2b5f7d,.2,.5),1.05,.74,.48));
  b.add(cyl(.016,.03,red,'y',.97,.785,.44,12)); b.add(cyl(.016,.03,blk,'y',1.13,.785,.44,12));
  b.add(tube([[.97,.79,.44],[1.0,.82,.3],[1.1,.6,.22],[1.12,.44,-.12]],.011,wire,32));
  put(g,b,[0,0.7,0.35]);
  const a = grp();
  a.add(cyl(.065,.14,alu,'x',1.78,.58,.22,24));
  a.add(cyl(.04,.03,M(0x30353b,.5,.5),'x',1.86,.58,.22,16));
  put(g,a,[0.4,0.6,0.25]);
  const s = grp(); s.add(cyl(.05,.16,M(0x3a4047,.6,.4),'x',1.12,.38,-.2,20)); put(g,s,[0,0.3,-0.4]);
  g.userData.anchor = b;
})();

// Câmbio
(function(){
  const g = P('cambio');
  const m=M(0x5d7489,.6,.4,{side:THREE.DoubleSide});
  const lp=[[0.0,-0.01],[0.21,0],[0.215,0.1],[0.17,0.22],[0.13,0.45],[0.11,0.7],[0.07,0.8],[0.0,0.81]].map(p=>new THREE.Vector2(p[0],p[1]));
  const lg=new THREE.LatheGeometry(lp,36); lg.rotateZ(PI/2);
  const c = grp();
  c.add(mesh(lg,m,1.17,.45,0));
  c.add(rod([0.62,.55,0],[0.45,.79,0],.012,M(0xc9cfd4,.9,.2)));
  c.add(mesh(new THREE.SphereGeometry(.035,16,12),M(0x15171a,.2,.5),0.45,.81,0));
  c.add(box(.1,.08,.12,M(0x1f2226,.1,.8),0.6,.29,0));
  put(g,c,[0,0.55,0]);
})();

// Cardã
(function(){
  const g = P('cardan'), m=M(0x8a949c,.75,.3), d=M(0x2c3035,.4,.6);
  const c = grp();
  c.add(rod([0.37,.44,0],[-1.17,.35,0],.035,m,16));
  c.add(box(.06,.07,.07,d,0.36,.44,0)); c.add(box(.06,.07,.07,d,-1.16,.35,0));
  c.add(box(.05,.09,.13,d,-0.4,.395,0));
  put(g,c,[0,0.28,0]);
})();

// Diferencial
(function(){
  const g = P('diferencial'), br=M(0x8a6a3e,.6,.42), st=M(0x6f7a84,.6,.4);
  const d = grp();
  const pump=mesh(new THREE.SphereGeometry(.15,28,20),br,-1.35,.33,0); pump.scale.set(1,.95,.9); d.add(pump);
  d.add(cyl(.12,.03,br,'x',-1.49,.33,0,28));
  d.add(cyl(.06,.1,br,'x',-1.2,.34,0,20));
  d.add(cyl(.045,1.24,st,'z',-1.35,.33,0,18));
  d.add(cyl(.07,.02,st,'z',-1.35,.33,.63,24)); d.add(cyl(.07,.02,st,'z',-1.35,.33,-.63,24));
  put(g,d,[-0.35,0.4,0]);
})();

// Freios
(function(){
  const g = P('freios'), disc=M(0xa7adb2,.85,.32), hat=M(0x6a7076,.7,.4), cal=M(0xc0262d,.3,.38);
  WHEELS.forEach(([wx,wz])=>{
    const s=Math.sign(wz), b=grp(wx,.33,wz);
    b.add(cyl(.2,.024,disc,'z',0,0,-s*.035,40));
    b.add(cyl(.085,.05,hat,'z',0,0,-s*.025,24));
    const c=box(.07,.13,.075,cal,0,0,-s*.035); c.position.set(-.16*Math.sign(wx)*-1,.1,-s*.035);
    c.position.set(wx>0?-.15:.15,.12,-s*.035); c.rotation.z = wx>0 ? .9 : -.9; b.add(c);
    put(g,b,[0,0,s*0.38]);
  });
  g.userData.anchor = g.children[0];
})();

// Rodas
(function(){
  const g = P('rodas');
  const rubber=M(0x1b1d20,.05,.85), rim=M(0xc5ccd2,.85,.25,{side:THREE.DoubleSide}), cap=M(0x3a3f45,.6,.4);
  const prof=[[0.215,-0.11],[0.30,-0.115],[0.33,-0.08],[0.336,0],[0.33,0.08],[0.30,0.115],[0.215,0.11],[0.215,-0.11]].map(p=>new THREE.Vector2(p[0],p[1]));
  const tireGeo=new THREE.LatheGeometry(prof,56); tireGeo.rotateX(PI/2);
  WHEELS.forEach(([wx,wz])=>{
    const s=Math.sign(wz), w=grp(wx,.33,wz);
    w.add(new THREE.Mesh(tireGeo,rubber));
    w.add(cyl(.212,.2,rim,'z',0,0,0,40,true));
    for(let k=0;k<5;k++){ const a=k*PI*2/5, sp=box(.045,.17,.025,rim,Math.sin(a)*.12,Math.cos(a)*.12,s*.09); sp.rotation.z=-a; w.add(sp); }
    w.add(cyl(.05,.04,cap,'z',0,0,s*.095,20));
    const lip=new THREE.Mesh(new THREE.TorusGeometry(.212,.01,8,48),rim); lip.position.z=s*.1; w.add(lip);
    put(g,w,[0,0,s*0.7]);
  });
  g.userData.anchor = g.children[0];
})();

// Suspensão
(function(){
  const g = P('suspensao'), spr=M(0x2f6fd6,.45,.35), damp=M(0x22262b,.5,.45), chrome=M(0xd0d6db,.9,.2), arm=M(0x3b4148,.5,.5);
  WHEELS.forEach(([wx,wz])=>{
    const s=Math.sign(wz), c=grp();
    if(wx>0){
      c.add(box(.08,.17,.06,arm,wx,.33,s*.64));
      c.add(rod([wx,.4,s*.6],[wx,.8,s*.5],.028,damp));
      c.add(rod([wx,.62,s*.55],[wx,.86,s*.49],.013,chrome));
      c.add(spring([wx,.46,s*.585],[wx,.78,s*.505],.065,6,spr));
      c.add(rod([wx,.26,s*.62],[wx+.2,.27,s*.22],.018,arm));
      c.add(rod([wx,.26,s*.62],[wx-.2,.27,s*.22],.018,arm));
    } else {
      c.add(spring([wx,.38,s*.48],[wx,.72,s*.48],.07,6,spr));
      c.add(rod([wx-.16,.3,s*.56],[wx-.16,.62,s*.56],.026,damp));
      c.add(rod([wx-.16,.55,s*.56],[wx-.16,.72,s*.56],.012,chrome));
      c.add(rod([wx,.3,s*.56],[wx+.48,.3,s*.6],.02,arm));
    }
    put(g,c,[0,0.3,s*0.32]);
  });
  g.userData.anchor = g.children[0];
})();

// Direção
(function(){
  const g = P('direcao'), m=M(0x7b858f,.6,.4), boot=M(0x17191c,.05,.8), wh=M(0x1d2024,.2,.6);
  const r = grp();
  r.add(cyl(.03,.8,m,'z',1.62,.23,0,16));
  r.add(cyl(.045,.1,boot,'z',1.62,.23,.42,16)); r.add(cyl(.045,.1,boot,'z',1.62,.23,-.42,16));
  r.add(rod([1.62,.23,.45],[1.56,.3,.64],.015,m)); r.add(rod([1.62,.23,-.45],[1.56,.3,-.64],.015,m));
  r.add(box(.08,.08,.08,m,1.62,.25,-.36));
  r.add(rod([1.6,.27,-.37],[0.6,.9,-.38],.022,m));
  const sw=grp(0.5,.97,-.38); sw.rotation.z=-.46;
  const tor=new THREE.Mesh(new THREE.TorusGeometry(.17,.019,10,40),wh); tor.rotation.y=PI/2; sw.add(tor);
  const hub=cyl(.05,.05,wh,'x',0,0,0,20); sw.add(hub);
  [0,PI*0.6,PI*1.4].forEach(a=>{ const sp=box(.02,.16,.03,wh,0,Math.cos(a)*.08,Math.sin(a)*.08); sp.rotation.x=-a; sw.add(sp); });
  r.add(sw);
  put(g,r,[0.3,0.2,0]);
})();

// Escapamento
(function(){
  const g = P('escapamento'), st=M(0x7d848a,.7,.48), hot=M(0x9a8573,.65,.45), sh=M(0xa4abb1,.8,.35);
  const e = grp();
  [1.29,1.43,1.57,1.71].forEach(x=> e.add(tube([[x,.68,.17],[x,.63,.25],[(x+1.35)/2,.47,.285],[1.22,.37,.28]],.022,hot,24)));
  e.add(tube([[1.22,.37,.28],[1.1,.28,.28],[0.85,.26,.28]],.03,st,24));
  e.add(cyl(.07,.32,sh,'x',0.62,.26,.28,24));
  e.add(tube([[0.46,.26,.28],[-0.6,.26,.28]],.03,st,24));
  e.add(cyl(.055,.3,sh,'x',-0.25,.26,.28,24));
  e.add(tube([[-0.6,.26,.28],[-1.0,.27,.28],[-1.17,.42,.28],[-1.35,.52,.28],[-1.55,.42,.28],[-1.72,.31,.2],[-1.78,.3,.15]],.03,st,64));
  e.add(box(.28,.15,.62,sh,-1.92,.3,.02));
  e.add(rod([-2.06,.29,.22],[-2.33,.29,.22],.032,M(0xc9cfd4,.9,.2)));
  put(g,e,[0,0,0.8]);
})();

// Combustível
(function(){
  const g = P('combustivel'), m=M(0x3a4047,.4,.55), l=M(0x8a949c,.7,.35);
  const f = grp();
  f.add(box(.55,.16,.48,m,-0.72,.32,-.38));
  f.add(cyl(.055,.04,M(0x1f2226,.2,.6),'y',-0.72,.42,-.38,20));
  f.add(tube([[-0.6,.42,-.3],[-0.45,.3,-.24],[0.4,.27,-.22],[1.0,.3,-.23],[1.2,.62,-.2]],.01,l,64));
  f.add(cyl(.03,.11,M(0xb7bdc2,.7,.3),'x',0.0,.27,-.23,16));
  put(g,f,[0,0,-0.75]);
})();

// Iluminação
(function(){
  const g = P('iluminacao');
  const hl=M(0xdfefff,.2,.2,{emissive:0xcfe6ff,emissiveIntensity:1.1}), tl=M(0xff3b3b,.2,.3,{emissive:0xd11a1a,emissiveIntensity:1.2});
  [1,-1].forEach(s=>{
    put(g, box(.08,.1,.3,hl,2.18,.7,s*.58), [0.35,0,0]);
    put(g, box(.05,.1,.28,tl,-2.235,.85,s*.6), [-0.35,0,0]);
  });
  g.userData.anchor = g.children[0];
})();

// Habitáculo
(function(){
  const g = P('interior'), fab=M(0x2b2f35,.05,.9), dash=M(0x23272c,.2,.7), ins=M(0x0d1013,.3,.3,{emissive:0x113344,emissiveIntensity:.6});
  const h = grp();
  [.38,-.38].forEach(z=>{
    h.add(box(.46,.1,.44,fab,0.05,.47,z));
    const bk=box(.1,.56,.42,fab,-0.21,.79,z); bk.rotation.z=.18; h.add(bk);
    const hr=box(.08,.14,.24,fab,-0.28,1.13,z); hr.rotation.z=.18; h.add(hr);
  });
  h.add(box(.46,.1,1.2,fab,-0.85,.47,0));
  const rb=box(.1,.52,1.2,fab,-1.1,.76,0); rb.rotation.z=.2; h.add(rb);
  h.add(box(.26,.18,1.5,dash,0.76,.82,0));
  h.add(box(.12,.05,.36,dash,0.68,.935,-.38));
  h.add(box(.01,.08,.28,ins,0.62,.88,-.38));
  put(g,h,[0,0.62,0]);
})();

  /* ---------- Estado ---------- */
  let mode='xray', sel=null, explodeT=0, explodeTarget=0, doorT=1, doorTarget=1;
  const MODES = {
    xray:{paint:.16, door:.38, glass:.22, trim:.5, edge:.55, clip:false},
    corte:{paint:.97, door:.97, glass:.6, trim:1, edge:.22, clip:true},
    solid:{paint:1, door:1, glass:.88, trim:1, edge:.1, clip:false},
  };
  const bodyMats = [paintMat, doorMat, glassMat, trimMat, edgeMat];
  function setMode(m){
    mode = m; const s = MODES[m];
    bodyMats.forEach(mt=>{ mt.clippingPlanes = s.clip ? [clipPlane] : []; mt.needsUpdate = true; });
    bodyGroup.traverse(o=>{ if(o.isMesh) o.castShadow = (m==='solid'); });
    if (opts.onMode) opts.onMode(m);
  }

  const AMBER = new THREE.Color(ACCENT);
  function partMaterials(id){ const set=new Set(); partGroups[id].traverse(o=>{ if(o.isMesh) set.add(o.material); }); return [...set]; }
  function clearHL(id){ if(!id) return; partMaterials(id).forEach(m=>{ if(m.userData.e0){ m.emissive.copy(m.userData.e0); m.emissiveIntensity=m.userData.i0; } }); }
  function applyHL(id, k){ partMaterials(id).forEach(m=>{ if(!m.userData.e0){ m.userData.e0=m.emissive.clone(); m.userData.i0=m.emissiveIntensity; } m.emissive.copy(AMBER); m.emissiveIntensity=k; }); }

  let camTween = null;
  const tmpBox = new THREE.Box3(), tmpV = new V3();
  function anchorCenter(id, out){ const g=partGroups[id]; tmpBox.setFromObject(g.userData.anchor||g); return tmpBox.getCenter(out); }
  function select(id){
    clearHL(sel); sel = id || null;
    if (sel){
      if (mode==='solid') setMode('xray');
      const c = anchorCenter(sel, new V3());
      const goalT = HOME_TGT.clone().lerp(c, .55);
      camTween = {t: goalT, c: camera.position.clone().add(goalT.clone().sub(controls.target))};
    } else if (opts.onPin) opts.onPin(0,0,false,'');
    if (opts.onSelect) opts.onSelect(sel);
  }
  function step(d){ const i = sel ? ORDER.indexOf(sel) : -1; select(ORDER[(i+d+ORDER.length)%ORDER.length]); }

  function toggleDoors(){ doorTarget = doorTarget ? 0 : 1; return !!doorTarget; }
  function toggleExplode(){
    explodeTarget = explodeTarget ? 0 : 1;
    if(explodeTarget && camera.position.distanceTo(controls.target) < 9){
      const dir = camera.position.clone().sub(controls.target).normalize();
      const t = HOME_TGT.clone().add(new V3(0,.5,0));
      camTween = {t, c: t.clone().addScaledVector(dir, 10)};
    }
    return !!explodeTarget;
  }
  function toggleSpin(){ controls.autoRotate = !controls.autoRotate; return controls.autoRotate; }
  function home(){ camTween = {t: HOME_TGT.clone(), c: HOME_CAM.clone().multiplyScalar(explodeTarget?1.45:1).setY(explodeTarget?3.4:HOME_CAM.y)}; }
  function setPaint(hex){ paintMat.color.set(hex); doorMat.color.set(hex); }
  controls.addEventListener('start', ()=>{ camTween = null; });

  /* ---------- Picking (só na versão completa) ---------- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(x,y){
    const r = canvas.getBoundingClientRect();
    ndc.set(((x-r.left)/r.width)*2-1, -((y-r.top)/r.height)*2+1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(partsRoot.children, true);
    for(const h of hits){ let o=h.object; while(o && !o.userData.partId) o=o.parent; if(o) return o.userData.partId; }
    return null;
  }
  let down=null, hoverRAF=0, lastMove=null;
  if (!preview){
    canvas.addEventListener('pointerdown', e=>{ down={x:e.clientX,y:e.clientY,t:performance.now()}; });
    canvas.addEventListener('pointerup', e=>{
      if(!down) return; const moved=Math.hypot(e.clientX-down.x, e.clientY-down.y);
      if(moved<6 && performance.now()-down.t<600){ const id=pick(e.clientX,e.clientY); select(id && id===sel ? null : id); }
      down=null;
    });
    canvas.addEventListener('pointermove', e=>{
      if(e.pointerType!=='mouse'){ if(opts.onHover) opts.onHover(null); return; }
      lastMove=e; if(hoverRAF) return;
      hoverRAF=requestAnimationFrame(()=>{
        hoverRAF=0;
        if(down){ if(opts.onHover) opts.onHover(null); canvas.style.cursor='grabbing'; return; }
        const id=pick(lastMove.clientX,lastMove.clientY);
        if(opts.onHover) opts.onHover(id, lastMove.clientX, lastMove.clientY);
        canvas.style.cursor = id ? 'pointer' : 'grab';
      });
    });
    canvas.addEventListener('pointerleave', ()=>{ if(opts.onHover) opts.onHover(null); });
  }

  /* ---------- Tamanho: acompanha o contêiner ---------- */
  const holder = canvas.parentElement || canvas;
  function resize(){
    const w = Math.max(holder.clientWidth, 1), h = Math.max(holder.clientHeight, 1);
    renderer.setSize(w,h,false);
    camera.aspect=w/h; camera.fov = camera.aspect<0.8 ? 52 : (camera.aspect<1.2 ? 40 : 32);
    camera.updateProjectionMatrix();
  }
  let ro = null;
  if (window.ResizeObserver){ ro = new ResizeObserver(resize); ro.observe(holder); }
  else window.addEventListener('resize', resize);
  resize();

  /* ---------- Loop (pausa fora da tela / aba oculta) ---------- */
  const ease = t=>t<.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2;
  const clock = new THREE.Clock();
  let running = true, visible = true, raf = 0;
  setMode('xray');

  function frame(){
    raf = 0;
    if (!running || !visible || document.hidden) return;
    const dt = Math.min(clock.getDelta(), .05), k = reduced ? 1 : 1-Math.pow(0.0008, dt), time = clock.elapsedTime;
    const s = MODES[mode];
    paintMat.opacity += (s.paint-paintMat.opacity)*k; paintMat.depthWrite = paintMat.opacity>.9;
    doorMat.opacity  += (s.door-doorMat.opacity)*k;   doorMat.depthWrite = doorMat.opacity>.9;
    glassMat.opacity += (s.glass-glassMat.opacity)*k;
    trimMat.opacity  += (s.trim-trimMat.opacity)*k;   trimMat.depthWrite = trimMat.opacity>.9;
    edgeMat.opacity  += (s.edge-edgeMat.opacity)*k;

    const stp = reduced ? 1 : dt*1.6;
    explodeT += Math.sign(explodeTarget-explodeT)*Math.min(Math.abs(explodeTarget-explodeT), stp);
    doorT    += Math.sign(doorTarget-doorT)*Math.min(Math.abs(doorTarget-doorT), stp);
    const ex = ease(explodeT), dr = ease(doorT);
    for(const o of movers){ o.position.copy(o.userData.home).addScaledVector(o.userData.ex, ex); }
    bodyGroup.position.y = 1.4*ex;
    for(const d of doors) d.rotation.y = d.userData.open*dr;

    if(camTween){
      controls.target.lerp(camTween.t, k*.6); camera.position.lerp(camTween.c, k*.6);
      if(controls.target.distanceTo(camTween.t)<.005 && camera.position.distanceTo(camTween.c)<.01) camTween=null;
    }
    controls.update();

    if(sel){
      applyHL(sel, reduced ? .5 : .38 + .22*Math.sin(time*4));
      if (opts.onPin){
        anchorCenter(sel, tmpV).project(camera);
        const r = canvas.getBoundingClientRect();
        if(tmpV.z<1 && Math.abs(tmpV.x)<1.1 && Math.abs(tmpV.y)<1.1)
          opts.onPin(r.left+(tmpV.x*.5+.5)*r.width, r.top+(-tmpV.y*.5+.5)*r.height, true, BYID[sel].nome);
        else opts.onPin(0,0,false,'');
      }
    }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  function kick(){ if(!raf && running && visible && !document.hidden){ clock.getDelta(); raf = requestAnimationFrame(frame); } }
  if (window.IntersectionObserver)
    new IntersectionObserver(es=>{ visible = es[0].isIntersecting; kick(); }, {threshold:0.01}).observe(canvas);
  document.addEventListener('visibilitychange', kick);
  kick();

  return {
    select, step, setMode, toggleDoors, toggleExplode, toggleSpin, home, setPaint,
    get selected(){ return sel; },
    destroy(){ running=false; if(ro) ro.disconnect(); renderer.dispose(); },
  };
}

window.AutoSyncRaioX = { PARTS, BYID, CATS, ORDER, create };
})();
