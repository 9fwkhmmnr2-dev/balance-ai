"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

type VeraCore3DProps = {
  variant?: "violet" | "gold";
  className?: string;
  label?: string;
};

const vertexShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;
  uniform float uTime;
  float wave(vec3 p) {
    return sin(p.x * 5.4 + uTime * .72) * cos(p.y * 4.8 - uTime * .53)
      + sin(p.z * 6.2 + p.x * 2.1 + uTime * .38) * .42;
  }
  void main() {
    vUv = uv;
    vec3 p = position;
    float n = wave(normalize(position));
    p += normal * n * .035;
    vNormal = normalize(normalMatrix * normal);
    vPosition = (modelViewMatrix * vec4(p, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const fragmentShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorC;
  float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
  float noise(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
      mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
  }
  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(-vPosition);
    float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.4);
    float n = noise(normal * 5.5 + vec3(0.0, uTime * .12, uTime * .08));
    float flow = sin((vUv.x * 8.0 + vUv.y * 5.0 + n * 2.5) * 3.14159 + uTime * .85) * .5 + .5;
    float core = smoothstep(.82, .12, distance(vUv, vec2(.34,.29)));
    vec3 color = mix(uColorA, uColorB, clamp(n * .68 + flow * .25, 0.0, 1.0));
    color = mix(color, uColorC, fresnel * .82);
    color += uColorC * core * .34;
    float highlight = pow(max(dot(normal, normalize(vec3(-.45,.75,1.0))),0.0), 16.0);
    color += vec3(1.0) * highlight * .8;
    float alpha = .94 + fresnel * .06;
    gl_FragColor = vec4(color * (1.05 + flow * .12), alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export default function VeraCore3D({ variant = "violet", className = "", label = "Núcleo animado de VERA" }: VeraCore3DProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
    } catch {
      return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(width, height, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.domElement.setAttribute("aria-hidden", "true");
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, width / height, .1, 30);
    camera.position.z = 4.2;

    const gold = variant === "gold";
    const palette = gold
      ? { a: 0x8b6427, b: 0xe5bd70, c: 0xffe7b0, glow: 0xd7a94f }
      : { a: 0x45217d, b: 0xa987ff, c: 0xe9ddff, glow: 0x9c6cff };

    const coreGeometry = new THREE.SphereGeometry(1, 96, 72);
    const coreMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uColorA: { value: new THREE.Color(palette.a) },
        uColorB: { value: new THREE.Color(palette.b) },
        uColorC: { value: new THREE.Color(palette.c) },
      },
      transparent: true,
      depthWrite: true,
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    core.scale.set(1.0, 1.0, .92);
    scene.add(core);

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.12, 64, 48),
      new THREE.MeshBasicMaterial({ color: palette.glow, transparent: true, opacity: .095, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    scene.add(atmosphere);

    const rings: THREE.Mesh[] = [];
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.18 + i * .095, .006 + (i === 0 ? .002 : 0), 8, 140),
        new THREE.MeshBasicMaterial({ color: palette.c, transparent: true, opacity: .38 - i * .08, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      ring.rotation.set(.72 + i * .28, .2 + i * .54, -.45 + i * .36);
      ring.scale.set(1, .78, 1);
      scene.add(ring);
      rings.push(ring);
    }

    const particleCount = 90;
    const particlePositions = new Float32Array(particleCount * 3);
    const particlePhases = new Float32Array(particleCount);
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 1.18 + Math.random() * .65;
      particlePositions[i * 3] = Math.cos(angle) * radius;
      particlePositions[i * 3 + 1] = (Math.random() - .5) * 2.2;
      particlePositions[i * 3 + 2] = Math.sin(angle) * radius * .5;
      particlePhases[i] = Math.random() * Math.PI * 2;
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    const particleMaterial = new THREE.PointsMaterial({ color: palette.c, size: .018, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    const clock = new THREE.Clock();
    let frame = 0;
    let raf = 0;
    let disposed = false;
    const render = () => {
      if (disposed) return;
      const time = reducedMotion ? 0 : clock.getElapsedTime();
      coreMaterial.uniforms.uTime.value = time;
      core.rotation.set(Math.sin(time * .24) * .13, time * .12, Math.cos(time * .19) * .1);
      core.scale.set(1 + Math.sin(time * .9) * .025, 1 + Math.cos(time * .72) * .03, .92 + Math.sin(time * .8) * .02);
      atmosphere.scale.setScalar(1.08 + Math.sin(time * .8) * .035);
      rings.forEach((ring, index) => {
        ring.rotation.z += reducedMotion ? 0 : .0015 * (index % 2 ? -1 : 1);
        ring.rotation.x += reducedMotion ? 0 : .0008;
      });
      if (!reducedMotion) {
        const positions = particleGeometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < particleCount; i++) {
          const y = positions.getY(i) + Math.sin(time * .65 + particlePhases[i]) * .0009;
          positions.setY(i, y > 1.3 ? -1.3 : y < -1.3 ? 1.3 : y);
        }
        positions.needsUpdate = true;
      }
      renderer.render(scene, camera);
      if (!reducedMotion) raf = window.requestAnimationFrame(render);
    };
    render();

    const resizeObserver = new ResizeObserver(() => {
      if (!host.isConnected || disposed) return;
      const nextWidth = Math.max(1, host.clientWidth);
      const nextHeight = Math.max(1, host.clientHeight);
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(nextWidth, nextHeight, false);
    });
    resizeObserver.observe(host);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      coreGeometry.dispose();
      coreMaterial.dispose();
      atmosphere.geometry.dispose();
      (atmosphere.material as THREE.Material).dispose();
      rings.forEach((ring) => { ring.geometry.dispose(); (ring.material as THREE.Material).dispose(); });
      particleGeometry.dispose();
      particleMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [variant]);

  return <div ref={hostRef} className={`vera-core-3d ${className}`} role="img" aria-label={label}><span className="vera-core-fallback" aria-hidden="true" /></div>;
}
