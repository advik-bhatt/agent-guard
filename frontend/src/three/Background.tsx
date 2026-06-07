import { useEffect, useRef } from "react";
import * as THREE from "three";

// WebGL brand backdrop: a slowly rotating wireframe "core" (the guarded perimeter)
// inside a drifting field of agents, with subtle parallax. Tasteful, not a toy.
export function Background() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(58, el.clientWidth / el.clientHeight, 0.1, 100);
    camera.position.z = 15;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(renderer.domElement);

    // Drifting agent field
    const N = 1600;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N * 3; i++) pos[i] = (Math.random() - 0.5) * 46;
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const pMat = new THREE.PointsMaterial({ color: 0x1f5e49, size: 0.055, transparent: true, opacity: 0.55 });
    const field = new THREE.Points(pGeo, pMat);
    scene.add(field);

    // Guarded core
    const ico = new THREE.IcosahedronGeometry(5.4, 1);
    const wire = new THREE.WireframeGeometry(ico);
    const cMat = new THREE.LineBasicMaterial({ color: 0x00e5a0, transparent: true, opacity: 0.22 });
    const core = new THREE.LineSegments(wire, cMat);
    scene.add(core);

    const inner = new THREE.Mesh(
      new THREE.IcosahedronGeometry(5.4, 1),
      new THREE.MeshBasicMaterial({ color: 0x021a12, transparent: true, opacity: 0.35 })
    );
    scene.add(inner);

    let mx = 0;
    let my = 0;
    const onMove = (e: MouseEvent) => {
      mx = e.clientX / window.innerWidth - 0.5;
      my = e.clientY / window.innerHeight - 0.5;
    };
    window.addEventListener("mousemove", onMove);

    const clock = new THREE.Clock();
    let raf = 0;
    const tick = () => {
      const t = clock.getElapsedTime();
      core.rotation.y = t * 0.1 + mx * 0.5;
      core.rotation.x = t * 0.045 + my * 0.4;
      inner.rotation.copy(core.rotation);
      field.rotation.y = t * 0.018;
      camera.position.x += (mx * 2.4 - camera.position.x) * 0.03;
      camera.position.y += (-my * 2.4 - camera.position.y) * 0.03;
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
      pGeo.dispose();
      pMat.dispose();
      wire.dispose();
      cMat.dispose();
      ico.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={ref} className="bg3d" aria-hidden="true" />;
}
