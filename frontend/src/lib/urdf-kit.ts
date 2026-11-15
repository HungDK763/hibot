import * as THREE from 'three';

export interface UrdfVisual {
  xyz: [number, number, number];
  rpy: [number, number, number];
  geo: {
    type: 'mesh' | 'box' | 'cylinder' | 'sphere';
    filename?: string;
    scale?: [number, number, number];
    size?: [number, number, number];
    radius?: number;
    length?: number;
  } | null;
  rgba: [number, number, number, number] | null;
}

export interface UrdfLink {
  name: string;
  visuals: UrdfVisual[];
}

export interface UrdfJoint {
  name: string;
  type: string;
  parent: string | null;
  child: string | null;
  xyz: [number, number, number];
  rpy: [number, number, number];
  axis: [number, number, number];
  limit: {
    lower: number;
    upper: number;
    effort: number;
    velocity: number;
  } | null;
}

export interface ParsedUrdf {
  name: string;
  links: Record<string, UrdfLink>;
  joints: UrdfJoint[];
}

export interface MovableJoint {
  joint: UrdfJoint;
  group: THREE.Group;
  axis: THREE.Vector3;
}

export interface BuiltRobot {
  root: THREE.Group;
  movable: MovableJoint[];
  tip: THREE.Group;
  name: string;
  missingMesh: number;
  loadedMesh: number;
  meshTotal: number;
  linkCount: number;
  isCustom?: boolean;
}

export interface UrdfFileSystem {
  kind: string;
  name: string;
  list(): Promise<string[]>;
  getFile(path: string): Promise<File>;
  getText(path: string): Promise<string>;
  getBuffer(path: string): Promise<ArrayBuffer>;
}

export interface BuiltinArm {
  group: THREE.Group;
  joints: THREE.Group[];
  flange: THREE.Object3D;
  name: string;
}

