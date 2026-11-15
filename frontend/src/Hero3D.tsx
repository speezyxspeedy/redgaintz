import { useEffect, useRef } from "react";
import * as THREE from "three";

const D2R = Math.PI / 180;
const NAGPUR = { lat: 21.1458, lon: 79.0882 };
const TEX = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.1.1&LAYERS=BlueMarble_NextGeneration&STYLES=&SRS=EPSG:4326&BBOX=-180,-90,180,90&WIDTH=2048&HEIGHT=1024&FORMAT=image/jpeg";

/** Same mapping three.js uses for SphereGeometry UVs, so lines and the texture line up. */
const toVec = (lat: number, lon: number, r = 1) => {
  const phi = (lon + 180) * D2R, th = (90 - lat) * D2R;
  return new THREE.Vector3(-r * Math.cos(phi) * Math.sin(th), r * Math.cos(th), r * Math.sin(phi) * Math.sin(th));
};

export default function Hero3D() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0, 4.6);

    const tilt = new THREE.Group();
    const globe = new THREE.Group();
    tilt.add(globe);
    scene.add(tilt);
    const v = toVec(NAGPUR.lat, NAGPUR.lon);
    const faceIndia = Math.atan2(-v.x, v.z);
    tilt.rotation.x = 0.3;

    // Planet: ocean-blue until the NASA Blue Marble texture arrives (or if it never does).
    const mat = new THREE.MeshPhongMaterial({ color: 0x0f3a5c, shininess: 12, specular: 0x14324a });
    globe.add(new THREE.Mesh(new THREE.SphereGeometry(1, 96, 96), mat));
    new THREE.TextureLoader().setCrossOrigin("anonymous").load(TEX, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      mat.map = t; mat.color.set(0xffffff); mat.needsUpdate = true;
    });

    // Graticule every 30°, so the globe still reads as a globe without imagery.
    const gp: number[] = [];
    for (let lat = -60; lat <= 60; lat += 30) for (let lon = -180; lon < 180; lon += 3) { const a = toVec(lat, lon, 1.002), b = toVec(lat, lon + 3, 1.002); gp.push(a.x, a.y, a.z, b.x, b.y, b.z); }
    for (let lon = -180; lon < 180; lon += 30) for (let lat = -87; lat < 87; lat += 3) { const a = toVec(lat, lon, 1.002), b = toVec(lat + 3, lon, 1.002); gp.push(a.x, a.y, a.z, b.x, b.y, b.z); }
    const gg = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(gp, 3));
    globe.add(new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: 0xbfe3f2, transparent: true, opacity: 0.12 })));

    // Vidarbha district outlines from the app's own boundary file.
    const outline = new THREE.Group();
    globe.add(outline);
    fetch(`${import.meta.env.BASE_URL}boundaries/IN-MH-VID.display.geojson`).then((r) => r.json()).then((gj) => {
      const m = new THREE.LineBasicMaterial({ color: 0xff8a1f });
      for (const f of gj.features ?? []) {
        const polys = f.geometry?.type === "Polygon" ? [f.geometry.coordinates] : f.geometry?.type === "MultiPolygon" ? f.geometry.coordinates : [];
        for (const poly of polys) for (const ring of poly) outline.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ring.map(([lo, la]: number[]) => toVec(la, lo, 1.004))), m));
      }
    }).catch(() => {});

    // Pulse on Nagpur.
    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.012, 16, 16), new THREE.MeshBasicMaterial({ color: 0xff8a1f }));
    pin.position.copy(toVec(NAGPUR.lat, NAGPUR.lon, 1.008));
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.02, 0.026, 48), new THREE.MeshBasicMaterial({ color: 0xff8a1f, transparent: true, side: THREE.DoubleSide }));
    ring.position.copy(pin.position); ring.lookAt(pin.position.clone().multiplyScalar(2));
    globe.add(pin, ring);

    // Atmosphere rim (back-face fresnel glow).
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.14, 64, 64), new THREE.ShaderMaterial({
      transparent: true, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false,
      vertexShader: "varying vec3 n;void main(){n=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader: "varying vec3 n;void main(){float i=pow(.72-dot(n,vec3(0,0,1.)),3.);gl_FragColor=vec4(.35,.70,.95,1.)*i;}",
    }));
    scene.add(atmo);

    // Stars
    const sp: number[] = [];
    for (let i = 0; i < 1400; i++) { const p = new THREE.Vector3().randomDirection().multiplyScalar(30 + Math.random() * 20); sp.push(p.x, p.y, p.z); }
    scene.add(new THREE.Points(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(sp, 3)), new THREE.PointsMaterial({ color: 0xdfeaf2, size: 0.09, sizeAttenuation: true, transparent: true, opacity: 0.7 })));

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const sun = new THREE.DirectionalLight(0xfff1dd, 2.4); sun.position.set(-3, 1.5, 4); scene.add(sun);

    let drag = 0, spin = 0, down = false, lastX = 0;
    const onDown = (e: PointerEvent) => { down = true; lastX = e.clientX; };
    const onMove = (e: PointerEvent) => { if (!down) return; drag += (e.clientX - lastX) * 0.006; lastX = e.clientX; };
    const onUp = () => { down = false; };
    el.addEventListener("pointerdown", onDown); window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp);

    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      renderer.setSize(w, h); camera.aspect = w / h;
      const wide = w / h > 1.15;
      camera.position.z = wide ? 4.4 : 5.6;
      tilt.position.set(wide ? 1.05 : 0, wide ? 0 : -0.55, 0); atmo.position.copy(tilt.position);
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(el);

    let raf = 0, visible = true, t0 = performance.now();
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }); io.observe(el);
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible) return;
      const t = (now - t0) / 1000;
      if (!reduce && !down) spin += 0.0012;
      globe.rotation.y = faceIndia + 0.55 + drag + spin - (reduce ? 0.55 : Math.min(t / 2.2, 1) * 0.55);
      const k = (t % 2.4) / 2.4;
      ring.scale.setScalar(1 + k * 3.2); (ring.material as THREE.MeshBasicMaterial).opacity = 1 - k;
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
      el.removeEventListener("pointerdown", onDown); window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp);
      scene.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose?.(); const mm = m.material as THREE.Material | undefined; mm?.dispose?.(); });
      mat.map?.dispose(); renderer.dispose(); renderer.domElement.remove();
    };
  }, []);

  return <div className="hero3d-canvas" ref={host} role="img" aria-label="3D Earth, rotating to Vidarbha in central India. Drag to spin." />;
}
