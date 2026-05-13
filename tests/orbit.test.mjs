// Browser-level tests for the hero orbit: verifies that the chips actually
// rotate around the center and that each chip carries its own white ring.
// Uses the Playwright library directly with node:test so we don't depend
// on @playwright/test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const MIME = {
    '.html': 'text/html',
    '.css':  'text/css',
    '.js':   'application/javascript',
    '.svg':  'image/svg+xml',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ico':  'image/x-icon'
};

function startServer() {
    const server = createServer((req, res) => {
        let p = decodeURIComponent(req.url.split('?')[0]);
        if (p === '/') p = '/index.html';
        const fp = join(root, p);
        try {
            const stat = statSync(fp);
            if (stat.isDirectory()) {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(readFileSync(join(fp, 'index.html')));
            } else {
                res.writeHead(200, { 'Content-Type': MIME[extname(fp)] || 'application/octet-stream' });
                res.end(readFileSync(fp));
            }
        } catch {
            res.writeHead(404);
            res.end();
        }
    });
    return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function withPage(fn) {
    const server = await startServer();
    const port = server.address().port;
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.orbit-chip');
        await fn(page);
    } finally {
        await browser.close();
        await new Promise(r => server.close(r));
    }
}

test('orbit chips rotate around the center over time', async () => {
    await withPage(async (page) => {
        // Position lives in transform's translate3d; sample rendered rects.
        const sample = () => page.$$eval('.orbit-chip', els => els.map(el => {
            const r = el.getBoundingClientRect();
            return { x: Math.round(r.x), y: Math.round(r.y) };
        }));

        const t0 = await sample();
        assert.ok(t0.length >= 3, `expected several orbit chips, found ${t0.length}`);

        await page.waitForTimeout(1500);
        const t1 = await sample();

        const moved = t0.filter((p, i) => p.x !== t1[i].x || p.y !== t1[i].y).length;
        assert.ok(
            moved >= Math.ceil(t0.length / 2),
            `expected most chips to change position over 1.5s; only ${moved}/${t0.length} moved`
        );
    });
});

test('each chip has its own white orbit ring', async () => {
    await withPage(async (page) => {
        const chipCount = await page.$$eval('.orbit-chip', els => els.length);
        const ringCount = await page.$$eval('.orbit-ring.chip-ring', els => els.length);
        assert.equal(ringCount, chipCount,
            `expected one .chip-ring per .orbit-chip, got ${ringCount} rings for ${chipCount} chips`);
    });
});

test('chips orbit with varied direction and speed (not all parallel)', async () => {
    await withPage(async (page) => {
        // Read each chip's orbital angle (polar position from the orbit
        // center). chip-spin rotates the chip's own axis but doesn't move
        // its center, so this is purely orbital motion.
        const samplePolar = () => page.$$eval('.orbit-chip', els => {
            const wrap = document.querySelector('.orbit-wrap').getBoundingClientRect();
            const cx = wrap.x + wrap.width / 2;
            const cy = wrap.y + wrap.height / 2;
            return els.map(el => {
                const r = el.getBoundingClientRect();
                const dx = (r.x + r.width / 2) - cx;
                const dy = (r.y + r.height / 2) - cy;
                return Math.atan2(dx, -dy) * 180 / Math.PI; // 0 = up, +ve = clockwise
            });
        });

        const t0 = await samplePolar();
        await page.waitForTimeout(2000);
        const t1 = await samplePolar();

        const deltas = t0.map((a0, i) => {
            let d = t1[i] - a0;
            while (d >  180) d -= 360;
            while (d < -180) d += 360;
            return d;
        });

        // Centre on the mean delta — that strips any global rotation of the
        // whole composition (moto-relativo) and leaves only each chip's
        // relative dynamic. The invariant we care about is "chips don't move
        // in lock-step", regardless of any assembly-wide rotation.
        const mean = deltas.reduce((a,b)=>a+b, 0) / deltas.length;
        const centered = deltas.map(d => d - mean);

        const positives = centered.filter(d => d >  1).length;
        const negatives = centered.filter(d => d < -1).length;
        assert.ok(positives >= 1 && negatives >= 1,
            `expected mix of orbit directions relative to the group; got +${positives}/-${negatives}, centered=${centered.map(d=>d.toFixed(1))}`);

        const absD = centered.map(Math.abs);
        const range = Math.max(...absD) - Math.min(...absD);
        assert.ok(range > 2,
            `expected varied orbital speed; |delta-mean| range=${range.toFixed(2)}, centered=${centered.map(d=>d.toFixed(1))}`);

        // Starting angles should also be spread — variance should not be
        // tiny. Compute the spread of t0 modulo 360.
        const wrap360 = a => ((a % 360) + 360) % 360;
        const starts = t0.map(wrap360).sort((a,b) => a - b);
        const gaps = starts.map((v, i) => (i === 0 ? v + 360 - starts[starts.length-1] : v - starts[i-1]));
        assert.ok(Math.max(...gaps) < 200,
            `starting angles look clustered; sorted=${starts.map(s=>s.toFixed(0))}`);
    });
});