// -----------------------------------------------------------------------------
// MÔ HÌNH ROBOT CÔNG NGHIỆP 6-DOF CHÍNH THỨC (HIBOT_ARM_6DOF)
// -----------------------------------------------------------------------------
export function buildBuiltinArm(): BuiltinArm {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({
    color: 0xcdd5d0,
    metalness: 0.55,
    roughness: 0.42
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x39433e,
    metalness: 0.5,
    roughness: 0.5
  });
  const accent = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#28ab67'),
    metalness: 0.25,
    roughness: 0.4
  });
  const white = new THREE.MeshStandardMaterial({
    color: 0xeef2f0,
    metalness: 0.2,
    roughness: 0.6
  });

  const ring = (r: number) =>
    new THREE.Mesh(new THREE.TorusGeometry(r, 0.07, 16, 40), accent);
  const cyl = (rt: number, rb: number, h: number, m: THREE.Material) =>
    new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 40), m);
  const box = (w: number, h: number, d: number, m: THREE.Material) =>
    new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);

  // Chân đế (Base)
  const base = cyl(1.0, 1.35, 0.5, dark);
  base.position.y = 0.25;
  g.add(base);

  const plate = cyl(0.95, 0.95, 0.12, metal);
  plate.position.y = 0.55;
  g.add(plate);

  // Khớp J1 (Base Rotation - xoay quanh trục Y)
  const j1 = new THREE.Group();
  j1.position.y = 0.6;
  g.add(j1);
  const h1 = cyl(0.8, 0.85, 0.7, metal);
  h1.position.y = 0.35;
  j1.add(h1);
  const r1 = ring(0.8);
  r1.position.y = 0.7;
  r1.rotation.x = Math.PI / 2;
  j1.add(r1);

  // Khớp J2 (Shoulder - vai, xoay quanh trục Z)
  const j2 = new THREE.Group();
  j2.position.y = 0.78;
  j1.add(j2);
  const sh = box(0.9, 0.7, 1.0, dark);
  j2.add(sh);
  const r2 = ring(0.5);
  r2.rotation.y = Math.PI / 2;
  j2.add(r2);
  const upper = box(0.55, 2.0, 0.62, metal);
  upper.position.y = 1.05;
  j2.add(upper);
  const upperStripe = box(0.58, 0.18, 0.66, accent);
  upperStripe.position.y = 1.82;
  j2.add(upperStripe);

  // Khớp J3 (Elbow - cùi chỏ, xoay quanh trục Z)
  const j3 = new THREE.Group();
  j3.position.y = 2.05;
  j2.add(j3);
  const el = box(0.7, 0.6, 0.8, dark);
  j3.add(el);
  const r3 = ring(0.42);
  r3.rotation.y = Math.PI / 2;
  j3.add(r3);
  const fore = box(0.42, 1.55, 0.48, metal);
  fore.position.y = 0.85;
  j3.add(fore);

  // Khớp J4 (Wrist 1 - cẳng tay xoay quanh trục Y)
  const j4 = new THREE.Group();
  j4.position.y = 1.55;
  j3.add(j4);
  const fr = cyl(0.3, 0.32, 0.6, white);
  fr.position.y = 0.3;
  j4.add(fr);
  const r4 = ring(0.3);
  r4.position.y = 0.55;
  r4.rotation.x = Math.PI / 2;
  j4.add(r4);

  // Khớp J5 (Wrist 2 - gập cổ tay quanh trục Z)
  const j5 = new THREE.Group();
  j5.position.y = 0.62;
  j4.add(j5);
  const wr = box(0.5, 0.42, 0.5, dark);
  j5.add(wr);
  const r5 = ring(0.26);
  r5.rotation.y = Math.PI / 2;
  j5.add(r5);

  // Khớp J6 (Wrist 3 - xoay mặt bích quanh trục Y)
  const j6 = new THREE.Group();
  j6.position.y = 0.34;
  j5.add(j6);
  const fl = cyl(0.28, 0.28, 0.16, accent);
  fl.position.y = 0.08;
  j6.add(fl);
  const flface = cyl(0.2, 0.2, 0.05, metal);
  flface.position.y = 0.18;
  j6.add(flface);
  const gb = box(0.34, 0.12, 0.34, dark);
  gb.position.y = 0.26;
  j6.add(gb);
  const f1 = box(0.06, 0.32, 0.12, metal);
  f1.position.set(0.12, 0.43, 0);
  j6.add(f1);
  const f2 = box(0.06, 0.32, 0.12, metal);
  f2.position.set(-0.12, 0.43, 0);
  j6.add(f2);

  // Flange TCP tip
  const flange = new THREE.Object3D();
  flange.position.y = 0.6;
  j6.add(flange);

  g.traverse((o: any) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  return {
    group: g,
    joints: [j1, j2, j3, j4, j5, j6],
    flange,
    name: 'hibot_arm_6dof'
  };
}

export function applyBuiltinArmAngles(arm: BuiltinArm, angles: number[]) {
  const rad = (d: number) => ((d || 0) * Math.PI) / 180;
  const j = arm.joints;
  const a = angles;
  if (j[0]) j[0].rotation.y = rad(a[0]);
  if (j[1]) j[1].rotation.z = -rad(a[1]);
  if (j[2]) j[2].rotation.z = -rad(a[2]);
  if (j[3]) j[3].rotation.y = rad(a[3]);
  if (j[4]) j[4].rotation.z = -rad(a[4]);
  if (j[5]) j[5].rotation.y = rad(a[5]);
}

