import { useEffect, useRef } from "react";
import * as THREE from "three";

// WebGL brand backdrop that literally animates what AgentGuard does:
//
//   tool-call requests stream inward toward the agent (the core).  They hit the
//   firewall perimeter, where the policy is enforced in the request path:
//     - safe reads (teal) and in-budget money-movers (amber) pass through, reach
//       the agent, and are written as a new block on the hash-chained ledger.
//     - forbidden calls (red) are stopped dead at the perimeter, flash, and
//       dissipate -- they never reach the agent.
//   Every allowed verdict drops down and links onto the audit chain that
//   scrolls along the bottom: the tamper-evident flight recorder.
//
// Ambient and low-contrast on purpose: it reads as motion, not a toy.
export function Background() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    const COL = {
      safe: new THREE.Color(0x00e5a0),
      money: new THREE.Color(0xf5b54a),
      forbidden: new THREE.Color(0xff5470),
      dim: new THREE.Color(0x1f5e49),
    };

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(58, el.clientWidth / el.clientHeight, 0.1, 100);
    camera.position.z = 16;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(renderer.domElement);

    const RING_R = 4.7; // firewall perimeter radius
    const LEDGER_Y = -7.0;
    const LEFT_X = -12.5;
    const RIGHT_X = 11.0;
    const BLOCK_GAP = 1.7;

    // ---- faint depth field (the open, untrusted environment) ----
    const FN = 700;
    const fpos = new Float32Array(FN * 3);
    for (let i = 0; i < FN * 3; i++) fpos[i] = (Math.random() - 0.5) * 50;
    const fGeo = new THREE.BufferGeometry();
    fGeo.setAttribute("position", new THREE.BufferAttribute(fpos, 3));
    const fMat = new THREE.PointsMaterial({ color: 0x123c2e, size: 0.05, transparent: true, opacity: 0.5 });
    const field = new THREE.Points(fGeo, fMat);
    scene.add(field);

    // ---- the agent core (what we're protecting) ----
    const coreWire = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(1.35, 1)),
      new THREE.LineBasicMaterial({ color: 0x00e5a0, transparent: true, opacity: 0.5 })
    );
    scene.add(coreWire);
    const coreInner = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.3, 1),
      new THREE.MeshBasicMaterial({ color: 0x021a12, transparent: true, opacity: 0.6 })
    );
    scene.add(coreInner);
    let corePulse = 0;

    // ---- the firewall perimeter ----
    const ringPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      ringPts.push(new THREE.Vector3(Math.cos(a) * RING_R, Math.sin(a) * RING_R, 0));
    }
    const ringGeo = new THREE.BufferGeometry().setFromPoints(ringPts);
    const ringMat = new THREE.LineBasicMaterial({ color: 0x00e5a0, transparent: true, opacity: 0.22 });
    const ring = new THREE.LineLoop(ringGeo, ringMat);
    scene.add(ring);
    const ring2 = new THREE.LineLoop(ringGeo, new THREE.LineBasicMaterial({ color: 0x0a7f5e, transparent: true, opacity: 0.12 }));
    ring2.scale.setScalar(1.07);
    scene.add(ring2);

    // ---- request particles (tool calls flowing toward the agent) ----
    type Kind = "safe" | "money" | "forbidden";
    type Req = { active: boolean; kind: Kind; state: "in" | "blocked" | "done"; px: number; py: number; pz: number; dx: number; dy: number; speed: number; life: number };
    const CAP = reduce ? 60 : 130;
    const reqPos = new Float32Array(CAP * 3);
    const reqCol = new Float32Array(CAP * 3); // black == invisible under additive blending
    const reqGeo = new THREE.BufferGeometry();
    reqGeo.setAttribute("position", new THREE.BufferAttribute(reqPos, 3));
    reqGeo.setAttribute("color", new THREE.BufferAttribute(reqCol, 3));
    const reqMat = new THREE.PointsMaterial({ size: 0.16, vertexColors: true, transparent: true, opacity: 0.95, sizeAttenuation: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const reqs = new THREE.Points(reqGeo, reqMat);
    scene.add(reqs);
    const R: Req[] = Array.from({ length: CAP }, () => ({ active: false, kind: "safe", state: "in", px: 0, py: 0, pz: 0, dx: 0, dy: 0, speed: 0, life: 0 }));

    const setReqColor = (i: number, c: THREE.Color, k: number) => {
      reqCol[i * 3] = c.r * k;
      reqCol[i * 3 + 1] = c.g * k;
      reqCol[i * 3 + 2] = c.b * k;
    };

    const spawnReq = () => {
      const i = R.findIndex((r) => !r.active);
      if (i < 0) return;
      const r = Math.random();
      const kind: Kind = r < 0.66 ? "safe" : r < 0.86 ? "money" : "forbidden";
      const a = Math.random() * Math.PI * 2;
      const rad = 13.5 + Math.random() * 3;
      const px = Math.cos(a) * rad;
      const py = Math.sin(a) * rad;
      const len = Math.hypot(px, py) || 1;
      const o = R[i];
      o.active = true;
      o.kind = kind;
      o.state = "in";
      o.px = px;
      o.py = py;
      o.pz = (Math.random() - 0.5) * 2.4;
      o.dx = -px / len;
      o.dy = -py / len;
      o.speed = 3.6 + Math.random() * 2.4;
      o.life = 0;
    };

    // ---- blocked-at-the-wall impact flashes (pool) ----
    const impGeo = new THREE.RingGeometry(0.05, 0.16, 20);
    const IMP = 12;
    const impacts = Array.from({ length: IMP }, () => {
      const m = new THREE.Mesh(impGeo, new THREE.MeshBasicMaterial({ color: COL.forbidden, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      m.visible = false;
      scene.add(m);
      return { mesh: m, life: 0 };
    });
    const flashImpact = (x: number, y: number) => {
      const f = impacts.find((p) => p.life <= 0);
      if (!f) return;
      f.life = 0.55;
      f.mesh.visible = true;
      f.mesh.position.set(x, y, 0);
      f.mesh.scale.setScalar(1);
    };

    // ---- hash-chained ledger (the flight recorder) ----
    const blockEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(0.62, 0.62, 0.62));
    const POOL = 18;
    type Blk = { active: boolean; x: number; tx: number; y: number; glow: number; color: THREE.Color; mesh: THREE.LineSegments; mat: THREE.LineBasicMaterial };
    const blocks: Blk[] = Array.from({ length: POOL }, () => {
      const mat = new THREE.LineBasicMaterial({ color: 0x00e5a0, transparent: true, opacity: 0 });
      const mesh = new THREE.LineSegments(blockEdges, mat);
      mesh.visible = false;
      scene.add(mesh);
      return { active: false, x: 0, tx: 0, y: LEDGER_Y, glow: 0, color: COL.safe.clone(), mesh, mat };
    });
    const chain: Blk[] = []; // chronological order, oldest first

    // links between consecutive blocks
    const linkPos = new Float32Array(POOL * 2 * 3);
    const linkGeo = new THREE.BufferGeometry();
    linkGeo.setAttribute("position", new THREE.BufferAttribute(linkPos, 3));
    const linkMat = new THREE.LineBasicMaterial({ color: 0x0a7f5e, transparent: true, opacity: 0.4 });
    const links = new THREE.LineSegments(linkGeo, linkMat);
    scene.add(links);

    const appendBlock = (kind: Kind) => {
      // shift the existing chain left to make room for the new record
      for (const b of chain) b.tx -= BLOCK_GAP;
      // drop the oldest if it has scrolled past the edge or the pool is full
      while (chain.length && (chain[0].tx < LEFT_X || chain.length >= POOL - 1)) {
        const old = chain.shift()!;
        old.active = false;
        old.mesh.visible = false;
      }
      const b = blocks.find((x) => !x.active);
      if (!b) return;
      b.active = true;
      b.tx = RIGHT_X;
      b.y = LEDGER_Y;
      b.x = 0; // written from the agent core, animates out to its slot
      b.glow = 1;
      b.color.copy(kind === "money" ? COL.money : COL.safe);
      b.mesh.visible = true;
      b.mesh.position.set(b.x, b.y, 0);
      chain.push(b);
      corePulse = 1;
    };

    // ---- interaction: parallax ----
    let mx = 0;
    let my = 0;
    const onMove = (e: MouseEvent) => {
      mx = e.clientX / window.innerWidth - 0.5;
      my = e.clientY / window.innerHeight - 0.5;
    };
    if (!reduce) window.addEventListener("mousemove", onMove);

    const clock = new THREE.Clock();
    let raf = 0;
    let spawnAcc = 0;
    const spawnEvery = reduce ? 0.42 : 0.12;

    const tick = () => {
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;

      // spawn requests
      spawnAcc += dt;
      while (spawnAcc >= spawnEvery) {
        spawnAcc -= spawnEvery;
        spawnReq();
      }

      // update requests
      for (let i = 0; i < CAP; i++) {
        const o = R[i];
        if (!o.active) {
          setReqColor(i, COL.dim, 0); // invisible
          continue;
        }
        const base = o.kind === "safe" ? COL.safe : o.kind === "money" ? COL.money : COL.forbidden;
        if (o.state === "in") {
          o.px += o.dx * o.speed * dt;
          o.py += o.dy * o.speed * dt;
          o.pz += (0 - o.pz) * dt * 1.5;
          const r = Math.hypot(o.px, o.py);
          if (r <= RING_R) {
            if (o.kind === "forbidden") {
              o.state = "blocked";
              o.life = 0.5;
              // pin to the wall at the impact angle
              const a = Math.atan2(o.py, o.px);
              o.px = Math.cos(a) * RING_R;
              o.py = Math.sin(a) * RING_R;
              flashImpact(o.px, o.py);
            } else if (r <= 0.8) {
              o.state = "done";
              appendBlock(o.kind);
            }
          }
          setReqColor(i, base, 1);
        } else if (o.state === "blocked") {
          o.life -= dt;
          // small recoil off the wall
          const a = Math.atan2(o.py, o.px);
          o.px += Math.cos(a) * dt * 1.2;
          o.py += Math.sin(a) * dt * 1.2;
          const k = Math.max(0, o.life / 0.5);
          setReqColor(i, base, k * (0.6 + 0.4 * Math.sin(t * 40)));
          if (o.life <= 0) o.state = "done";
        }
        if (o.state === "done") {
          o.active = false;
          setReqColor(i, COL.dim, 0);
        }
        reqPos[i * 3] = o.px;
        reqPos[i * 3 + 1] = o.py;
        reqPos[i * 3 + 2] = o.pz;
      }
      reqGeo.attributes.position.needsUpdate = true;
      (reqGeo.attributes.color as THREE.BufferAttribute).needsUpdate = true;

      // update impact flashes
      for (const f of impacts) {
        if (f.life <= 0) continue;
        f.life -= dt;
        const k = Math.max(0, f.life / 0.55);
        f.mesh.scale.setScalar(1 + (1 - k) * 6);
        (f.mesh.material as THREE.MeshBasicMaterial).opacity = k * 0.7;
        if (f.life <= 0) f.mesh.visible = false;
      }

      // update ledger blocks
      let ln = 0;
      for (let i = 0; i < chain.length; i++) {
        const b = chain[i];
        b.x += (b.tx - b.x) * Math.min(1, dt * 6);
        b.y += (LEDGER_Y - b.y) * Math.min(1, dt * 6);
        b.glow = Math.max(0, b.glow - dt * 1.4);
        b.mesh.position.set(b.x, b.y, 0);
        b.mesh.rotation.y = t * 0.4 + i;
        b.mesh.rotation.x = t * 0.25;
        b.mat.color.copy(b.color).multiplyScalar(0.7 + b.glow * 0.8);
        b.mat.opacity = 0.4 + b.glow * 0.55;
        if (i > 0) {
          const p = chain[i - 1];
          linkPos[ln++] = p.x; linkPos[ln++] = p.y; linkPos[ln++] = 0;
          linkPos[ln++] = b.x; linkPos[ln++] = b.y; linkPos[ln++] = 0;
        }
      }
      linkGeo.setDrawRange(0, Math.max(0, (chain.length - 1) * 2));
      linkGeo.attributes.position.needsUpdate = true;

      // core
      corePulse = Math.max(0, corePulse - dt * 2.2);
      const s = 1 + corePulse * 0.22;
      coreWire.scale.setScalar(s);
      coreInner.scale.setScalar(s);
      coreWire.rotation.y = t * 0.25;
      coreWire.rotation.x = t * 0.15;
      coreInner.rotation.copy(coreWire.rotation);
      (coreWire.material as THREE.LineBasicMaterial).opacity = 0.45 + corePulse * 0.4;

      // firewall ring breathing
      ringMat.opacity = 0.2 + Math.sin(t * 1.3) * 0.05;

      // parallax
      field.rotation.y = t * 0.015;
      camera.position.x += (mx * 2.2 - camera.position.x) * 0.03;
      camera.position.y += (-my * 1.6 - camera.position.y) * 0.03;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    const onResize = () => {
      if (!el) return;
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize", onResize);
      scene.traverse((obj) => {
        const any = obj as THREE.Mesh;
        if (any.geometry) any.geometry.dispose();
        const m = (any as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else if (m) m.dispose();
      });
      blockEdges.dispose();
      impGeo.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={ref} className="bg3d" aria-hidden="true" />;
}