test('each track has a unique data-period (jittered to avoid re-sync)', async () => {
    await withPage(async (page) => {
        const periods = await page.$$eval('.orbit-track',
            els => els.map(el => el.dataset.period));
        assert.equal(new Set(periods).size, periods.length,
            `expected every orbit-track to have a unique data-period; got ${periods.join(', ')}`);

        // No two periods should be closer than 0.5s — anything tighter would
        // make the closest pair re-sync within a few minutes.
        const nums = periods.map(parseFloat).sort((a, b) => a - b);
        const gaps = nums.slice(1).map((v, i) => v - nums[i]);
        const minGap = Math.min(...gaps);
        assert.ok(minGap >= 0.5,
            `closest periods should be ≥0.5s apart, got minGap=${minGap.toFixed(2)} from ${nums}`);
    });
});

test('each chip has its own chip-spin (varied rotation over time)', async () => {
    await withPage(async (page) => {
        // Spin lives inside the inline transform's rotate(...) component.
        const readSpins = () => page.$$eval('.orbit-chip', els => els.map(el => {
            const m = el.style.transform.match(/rotate\(([-\d.]+)deg\)/);
            return m ? parseFloat(m[1]) : null;
        }));

        const t0 = await readSpins();
        assert.ok(t0.every(v => v !== null),
            `every chip should have a rotate() in its transform, got: ${t0}`);

        // Snapshot rotations at two times. Per-chip spin is varied in
        // duration AND direction, so the deltas must (a) not all be equal
        // and (b) include both signs.
        await page.waitForTimeout(1500);
        const t1 = await readSpins();

        const deltas = t0.map((a, i) => t1[i] - a);
        const positives = deltas.filter(d => d >  1).length;
        const negatives = deltas.filter(d => d < -1).length;
        assert.ok(positives >= 1 && negatives >= 1,
            `expected mix of chip-spin directions; got +${positives}/-${negatives}, deltas=${deltas.map(d=>d.toFixed(1))}`);

        const absD = deltas.map(Math.abs);
        const range = Math.max(...absD) - Math.min(...absD);
        assert.ok(range > 2,
            `expected varied chip-spin speed; |delta| range=${range.toFixed(2)}`);
    });
});

test('a chip dragged outward widens its own ring (not its neighbours)', async () => {
    await withPage(async (page) => {
        await page.locator('.orbit-wrap').scrollIntoViewIfNeeded();
        await page.waitForTimeout(100);

        const insetBefore = await page.$$eval('.orbit-ring.chip-ring',
            els => els.map(el => el.style.inset));

        // Drag the first chip well past its original orbit. The drag handler
        // owns angle + radius while dragging, so this is deterministic even
        // with autospin still running.
        const wrapBox = await page.locator('.orbit-wrap').boundingBox();
        const chip = page.locator('.orbit-chip').first();
        const cbox = await chip.boundingBox();
        const cx = wrapBox.x + wrapBox.width / 2;
        const cy = wrapBox.y + wrapBox.height / 2;
        await page.mouse.move(cbox.x + cbox.width / 2, cbox.y + cbox.height / 2);
        await page.mouse.down();
        // Move out toward the upper-right corner, well past the original orbit.
        await page.mouse.move(cx + wrapBox.width * 0.55, cy - wrapBox.height * 0.55,
            { steps: 12 });
        await page.mouse.up();
        await page.waitForTimeout(100);

        const insetAfter = await page.$$eval('.orbit-ring.chip-ring',
            els => els.map(el => el.style.inset));

        // Inset is a percentage string like "10%" / "-30%". Lower percentage
        // = larger ring. The dragged chip's ring should have shrunk (more
        // negative); the others should be untouched.
        const parse = s => parseFloat(s);
        assert.ok(parse(insetAfter[0]) < parse(insetBefore[0]),
            `dragged chip's ring should grow: before=${insetBefore[0]} after=${insetAfter[0]}`);
        for (let i = 1; i < insetBefore.length; i++) {
            assert.equal(insetAfter[i], insetBefore[i],
                `neighbour ring ${i} must be untouched (before=${insetBefore[i]} after=${insetAfter[i]})`);
        }
    });
});