// -----------------------------------------------------------------------------
// BỘ PHÂN TÍCH VÀ DỰNG ROBOT TỪ FILE URDF BÊN NGOÀI
// -----------------------------------------------------------------------------
export function parseSTL(buf: ArrayBuffer): THREE.BufferGeometry {
  const dv = new DataView(buf);
  let isBinary = false;
  if (buf.byteLength >= 84) {
    const n = dv.getUint32(80, true);
    if (n > 0 && 84 + n * 50 <= buf.byteLength) {
      isBinary = true;
    }
  }

  const geom = new THREE.BufferGeometry();
  if (isBinary) {
    const n = dv.getUint32(80, true);
    const pos = new Float32Array(n * 9);
    const nor = new Float32Array(n * 9);
    let o = 84;
    for (let i = 0; i < n; i++) {
      const nx = dv.getFloat32(o, true),
        ny = dv.getFloat32(o + 4, true),
        nz = dv.getFloat32(o + 8, true);
      o += 12;
      for (let v = 0; v < 3; v++) {
        const k = i * 9 + v * 3;
        pos[k] = dv.getFloat32(o, true);
        pos[k + 1] = dv.getFloat32(o + 4, true);
        pos[k + 2] = dv.getFloat32(o + 8, true);
        nor[k] = nx;
        nor[k + 1] = ny;
        nor[k + 2] = nz;
        o += 12;
      }
      o += 2;
    }
    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geom.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  } else {
    const txt = new TextDecoder().decode(buf);
    const verts: number[] = [];
    const re = /vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g;
    let m;
    while ((m = re.exec(txt))) {
      verts.push(+m[1], +m[2], +m[3]);
    }
    geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
  }
  geom.computeVertexNormals();
  geom.computeBoundingBox();
  geom.computeBoundingSphere();
  return geom;
}

const num = (s: string | null, d: number) => {
  if (!s) return d;
  const v = parseFloat(s);
  return isFinite(v) ? v : d;
};

function vec3(s: string | null, dx: number, dy: number, dz: number): [number, number, number] {
  if (!s) return [dx, dy, dz];
  const p = s.trim().split(/\s+/).map(Number);
  return [isFinite(p[0]) ? p[0] : dx, isFinite(p[1]) ? p[1] : dy, isFinite(p[2]) ? p[2] : dz];
}

function vec4(s: string | null): [number, number, number, number] | null {
  if (!s) return null;
  const p = s.trim().split(/\s+/).map(Number);
  return [p[0], p[1], p[2], p[3]];
}

export function parseURDF(text: string): ParsedUrdf {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('File URDF không hợp lệ (lỗi XML)');
  const robot = doc.querySelector('robot');
  if (!robot) throw new Error('Không có phần tử <robot> — có thể là Xacro chưa build');

  const links: Record<string, UrdfLink> = {};
  robot.querySelectorAll(':scope > link').forEach((l) => {
    const name = l.getAttribute('name') || '';
    const visuals: UrdfVisual[] = [];
    l.querySelectorAll(':scope > visual').forEach((v) => {
      const o = v.querySelector(':scope > origin');
      const xyz = vec3(o && o.getAttribute('xyz'), 0, 0, 0);
      const rpy = vec3(o && o.getAttribute('rpy'), 0, 0, 0);
      const g = v.querySelector(':scope > geometry');
      let geo: UrdfVisual['geo'] = null;
      if (g) {
        const mesh = g.querySelector('mesh'),
          box = g.querySelector('box'),
          cyl = g.querySelector('cylinder'),
          sph = g.querySelector('sphere');
        if (mesh)
          geo = {
            type: 'mesh',
            filename: mesh.getAttribute('filename') || undefined,
            scale: vec3(mesh.getAttribute('scale'), 1, 1, 1)
          };
        else if (box)
          geo = {
            type: 'box',
            size: vec3(box.getAttribute('size'), 0.1, 0.1, 0.1)
          };
        else if (cyl)
          geo = {
            type: 'cylinder',
            radius: num(cyl.getAttribute('radius'), 0.05),
            length: num(cyl.getAttribute('length'), 0.1)
          };
        else if (sph)
          geo = {
            type: 'sphere',
            radius: num(sph.getAttribute('radius'), 0.05)
          };
      }
      const mc = v.querySelector(':scope > material color');
      visuals.push({ xyz, rpy, geo, rgba: mc ? vec4(mc.getAttribute('rgba')) : null });
    });
    links[name] = { name, visuals };
  });

  const joints: UrdfJoint[] = [];
  robot.querySelectorAll(':scope > joint').forEach((j) => {
    const p = j.querySelector(':scope > parent'),
      c = j.querySelector(':scope > child');
    const o = j.querySelector(':scope > origin'),
      a = j.querySelector(':scope > axis'),
      lim = j.querySelector(':scope > limit');
    joints.push({
      name: j.getAttribute('name') || '',
      type: j.getAttribute('type') || 'fixed',
      parent: p ? p.getAttribute('link') : null,
      child: c ? c.getAttribute('link') : null,
      xyz: vec3(o && o.getAttribute('xyz'), 0, 0, 0),
      rpy: vec3(o && o.getAttribute('rpy'), 0, 0, 0),
      axis: vec3(a && a.getAttribute('xyz'), 1, 0, 0),
      limit: lim
        ? {
            lower: num(lim.getAttribute('lower'), -Math.PI),
            upper: num(lim.getAttribute('upper'), Math.PI),
            effort: num(lim.getAttribute('effort'), 50),
            velocity: num(lim.getAttribute('velocity'), 2)
          }
        : null
    });
  });
  return { name: robot.getAttribute('name') || 'robot', links, joints };
}

