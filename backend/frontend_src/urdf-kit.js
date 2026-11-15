/* ============================================================================
   URDFKit — đọc & dựng robot từ URDF cho HiBot Control Desk
   - parseURDF(text)            : XML -> {name, links, joints}
   - fsFromHandle(dirHandle)    : truy cập file qua File System Access API
   - fsFromFileList(fileList)   : truy cập file qua <input webkitdirectory>
   - buildRobot(THREE,parsed,fs): dựng cây động học three.js (+ nạp STL)
   - setJoint(movable, value)   : đặt góc (độ) / vị trí (mm) cho 1 khớp
   - saveRecent/listRecents/removeRecent : thư mục mở gần đây (IndexedDB)
   Không phụ thuộc framework. Gắn vào window.URDFKit.
============================================================================ */
window.URDFKit = (function () {
  "use strict";

  /* ---------------- Recents (IndexedDB, lưu directory handle) ------------- */
  const DB = "vd_urdf_recents", STORE = "recents";
  function idb() {
    return new Promise((res, rej) => {
      let r;
      try { r = indexedDB.open(DB, 1); } catch (e) { return rej(e); }
      r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "id" });
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  async function saveRecent(rec) {
    try {
      const db = await idb();
      await new Promise((res, rej) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(rec);
        tx.oncomplete = res; tx.onerror = () => rej(tx.error);
      });
    } catch (e) { /* IndexedDB không khả dụng -> bỏ qua */ }
  }
  async function listRecents() {
    try {
      const db = await idb();
      return await new Promise((res) => {
        const tx = db.transaction(STORE, "readonly");
        const rq = tx.objectStore(STORE).getAll();
        rq.onsuccess = () => res((rq.result || []).sort((a, b) => b.ts - a.ts));
        rq.onerror = () => res([]);
      });
    } catch (e) { return []; }
  }
  async function removeRecent(id) {
    try {
      const db = await idb();
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
    } catch (e) { /* bỏ qua */ }
  }

  /* ---------------- Truy cập file trong thư mục dự án --------------------- */
  function fsFromHandle(dir) {
    return {
      kind: "handle", name: dir.name, handle: dir,
      async list() {
        const out = [];
        async function walk(d, prefix) {
          for await (const [n, h] of d.entries()) {
            const p = prefix ? prefix + "/" + n : n;
            if (h.kind === "directory") await walk(h, p); else out.push(p);
          }
        }
        await walk(dir, "");
        return out;
      },
      async _fh(rel) {
        const parts = rel.split("/").filter(Boolean);
        let d = dir;
        try {
          for (let i = 0; i < parts.length - 1; i++) d = await d.getDirectoryHandle(parts[i]);
          return await d.getFileHandle(parts[parts.length - 1]);
        } catch (e) {
          // fallback không phân biệt hoa/thường
          const all = await this.list();
          const lp = rel.toLowerCase(), base = lp.split("/").pop();
          let hit = all.find(x => x.toLowerCase() === lp || x.toLowerCase().endsWith("/" + lp));
          if (!hit) hit = all.find(x => x.toLowerCase().split("/").pop() === base);
          if (!hit) throw e;
          const p2 = hit.split("/").filter(Boolean);
          let d2 = dir;
          for (let i = 0; i < p2.length - 1; i++) d2 = await d2.getDirectoryHandle(p2[i]);
          return d2.getFileHandle(p2[p2.length - 1]);
        }
      },
      async getFile(rel) { return (await this._fh(rel)).getFile(); },
      async getText(rel) { return (await this.getFile(rel)).text(); },
      async getBuffer(rel) { return (await this.getFile(rel)).arrayBuffer(); }
    };
  }
  function fsFromFileList(files) {
    let root = "";
    const map = {};
    for (const f of files) {
      const rp = f.webkitRelativePath || f.name;
      map[rp] = f; if (!root) root = rp.split("/")[0];
    }
    const rel = {};
    for (const k in map) rel[k.startsWith(root + "/") ? k.slice(root.length + 1) : k] = map[k];
    return {
      kind: "filelist", name: root, _map: rel,
      async list() { return Object.keys(rel); },
      _find(p) {
        if (rel[p]) return rel[p];
        const lp = p.toLowerCase(), base = lp.split("/").pop();
        let k = Object.keys(rel).find(x => x.toLowerCase() === lp || x.toLowerCase().endsWith("/" + lp));
        if (!k) k = Object.keys(rel).find(x => x.toLowerCase().split("/").pop() === base);
        return k ? rel[k] : null;
      },
      async getFile(p) { const f = this._find(p); if (!f) throw new Error("Không thấy: " + p); return f; },
      async getText(p) { return (await this.getFile(p)).text(); },
      async getBuffer(p) { return (await this.getFile(p)).arrayBuffer(); }
    };
  }

  /* ---------------- Parse URDF (XML) ------------------------------------- */
  const num = (s, d) => { const v = parseFloat(s); return isFinite(v) ? v : d; };
  function vec3(s, dx, dy, dz) {
    if (!s) return [dx, dy, dz];
    const p = s.trim().split(/\s+/).map(Number);
    return [isFinite(p[0]) ? p[0] : dx, isFinite(p[1]) ? p[1] : dy, isFinite(p[2]) ? p[2] : dz];
  }
  function vec4(s) { if (!s) return null; const p = s.trim().split(/\s+/).map(Number); return [p[0], p[1], p[2], p[3]]; }

  /* ---------------- Đọc STL (tự parse, không cần THREE.STLLoader) --------- */
  function parseSTL(buf, THREE) {
    const dv = new DataView(buf);
    // Heuristic nhị phân: 84 + 50*n === độ dài file
    let isBinary = false;
    if (buf.byteLength >= 84) {
      const n = dv.getUint32(80, true);
      if (84 + n * 50 === buf.byteLength) isBinary = true;
    }
    const geom = new THREE.BufferGeometry();
    if (isBinary) {
      const n = dv.getUint32(80, true);
      const pos = new Float32Array(n * 9);
      const nor = new Float32Array(n * 9);
      let o = 84;
      for (let i = 0; i < n; i++) {
        const nx = dv.getFloat32(o, true), ny = dv.getFloat32(o + 4, true), nz = dv.getFloat32(o + 8, true);
        o += 12;
        for (let v = 0; v < 3; v++) {
          const k = i * 9 + v * 3;
          pos[k] = dv.getFloat32(o, true); pos[k + 1] = dv.getFloat32(o + 4, true); pos[k + 2] = dv.getFloat32(o + 8, true);
          nor[k] = nx; nor[k + 1] = ny; nor[k + 2] = nz;
          o += 12;
        }
        o += 2; // attribute byte count
      }
      geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geom.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    } else {
      const txt = new TextDecoder().decode(buf);
      const verts = [];
      const re = /vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g;
      let m;
      while ((m = re.exec(txt))) { verts.push(+m[1], +m[2], +m[3]); }
      geom.setAttribute("position", new THREE.BufferAttribute(new Float32Array(verts), 3));
      geom.computeVertexNormals();
    }
    return geom;
  }

  function parseURDF(text) {
    const doc = new DOMParser().parseFromString(text, "application/xml");
    if (doc.querySelector("parsererror")) throw new Error("File URDF không hợp lệ (lỗi XML)");
    const robot = doc.querySelector("robot");
    if (!robot) throw new Error("Không có phần tử <robot> — có thể là Xacro chưa build");

    const links = {};
    robot.querySelectorAll(":scope > link").forEach(l => {
      const name = l.getAttribute("name");
      const visuals = [];
      l.querySelectorAll(":scope > visual").forEach(v => {
        const o = v.querySelector(":scope > origin");
        const xyz = vec3(o && o.getAttribute("xyz"), 0, 0, 0);
        const rpy = vec3(o && o.getAttribute("rpy"), 0, 0, 0);
        const g = v.querySelector(":scope > geometry");
        let geo = null;
        if (g) {
          const mesh = g.querySelector("mesh"), box = g.querySelector("box"),
                cyl = g.querySelector("cylinder"), sph = g.querySelector("sphere");
          if (mesh) geo = { type: "mesh", filename: mesh.getAttribute("filename"), scale: vec3(mesh.getAttribute("scale"), 1, 1, 1) };
          else if (box) geo = { type: "box", size: vec3(box.getAttribute("size"), 0.1, 0.1, 0.1) };
          else if (cyl) geo = { type: "cylinder", radius: num(cyl.getAttribute("radius"), 0.05), length: num(cyl.getAttribute("length"), 0.1) };
          else if (sph) geo = { type: "sphere", radius: num(sph.getAttribute("radius"), 0.05) };
        }
        const mc = v.querySelector(":scope > material color");
        visuals.push({ xyz, rpy, geo, rgba: mc ? vec4(mc.getAttribute("rgba")) : null });
      });
      links[name] = { name, visuals };
    });

    const joints = [];
    robot.querySelectorAll(":scope > joint").forEach(j => {
      const p = j.querySelector(":scope > parent"), c = j.querySelector(":scope > child");
      const o = j.querySelector(":scope > origin"), a = j.querySelector(":scope > axis"),
            lim = j.querySelector(":scope > limit");
      joints.push({
        name: j.getAttribute("name"),
        type: j.getAttribute("type"),
        parent: p ? p.getAttribute("link") : null,
        child: c ? c.getAttribute("link") : null,
        xyz: vec3(o && o.getAttribute("xyz"), 0, 0, 0),
        rpy: vec3(o && o.getAttribute("rpy"), 0, 0, 0),
        axis: vec3(a && a.getAttribute("xyz"), 1, 0, 0),
        limit: lim ? {
          lower: num(lim.getAttribute("lower"), -Math.PI),
          upper: num(lim.getAttribute("upper"), Math.PI),
          effort: num(lim.getAttribute("effort"), 50),
          velocity: num(lim.getAttribute("velocity"), 2)
        } : null
      });
    });
    return { name: robot.getAttribute("name") || "robot", links, joints };
  }

  /* ---------------- Xây robot three.js ----------------------------------- */
  function meshRel(filename) {
    if (!filename) return null;
    return filename
      .replace(/^package:\/\/[^/]+\//, "")
      .replace(/^model:\/\/[^/]+\//, "")
      .replace(/^file:\/\//, "")
      .replace(/^\.\//, "")
      .replace(/^(\.\.\/)+/, "");
  }
  function setRpy(THREE, o, rpy) {
    // URDF rpy = xoay cố định trục X->Y->Z  ⇒  R = Rz(y)·Ry(p)·Rx(r)
    const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), rpy[0]);
    const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rpy[1]);
    const qz = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), rpy[2]);
    o.quaternion.copy(qz.multiply(qy).multiply(qx));
  }

  async function buildRobot(THREE, parsed, fs, opts) {
    opts = opts || {};
    const metal = new THREE.MeshStandardMaterial({ color: 0xcdd5d0, metalness: 0.45, roughness: 0.5 });
    const root = new THREE.Group();

    const childSet = new Set(parsed.joints.map(j => j.child));
    const rootLink = Object.keys(parsed.links).find(n => !childSet.has(n)) || Object.keys(parsed.links)[0];
    const byParent = {};
    parsed.joints.forEach(j => { (byParent[j.parent] = byParent[j.parent] || []).push(j); });
    const movable = [];
    let missingMesh = 0, loadedMesh = 0, meshTotal = 0;

    async function addVisuals(group, linkName) {
      const link = parsed.links[linkName];
      if (!link) return;
      for (const v of link.visuals) {
        let mesh = null;
        const mat = v.rgba
          ? new THREE.MeshStandardMaterial({ color: new THREE.Color(v.rgba[0], v.rgba[1], v.rgba[2]), metalness: 0.35, roughness: 0.55 })
          : metal.clone();
        if (v.geo) {
          if (v.geo.type === "mesh") {
            meshTotal++;
            try {
              const buf = await fs.getBuffer(meshRel(v.geo.filename));
              const geom = parseSTL(buf, THREE);
              mesh = new THREE.Mesh(geom, mat);
              mesh.scale.set(v.geo.scale[0], v.geo.scale[1], v.geo.scale[2]);
              loadedMesh++;
            } catch (e) {
              missingMesh++;
              mesh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05),
                new THREE.MeshStandardMaterial({ color: 0xd98c2b, metalness: 0.2, roughness: 0.7 }));
            }
          } else if (v.geo.type === "box") {
            mesh = new THREE.Mesh(new THREE.BoxGeometry(v.geo.size[0], v.geo.size[1], v.geo.size[2]), mat);
          } else if (v.geo.type === "cylinder") {
            mesh = new THREE.Mesh(new THREE.CylinderGeometry(v.geo.radius, v.geo.radius, v.geo.length, 32), mat);
            mesh.rotation.x = Math.PI / 2; // trục URDF = Z, three = Y
          } else if (v.geo.type === "sphere") {
            mesh = new THREE.Mesh(new THREE.SphereGeometry(v.geo.radius, 24, 16), mat);
          }
        }
        if (mesh) {
          const holder = new THREE.Group();
          holder.position.set(v.xyz[0], v.xyz[1], v.xyz[2]);
          setRpy(THREE, holder, v.rpy);
          holder.add(mesh);
          mesh.castShadow = true; mesh.receiveShadow = true;
          group.add(holder);
        }
      }
    }
    async function walk(linkName, parentGroup) {
      await addVisuals(parentGroup, linkName);
      for (const j of (byParent[linkName] || [])) {
        const jg = new THREE.Group();
        jg.position.set(j.xyz[0], j.xyz[1], j.xyz[2]);
        setRpy(THREE, jg, j.rpy);
        parentGroup.add(jg);
        const ag = new THREE.Group(); jg.add(ag);
        if (j.type !== "fixed") movable.push({ joint: j, group: ag, axis: new THREE.Vector3(j.axis[0], j.axis[1], j.axis[2]).normalize() });
        await walk(j.child, ag);
      }
    }
    await walk(rootLink, root);
    root.rotation.x = -Math.PI / 2; // Z-up (URDF) -> Y-up (three)
    root.updateMatrixWorld(true);
    const tip = movable.length ? movable[movable.length - 1].group : root;
    return { root, movable, tip, name: parsed.name, missingMesh, loadedMesh, meshTotal, linkCount: Object.keys(parsed.links).length };
  }

  function setJoint(m, value) {
    if (m.joint.type === "prismatic") {
      m.group.position.copy(m.axis.clone().multiplyScalar(value / 1000)); // mm -> m
    } else {
      m.group.quaternion.setFromAxisAngle(m.axis, value * Math.PI / 180);
    }
  }

  return { parseURDF, fsFromHandle, fsFromFileList, buildRobot, setJoint, meshRel, saveRecent, listRecents, removeRecent };
})();
