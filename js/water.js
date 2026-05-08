/* ============================================================
 * Hero water ripples — WebGL, procedural background.
 *
 * Renders a canvas under the hero text that reproduces the
 * Tailwind bg-gradient-to-br gradient (primary → secondary →
 * accent) and distorts it with a 2D wave simulation. The
 * height field lives in a ping-pong FBO; pointer move/click
 * inject drops; the render shader samples the procedural
 * background through the height-field gradient and adds a
 * little specular for sparkle.
 *
 * Graceful: if WebGL or float textures are missing, or if the
 * user prefers reduced motion, the canvas isn't added and the
 * native CSS gradient on the section stays as-is.
 * ============================================================ */
(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', function () {
        var hero = document.querySelector('section.relative.overflow-hidden');
        if (!hero) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        // Desktop / pointer-fine devices only. The v_uv-based sampling stretches
        // ripples to the canvas aspect, which reads as "tilted lake" on wide
        // viewports but as squashed/vertical ovals on phones — not what we want.
        // Skip on touch-primary devices entirely.
        if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
        try { initWater(hero); } catch (e) { /* fail silently */ }
    });

    function initWater(host) {
        var canvas = document.createElement('canvas');
        canvas.setAttribute('aria-hidden', 'true');
        // z-index: 5 puts the canvas ABOVE the hero content (which sits in
        // .relative children with auto z-index). mix-blend-mode: screen makes
        // only the bright specular crests visible — calm water is fully
        // transparent and the DOM underneath stays interactive and readable.
        canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:5;mix-blend-mode:screen;';
        host.appendChild(canvas);

        var gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true })
              || canvas.getContext('experimental-webgl', { alpha: true, antialias: false, premultipliedAlpha: true });
        if (!gl) { canvas.remove(); return; }

        // Need to write floating-point heights into FBO color attachments
        var halfExt = gl.getExtension('OES_texture_half_float');
        var halfLinearExt = gl.getExtension('OES_texture_half_float_linear');
        var floatExt = gl.getExtension('OES_texture_float');
        var floatLinearExt = gl.getExtension('OES_texture_float_linear');

        var TEX_TYPE, TEX_TYPE_NAME;
        if (halfExt) { TEX_TYPE = halfExt.HALF_FLOAT_OES; TEX_TYPE_NAME = 'half'; }
        else if (floatExt) { TEX_TYPE = gl.FLOAT; TEX_TYPE_NAME = 'float'; }
        else { canvas.remove(); return; }

        var SIM_RES = 256;       // height-map grid resolution (square)
        var DAMPING = 0.987;     // amplitude decay per step — lower = waves die quicker (calmer)
        // Tighter drops + slower wave speed (set in update shader) = crisp, slow ripples
        var DROP_RADIUS_MOVE = 0.018;
        var DROP_RADIUS_CLICK = 0.035;
        var DROP_STR_MOVE = 0.012;
        var DROP_STR_CLICK = 0.06;
        var MOVE_THROTTLE_MS = 80;

        var fullscreenVS = '\n' +
            'attribute vec2 a_pos;\n' +
            'varying vec2 v_uv;\n' +
            'void main() {\n' +
            '  v_uv = a_pos * 0.5 + 0.5;\n' +
            '  gl_Position = vec4(a_pos, 0.0, 1.0);\n' +
            '}\n';

        // Update: leapfrog wave eq on a 5-point stencil.
        // r channel = current height, g channel = previous (carried frame-to-frame).
        // Edge damping zone simulates an "infinite" surface: amplitude is bled out
        // in the outer ~20% so reflections off the canvas border are imperceptible.
        var updateFS = '\n' +
            'precision highp float;\n' +
            'uniform sampler2D u_curr;\n' +
            'uniform vec2 u_texel;\n' +
            'uniform float u_damping;\n' +
            'varying vec2 v_uv;\n' +
            'void main() {\n' +
            '  vec2 t = u_texel;\n' +
            '  float c = texture2D(u_curr, v_uv).r;\n' +
            '  float p = texture2D(u_curr, v_uv).g;\n' +
            '  float l = texture2D(u_curr, v_uv - vec2(t.x, 0.0)).r;\n' +
            '  float r = texture2D(u_curr, v_uv + vec2(t.x, 0.0)).r;\n' +
            '  float u = texture2D(u_curr, v_uv - vec2(0.0, t.y)).r;\n' +
            '  float d = texture2D(u_curr, v_uv + vec2(0.0, t.y)).r;\n' +
            '  // Wave eq with CFL coefficient α=0.3 (was 0.5). Lower α = slower\n' +
            '  // propagation. Stable while α ≤ 0.5.\n' +
            '  float n = 0.8 * c + 0.3 * (l + r + u + d) - p;\n' +
            '  // Distance to nearest edge in [0, 0.5]\n' +
            '  float edgeDist = min(min(v_uv.x, 1.0 - v_uv.x), min(v_uv.y, 1.0 - v_uv.y));\n' +
            '  // 1.0 inside, smoothly decays to 0.85 at the very edge\n' +
            '  float edgeFalloff = smoothstep(0.0, 0.2, edgeDist);\n' +
            '  float damp = mix(0.85, u_damping, edgeFalloff);\n' +
            '  n *= damp;\n' +
            '  gl_FragColor = vec4(n, c, 0.0, 1.0);\n' +
            '}\n';

        // Drop: add a smooth bump centered at u_center with radius u_radius
        var dropFS = '\n' +
            'precision highp float;\n' +
            'uniform sampler2D u_curr;\n' +
            'uniform vec2 u_center;\n' +
            'uniform float u_radius;\n' +
            'uniform float u_strength;\n' +
            'varying vec2 v_uv;\n' +
            'void main() {\n' +
            '  vec4 c = texture2D(u_curr, v_uv);\n' +
            '  float d = distance(v_uv, u_center) / max(u_radius, 1e-4);\n' +
            '  float bump = (1.0 - smoothstep(0.0, 1.0, d)) * u_strength;\n' +
            '  c.r += bump;\n' +
            '  gl_FragColor = c;\n' +
            '}\n';

        // Render: transparent overlay that emits only specular highlights from
        // the wave surface. The DOM under the canvas is the actual hero content;
        // mix-blend-mode: screen on the canvas adds these highlights on top.
        // Premultiplied alpha so the canvas composites cleanly with the page.
        var renderFS = '\n' +
            'precision highp float;\n' +
            'uniform sampler2D u_height;\n' +
            'uniform vec2 u_texel;\n' +
            'varying vec2 v_uv;\n' +
            'void main() {\n' +
            '  float hl = texture2D(u_height, v_uv - vec2(u_texel.x, 0.0)).r;\n' +
            '  float hr = texture2D(u_height, v_uv + vec2(u_texel.x, 0.0)).r;\n' +
            '  float hu = texture2D(u_height, v_uv - vec2(0.0, u_texel.y)).r;\n' +
            '  float hd = texture2D(u_height, v_uv + vec2(0.0, u_texel.y)).r;\n' +
            '  vec2 slope = vec2(hr - hl, hd - hu);\n' +
            '  vec3 normal = normalize(vec3(-slope * 110.0, 1.0));\n' +
            '  vec3 lightDir = normalize(vec3(-0.4, -0.4, 1.0));\n' +
            '  float spec = pow(max(0.0, dot(normal, lightDir)), 22.0);\n' +
            '  float mag = length(slope);\n' +
            '  float a = clamp(spec * 0.7 + mag * 1.2, 0.0, 0.95);\n' +
            '  vec3 tint = vec3(0.92, 0.97, 1.0);\n' +
            '  gl_FragColor = vec4(tint * a, a);\n' +
            '}\n';

        function compile(type, src) {
            var s = gl.createShader(type);
            gl.shaderSource(s, src);
            gl.compileShader(s);
            if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
                throw new Error('Shader compile: ' + gl.getShaderInfoLog(s));
            }
            return s;
        }
        function program(vs, fs) {
            var p = gl.createProgram();
            gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
            gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
            gl.linkProgram(p);
            if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
                throw new Error('Program link: ' + gl.getProgramInfoLog(p));
            }
            return p;
        }
        var progUpdate = program(fullscreenVS, updateFS);
        var progDrop   = program(fullscreenVS, dropFS);
        var progRender = program(fullscreenVS, renderFS);

        // Fullscreen triangle strip
        var quad = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, quad);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1,  1, -1,  -1, 1,  1, 1]), gl.STATIC_DRAW);

        function bindQuad(prog) {
            gl.useProgram(prog);
            var loc = gl.getAttribLocation(prog, 'a_pos');
            gl.bindBuffer(gl.ARRAY_BUFFER, quad);
            gl.enableVertexAttribArray(loc);
            gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        }

        // Two ping-pong textures + framebuffers for the height field
        function makeSimTarget() {
            var tex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, SIM_RES, SIM_RES, 0, gl.RGBA, TEX_TYPE, null);
            // CLAMP avoids waves wrapping at borders (visible as straight echoes)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            // Linear if supported, else nearest
            var canLinear = (TEX_TYPE_NAME === 'half' && halfLinearExt) ||
                            (TEX_TYPE_NAME === 'float' && floatLinearExt);
            var filter = canLinear ? gl.LINEAR : gl.NEAREST;
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);

            var fb = gl.createFramebuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
            var status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
            if (status !== gl.FRAMEBUFFER_COMPLETE) throw new Error('FBO incomplete: ' + status);
            return { tex: tex, fb: fb };
        }
        var bufA = makeSimTarget();
        var bufB = makeSimTarget();
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        var simTexel = [1.0 / SIM_RES, 1.0 / SIM_RES];

        // Resize canvas backing store to its CSS size (capped DPR)
        function resize() {
            var dpr = Math.min(window.devicePixelRatio || 1, 2);
            var w = Math.max(1, Math.round(canvas.clientWidth * dpr));
            var h = Math.max(1, Math.round(canvas.clientHeight * dpr));
            if (canvas.width !== w || canvas.height !== h) {
                canvas.width = w;
                canvas.height = h;
            }
        }
        resize();
        window.addEventListener('resize', resize);

        // -------- Pointer events: drops --------
        var pendingDrops = [];
        var lastMoveTs = 0;

        function localUv(ev) {
            var r = canvas.getBoundingClientRect();
            var x = (ev.clientX - r.left) / r.width;
            var y = (ev.clientY - r.top) / r.height;
            // Caller wants a UV inside the canvas, but pointer can be outside the
            // hero on the document level. Clamp here, drops outside become no-ops.
            if (x < 0 || x > 1 || y < 0 || y > 1) return null;
            // GL has y=0 at bottom; CSS has y=0 at top → flip
            return [x, 1.0 - y];
        }

        function pushDrop(uv, radius, strength) {
            if (!uv) return;
            pendingDrops.push({ uv: uv, r: radius, s: strength });
        }

        function onMove(ev) {
            var now = performance.now();
            if (now - lastMoveTs < MOVE_THROTTLE_MS) return;
            lastMoveTs = now;
            pushDrop(localUv(ev), DROP_RADIUS_MOVE, DROP_STR_MOVE);
        }
        function onDown(ev) {
            pushDrop(localUv(ev), DROP_RADIUS_CLICK, DROP_STR_CLICK);
        }

        // Listen on the host so we get events even though canvas is pointer-events:none
        host.addEventListener('pointermove', onMove);
        host.addEventListener('pointerdown', onDown);

        // -------- Frame loop --------
        var uUpdateCurr   = gl.getUniformLocation(progUpdate, 'u_curr');
        var uUpdateTexel  = gl.getUniformLocation(progUpdate, 'u_texel');
        var uUpdateDamp   = gl.getUniformLocation(progUpdate, 'u_damping');

        var uDropCurr     = gl.getUniformLocation(progDrop, 'u_curr');
        var uDropCenter   = gl.getUniformLocation(progDrop, 'u_center');
        var uDropRadius   = gl.getUniformLocation(progDrop, 'u_radius');
        var uDropStrength = gl.getUniformLocation(progDrop, 'u_strength');

        var uRenderHeight = gl.getUniformLocation(progRender, 'u_height');
        var uRenderTexel  = gl.getUniformLocation(progRender, 'u_texel');

        function passUpdate() {
            // bufA -> bufB
            gl.bindFramebuffer(gl.FRAMEBUFFER, bufB.fb);
            gl.viewport(0, 0, SIM_RES, SIM_RES);
            bindQuad(progUpdate);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, bufA.tex);
            gl.uniform1i(uUpdateCurr, 0);
            gl.uniform2f(uUpdateTexel, simTexel[0], simTexel[1]);
            gl.uniform1f(uUpdateDamp, DAMPING);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            // swap
            var tmp = bufA; bufA = bufB; bufB = tmp;
        }
        function passDrop(d) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, bufB.fb);
            gl.viewport(0, 0, SIM_RES, SIM_RES);
            bindQuad(progDrop);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, bufA.tex);
            gl.uniform1i(uDropCurr, 0);
            gl.uniform2f(uDropCenter, d.uv[0], d.uv[1]);
            gl.uniform1f(uDropRadius, d.r);
            gl.uniform1f(uDropStrength, d.s);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            var tmp = bufA; bufA = bufB; bufB = tmp;
        }
        function passRender() {
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.viewport(0, 0, canvas.width, canvas.height);
            // Clear to transparent so calm water reveals the DOM beneath.
            gl.clearColor(0.0, 0.0, 0.0, 0.0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            bindQuad(progRender);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, bufA.tex);
            gl.uniform1i(uRenderHeight, 0);
            gl.uniform2f(uRenderTexel, simTexel[0], simTexel[1]);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }

        function frame() {
            for (var i = 0; i < pendingDrops.length; i++) passDrop(pendingDrops[i]);
            pendingDrops.length = 0;
            passUpdate();
            passRender();
            requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
    }
})();