export function meshRel(filename?: string): string | null {
  if (!filename) return null;
  return filename
    .replace(/^package:\/\/[^/]+\//, '')
    .replace(/^model:\/\/[^/]+\//, '')
    .replace(/^file:\/\//, '')
    .replace(/^\.\//, '')
    .replace(/^(\.\.\/)+/, '');
}

export function setRpy(o: THREE.Object3D, rpy: [number, number, number]) {
  const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), rpy[0]);
  const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rpy[1]);
  const qz = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), rpy[2]);
  o.quaternion.copy(qz.multiply(qy).multiply(qx));
}

export async function buildRobot(
  parsed: ParsedUrdf,
  fs?: UrdfFileSystem,
  urdfPath?: string
): Promise<BuiltRobot> {
  const metal = new THREE.MeshStandardMaterial({
    color: 0xcdd5d0,
    metalness: 0.5,
    roughness: 0.45,
    side: THREE.DoubleSide
  });
  const darkMetal = new THREE.MeshStandardMaterial({
    color: 0x39433e,
    metalness: 0.5,
    roughness: 0.5,
    side: THREE.DoubleSide
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0x28ab67,
    metalness: 0.35,
    roughness: 0.4,
    side: THREE.DoubleSide
  });

  const root = new THREE.Group();
  const childSet = new Set(parsed.joints.map((j) => j.child));
  const rootLink =
    Object.keys(parsed.links).find((n) => !childSet.has(n)) || Object.keys(parsed.links)[0];
  const byParent: Record<string, UrdfJoint[]> = {};
  parsed.joints.forEach((j) => {
    if (j.parent) {
      (byParent[j.parent] = byParent[j.parent] || []).push(j);
    }
  });

  const movable: MovableJoint[] = [];
  let missingMesh = 0,
    loadedMesh = 0,
    meshTotal = 0;

  async function addVisuals(group: THREE.Group, linkName: string) {
    const link = parsed.links[linkName];
    if (!link) return;

    if (link.visuals.length === 0) {
      // Fallback liên kết hình trụ kim loại nếu link không định nghĩa visual
      const fallback = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.15, 24),
        metal.clone()
      );
      fallback.castShadow = true;
      group.add(fallback);
      return;
    }

    for (const v of link.visuals) {
      let mesh: THREE.Mesh | null = null;
      const mat = v.rgba
        ? new THREE.MeshStandardMaterial({
            color: new THREE.Color(v.rgba[0], v.rgba[1], v.rgba[2]),
            metalness: 0.45,
            roughness: 0.48,
            side: THREE.DoubleSide
          })
        : metal.clone();

      if (v.geo) {
        if (v.geo.type === 'mesh' && v.geo.filename) {
          meshTotal++;
          let buf: ArrayBuffer | null = null;

          // 1. Thử đọc từ fs trong trình duyệt nếu có
          if (fs) {
            try {
              const rel = meshRel(v.geo.filename);
              if (rel) {
                buf = await fs.getBuffer(rel);
              }
            } catch {
              // Bỏ qua để thử fallback backend
            }
          }

          // 2. Fallback: Gọi backend API (/api/robots/mesh)
          if (!buf && v.geo.filename) {
            try {
              const q = new URLSearchParams();
              q.set('path', v.geo.filename);
              if (urdfPath) q.set('urdf_path', urdfPath);
              const res = await fetch(`/api/robots/mesh?${q.toString()}`);
              if (res.ok) {
                buf = await res.arrayBuffer();
              }
            } catch (err) {
              console.warn('Backend fetch failed for mesh:', v.geo.filename, err);
            }
          }

          // 3. Phân tích STL và dựng mesh 3D
          if (buf) {
            try {
              const geom = parseSTL(buf);
              mesh = new THREE.Mesh(geom, mat);
              const sc = v.geo.scale || [1, 1, 1];
              mesh.scale.set(sc[0], sc[1], sc[2]);
              loadedMesh++;
            } catch (err) {
              console.error('Lỗi dựng 3D STL cho mesh:', v.geo.filename, err);
            }
          }

          if (!mesh) {
            missingMesh++;
            // Fallback khớp công nghiệp nếu STL thực sự không tìm thấy
            mesh = new THREE.Mesh(
              new THREE.CylinderGeometry(0.05, 0.055, 0.18, 24),
              accentMat.clone()
            );
          }
        } else if (v.geo.type === 'box' && v.geo.size) {
          mesh = new THREE.Mesh(
            new THREE.BoxGeometry(v.geo.size[0], v.geo.size[1], v.geo.size[2]),
            mat
          );
        } else if (v.geo.type === 'cylinder' && v.geo.radius !== undefined && v.geo.length !== undefined) {
          mesh = new THREE.Mesh(
            new THREE.CylinderGeometry(v.geo.radius, v.geo.radius, v.geo.length, 32),
            mat
          );
          mesh.rotation.x = Math.PI / 2;
        } else if (v.geo.type === 'sphere' && v.geo.radius !== undefined) {
          mesh = new THREE.Mesh(new THREE.SphereGeometry(v.geo.radius, 24, 16), mat);
        }
      }

      if (mesh) {
        const holder = new THREE.Group();
        holder.position.set(v.xyz[0], v.xyz[1], v.xyz[2]);
        setRpy(holder, v.rpy);
        holder.add(mesh);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(holder);
      }
    }
  }

  async function walk(linkName: string, parentGroup: THREE.Group) {
    await addVisuals(parentGroup, linkName);
    for (const j of byParent[linkName] || []) {
      const jg = new THREE.Group();
      jg.position.set(j.xyz[0], j.xyz[1], j.xyz[2]);
      setRpy(jg, j.rpy);
      parentGroup.add(jg);

      // Thêm vành nhẫn Torus đánh dấu vị trí khớp quay
      const jointRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.045, 0.008, 12, 24),
        darkMetal
      );
      jointRing.rotation.x = Math.PI / 2;
      jg.add(jointRing);

      const ag = new THREE.Group();
      jg.add(ag);
      if (j.type !== 'fixed') {
        movable.push({
          joint: j,
          group: ag,
          axis: new THREE.Vector3(j.axis[0], j.axis[1], j.axis[2]).normalize()
        });
      }
      if (j.child) {
        await walk(j.child, ag);
      }
    }
  }

  await walk(rootLink, root);
  root.rotation.x = -Math.PI / 2; // Z-up (URDF) sang Y-up (Three.js)
  root.updateMatrixWorld(true);
  const tip = movable.length ? movable[movable.length - 1].group : root;
  return {
    root,
    movable,
    tip,
    name: parsed.name,
    missingMesh,
    loadedMesh,
    meshTotal,
    linkCount: Object.keys(parsed.links).length,
    isCustom: true
  };
}

