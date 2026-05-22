/* ============================================================================
 * APERTURE — WebGL hero scene for Upper Capital (concept 03/04)
 * ----------------------------------------------------------------------------
 * A cinematic, "looking into deep space" composition. A set of concentric
 * geometric rings (the aperture / iris) sits at the center of a dust-lit
 * volumetric field. Mouse parallax, scroll-linked depth, restrained bloom.
 *
 * Exported API:
 *   initAperture(container) -> { setScrollProgress(t), dispose() }
 *
 * The constants below are the design knobs. Touch these first — everything
 * else in this file flows from them. Comments explain the *why* on tricky
 * bits; obvious code is left uncommented intentionally.
 * ========================================================================= */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

/* ---------- TWEAKABLE CONSTANTS ----------------------------------------- */

// Palette — keep these in sync with the brand brief. Cyan + violet are
// *accent* tones; the dominant mass of the scene is deep blue/black.
const COLOR_DEEP_VOID    = 0x05060f; // outermost background
const COLOR_MIDNIGHT     = 0x0a0e1f; // mid-radius background
const COLOR_INK_PURPLE   = 0x181534; // inner vignette
const COLOR_CYAN         = 0x4fe3ff; // primary ring edge glow
const COLOR_VIOLET       = 0x7c5cff; // secondary ring glow / rim light
const COLOR_WARM_SPARK   = 0xffb066; // sparing highlight, used on innermost ring

// Central form — concentric rings (the "aperture"). More rings = denser look,
// but each one is a draw call, so keep this modest.
const RING_COUNT         = 6;
const RING_INNER_RADIUS  = 1.15;     // radius of the smallest ring
const RING_RADIUS_STEP   = 0.55;     // spacing between rings
const RING_THICKNESS     = 0.018;    // tube thickness — thin reads as premium
const RING_Z_SPREAD      = 0.45;     // how far rings stagger along z
const RING_BASE_SPIN     = 0.04;     // base rotation rad/sec (slow + meditative)
const RING_BREATHE_AMT   = 0.018;    // sine-driven scale wobble amplitude
const RING_BREATHE_SPEED = 0.45;     // breath cycles per second-ish

// Particle field — "dust suspended in light", not stars. Varied size + alpha.
const PARTICLE_COUNT_DESKTOP = 3200;
const PARTICLE_COUNT_MOBILE  = 1500;
const PARTICLE_FIELD_RADIUS  = 38;   // spherical shell radius around origin
const PARTICLE_DRIFT_SPEED   = 0.06; // base units/sec drift magnitude
const PARTICLE_SIZE_MIN      = 0.04;
const PARTICLE_SIZE_MAX      = 0.32;
const PARTICLE_TWINKLE_RATIO = 0.18; // fraction of particles that twinkle

// Camera
const CAMERA_FOV             = 56;
const CAMERA_Z_START         = 10;
const CAMERA_Z_END           = 7;    // scroll progress 1.0 dollies forward
const CAMERA_TILT_X          = 0.03; // max rad rotation from mouse Y
const CAMERA_TILT_Y          = 0.05; // max rad rotation from mouse X
const CAMERA_LERP            = 0.045;// how snappy mouse follow feels

// Mouse parallax on particle field — moves opposite to mouse, gentle.
const PARALLAX_STRENGTH      = 3.0;
const PARALLAX_LERP          = 0.04;

// Bloom — keep restrained. Glow should *imply* light, not blow out edges.
const BLOOM_STRENGTH         = 0.62;
const BLOOM_RADIUS           = 0.85;
const BLOOM_THRESHOLD        = 0.18;

// Scroll-linked behavior
const SCROLL_FORM_SCALE      = 1.15; // form scales 1 -> SCROLL_FORM_SCALE
const SCROLL_SPIN_BOOST      = 3.0;  // rotation multiplier at t=1
const SCROLL_DRIFT_BOOST     = 2.2;  // particle drift multiplier at t=1

/* ---------- PUBLIC ENTRY ------------------------------------------------ */