export function setJoint(m: MovableJoint, value: number) {
  if (m.joint.type === 'prismatic') {
    m.group.position.copy(m.axis.clone().multiplyScalar((value || 0) / 1000)); // mm -> m
  } else {
    m.group.quaternion.setFromAxisAngle(m.axis, ((value || 0) * Math.PI) / 180);
  }
}

export const SAMPLE3_URDF = `<?xml version="1.0"?>
<robot name="sample_gimbal_3dof">
  <link name="base_link">
    <visual>
      <origin xyz="0 0 0.08"/>
      <geometry><cylinder radius="0.3" length="0.16"/></geometry>
      <material color><color rgba="0.22 0.26 0.24 1"/></material>
    </visual>
  </link>
  <link name="yaw_link">
    <visual>
      <origin xyz="0 0 0.35"/>
      <geometry><cylinder radius="0.18" length="0.55"/></geometry>
      <material color><color rgba="0.16 0.67 0.4 1"/></material>
    </visual>
  </link>
  <link name="pitch_link">
    <visual>
      <origin xyz="0.35 0 0"/>
      <geometry><box size="0.8 0.22 0.22"/></geometry>
      <material color><color rgba="0.8 0.84 0.82 1"/></material>
    </visual>
  </link>
  <link name="roll_link">
    <visual>
      <origin xyz="0.28 0 0"/>
      <geometry><box size="0.55 0.15 0.15"/></geometry>
      <material color><color rgba="0.25 0.25 0.25 1"/></material>
    </visual>
  </link>
  <joint name="yaw" type="revolute">
    <parent link="base_link"/><child link="yaw_link"/>
    <origin xyz="0 0 0.16"/><axis xyz="0 0 1"/>
    <limit lower="-3.14" upper="3.14" effort="40" velocity="2"/>
  </joint>
  <joint name="pitch" type="revolute">
    <parent link="yaw_link"/><child link="pitch_link"/>
    <origin xyz="0 0 0.62"/><axis xyz="0 1 0"/>
    <limit lower="-1.57" upper="1.57" effort="35" velocity="2"/>
  </joint>
  <joint name="roll" type="revolute">
    <parent link="pitch_link"/><child link="roll_link"/>
    <origin xyz="0.75 0 0"/><axis xyz="1 0 0"/>
    <limit lower="-3.14" upper="3.14" effort="20" velocity="2"/>
  </joint>
</robot>`;

export function fsFromFileList(files: FileList | File[]): UrdfFileSystem {
  let root = '';
  const map: Record<string, File> = {};
  const arr = Array.isArray(files) ? files : Array.from(files);
  for (let i = 0; i < arr.length; i++) {
    const f = arr[i];
    const rp = f.webkitRelativePath || f.name;
    map[rp] = f;
    if (!root && f.webkitRelativePath) root = rp.split('/')[0];
  }
  const rel: Record<string, File> = {};
  for (const k in map) {
    const cleanKey = root && k.startsWith(root + '/') ? k.slice(root.length + 1) : k;
    rel[cleanKey] = map[k];
  }
  return {
    kind: 'filelist',
    name: root || 'custom_files',
    async list() {
      return Object.keys(rel);
    },
    _find(p: string) {
      if (!p) return null;
      let decoded = p;
      try {
        decoded = decodeURIComponent(p);
      } catch {}

      if (rel[p]) return rel[p];
      if (rel[decoded]) return rel[decoded];

      const lp = p.toLowerCase().trim();
      const ldec = decoded.toLowerCase().trim();
      const base = lp.split('/').pop()?.trim();
      const baseDec = ldec.split('/').pop()?.trim();

      // 1. Khớp chính xác hoặc khớp hậu tố đường dẫn
      let hit = Object.keys(rel).find((x) => {
        const lx = x.toLowerCase().trim();
        return lx === lp || lx === ldec || lx.endsWith('/' + lp) || lx.endsWith('/' + ldec);
      });

      // 2. Khớp theo tên file cơ sở (basename) bất kể thư mục
      if (!hit && (base || baseDec)) {
        hit = Object.keys(rel).find((x) => {
          const bx = x.toLowerCase().split('/').pop()?.trim();
          return bx === base || bx === baseDec;
        });
      }

      return hit ? rel[hit] : null;
    },
    async getFile(p: string) {
      const f = (this as any)._find(p);
      if (!f) throw new Error('Không thấy: ' + p);
      return f;
    },
    async getText(p: string) {
      return (await this.getFile(p)).text();
    },
    async getBuffer(p: string) {
      return (await this.getFile(p)).arrayBuffer();
    }
  } as any;
}