export function initAperture(container) {
    const isMobile = window.innerWidth < 768;
    const particleCount = isMobile ? PARTICLE_COUNT_MOBILE : PARTICLE_COUNT_DESKTOP;
    const useBloom = !isMobile;

    /* ----- renderer ----- */
    const renderer = new THREE.WebGLRenderer({
        antialias: !isMobile,
        alpha: false,
        powerPreference: 'high-performance',
        stencil: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);

    /* ----- scene + camera ----- */
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
        CAMERA_FOV,
        container.clientWidth / container.clientHeight,
        0.1,
        200
    );
    camera.position.set(0, 0, CAMERA_Z_START);
    camera.lookAt(0, 0, 0);

    /* ----- subtle exponential fog deepens the well ----- */
    // Density tuned so the rings stay legible but the particle field
    // reads as receding into haze rather than uniformly lit.
    scene.fog = new THREE.FogExp2(COLOR_DEEP_VOID, 0.022);

    /* ----- background gradient (fullscreen quad with shader) ----- */
    const background = createBackgroundQuad();
    scene.add(background.mesh);

    /* ----- central form: concentric rings ----- */
    const ringGroup = buildRingAssembly();
    scene.add(ringGroup.group);

    /* ----- soft "iris" disc behind the rings to anchor the center ----- */
    const irisDisc = createIrisDisc();
    scene.add(irisDisc.mesh);

    /* ----- particle dust field ----- */
    const particles = createParticleField(particleCount);
    scene.add(particles.points);

    /* ----- lighting ----- */
    // Cool key light from upper-front-left.
    const keyLight = new THREE.DirectionalLight(0xcfe3ff, 1.1);
    keyLight.position.set(-3, 4, 6);
    scene.add(keyLight);

    // Warm/violet rim from behind-below, gives the central form edge bloom.
    const rimLight = new THREE.DirectionalLight(COLOR_VIOLET, 1.4);
    rimLight.position.set(0, -2, -5);
    scene.add(rimLight);

    // Very low ambient so we don't crush blacks completely.
    scene.add(new THREE.AmbientLight(0x1a2040, 0.25));

    /* ----- post-processing ----- */
    const composer = new EffectComposer(renderer);
    composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    composer.setSize(container.clientWidth, container.clientHeight);
    composer.addPass(new RenderPass(scene, camera));

    let bloomPass = null;
    let aberrationPass = null;

    if (useBloom) {
        bloomPass = new UnrealBloomPass(
            new THREE.Vector2(container.clientWidth, container.clientHeight),
            BLOOM_STRENGTH,
            BLOOM_RADIUS,
            BLOOM_THRESHOLD
        );
        composer.addPass(bloomPass);

        // Cheap chromatic aberration applied after bloom. Strength is tiny —
        // we want a hint of "lens" not a glitch effect.
        aberrationPass = new ShaderPass(buildChromaticAberrationShader());
        aberrationPass.uniforms.uStrength.value = 0.0018;
        composer.addPass(aberrationPass);
    }

    /* ----- interaction state ----- */
    const mouseTarget = { x: 0, y: 0 };
    const mouseEased  = { x: 0, y: 0 };
    let scrollProgress = 0; // 0..1, externally driven

    function onPointerMove(e) {
        const rect = renderer.domElement.getBoundingClientRect();
        mouseTarget.x = ((e.clientX - rect.left) / rect.width)  * 2 - 1;
        mouseTarget.y = ((e.clientY - rect.top)  / rect.height) * 2 - 1;
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    /* ----- resize ----- */
    function onResize() {
        const w = container.clientWidth;
        const h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        composer.setSize(w, h);
        if (bloomPass) bloomPass.setSize(w, h);
        background.material.uniforms.uResolution.value.set(w, h);
    }
    window.addEventListener('resize', onResize);

    /* ----- animation loop ----- */
    const clock = new THREE.Clock();
    let rafId = null;
    let disposed = false;

    function tick() {
        if (disposed) return;
        const dt = Math.min(clock.getDelta(), 0.05); // clamp dt to avoid jumps on tab return
        const t  = clock.getElapsedTime();

        // Ease mouse toward target.
        mouseEased.x += (mouseTarget.x - mouseEased.x) * CAMERA_LERP;
        mouseEased.y += (mouseTarget.y - mouseEased.y) * CAMERA_LERP;

        // Camera dolly from scroll, tilt from mouse.
        camera.position.z = CAMERA_Z_START + (CAMERA_Z_END - CAMERA_Z_START) * scrollProgress;
        camera.rotation.y = -mouseEased.x * CAMERA_TILT_Y;
        camera.rotation.x = -mouseEased.y * CAMERA_TILT_X;

        // Rings: counter-rotation + breathing + scroll-driven scale.
        ringGroup.update(dt, t, scrollProgress);

        // Iris disc gently pulses its alpha with the breath.
        irisDisc.material.uniforms.uTime.value = t;
        irisDisc.material.uniforms.uScroll.value = scrollProgress;

        // Particles: drift + twinkle + parallax. Parallax is applied as a
        // group-level offset so we don't have to touch every vertex.
        particles.update(dt, t, scrollProgress, mouseEased);

        // Background shader time tick (for grain animation).
        background.material.uniforms.uTime.value = t;

        composer.render();
        rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);

    /* ----- public methods ----- */
    function setScrollProgress(t) {
        scrollProgress = Math.max(0, Math.min(1, t));
    }

    function dispose() {
        disposed = true;
        if (rafId) cancelAnimationFrame(rafId);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('resize', onResize);

        scene.traverse((obj) => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
                mats.forEach((m) => {
                    Object.values(m).forEach((v) => {
                        if (v && v.isTexture) v.dispose();
                    });
                    m.dispose();
                });
            }
        });

        if (bloomPass) bloomPass.dispose && bloomPass.dispose();
        composer.renderTarget1.dispose();
        composer.renderTarget2.dispose();
        renderer.dispose();

        if (renderer.domElement.parentNode === container) {
            container.removeChild(renderer.domElement);
        }
    }

    return { setScrollProgress, dispose };
}

/* ---------- BACKGROUND QUAD --------------------------------------------- */
// A fullscreen triangle (cheaper than a quad, single-tri trick) rendered
// behind everything. Renders a radial gradient + animated grain so the
// background never bands or looks flat. The shader uses NDC directly so
// the camera can move without disturbing it.

function createBackgroundQuad() {
    const geometry = new THREE.BufferGeometry();
    // Single oversized triangle covers the whole viewport in NDC.
    const verts = new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]);
    geometry.setAttribute('position', new THREE.BufferAttribute(verts, 3));

    const material = new THREE.ShaderMaterial({
        uniforms: {
            uTime:       { value: 0 },
            uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
            uDeepVoid:   { value: new THREE.Color(COLOR_DEEP_VOID) },
            uMidnight:   { value: new THREE.Color(COLOR_MIDNIGHT) },
            uInkPurple:  { value: new THREE.Color(COLOR_INK_PURPLE) },
        },
        vertexShader: /* glsl */`
            void main() {
                // Pass through in clip space, force depth to far plane.
                gl_Position = vec4(position.xy, 1.0, 1.0);
            }
        `,
        fragmentShader: /* glsl */`
            precision highp float;
            uniform float uTime;
            uniform vec2  uResolution;
            uniform vec3  uDeepVoid;
            uniform vec3  uMidnight;
            uniform vec3  uInkPurple;

            // Cheap hash, used for film grain. No expensive noise needed.
            float hash(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
            }

            void main() {
                vec2 uv = gl_FragCoord.xy / uResolution.xy;
                vec2 centered = uv - 0.5;
                centered.x *= uResolution.x / uResolution.y;
                float d = length(centered);

                // Three-stop radial gradient: ink-purple core -> midnight -> deep void.
                vec3 col = mix(uInkPurple, uMidnight, smoothstep(0.05, 0.45, d));
                col = mix(col, uDeepVoid, smoothstep(0.4, 0.95, d));

                // Soft vignette darkening at the corners.
                col *= 1.0 - smoothstep(0.55, 1.15, d) * 0.5;

                // Animated grain breaks up banding on dark gradients.
                float g = hash(gl_FragCoord.xy + fract(uTime) * 100.0);
                col += (g - 0.5) * 0.018;

                gl_FragColor = vec4(col, 1.0);
            }
        `,
        depthTest: false,
        depthWrite: false,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = -1000;
    return { mesh, material };
}

/* ---------- IRIS DISC --------------------------------------------------- */
// A faint glowing disc sitting just behind the rings. Gives the center of
// the aperture a sense of "something is there" without it being a literal
// light source. Pure shader, additive blend.

function createIrisDisc() {
    const geometry = new THREE.PlaneGeometry(6, 6, 1, 1);
    const material = new THREE.ShaderMaterial({
        uniforms: {
            uTime:   { value: 0 },
            uScroll: { value: 0 },
            uCyan:   { value: new THREE.Color(COLOR_CYAN) },
            uViolet: { value: new THREE.Color(COLOR_VIOLET) },
        },
        vertexShader: /* glsl */`
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: /* glsl */`
            precision highp float;
            varying vec2 vUv;
            uniform float uTime;
            uniform float uScroll;
            uniform vec3  uCyan;
            uniform vec3  uViolet;

            void main() {
                vec2 p = vUv - 0.5;
                float d = length(p);

                // Two-tone falloff: violet outer halo blending into a cyan core.
                float core = exp(-d * 14.0);
                float halo = exp(-d * 5.5) * 0.6;

                // Slow breath, slightly amplified by scroll progress.
                float breath = 0.85 + 0.15 * sin(uTime * 0.55);
                float intensity = (core + halo) * breath * (0.75 + uScroll * 0.35);

                vec3 col = mix(uViolet, uCyan, smoothstep(0.0, 0.25, 1.0 - d));
                gl_FragColor = vec4(col * intensity, intensity);

                // Hard cut beyond the disc radius to avoid square artifacts.
                if (d > 0.5) discard;
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.z = -0.3;
    return { mesh, material };
}

/* ---------- RING ASSEMBLY ----------------------------------------------- */
// Each ring is a TorusGeometry — cheap, thin, low segment count is fine
// because they're small on screen. Each gets its own MeshStandardMaterial
// with subtle emissive so bloom can latch onto the edges. Per-ring axis
// and speed give the assembly a "mechanism" feel without being literal.

function buildRingAssembly() {
    const group = new THREE.Group();
    const rings = [];

    const cyan   = new THREE.Color(COLOR_CYAN);
    const violet = new THREE.Color(COLOR_VIOLET);
    const warm   = new THREE.Color(COLOR_WARM_SPARK);

    for (let i = 0; i < RING_COUNT; i++) {
        const radius = RING_INNER_RADIUS + i * RING_RADIUS_STEP;

        // Innermost ring picks up the warm spark; the rest oscillate
        // along the cyan-violet axis. Mixing per-ring gives the whole
        // assembly a subtle color story.
        const mix = i / (RING_COUNT - 1);
        const baseColor = (i === 0)
            ? warm.clone().lerp(cyan, 0.25)
            : cyan.clone().lerp(violet, mix);

        const geom = new THREE.TorusGeometry(radius, RING_THICKNESS, 8, 128);
        const mat = new THREE.MeshStandardMaterial({
            color: 0x0a0e1f,           // body stays dark; the edge does the talking
            emissive: baseColor,
            emissiveIntensity: 1.35,
            roughness: 0.35,
            metalness: 0.55,
            toneMapped: true,
        });

        const mesh = new THREE.Mesh(geom, mat);

        // Stagger Z so the rings don't all sit in the same plane —
        // creates parallax inside the form itself.
        mesh.position.z = (i - (RING_COUNT - 1) / 2) * (RING_Z_SPREAD / RING_COUNT);

        // Each ring tilts on a slightly different axis. Pseudo-random but
        // seeded by index so the layout is stable across reloads.
        const tilt = (i * 1.7) % Math.PI;
        mesh.rotation.x = Math.sin(tilt) * 0.55;
        mesh.rotation.y = Math.cos(tilt) * 0.35;

        rings.push({
            mesh,
            // Counter-rotating speeds. Alternating sign on i gives the
            // mechanism look.
            spinAxis: pickSpinAxis(i),
            spinSpeed: RING_BASE_SPIN * (1 + i * 0.18) * (i % 2 === 0 ? 1 : -1),
            breathPhase: i * 0.7,
            baseScale: 1.0,
        });
        group.add(mesh);
    }

    function update(dt, t, scroll) {
        const spinMul = 1 + scroll * (SCROLL_SPIN_BOOST - 1);
        const scrollScale = 1 + scroll * (SCROLL_FORM_SCALE - 1);
        for (const r of rings) {
            // Rotate around the ring's chosen axis.
            const s = r.spinSpeed * spinMul * dt;
            r.mesh.rotateOnAxis(r.spinAxis, s);

            // Breath: tiny scale wobble so the assembly never feels static.
            const breath = 1 + Math.sin(t * RING_BREATHE_SPEED + r.breathPhase) * RING_BREATHE_AMT;
            const scl = r.baseScale * breath * scrollScale;
            r.mesh.scale.setScalar(scl);
        }
        // The whole assembly drifts very slowly on Z so it feels alive
        // even when nothing else moves.
        group.rotation.z = Math.sin(t * 0.07) * 0.05;
    }

    return { group, update };
}

function pickSpinAxis(i) {
    // Six stable axes that look like deliberate design choices.
    const axes = [
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(0.2, 0.1, 1).normalize(),
        new THREE.Vector3(-0.15, 0.2, 1).normalize(),
        new THREE.Vector3(0.05, -0.25, 1).normalize(),
        new THREE.Vector3(-0.1, -0.05, 1).normalize(),
        new THREE.Vector3(0.25, 0.15, 1).normalize(),
    ];
    return axes[i % axes.length];
}

/* ---------- PARTICLE FIELD ---------------------------------------------- */
// Custom ShaderMaterial on a Points object. We bake per-particle drift
// vectors, base size, twinkle phase, and color tint into BufferAttributes
// and let the vertex shader handle all motion. This keeps the JS loop
// O(1) regardless of particle count.

function createParticleField(count) {
    const positions = new Float32Array(count * 3);
    const drifts    = new Float32Array(count * 3); // per-particle velocity direction
    const sizes     = new Float32Array(count);
    const phases    = new Float32Array(count);     // twinkle phase
    const tints     = new Float32Array(count * 3); // per-particle subtle color shift
    const seeds     = new Float32Array(count);     // 0 or 1 flag for "is twinkler"

    const cyan   = new THREE.Color(COLOR_CYAN);
    const violet = new THREE.Color(COLOR_VIOLET);
    const warm   = new THREE.Color(COLOR_WARM_SPARK);

    for (let i = 0; i < count; i++) {
        // Distribute in a spherical shell — uniform on the sphere surface
        // then jittered radially. This avoids the "clumpy at poles" bug
        // you get from naive (theta, phi) sampling.
        const u = Math.random();
        const v = Math.random();
        const theta = 2 * Math.PI * u;
        const phi   = Math.acos(2 * v - 1);
        // Pull radius from a soft distribution so most dust sits in a
        // mid-distance band — close ones add scale, far ones add depth.
        const radius = PARTICLE_FIELD_RADIUS * (0.25 + Math.pow(Math.random(), 0.7) * 0.75);

        positions[i * 3 + 0] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = radius * Math.cos(phi);

        // Random small drift direction, normalized.
        const dx = (Math.random() - 0.5);
        const dy = (Math.random() - 0.5);
        const dz = (Math.random() - 0.5);
        const dl = Math.hypot(dx, dy, dz) || 1;
        drifts[i * 3 + 0] = dx / dl;
        drifts[i * 3 + 1] = dy / dl;
        drifts[i * 3 + 2] = dz / dl;

        // Size: heavy tail. Most dust is tiny, a few are larger highlights.
        const sizeRand = Math.pow(Math.random(), 3.2);
        sizes[i] = PARTICLE_SIZE_MIN + sizeRand * (PARTICLE_SIZE_MAX - PARTICLE_SIZE_MIN);

        phases[i] = Math.random() * Math.PI * 2;
        seeds[i]  = Math.random() < PARTICLE_TWINKLE_RATIO ? 1.0 : 0.0;

        // Subtle per-particle tint: bias most toward cool, a few toward warm.
        // Avoids the "uniform white starfield" look.
        const tintRoll = Math.random();
        let c;
        if (tintRoll < 0.05) {
            c = warm.clone().lerp(new THREE.Color(0xffffff), 0.3);
        } else if (tintRoll < 0.55) {
            c = cyan.clone().lerp(new THREE.Color(0xffffff), 0.55);
        } else {
            c = violet.clone().lerp(new THREE.Color(0xc8d8ff), 0.5);
        }
        tints[i * 3 + 0] = c.r;
        tints[i * 3 + 1] = c.g;
        tints[i * 3 + 2] = c.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position',   new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aDrift',     new THREE.BufferAttribute(drifts, 3));
    geometry.setAttribute('aSize',      new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aPhase',     new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('aTint',      new THREE.BufferAttribute(tints, 3));
    geometry.setAttribute('aTwinkler',  new THREE.BufferAttribute(seeds, 1));

    const material = new THREE.ShaderMaterial({
        uniforms: {
            uTime:        { value: 0 },
            uDriftSpeed:  { value: PARTICLE_DRIFT_SPEED },
            uPixelRatio:  { value: Math.min(window.devicePixelRatio, 2) },
        },
        vertexShader: /* glsl */`
            attribute vec3  aDrift;
            attribute float aSize;
            attribute float aPhase;
            attribute vec3  aTint;
            attribute float aTwinkler;

            uniform float uTime;
            uniform float uDriftSpeed;
            uniform float uPixelRatio;

            varying vec3  vTint;
            varying float vTwinkle;

            void main() {
                // Drift each particle along its baked direction, then wrap
                // gently using a sine so it never escapes its neighborhood.
                vec3 pos = position + aDrift * sin(uTime * uDriftSpeed + aPhase * 1.3) * 1.2;

                vec4 mv = modelViewMatrix * vec4(pos, 1.0);
                gl_Position = projectionMatrix * mv;

                // Size attenuated by distance so far particles don't dominate.
                // The 90.0 factor was eyeballed against the camera FOV.
                gl_PointSize = aSize * uPixelRatio * (90.0 / -mv.z);

                // Twinkle: only for flagged particles. Otherwise alpha is steady.
                float tw = 1.0;
                if (aTwinkler > 0.5) {
                    tw = 0.55 + 0.45 * sin(uTime * 2.4 + aPhase * 4.0);
                }
                vTwinkle = tw;
                vTint    = aTint;
            }
        `,
        fragmentShader: /* glsl */`
            precision mediump float;
            varying vec3  vTint;
            varying float vTwinkle;

            void main() {
                // Soft circular sprite — distance from center of point quad.
                vec2 c = gl_PointCoord - 0.5;
                float d = length(c);

                // Two-stop falloff: tight bright core + wider gentle halo.
                float core = smoothstep(0.5, 0.05, d);
                float halo = smoothstep(0.5, 0.2, d) * 0.5;
                float alpha = (core + halo) * vTwinkle;

                if (alpha < 0.01) discard;

                // Slight bias toward white in the core for a "sparkle" feel.
                vec3 col = mix(vTint, vec3(1.0), core * 0.35);
                gl_FragColor = vec4(col, alpha);
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });

    const points = new THREE.Points(geometry, material);

    // Parallax is implemented as a group-level offset, eased over time.
    const parallaxOffset = new THREE.Vector3();
    const parallaxTarget = new THREE.Vector3();

    function update(dt, t, scroll, mouseEased) {
        material.uniforms.uTime.value = t * (1 + scroll * (SCROLL_DRIFT_BOOST - 1));

        // Mouse parallax: field moves opposite to cursor.
        parallaxTarget.set(
            -mouseEased.x * PARALLAX_STRENGTH,
            -mouseEased.y * PARALLAX_STRENGTH,
            0
        );
        parallaxOffset.lerp(parallaxTarget, PARALLAX_LERP);
        points.position.copy(parallaxOffset);
    }

    return { points, update };
}

/* ---------- CHROMATIC ABERRATION SHADER --------------------------------- */
// A very subtle radial RGB split. The strength uniform is tiny — we want
// a hint of "lens" not a glitch. Cheap: 3 texture taps per fragment.

function buildChromaticAberrationShader() {
    return {
        uniforms: {
            tDiffuse:  { value: null },
            uStrength: { value: 0.002 },
        },
        vertexShader: /* glsl */`
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: /* glsl */`
            precision mediump float;
            uniform sampler2D tDiffuse;
            uniform float uStrength;
            varying vec2 vUv;

            void main() {
                vec2 dir = vUv - 0.5;
                // Squared falloff: no aberration in the center, grows toward edges.
                float falloff = dot(dir, dir);
                vec2 offset = dir * uStrength * falloff * 6.0;

                float r = texture2D(tDiffuse, vUv + offset).r;
                float g = texture2D(tDiffuse, vUv).g;
                float b = texture2D(tDiffuse, vUv - offset).b;
                gl_FragColor = vec4(r, g, b, 1.0);
            }
        `,
    };
}
