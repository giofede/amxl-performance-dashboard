// ==UserScript==
// @name         Steering Performance Dashboard v2.9
// @version      2.9.1
// @description  Full-screen dashboard with per-week targets, planned TPH, FC/SC/IXD, display toggles, historical lookup. v2.8: "Copy as Database" tidy/long export. v2.9: "Export PDF" (results only) scaled to fit a single page.
// @author       PoC Draft
// @match        https://fclm-portal.amazon.com/*
// @updateURL    https://github.com/giofede/amxl-performance-dashboard/raw/refs/heads/main/performance-dashboard.user.js
// @downloadURL  https://github.com/giofede/amxl-performance-dashboard/raw/refs/heads/main/performance-dashboard.user.js
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @require      https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js
// @require      https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js
// @require      https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js
// @connect      fclm-portal.amazon.com
// ==/UserScript==

(function () {
    'use strict';

    // ─── Configuration ───────────────────────────────────────────────
    const SORT_CENTERS = ['BCN6', 'FCO7', 'STR5', 'STN7', 'CSA7'];
    const IXD_SITES = ['XLI7', 'XFR7'];
    const FC_SITES = ['BCN3', 'FCO5', 'STR2', 'LTN7', 'DSA7'];
    const MAX_RETRIES = 3;
    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // ─── Q3G Targets (per-week) ─────────────────────────────────────
    // SC targets: { site: { weekNum: tph } }
    const Q3G_SC = {
        BCN6: {21:18.53,22:18.53,23:18.53,24:18.7,25:18.7,26:18.7,27:18.7,28:18.6,29:18.6,30:18.6,31:18.6,32:18.8,33:18.8,34:18.8,35:18.8,36:19.0,37:19.0,38:19.0,39:19.0,40:19.0,41:18.6,42:18.6,43:18.6,44:18.6,45:19.4,46:19.4,47:19.4,48:19.4,49:19.4,50:19.4,51:19.4,52:19.4,53:19.4},
        STN7: {21:12.63,22:12.63,23:12.63,24:12.7,25:12.7,26:12.7,27:12.7,28:14.1,29:14.1,30:14.1,31:14.1,32:15.0,33:15.0,34:15.0,35:15.0,36:15.0,37:15.0,38:15.0,39:15.0,40:15.0,41:15.0,42:15.0,43:15.0,44:15.0,45:14.9,46:14.9,47:14.9,48:14.9,49:14.9,50:14.9,51:14.9,52:14.9,53:14.9},
        STR5: {21:15.46,22:15.46,23:15.46,24:15.5,25:15.5,26:15.5,27:15.5,28:16.6,29:16.6,30:16.6,31:16.6,32:16.0,33:16.0,34:16.0,35:16.0,36:16.1,37:16.1,38:16.1,39:16.1,40:16.1,41:16.2,42:16.2,43:16.2,44:16.2,45:18.2,46:18.2,47:18.2,48:18.2,49:18.2,50:18.2,51:18.2,52:18.2,53:18.2},
        FCO7: {21:15.70,22:15.70,23:15.70,24:15.7,25:15.7,26:15.7,27:15.7,28:16.4,29:16.4,30:16.4,31:16.4,32:16.2,33:16.2,34:16.2,35:16.2,36:16.2,37:16.2,38:16.2,39:16.2,40:16.2,41:16.3,42:16.3,43:16.3,44:16.3,45:17.7,46:17.7,47:17.7,48:17.7,49:17.8,50:17.8,51:17.8,52:17.8,53:17.8},
        CSA7: {33:9.29,34:9.29,35:9.29,36:10.31,37:10.31,38:10.31,39:10.31,40:10.31,41:11.32,42:11.32,43:11.32,44:11.32,45:11.77,46:11.77,47:11.77,48:11.77,49:11.98,50:11.98,51:11.98,52:11.98,53:11.98}
    };
    // FC targets: { site: { weekNum: { ib, ob } } }
    const Q3G_FC = {
        BCN3: {21:{ib:13.40,ob:12.58},22:{ib:13.40,ob:12.58},23:{ib:13.42,ob:12.93},24:{ib:13.42,ob:12.93},25:{ib:13.42,ob:12.93},26:{ib:13.42,ob:12.93},27:{ib:13.87,ob:13.00},28:{ib:12.84,ob:12.99},29:{ib:13.36,ob:12.99},30:{ib:13.32,ob:12.99},31:{ib:13.24,ob:12.98},32:{ib:13.53,ob:12.94},33:{ib:13.23,ob:12.93},34:{ib:13.31,ob:12.94},35:{ib:13.16,ob:12.92},36:{ib:14.53,ob:12.94},37:{ib:14.36,ob:12.93},38:{ib:14.17,ob:12.93},39:{ib:13.95,ob:12.93},40:{ib:14.09,ob:13.07},41:{ib:12.18,ob:13.29},42:{ib:14.45,ob:13.25},43:{ib:14.21,ob:13.25},44:{ib:13.75,ob:13.25},45:{ib:13.70,ob:13.36},46:{ib:13.91,ob:13.36},47:{ib:13.18,ob:13.37},48:{ib:12.00,ob:13.40},49:{ib:12.70,ob:13.42},50:{ib:13.39,ob:13.40},51:{ib:12.89,ob:13.40},52:{ib:12.87,ob:13.38},53:{ib:12.14,ob:13.43}},
        FCO5: {21:{ib:12.60,ob:11.09},22:{ib:12.60,ob:11.09},23:{ib:12.75,ob:11.10},24:{ib:12.75,ob:11.10},25:{ib:12.75,ob:11.10},26:{ib:12.75,ob:11.10},27:{ib:13.48,ob:11.82},28:{ib:12.17,ob:11.79},29:{ib:12.82,ob:11.79},30:{ib:14.35,ob:11.79},31:{ib:13.83,ob:11.78},32:{ib:13.01,ob:11.72},33:{ib:13.96,ob:11.71},34:{ib:13.33,ob:11.72},35:{ib:13.69,ob:11.72},36:{ib:13.26,ob:11.79},37:{ib:13.14,ob:11.80},38:{ib:14.47,ob:11.80},39:{ib:13.98,ob:11.80},40:{ib:13.15,ob:11.79},41:{ib:11.38,ob:11.87},42:{ib:13.26,ob:11.76},43:{ib:13.26,ob:11.75},44:{ib:13.29,ob:11.74},45:{ib:14.94,ob:12.22},46:{ib:16.63,ob:12.22},47:{ib:13.61,ob:12.27},48:{ib:13.51,ob:12.35},49:{ib:13.49,ob:12.36},50:{ib:15.13,ob:12.31},51:{ib:13.61,ob:12.29},52:{ib:14.09,ob:12.23},53:{ib:11.76,ob:12.35}},
        STR2: {21:{ib:12.44,ob:12.30},22:{ib:12.44,ob:12.30},23:{ib:12.52,ob:12.28},24:{ib:12.52,ob:12.28},25:{ib:12.52,ob:12.28},26:{ib:12.52,ob:12.28},27:{ib:12.79,ob:13.07},28:{ib:13.48,ob:12.93},29:{ib:11.99,ob:13.05},30:{ib:12.22,ob:13.06},31:{ib:13.91,ob:12.85},32:{ib:13.27,ob:13.01},33:{ib:12.18,ob:13.01},34:{ib:13.23,ob:12.94},35:{ib:12.71,ob:13.01},36:{ib:12.61,ob:13.02},37:{ib:12.54,ob:13.03},38:{ib:12.79,ob:13.03},39:{ib:12.67,ob:13.03},40:{ib:12.59,ob:13.01},41:{ib:12.30,ob:13.01},42:{ib:13.24,ob:12.98},43:{ib:13.40,ob:12.98},44:{ib:13.55,ob:12.98},45:{ib:14.23,ob:13.44},46:{ib:13.75,ob:13.44},47:{ib:13.12,ob:13.45},48:{ib:12.46,ob:13.48},49:{ib:12.96,ob:13.10},50:{ib:13.00,ob:12.93},51:{ib:11.79,ob:12.93},52:{ib:10.56,ob:12.91},53:{ib:9.01,ob:12.96}},
        LTN7: {21:{ib:12.16,ob:10.87},22:{ib:12.16,ob:10.87},23:{ib:12.37,ob:11.05},24:{ib:12.37,ob:11.05},25:{ib:12.37,ob:11.05},26:{ib:12.37,ob:11.05},27:{ib:12.30,ob:11.65},28:{ib:12.12,ob:11.65},29:{ib:12.39,ob:11.65},30:{ib:12.22,ob:11.65},31:{ib:12.18,ob:11.65},32:{ib:11.90,ob:11.65},33:{ib:12.02,ob:11.64},34:{ib:11.83,ob:11.64},35:{ib:11.88,ob:11.65},36:{ib:12.10,ob:11.64},37:{ib:12.26,ob:11.65},38:{ib:12.10,ob:11.65},39:{ib:12.19,ob:11.65},40:{ib:12.43,ob:11.65},41:{ib:12.31,ob:11.68},42:{ib:12.58,ob:11.64},43:{ib:12.67,ob:11.65},44:{ib:12.45,ob:11.65},45:{ib:12.61,ob:12.23},46:{ib:12.65,ob:12.23},47:{ib:12.65,ob:12.24},48:{ib:12.26,ob:12.26},49:{ib:12.26,ob:11.84},50:{ib:12.44,ob:11.65},51:{ib:12.05,ob:11.65},52:{ib:11.83,ob:11.64},53:{ib:11.57,ob:11.68}},
        DSA7: {21:{ib:18.17,ob:10.30},22:{ib:18.17,ob:10.30},23:{ib:18.19,ob:10.72},24:{ib:18.19,ob:10.72},25:{ib:18.19,ob:10.72},26:{ib:18.19,ob:10.72},27:{ib:16.08,ob:8.99},28:{ib:15.35,ob:8.98},29:{ib:14.98,ob:8.98},30:{ib:15.81,ob:8.98},31:{ib:15.61,ob:9.12},32:{ib:14.54,ob:10.04},33:{ib:16.41,ob:10.04},34:{ib:15.90,ob:10.04},35:{ib:14.87,ob:10.04},36:{ib:14.80,ob:10.16},37:{ib:14.99,ob:10.21},38:{ib:14.39,ob:10.21},39:{ib:15.22,ob:10.21},40:{ib:11.27,ob:9.14},41:{ib:7.80,ob:8.08},42:{ib:8.02,ob:8.01},43:{ib:8.28,ob:8.01},44:{ib:8.10,ob:8.01},45:{ib:10.66,ob:8.74},46:{ib:10.81,ob:8.75},47:{ib:10.64,ob:8.77},48:{ib:9.91,ob:8.80},49:{ib:12.67,ob:8.67},50:{ib:13.91,ob:8.58},51:{ib:13.12,ob:8.58},52:{ib:11.67,ob:8.57},53:{ib:11.05,ob:8.62}}
    };
    // IXD targets: { site: { weekNum: { ib, da } } } — Q3G, flat W33–W53
    const Q3G_IXD = {
        XLI7: {33:{ib:21.7,da:32.5},34:{ib:21.7,da:32.5},35:{ib:21.7,da:32.5},36:{ib:21.7,da:32.5},37:{ib:21.7,da:32.5},38:{ib:21.7,da:32.5},39:{ib:21.7,da:32.5},40:{ib:21.7,da:32.5},41:{ib:21.7,da:32.5},42:{ib:21.7,da:32.5},43:{ib:21.7,da:32.5},44:{ib:21.7,da:32.5},45:{ib:21.7,da:32.5},46:{ib:21.7,da:32.5},47:{ib:21.7,da:32.5},48:{ib:21.7,da:32.5},49:{ib:21.7,da:32.5},50:{ib:21.7,da:32.5},51:{ib:21.7,da:32.5},52:{ib:21.7,da:32.5},53:{ib:21.7,da:32.5}},
        XFR7: {33:{ib:23.8,da:54.5},34:{ib:23.8,da:54.5},35:{ib:23.8,da:54.5},36:{ib:23.8,da:54.5},37:{ib:23.8,da:54.5},38:{ib:23.8,da:54.5},39:{ib:23.8,da:54.5},40:{ib:23.8,da:54.5},41:{ib:23.8,da:54.5},42:{ib:23.8,da:54.5},43:{ib:23.8,da:54.5},44:{ib:23.8,da:54.5},45:{ib:23.8,da:54.5},46:{ib:23.8,da:54.5},47:{ib:23.8,da:54.5},48:{ib:23.8,da:54.5},49:{ib:23.8,da:54.5},50:{ib:23.8,da:54.5},51:{ib:23.8,da:54.5},52:{ib:23.8,da:54.5},53:{ib:23.8,da:54.5}}
    };

    // Sidebar editable targets (current week, resets on reload)
    let sidebarSCTarget = {};
    let sidebarFCTarget = { ib: {}, ob: {} };
    let sidebarIXDTarget = { ib: {}, da: {} };

    function initSidebarTargets() {
        const cw = getCurrentWeekNumber();
        SORT_CENTERS.forEach(sc => { sidebarSCTarget[sc] = Q3G_SC[sc]?.[cw] || 0; });
        FC_SITES.forEach(fc => {
            sidebarFCTarget.ib[fc] = Q3G_FC[fc]?.[cw]?.ib || 0;
            sidebarFCTarget.ob[fc] = Q3G_FC[fc]?.[cw]?.ob || 0;
        });
        IXD_SITES.forEach(s => {
            sidebarIXDTarget.ib[s] = Q3G_IXD[s]?.[cw]?.ib || 0;
            sidebarIXDTarget.da[s] = Q3G_IXD[s]?.[cw]?.da || 0;
        });
    }
    initSidebarTargets();

    // Get target for a specific week (uses Q3G hardcoded values)
    function getSCTargetForWeek(sc, weekNum) {
        const val = Q3G_SC[sc]?.[weekNum] || Q3G_SC[sc]?.[String(weekNum)] || 0;
        return val > 0 ? val : null;
    }
    function getFCTargetForWeek(fc, weekNum, type) {
        const week = Q3G_FC[fc]?.[weekNum] || Q3G_FC[fc]?.[String(weekNum)];
        return week ? (week[type] || 0) : 0;
    }
    function getIXDTargetForWeek(site, weekNum, type) {
        const week = Q3G_IXD[site]?.[weekNum] || Q3G_IXD[site]?.[String(weekNum)];
        return week ? (week[type] || 0) : 0;
    }

    // Vs Target comparison (per-week)
    function getVsTarget(actual, sc, weekNum) {
        const target = getSCTargetForWeek(sc, weekNum);
        if (!target || target <= 0 || isNaN(actual) || actual <= 0) return { pct: null, cssClass: '' };
        const pct = ((actual - target) / target) * 100;
        let cssClass = 'spp-vs-green';
        if (pct < 0) { cssClass = Math.abs(pct) <= 10 ? 'spp-vs-yellow' : 'spp-vs-red'; }
        return { pct, cssClass };
    }
    function formatVsTarget(actual, sc, weekNum) {
        const target = getSCTargetForWeek(sc, weekNum);
        if (!target || target <= 0 || isNaN(actual) || actual <= 0) return { html: '\u2013', cssClass: '' };
        const pct = ((actual - target) / target) * 100;
        const sign = pct >= 0 ? '+' : '';
        let cssClass = 'spp-vs-green';
        if (pct < 0) { cssClass = Math.abs(pct) <= 10 ? 'spp-vs-yellow' : 'spp-vs-red'; }
        return { html: `${formatEU(target)} (${sign}${pct.toFixed(1)}%)`, cssClass };
    }

    function getFCVsTarget(actual, fc, type, weekNum) {
        const target = getFCTargetForWeek(fc, weekNum, type);
        if (!target || target <= 0 || isNaN(actual) || actual <= 0) return { pct: null, cssClass: '' };
        const pct = ((actual - target) / target) * 100;
        let cssClass = 'spp-vs-green';
        if (pct < 0) { cssClass = Math.abs(pct) <= 10 ? 'spp-vs-yellow' : 'spp-vs-red'; }
        return { pct, cssClass };
    }
    function formatFCVsTarget(actual, fc, type, weekNum) {
        const target = getFCTargetForWeek(fc, weekNum, type);
        if (!target || target <= 0 || isNaN(actual) || actual <= 0) return { html: '\u2013', cssClass: '' };
        const pct = ((actual - target) / target) * 100;
        const sign = pct >= 0 ? '+' : '';
        let cssClass = 'spp-vs-green';
        if (pct < 0) { cssClass = Math.abs(pct) <= 10 ? 'spp-vs-yellow' : 'spp-vs-red'; }
        return { html: `${formatEU(target)} (${sign}${pct.toFixed(1)}%)`, cssClass };
    }

    function getIXDVsTarget(actual, site, type, weekNum) {
        const target = getIXDTargetForWeek(site, weekNum, type);
        if (!target || target <= 0 || isNaN(actual) || actual <= 0) return { pct: null, cssClass: '' };
        const pct = ((actual - target) / target) * 100;
        let cssClass = 'spp-vs-green';
        if (pct < 0) { cssClass = Math.abs(pct) <= 10 ? 'spp-vs-yellow' : 'spp-vs-red'; }
        return { pct, cssClass };
    }
    function formatIXDVsTarget(actual, site, type, weekNum) {
        const target = getIXDTargetForWeek(site, weekNum, type);
        if (!target || target <= 0 || isNaN(actual) || actual <= 0) return { html: '\u2013', cssClass: '' };
        const pct = ((actual - target) / target) * 100;
        const sign = pct >= 0 ? '+' : '';
        let cssClass = 'spp-vs-green';
        if (pct < 0) { cssClass = Math.abs(pct) <= 10 ? 'spp-vs-yellow' : 'spp-vs-red'; }
        return { html: `${formatEU(target)} (${sign}${pct.toFixed(1)}%)`, cssClass };
    }

    // ─── Chart Configuration ─────────────────────────────────────────

    // Format planned TPH with variance: "16,50 (-9,1%)"
    function formatPlanned(actual, planned) {
        if (!planned || planned <= 0 || isNaN(actual) || actual <= 0) return { html: '\u2013', cssClass: '' };
        const pct = ((actual - planned) / planned) * 100;
        const sign = pct >= 0 ? '+' : '';
        let cssClass = 'spp-vs-green';
        if (pct < 0) { cssClass = Math.abs(pct) <= 10 ? 'spp-vs-yellow' : 'spp-vs-red'; }
        return { html: `${formatEU(planned)} (${sign}${pct.toFixed(1)}%)`, cssClass };
    }

    const SC_COLORS = {
        BCN6: '#4d9fff',
        FCO7: '#f87171',
        STR5: '#fbbf24',
        STN7: '#a78bfa',
        CSA7: '#22d3ee'
    };
    const IXD_COLORS = {
        XLI7: '#f87171',
        XFR7: '#fbbf24'
    };
    const FC_COLORS = {
        BCN3: '#4d9fff',
        FCO5: '#f87171',
        STR2: '#fbbf24',
        LTN7: '#a78bfa',
        DSA7: '#fb923c'
    };

    let scChartInstance = null, ixdIBChartInstance = null, ixdDAChartInstance = null, fcIBChartInstance = null, fcOBChartInstance = null;

    function buildSCChart(container, scData, mode) {
        // mode: 'weekly' or 'daily'
        if (scChartInstance) { scChartInstance.destroy(); scChartInstance = null; }
        if (!scData || scData.length === 0) return;

        const labels = mode === 'weekly'
            ? scData[0].weeks.map(w => `W${w.wNum}`)
            : scData[0].days.map(d => d.label);

        const datasets = [];
        for (const s of scData) {
            const values = mode === 'weekly'
                ? s.weeks.map(w => (w.ppr && !w.ppr.error && w.ppr.tph > 0) ? w.ppr.tph : null)
                : s.days.map(d => (d.ppr && !d.ppr.error && d.ppr.tph > 0) ? d.ppr.tph : null);

            datasets.push({
                label: s.sc,
                data: values,
                borderColor: SC_COLORS[s.sc] || '#888',
                backgroundColor: 'transparent',
                borderWidth: 2.5,
                pointRadius: 4,
                pointBackgroundColor: SC_COLORS[s.sc] || '#888',
                tension: 0.2,
                spanGaps: true
            });
        }

        const canvas = document.createElement('canvas');
        canvas.style.cssText = 'width:100%;max-height:300px;';
        container.appendChild(canvas);

        scChartInstance = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { display: true, position: 'top', labels: { color: '#e8eaed', font: { size: 11 }, boxWidth: 12 } },
                    tooltip: { backgroundColor: '#1a1d27', borderColor: '#2d3140', borderWidth: 1, titleColor: '#e8eaed', bodyColor: '#9aa0a6' }
                },
                scales: {
                    x: { ticks: { color: '#9aa0a6', font: { size: 10 } }, grid: { color: 'rgba(45,49,64,.4)' } },
                    y: { beginAtZero: false, ticks: { color: '#9aa0a6', font: { size: 10 } }, grid: { color: 'rgba(45,49,64,.4)' }, title: { display: true, text: 'TPH', color: '#9aa0a6' } }
                }
            }
        });
    }

    function toggleTargetLine(sc, show) {
        if (!scChartInstance) return;
        const targetLabel = `${sc} Target`;
        const existingIdx = scChartInstance.data.datasets.findIndex(ds => ds.label === targetLabel);

        if (show && existingIdx === -1) {
            const target = sidebarSCTarget[sc] || 0;
            if (!target) return;
            const dataPoints = scChartInstance.data.labels.map(() => target);
            scChartInstance.data.datasets.push({
                label: targetLabel,
                data: dataPoints,
                borderColor: SC_COLORS[sc] || '#888',
                backgroundColor: 'transparent',
                borderWidth: 1.5,
                borderDash: [6, 4],
                pointRadius: 0,
                tension: 0,
                order: 10
            });
        } else if (!show && existingIdx !== -1) {
            scChartInstance.data.datasets.splice(existingIdx, 1);
        }
        scChartInstance.update();
    }

    function buildIXDCharts(ibContainer, daContainer, ixdData, mode) {
        if (ixdIBChartInstance) { ixdIBChartInstance.destroy(); ixdIBChartInstance = null; }
        if (ixdDAChartInstance) { ixdDAChartInstance.destroy(); ixdDAChartInstance = null; }
        if (!ixdData || ixdData.length === 0) return;

        const labels = mode === 'weekly'
            ? ixdData[0].weeks.map(w => `W${w.wNum}`)
            : ixdData[0].days.map(d => d.label);

        // IB chart
        const ibDatasets = ixdData.map(s => ({
            label: s.sc,
            data: mode === 'weekly'
                ? s.weeks.map(w => (w.inbound && !w.inbound.error && w.inbound.tph > 0) ? w.inbound.tph : null)
                : s.days.map(d => (d.inbound && !d.inbound.error && d.inbound.tph > 0) ? d.inbound.tph : null),
            borderColor: IXD_COLORS[s.sc] || '#888',
            backgroundColor: 'transparent',
            borderWidth: 2.5,
            pointRadius: 4,
            pointBackgroundColor: IXD_COLORS[s.sc] || '#888',
            tension: 0.2,
            spanGaps: true
        }));

        const ibCanvas = document.createElement('canvas');
        ibCanvas.style.cssText = 'width:100%;max-height:250px;';
        ibContainer.appendChild(ibCanvas);

        ixdIBChartInstance = new Chart(ibCanvas.getContext('2d'), {
            type: 'line',
            data: { labels, datasets: ibDatasets },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: { legend: { display: true, position: 'top', labels: { color: '#e8eaed', font: { size: 11 }, boxWidth: 12 } } },
                scales: {
                    x: { ticks: { color: '#9aa0a6', font: { size: 10 } }, grid: { color: 'rgba(45,49,64,.4)' } },
                    y: { ticks: { color: '#9aa0a6', font: { size: 10 } }, grid: { color: 'rgba(45,49,64,.4)' }, title: { display: true, text: 'IB TPH', color: '#9aa0a6' } }
                }
            }
        });

        // DA chart
        const daDatasets = ixdData.map(s => ({
            label: s.sc,
            data: mode === 'weekly'
                ? s.weeks.map(w => (w.da && !w.da.error && w.da.tph > 0) ? w.da.tph : null)
                : s.days.map(d => (d.da && !d.da.error && d.da.tph > 0) ? d.da.tph : null),
            borderColor: IXD_COLORS[s.sc] || '#888',
            backgroundColor: 'transparent',
            borderWidth: 2.5,
            pointRadius: 4,
            pointBackgroundColor: IXD_COLORS[s.sc] || '#888',
            tension: 0.2,
            spanGaps: true
        }));

        const daCanvas = document.createElement('canvas');
        daCanvas.style.cssText = 'width:100%;max-height:250px;';
        daContainer.appendChild(daCanvas);

        ixdDAChartInstance = new Chart(daCanvas.getContext('2d'), {
            type: 'line',
            data: { labels, datasets: daDatasets },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: { legend: { display: true, position: 'top', labels: { color: '#e8eaed', font: { size: 11 }, boxWidth: 12 } } },
                scales: {
                    x: { ticks: { color: '#9aa0a6', font: { size: 10 } }, grid: { color: 'rgba(45,49,64,.4)' } },
                    y: { ticks: { color: '#9aa0a6', font: { size: 10 } }, grid: { color: 'rgba(45,49,64,.4)' }, title: { display: true, text: 'DA TPH', color: '#9aa0a6' } }
                }
            }
        });
    }

    function buildFCCharts(ibContainer, obContainer, fcData, mode) {
        if (fcIBChartInstance) { fcIBChartInstance.destroy(); fcIBChartInstance = null; }
        if (fcOBChartInstance) { fcOBChartInstance.destroy(); fcOBChartInstance = null; }
        if (!fcData || fcData.length === 0) return;

        const labels = mode === 'weekly'
            ? fcData[0].weeks.map(w => `W${w.wNum}`)
            : fcData[0].days.map(d => d.label);

        // IB chart
        const ibDatasets = fcData.map(s => ({
            label: s.sc,
            data: mode === 'weekly'
                ? s.weeks.map(w => (w.ib && !w.ib.error && w.ib.tph > 0) ? w.ib.tph : null)
                : s.days.map(d => (d.ib && !d.ib.error && d.ib.tph > 0) ? d.ib.tph : null),
            borderColor: FC_COLORS[s.sc] || '#888',
            backgroundColor: 'transparent',
            borderWidth: 2.5, pointRadius: 4,
            pointBackgroundColor: FC_COLORS[s.sc] || '#888',
            tension: 0.2, spanGaps: true
        }));
        const ibCanvas = document.createElement('canvas');
        ibCanvas.style.cssText = 'width:100%;max-height:250px;';
        ibContainer.appendChild(ibCanvas);
        fcIBChartInstance = new Chart(ibCanvas.getContext('2d'), {
            type: 'line', data: { labels, datasets: ibDatasets },
            options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
                plugins: { legend: { display: true, position: 'top', labels: { color: '#e8eaed', font: { size: 11 }, boxWidth: 12 } } },
                scales: { x: { ticks: { color: '#9aa0a6', font: { size: 10 } }, grid: { color: 'rgba(45,49,64,.4)' } }, y: { beginAtZero: false, ticks: { color: '#9aa0a6', font: { size: 10 } }, grid: { color: 'rgba(45,49,64,.4)' }, title: { display: true, text: 'IB TPH', color: '#9aa0a6' } } }
            }
        });

        // OB chart
        const obDatasets = fcData.map(s => ({
            label: s.sc,
            data: mode === 'weekly'
                ? s.weeks.map(w => (w.ob && !w.ob.error && w.ob.tph > 0) ? w.ob.tph : null)
                : s.days.map(d => (d.ob && !d.ob.error && d.ob.tph > 0) ? d.ob.tph : null),
            borderColor: FC_COLORS[s.sc] || '#888',
            backgroundColor: 'transparent',
            borderWidth: 2.5, pointRadius: 4,
            pointBackgroundColor: FC_COLORS[s.sc] || '#888',
            tension: 0.2, spanGaps: true
        }));
        const obCanvas = document.createElement('canvas');
        obCanvas.style.cssText = 'width:100%;max-height:250px;';
        obContainer.appendChild(obCanvas);
        fcOBChartInstance = new Chart(obCanvas.getContext('2d'), {
            type: 'line', data: { labels, datasets: obDatasets },
            options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
                plugins: { legend: { display: true, position: 'top', labels: { color: '#e8eaed', font: { size: 11 }, boxWidth: 12 } } },
                scales: { x: { ticks: { color: '#9aa0a6', font: { size: 10 } }, grid: { color: 'rgba(45,49,64,.4)' } }, y: { beginAtZero: false, ticks: { color: '#9aa0a6', font: { size: 10 } }, grid: { color: 'rgba(45,49,64,.4)' }, title: { display: true, text: 'OB TPH', color: '#9aa0a6' } } }
            }
        });
    }

    // ─── FC Table Rendering ──────────────────────────────────────────

    function buildFCWeeklyTable(fcData) {
        if (!fcData || fcData.length === 0) return '';
        const weeks = fcData[0].weeks;
        function buildSingleTable(type, label) {
            const colSpan = 1 + (showDetails ? 2 : 0) + (showTargets ? 1 : 0) + (showPlanned ? 1 : 0);
            let h1 = `<th class="spp-sc-header" rowspan="2">Site</th>`;
            let h2 = '';
            for (const w of weeks) {
                h1 += `<th class="spp-week-header spp-divider" colspan="${colSpan}">W${w.wNum}</th>`;
                h2 += showDetails ? '<th class="spp-divider">Cap</th><th>Hrs</th><th>TPH</th>' : '<th class="spp-divider">TPH</th>';
                if (showTargets) h2 += '<th>vs Target</th>';
                if (showPlanned) h2 += '<th>vs Plan</th>';
            }
            if (showAverages && weeks.length >= 2) { const avgSpan = 1 + (showTargets ? 1 : 0); h1 += `<th class="spp-avg-header spp-divider" colspan="${avgSpan}">Avg L4</th>`; h2 += '<th class="spp-divider">TPH</th>'; if (showTargets) h2 += '<th>vs Target</th>'; }
            let body = '';
            for (const s of fcData) {
                let r = `<td>${s.sc}</td>`; const tphVals = [];
                for (const w of s.weeks) {
                    const d = w[type];
                    const tph = (d && !d.error && d.tph > 0) ? d.tph : NaN;
                    if (showDetails) { r += `<td class="spp-divider">${d && d.units ? formatEUInt(d.units) : '\u2013'}</td><td>${d && d.hours ? formatEU(d.hours) : '\u2013'}</td><td class="spp-tph-cell">${!isNaN(tph)?formatEU(tph):'\u2013'}</td>`; }
                    else { r += `<td class="spp-divider spp-tph-cell">${!isNaN(tph)?formatEU(tph):'\u2013'}</td>`; }
                    if (showTargets) { const vs = formatFCVsTarget(tph, s.sc, type, w.wNum); r += `<td class="${vs.cssClass}">${vs.html}</td>`; }
                    if (showPlanned) { const pl = formatPlanned(tph, d?.planned); r += `<td class="${pl.cssClass}" >${pl.html}</td>`; }
                    tphVals.push(tph);
                }
                if (showAverages && weeks.length >= 2) { const l4 = avgTPH(tphVals.slice(-4)); r += `<td class="spp-divider spp-avg-cell">${!isNaN(l4)?formatEU(l4):'\u2013'}</td>`; if (showTargets) { const vs = formatFCVsTarget(l4, s.sc, type, weeks[weeks.length-1].wNum); r += `<td class="${vs.cssClass}">${!isNaN(l4)?vs.html:'\u2013'}</td>`; } }
                body += `<tr>${r}</tr>`;
            }
            return `<div><div style="color:var(--spp-text-secondary);font-size:11px;margin-bottom:6px;text-align:center;font-weight:600">${label}</div><div class="spp-table-container"><table class="spp-table"><thead><tr>${h1}</tr><tr>${h2}</tr></thead><tbody>${body}</tbody></table></div></div>`;
        }
        return `<div class="spp-ixd-charts">${buildSingleTable('ib','Inbound')}${buildSingleTable('ob','Outbound')}</div>`;
    }

    function buildFCDailyTable(fcData) {
        if (!fcData || fcData.length === 0) return '';
        const days = fcData[0].days;
        function buildSingleTable(type, label) {
            const colSpan = 1 + (showDetails ? 2 : 0) + (showTargets ? 1 : 0) + (showPlanned ? 1 : 0);
            let h1 = `<th class="spp-sc-header" rowspan="2">Site</th>`;
            let h2 = '';
            for (const d of days) {
                h1 += `<th class="spp-week-header spp-divider" colspan="${colSpan}">${d.label}</th>`;
                h2 += showDetails ? '<th class="spp-divider">Cap</th><th>Hrs</th><th>TPH</th>' : '<th class="spp-divider">TPH</th>';
                if (showTargets) h2 += '<th>vs Target</th>';
                if (showPlanned) h2 += '<th>vs Plan</th>';
            }
            if (showAverages) { const avgSpan = 1 + (showTargets ? 1 : 0); h1 += `<th class="spp-avg-header spp-divider" colspan="${avgSpan}">Avg L4</th>`; h2 += '<th class="spp-divider">TPH</th>'; if (showTargets) h2 += '<th>vs Target</th>'; }
            let body = '';
            for (const s of fcData) {
                let r = `<td>${s.sc}</td>`; const tphVals = [];
                for (const d of s.days) {
                    const dd = d[type];
                    const tph = (dd && !dd.error && dd.tph > 0) ? dd.tph : NaN;
                    if (showDetails) { r += `<td class="spp-divider">${dd && dd.units ? formatEUInt(dd.units) : '\u2013'}</td><td>${dd && dd.hours ? formatEU(dd.hours) : '\u2013'}</td><td class="spp-tph-cell">${!isNaN(tph)?formatEU(tph):'\u2013'}</td>`; }
                    else { r += `<td class="spp-divider spp-tph-cell">${!isNaN(tph)?formatEU(tph):'\u2013'}</td>`; }
                    if (showTargets) { const vs = formatFCVsTarget(tph, s.sc, type, getWeekNumber(d.date)); r += `<td class="${vs.cssClass}">${vs.html}</td>`; }
                    if (showPlanned) { const pl = formatPlanned(tph, dd?.planned); r += `<td class="${pl.cssClass}" >${pl.html}</td>`; }
                    tphVals.push(tph);
                }
                if (showAverages) { const l4 = avgTPH(tphVals.slice(-4)); r += `<td class="spp-divider spp-avg-cell">${!isNaN(l4)?formatEU(l4):'\u2013'}</td>`; if (showTargets) { const vs = formatFCVsTarget(l4, s.sc, type, getWeekNumber(days[days.length-1].date)); r += `<td class="${vs.cssClass}">${!isNaN(l4)?vs.html:'\u2013'}</td>`; } }
                body += `<tr>${r}</tr>`;
            }
            return `<div><div style="color:var(--spp-text-secondary);font-size:11px;margin-bottom:6px;text-align:center;font-weight:600">${label}</div><div class="spp-table-container"><table class="spp-table"><thead><tr>${h1}</tr><tr>${h2}</tr></thead><tbody>${body}</tbody></table></div></div>`;
        }
        return `<div class="spp-ixd-charts">${buildSingleTable('ib','Inbound')}${buildSingleTable('ob','Outbound')}</div>`;
    }

    // ─── Number Parsing (European format) ────────────────────────────

    function parseEuropeanNumber(str) {
        if (!str) return NaN;
        let c = str.trim();
        if (c === '' || c === '-' || c === '\u2013') return NaN;
        c = c.replace(/\s/g, '');
        if (c.includes(',') && c.includes('.')) {
            c = c.replace(/\./g, '').replace(',', '.');
        } else if (c.includes(',')) {
            const parts = c.split(',');
            if (parts.length === 2 && parts[1].length === 3) { c = c.replace(',', ''); }
            else { c = c.replace(',', '.'); }
        } else if (c.includes('.')) {
            const p = c.split('.');
            if (p.length === 2 && p[1].length === 3) c = c.replace('.', '');
        }
        return parseFloat(c);
    }

    // ─── Date Utilities ──────────────────────────────────────────────

    function getWeekStart(weeksBack) {
        const now = new Date();
        const thisSun = new Date(now);
        thisSun.setDate(now.getDate() - now.getDay());
        thisSun.setHours(0, 0, 0, 0);
        const target = new Date(thisSun);
        target.setDate(thisSun.getDate() - (weeksBack * 7));
        return target;
    }

    function getWeekStartFromWeekNumber(year, weekNum) {
        const jan4 = new Date(year, 0, 4);
        const dayOfWeek = jan4.getDay() || 7;
        const isoWeek1Monday = new Date(jan4);
        isoWeek1Monday.setDate(jan4.getDate() - (dayOfWeek - 1));
        const targetMonday = new Date(isoWeek1Monday);
        targetMonday.setDate(isoWeek1Monday.getDate() + (weekNum - 1) * 7);
        const targetSunday = new Date(targetMonday);
        targetSunday.setDate(targetMonday.getDate() - 1);
        targetSunday.setHours(0, 0, 0, 0);
        return targetSunday;
    }

    function getDaysInWeek(weekStart) {
        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(weekStart);
            d.setDate(weekStart.getDate() + i);
            days.push(d);
        }
        return days;
    }

    function formatUrlDate(d) { return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`; }
    function formatShortDate(d) { return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
    function formatDayLabel(d) { return `${DAY_NAMES[d.getDay()]} ${d.getDate()}`; }

    function getWeekNumber(d) {
        const adjusted = new Date(d);
        if (adjusted.getDay() === 0) adjusted.setDate(adjusted.getDate() + 1);
        const date = new Date(Date.UTC(adjusted.getFullYear(), adjusted.getMonth(), adjusted.getDate()));
        date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
        return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
    }

    function getCurrentWeekNumber() { return getWeekNumber(new Date()); }

    function getAvailableWeeks() {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentWN = getCurrentWeekNumber();
        const weeks = [];
        for (let w = currentWN; w >= 1; w--) {
            const start = getWeekStartFromWeekNumber(currentYear, w);
            const end = new Date(start); end.setDate(start.getDate() + 6);
            weeks.push({ wNum: w, start, end, label: `W${w}` });
        }
        return weeks;
    }

    function formatEU(n, dec=2) { if (n===0||isNaN(n)) return '0'; return n.toLocaleString('de-DE',{minimumFractionDigits:dec,maximumFractionDigits:dec}); }
    function formatEUInt(n) { if (n===0||isNaN(n)) return '0'; return Math.round(n).toLocaleString('de-DE'); }
    function avgTPH(values) {
        const valid = values.filter(v => !isNaN(v) && v > 0);
        if (valid.length === 0) return NaN;
        return valid.reduce((a, b) => a + b, 0) / valid.length;
    }

    function getYesterday() {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        d.setHours(23, 59, 59, 999);
        return d;
    }

    // ─── HTTP Helpers ────────────────────────────────────────────────

    function fetchWithRetry(url, retries = MAX_RETRIES) {
        return new Promise((resolve, reject) => {
            const attempt = (rem) => {
                GM_xmlhttpRequest({
                    method: 'GET', url, responseType: 'text',
                    headers: { 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
                    timeout: 30000,
                    onload: (r) => { if (r.status===200) resolve(new DOMParser().parseFromString(r.responseText,'text/html')); else { if (rem>1) setTimeout(()=>attempt(rem-1),2000); else reject(new Error(`HTTP ${r.status}`)); } },
                    onerror: () => { if (rem>1) setTimeout(()=>attempt(rem-1),2000); else reject(new Error('Network error')); },
                    ontimeout: () => { if (rem>1) setTimeout(()=>attempt(rem-1),2000); else reject(new Error('Timeout')); }
                });
            };
            attempt(retries);
        });
    }

    function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

    // ─── URL Builders ────────────────────────────────────────────────

    function buildPPRUrlWeekly(sc, weekStart) {
        return `https://fclm-portal.amazon.com/reports/processPathRollup?reportFormat=HTML&warehouseId=${sc}&spanType=Week&startDateWeek=${encodeURIComponent(formatUrlDate(weekStart))}&maxIntradayDays=1&startHourIntraday=0&startMinuteIntraday=0&endHourIntraday=0&endMinuteIntraday=0&_adjustPlanHours=on&hideEmptyLineItems=true&_hideEmptyLineItems=on&_rememberViewForWarehouse=on&employmentType=AllEmployees`;
    }

    function buildPPRUrlDaily(sc, day) {
        return `https://fclm-portal.amazon.com/reports/processPathRollup?reportFormat=HTML&warehouseId=${sc}&spanType=Day&startDateDay=${encodeURIComponent(formatUrlDate(day))}&maxIntradayDays=1&startHourIntraday=0&startMinuteIntraday=0&endHourIntraday=0&endMinuteIntraday=0&_adjustPlanHours=on&hideEmptyLineItems=true&_hideEmptyLineItems=on&_rememberViewForWarehouse=on&employmentType=AllEmployees`;
    }

    // ─── Parsers ─────────────────────────────────────────────────────

    function parsePPR(doc) {
        try {
            let units = null, hours = null;
            const ar = doc.getElementById('ppr.detail.transport.amtran.amtranOut');
            if (ar) {
                const unitCell = ar.querySelector('td:nth-child(3) div') || ar.querySelector('td:nth-child(3)');
                if (unitCell) units = parseEuropeanNumber(unitCell.textContent);
                if (units === null || isNaN(units)) {
                    const c = ar.querySelectorAll('td');
                    units = parseEuropeanNumber(c[2]?.querySelector('div')?.textContent||c[2]?.textContent||'');
                }
            }

            // Hours: FC Summary Transport row
            const transportRow = doc.getElementById('ppr.fcSummary.transport');
            if (transportRow) {
                // Scan all td cells, find the hours column:
                // It's the cell with a value > 0 that is NOT the volume (volume is usually larger than hours)
                // Strategy: collect all numeric values, hours = the smallest positive value after the label columns
                const cells = transportRow.querySelectorAll('td');
                const candidates = [];
                for (let i = 1; i < cells.length; i++) {
                    const v = parseEuropeanNumber(cells[i]?.querySelector('div')?.textContent || cells[i]?.textContent || '');
                    if (!isNaN(v) && v > 0) candidates.push({ idx: i, val: v });
                }
                // Hours should be smaller than volume. Pick the candidate that makes sense as hours
                // (positive, smaller than units if we have units)
                if (units && units > 0) {
                    // Find the value closest to producing a reasonable TPH (between 5 and 50)
                    for (const c of candidates) {
                        const tph = units / c.val;
                        if (tph >= 5 && tph <= 50) { hours = c.val; break; }
                    }
                }
                // If that didn't work, just take the smallest positive candidate
                if (hours === null || isNaN(hours)) {
                    const sorted = candidates.filter(c => c.val > 0).sort((a, b) => a.val - b.val);
                    if (sorted.length > 0) hours = sorted[0].val;
                }
            }

            // Fallback selectors
            if (units===null||isNaN(units)) { for (const r of doc.querySelectorAll('tr[id*="amtranOut"]')) { const unitCell = r.querySelector('td:nth-child(3) div') || r.querySelector('td:nth-child(3)'); if (unitCell) { const v = parseEuropeanNumber(unitCell.textContent); if (!isNaN(v) && v > 0) { units = v; break; } } } }
            if (hours===null||isNaN(hours)) {
                const fallbackRow = doc.getElementById('ppr.fcSummary.throughput');
                if (fallbackRow) {
                    const hrsCell = fallbackRow.querySelector('td:nth-child(4) div') || fallbackRow.querySelector('td:nth-child(4)');
                    if (hrsCell) { const v = parseEuropeanNumber(hrsCell.textContent); if (!isNaN(v) && v > 0) hours = v; }
                }
            }
            if (units!==null&&!isNaN(units)&&hours!==null&&!isNaN(hours)) return {units,hours};
            return null;
        } catch(e) { return null; }
    }

    function parseIXD(doc) {
        try {
            const result = { inbound: null, da: null };
            const ibRow = doc.getElementById('ppr.detail.inbound.inbound.total');
            if (ibRow) {
                const cells = ibRow.querySelectorAll('td');
                const cap = parseEuropeanNumber(cells[3]?.querySelector('div')?.textContent || cells[3]?.textContent || '');
                const hrs = parseEuropeanNumber(cells[4]?.querySelector('div')?.textContent || cells[4]?.textContent || '');
                const tph = parseEuropeanNumber(cells[5]?.querySelector('div')?.textContent || cells[5]?.textContent || '');
                const planned = cells.length >= 7 ? parseEuropeanNumber(cells[6]?.querySelector('div')?.textContent || cells[6]?.textContent || '') : NaN;
                if (!isNaN(cap) && !isNaN(hrs)) { result.inbound = { units: cap, hours: hrs, tph: (!isNaN(tph) && tph > 0) ? tph : (hrs > 0 ? Math.round((cap / hrs) * 100) / 100 : 0), planned: !isNaN(planned) ? planned : 0 }; }
            }
            if (!result.inbound) { for (const r of doc.querySelectorAll('tr[id*="inbound.total"]')) { const cells = r.querySelectorAll('td'); if (cells.length >= 6) { const cap = parseEuropeanNumber(cells[3]?.querySelector('div')?.textContent || cells[3]?.textContent || ''); const hrs = parseEuropeanNumber(cells[4]?.querySelector('div')?.textContent || cells[4]?.textContent || ''); const tph = parseEuropeanNumber(cells[5]?.querySelector('div')?.textContent || cells[5]?.textContent || ''); const planned = cells.length >= 7 ? parseEuropeanNumber(cells[6]?.querySelector('div')?.textContent || cells[6]?.textContent || '') : NaN; if (!isNaN(cap) && !isNaN(hrs)) { result.inbound = { units: cap, hours: hrs, tph: (!isNaN(tph) && tph > 0) ? tph : (hrs > 0 ? Math.round((cap / hrs) * 100) / 100 : 0), planned: !isNaN(planned) ? planned : 0 }; break; } } } }
            const daRow = doc.getElementById('ppr.detail.da.da.total');
            if (daRow) {
                const cells = daRow.querySelectorAll('td');
                const cap = parseEuropeanNumber(cells[3]?.querySelector('div')?.textContent || cells[3]?.textContent || '');
                const hrs = parseEuropeanNumber(cells[4]?.querySelector('div')?.textContent || cells[4]?.textContent || '');
                const tph = parseEuropeanNumber(cells[5]?.querySelector('div')?.textContent || cells[5]?.textContent || '');
                const planned = cells.length >= 7 ? parseEuropeanNumber(cells[6]?.querySelector('div')?.textContent || cells[6]?.textContent || '') : NaN;
                if (!isNaN(cap) && !isNaN(hrs)) { result.da = { units: cap, hours: hrs, tph: (!isNaN(tph) && tph > 0) ? tph : (hrs > 0 ? Math.round((cap / hrs) * 100) / 100 : 0), planned: !isNaN(planned) ? planned : 0 }; }
            }
            if (!result.da) { for (const r of doc.querySelectorAll('tr[id*="da.total"]')) { const cells = r.querySelectorAll('td'); if (cells.length >= 6) { const cap = parseEuropeanNumber(cells[3]?.querySelector('div')?.textContent || cells[3]?.textContent || ''); const hrs = parseEuropeanNumber(cells[4]?.querySelector('div')?.textContent || cells[4]?.textContent || ''); const tph = parseEuropeanNumber(cells[5]?.querySelector('div')?.textContent || cells[5]?.textContent || ''); const planned = cells.length >= 7 ? parseEuropeanNumber(cells[6]?.querySelector('div')?.textContent || cells[6]?.textContent || '') : NaN; if (!isNaN(cap) && !isNaN(hrs)) { result.da = { units: cap, hours: hrs, tph: (!isNaN(tph) && tph > 0) ? tph : (hrs > 0 ? Math.round((cap / hrs) * 100) / 100 : 0), planned: !isNaN(planned) ? planned : 0 }; break; } } } }
            if (result.inbound || result.da) return result;
            return null;
        } catch (e) { return null; }
    }

    function parseFC(doc) {
        try {
            const result = { ib: null, ob: null };
            // Inbound → Total row: Cap=cells[3], Hrs=cells[4], Rate/TPH=cells[5], Planned=cells[6]
            const ibRow = doc.getElementById('ppr.detail.inbound.inbound.total');
            if (ibRow) {
                const cells = ibRow.querySelectorAll('td');
                if (cells.length >= 6) {
                    const cap = parseEuropeanNumber(cells[3]?.querySelector('div')?.textContent || cells[3]?.textContent || '');
                    const hrs = parseEuropeanNumber(cells[4]?.querySelector('div')?.textContent || cells[4]?.textContent || '');
                    const tph = parseEuropeanNumber(cells[5]?.querySelector('div')?.textContent || cells[5]?.textContent || '');
                    const planned = cells.length >= 7 ? parseEuropeanNumber(cells[6]?.querySelector('div')?.textContent || cells[6]?.textContent || '') : NaN;
                    if (!isNaN(tph)) result.ib = { units: !isNaN(cap) ? cap : 0, hours: !isNaN(hrs) ? hrs : 0, tph, planned: !isNaN(planned) ? planned : 0 };
                }
            }
            if (!result.ib) {
                for (const r of doc.querySelectorAll('tr[id*="inbound"][id*="total"]')) {
                    const cells = r.querySelectorAll('td');
                    if (cells.length >= 6) {
                        const cap = parseEuropeanNumber(cells[3]?.querySelector('div')?.textContent || cells[3]?.textContent || '');
                        const hrs = parseEuropeanNumber(cells[4]?.querySelector('div')?.textContent || cells[4]?.textContent || '');
                        const tph = parseEuropeanNumber(cells[5]?.querySelector('div')?.textContent || cells[5]?.textContent || '');
                        const planned = cells.length >= 7 ? parseEuropeanNumber(cells[6]?.querySelector('div')?.textContent || cells[6]?.textContent || '') : NaN;
                        if (!isNaN(tph) && tph > 0) { result.ib = { units: !isNaN(cap) ? cap : 0, hours: !isNaN(hrs) ? hrs : 0, tph, planned: !isNaN(planned) ? planned : 0 }; break; }
                    }
                }
            }
            // Outbound → Total row: same structure
            const obRow = doc.getElementById('ppr.detail.outbound.outbound.total');
            if (obRow) {
                const cells = obRow.querySelectorAll('td');
                if (cells.length >= 6) {
                    const cap = parseEuropeanNumber(cells[3]?.querySelector('div')?.textContent || cells[3]?.textContent || '');
                    const hrs = parseEuropeanNumber(cells[4]?.querySelector('div')?.textContent || cells[4]?.textContent || '');
                    const tph = parseEuropeanNumber(cells[5]?.querySelector('div')?.textContent || cells[5]?.textContent || '');
                    const planned = cells.length >= 7 ? parseEuropeanNumber(cells[6]?.querySelector('div')?.textContent || cells[6]?.textContent || '') : NaN;
                    if (!isNaN(tph)) result.ob = { units: !isNaN(cap) ? cap : 0, hours: !isNaN(hrs) ? hrs : 0, tph, planned: !isNaN(planned) ? planned : 0 };
                }
            }
            if (!result.ob) {
                for (const r of doc.querySelectorAll('tr[id*="outbound"][id*="total"]')) {
                    const cells = r.querySelectorAll('td');
                    if (cells.length >= 6) {
                        const cap = parseEuropeanNumber(cells[3]?.querySelector('div')?.textContent || cells[3]?.textContent || '');
                        const hrs = parseEuropeanNumber(cells[4]?.querySelector('div')?.textContent || cells[4]?.textContent || '');
                        const tph = parseEuropeanNumber(cells[5]?.querySelector('div')?.textContent || cells[5]?.textContent || '');
                        const planned = cells.length >= 7 ? parseEuropeanNumber(cells[6]?.querySelector('div')?.textContent || cells[6]?.textContent || '') : NaN;
                        if (!isNaN(tph) && tph > 0) { result.ob = { units: !isNaN(cap) ? cap : 0, hours: !isNaN(hrs) ? hrs : 0, tph, planned: !isNaN(planned) ? planned : 0 }; break; }
                    }
                }
            }
            if (result.ib || result.ob) return result;
            return null;
        } catch(e) { return null; }
    }

    // ─── Data Fetch: FC ──────────────────────────────────────────────

    async function fetchFCWeeklyData(selectedFCs, weekStarts, onProgress, startOffset) {
        const totalRequests = selectedFCs.length * weekStarts.length;
        let completed = 0;
        const fcData = [];
        for (const fc of selectedFCs) {
            const fcResult = { sc: fc, weeks: [] };
            for (const weekStart of weekStarts) {
                const wNum = getWeekNumber(weekStart);
                const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
                const weekLabel = `W${wNum} (${formatShortDate(weekStart)} \u2013 ${formatShortDate(weekEnd)})`;
                const weekData = { label: weekLabel, wNum, start: weekStart, end: weekEnd, ib: null, ob: null };
                try {
                    const pprDoc = await fetchWithRetry(buildPPRUrlWeekly(fc, weekStart));
                    const d = parseFC(pprDoc);
                    if (d) {
                        weekData.ib = d.ib || { tph: 0, error: 'No IB' };
                        weekData.ob = d.ob || { tph: 0, error: 'No OB' };
                    } else {
                        weekData.ib = { tph: 0, error: 'Parse failed' };
                        weekData.ob = { tph: 0, error: 'Parse failed' };
                    }
                } catch(e) { weekData.ib = { tph: 0, error: e.message }; weekData.ob = { tph: 0, error: e.message }; }
                completed++; if (abortRequested) throw new Error('Stopped'); if (onProgress) onProgress(startOffset + completed, startOffset + totalRequests);
                fcResult.weeks.push(weekData);
            }
            fcData.push(fcResult);
        }
        return fcData;
    }

    async function fetchFCDailyData(selectedFCs, weekStart, onProgress, maxDay, startOffset) {
        let days = getDaysInWeek(weekStart);
        if (maxDay) { days = days.filter(d => d <= maxDay); }
        if (days.length === 0) return [];
        const totalRequests = selectedFCs.length * days.length;
        let completed = 0;
        const fcData = [];
        for (const fc of selectedFCs) {
            const fcResult = { sc: fc, days: [] };
            for (const day of days) {
                const dayData = { date: day, label: formatDayLabel(day), ib: null, ob: null };
                try {
                    const pprDoc = await fetchWithRetry(buildPPRUrlDaily(fc, day));
                    const d = parseFC(pprDoc);
                    if (d) {
                        dayData.ib = d.ib || { tph: 0, error: 'No IB' };
                        dayData.ob = d.ob || { tph: 0, error: 'No OB' };
                    } else {
                        dayData.ib = { tph: 0, error: 'Parse failed' };
                        dayData.ob = { tph: 0, error: 'Parse failed' };
                    }
                } catch(e) { dayData.ib = { tph: 0, error: e.message }; dayData.ob = { tph: 0, error: e.message }; }
                completed++; if (abortRequested) throw new Error('Stopped'); if (onProgress) onProgress(startOffset + completed, startOffset + totalRequests);
                fcResult.days.push(dayData);
            }
            fcData.push(fcResult);
        }
        return fcData;
    }

    // ─── Data Fetch: Weekly ──────────────────────────────────────────

    async function fetchWeeklyData(selectedSCs, selectedIXDs, weekStarts, onProgress) {
        const totalRequests = (selectedSCs.length * weekStarts.length) + (selectedIXDs.length * weekStarts.length);
        let completed = 0;

        const scData = [];
        for (const sc of selectedSCs) {
            const scResult = { sc, weeks: [] };
            for (const weekStart of weekStarts) {
                const wNum = getWeekNumber(weekStart);
                const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
                const weekLabel = `W${wNum} (${formatShortDate(weekStart)} \u2013 ${formatShortDate(weekEnd)})`;
                const weekData = { label: weekLabel, wNum, start: weekStart, end: weekEnd, ppr: null };

                try {
                    const pprDoc = await fetchWithRetry(buildPPRUrlWeekly(sc, weekStart));
                    const d = parsePPR(pprDoc);
                    if (d && d.hours > 0) weekData.ppr = { units: d.units, hours: d.hours, tph: Math.round((d.units / d.hours) * 100) / 100 };
                    else if (d) weekData.ppr = { units: d.units, hours: d.hours || 0, tph: 0 };
                } catch (e) { weekData.ppr = { units: 0, hours: 0, tph: 0, error: e.message }; }
                completed++; if (abortRequested) throw new Error('Stopped'); onProgress(completed, totalRequests);

                scResult.weeks.push(weekData);
            }
            scData.push(scResult);
        }

        const ixdData = [];
        for (const site of selectedIXDs) {
            const siteResult = { sc: site, weeks: [] };
            for (const weekStart of weekStarts) {
                const wNum = getWeekNumber(weekStart);
                const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
                const weekLabel = `W${wNum} (${formatShortDate(weekStart)} \u2013 ${formatShortDate(weekEnd)})`;
                const weekData = { label: weekLabel, wNum, start: weekStart, end: weekEnd, inbound: null, da: null };
                try {
                    const pprDoc = await fetchWithRetry(buildPPRUrlWeekly(site, weekStart));
                    const d = parseIXD(pprDoc);
                    if (d) { weekData.inbound = d.inbound || { units: 0, hours: 0, tph: 0, error: 'No IB' }; weekData.da = d.da || { units: 0, hours: 0, tph: 0, error: 'No DA' }; }
                    else { weekData.inbound = { units: 0, hours: 0, tph: 0, error: 'Parse failed' }; weekData.da = { units: 0, hours: 0, tph: 0, error: 'Parse failed' }; }
                } catch (e) { weekData.inbound = { units: 0, hours: 0, tph: 0, error: e.message }; weekData.da = { units: 0, hours: 0, tph: 0, error: e.message }; }
                completed++; if (abortRequested) throw new Error('Stopped'); onProgress(completed, totalRequests);
                siteResult.weeks.push(weekData);
            }
            ixdData.push(siteResult);
        }
        return { scData, ixdData };
    }

    // ─── Data Fetch: Daily ───────────────────────────────────────────

    async function fetchDailyData(selectedSCs, selectedIXDs, weekStart, onProgress, maxDay) {
        let days = getDaysInWeek(weekStart);
        if (maxDay) { days = days.filter(d => d <= maxDay); }
        if (days.length === 0) { return { scData: [], ixdData: [] }; }

        const totalRequests = (selectedSCs.length * days.length) + (selectedIXDs.length * days.length);
        let completed = 0;

        const scData = [];
        for (const sc of selectedSCs) {
            const scResult = { sc, days: [] };
            for (const day of days) {
                const dayData = { date: day, label: formatDayLabel(day), ppr: null };

                try {
                    const pprDoc = await fetchWithRetry(buildPPRUrlDaily(sc, day));
                    const d = parsePPR(pprDoc);
                    if (d && d.hours > 0) dayData.ppr = { units: d.units, hours: d.hours, tph: Math.round((d.units / d.hours) * 100) / 100 };
                    else if (d) dayData.ppr = { units: d.units, hours: d.hours || 0, tph: 0 };
                } catch (e) { dayData.ppr = { units: 0, hours: 0, tph: 0, error: e.message }; }
                completed++; if (abortRequested) throw new Error('Stopped'); onProgress(completed, totalRequests);

                scResult.days.push(dayData);
            }
            scData.push(scResult);
        }

        const ixdData = [];
        for (const site of selectedIXDs) {
            const siteResult = { sc: site, days: [] };
            for (const day of days) {
                const dayData = { date: day, label: formatDayLabel(day), inbound: null, da: null };
                try {
                    const pprDoc = await fetchWithRetry(buildPPRUrlDaily(site, day));
                    const d = parseIXD(pprDoc);
                    if (d) { dayData.inbound = d.inbound || { units: 0, hours: 0, tph: 0, error: 'No IB' }; dayData.da = d.da || { units: 0, hours: 0, tph: 0, error: 'No DA' }; }
                    else { dayData.inbound = { units: 0, hours: 0, tph: 0, error: 'Parse failed' }; dayData.da = { units: 0, hours: 0, tph: 0, error: 'Parse failed' }; }
                } catch (e) { dayData.inbound = { units: 0, hours: 0, tph: 0, error: e.message }; dayData.da = { units: 0, hours: 0, tph: 0, error: e.message }; }
                completed++; if (abortRequested) throw new Error('Stopped'); onProgress(completed, totalRequests);
                siteResult.days.push(dayData);
            }
            ixdData.push(siteResult);
        }
        return { scData, ixdData };
    }

    // ─── CSS Styles ──────────────────────────────────────────────────

    const styles = `
        :root{--spp-bg-primary:#0f1117;--spp-bg-secondary:#1a1d27;--spp-bg-tertiary:#252833;--spp-bg-card:#1e2130;--spp-text-primary:#e8eaed;--spp-text-secondary:#9aa0a6;--spp-accent:#4d9fff;--spp-accent-hover:#3d8df0;--spp-success:#34d399;--spp-error:#f87171;--spp-warning:#fbbf24;--spp-border:#2d3140;--spp-shadow:0 4px 24px rgba(0,0,0,.4);--spp-radius:10px;--spp-transition:all .2s ease;--spp-avg:#a0aec0}
        .spp-button{position:fixed;bottom:24px;right:24px;background:linear-gradient(135deg,var(--spp-accent),#6366f1);color:#fff;border:none;border-radius:var(--spp-radius);padding:16px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;font-weight:600;cursor:pointer;z-index:9999;box-shadow:var(--spp-shadow);transition:var(--spp-transition)}
        .spp-button:hover{transform:translateY(-2px);box-shadow:0 6px 30px rgba(77,159,255,.4)}
        .spp-dashboard{position:fixed;top:0;left:0;right:0;bottom:0;width:100vw;height:100vh;background:var(--spp-bg-primary);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;z-index:10000;overflow:hidden;display:flex;flex-direction:column;animation:spp-fadeIn .3s ease}
        @keyframes spp-fadeIn{from{opacity:0}to{opacity:1}}
        .spp-dash-header{display:flex;justify-content:space-between;align-items:center;padding:16px 32px;background:var(--spp-bg-secondary);border-bottom:1px solid var(--spp-border)}
        .spp-dash-title{color:var(--spp-text-primary);font-weight:700;font-size:20px;margin:0;display:flex;align-items:center;gap:12px}
        .spp-dash-title span{font-size:24px}
        .spp-dash-subtitle{color:var(--spp-text-secondary);font-size:12px;margin-top:2px}
        .spp-close{background:var(--spp-bg-tertiary);border:1px solid var(--spp-border);color:var(--spp-text-secondary);font-size:18px;cursor:pointer;padding:8px 14px;border-radius:var(--spp-radius);transition:var(--spp-transition)}
        .spp-close:hover{background:var(--spp-error);color:#fff;border-color:var(--spp-error)}
        .spp-dash-body{display:flex;flex:1;overflow:hidden}
        .spp-sidebar{width:300px;min-width:280px;background:var(--spp-bg-secondary);border-right:1px solid var(--spp-border);padding:20px;overflow-y:auto;display:flex;flex-direction:column;gap:16px;transition:width .3s ease,min-width .3s ease,padding .3s ease}
        .spp-sidebar.collapsed{width:40px;min-width:40px;padding:10px 6px;overflow:hidden}
        .spp-sidebar.collapsed .spp-sidebar-content{display:none}
        .spp-sidebar-toggle{background:var(--spp-bg-tertiary);border:1px solid var(--spp-border);color:var(--spp-text-secondary);width:28px;height:28px;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;margin-bottom:4px;flex-shrink:0;transition:var(--spp-transition)}
        .spp-sidebar-toggle:hover{background:var(--spp-accent);color:#fff;border-color:var(--spp-accent)}
        .spp-main{flex:1;overflow-y:auto;padding:24px 32px}
        .spp-filter-group{background:var(--spp-bg-card);border:1px solid var(--spp-border);border-radius:var(--spp-radius);padding:14px}
        .spp-filter-group-title{color:var(--spp-text-primary);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;display:flex;align-items:center;gap:6px}
        .spp-chip{display:inline-flex;align-items:center;background:var(--spp-bg-tertiary);border:1px solid var(--spp-border);color:var(--spp-text-secondary);padding:5px 10px;border-radius:16px;font-size:11px;cursor:pointer;transition:var(--spp-transition);user-select:none;margin:2px}
        .spp-chip:hover{border-color:var(--spp-accent);color:var(--spp-text-primary)}
        .spp-chip.selected{background:var(--spp-accent);border-color:var(--spp-accent);color:#fff;font-weight:600}
        .spp-chip.all-btn{border-color:var(--spp-success);color:var(--spp-success);font-size:10px}
        .spp-chip.none-btn{border-color:var(--spp-error);color:var(--spp-error);font-size:10px}
        .spp-chip.shortcut-btn{border-color:var(--spp-warning);color:var(--spp-warning);font-size:10px}
        .spp-chips-row{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}
        .spp-week-chips-scroll{max-height:100px;overflow-y:auto;margin-top:6px}
        .spp-toggle-row{display:flex;align-items:center;gap:10px;margin-top:8px}
        .spp-toggle{position:relative;width:36px;height:20px;background:var(--spp-bg-tertiary);border-radius:10px;cursor:pointer;transition:var(--spp-transition);border:1px solid var(--spp-border)}
        .spp-toggle.active{background:var(--spp-accent);border-color:var(--spp-accent)}
        .spp-toggle::after{content:'';position:absolute;top:2px;left:2px;width:14px;height:14px;background:#fff;border-radius:50%;transition:var(--spp-transition)}
        .spp-toggle.active::after{left:18px}
        .spp-toggle-label{color:var(--spp-text-secondary);font-size:11px}
        .spp-tabs{display:flex;gap:0;margin-bottom:0;background:var(--spp-bg-card);border:1px solid var(--spp-border);border-radius:var(--spp-radius);overflow:hidden}
        .spp-tab{flex:1;padding:10px 16px;color:var(--spp-text-secondary);font-size:12px;font-weight:600;cursor:pointer;text-align:center;transition:var(--spp-transition);border:none}
        .spp-tab:hover{color:var(--spp-text-primary);background:var(--spp-bg-tertiary)}
        .spp-tab.active{color:#fff;background:var(--spp-accent)}
        .spp-run-btn{width:100%;background:linear-gradient(135deg,var(--spp-accent),#6366f1);border:none;color:#fff;padding:14px;border-radius:var(--spp-radius);font-size:13px;font-weight:700;cursor:pointer;transition:var(--spp-transition);letter-spacing:.3px}
        .spp-run-btn:hover{transform:translateY(-1px);box-shadow:0 4px 15px rgba(77,159,255,.3)}
        .spp-run-btn:disabled{opacity:.5;cursor:not-allowed;transform:none;box-shadow:none}
        .spp-progress{background:var(--spp-bg-tertiary);border-radius:20px;height:6px;overflow:hidden;margin:12px 0}
        .spp-progress-bar{background:linear-gradient(90deg,var(--spp-accent),var(--spp-success));height:100%;border-radius:20px;transition:width .3s ease;width:0%}
        .spp-progress-text{text-align:center;color:var(--spp-text-secondary);font-size:11px;margin-top:4px}
        .spp-status{color:var(--spp-text-secondary);font-size:11px;margin-top:8px;text-align:center}
        .spp-section-title{color:var(--spp-text-primary);font-size:15px;font-weight:700;margin:28px 0 12px 0;display:flex;align-items:center;gap:8px}
        .spp-section-title:first-of-type{margin-top:0}
        .spp-table-container{background:var(--spp-bg-card);border:1px solid var(--spp-border);border-radius:var(--spp-radius);overflow:auto;margin-bottom:16px}
        .spp-table{width:100%;border-collapse:collapse;font-size:12px;table-layout:auto}
        .spp-table th,.spp-table td{padding:10px 12px;white-space:nowrap;border-bottom:1px solid rgba(45,49,64,.5)}
        .spp-table thead th{position:sticky;top:0;z-index:5;background:var(--spp-bg-tertiary);color:var(--spp-text-primary);font-weight:600;text-align:center;border-bottom:2px solid var(--spp-border)}
        .spp-table thead th.spp-week-header{border-bottom:2px solid var(--spp-accent);font-size:12px}
        .spp-table thead th.spp-avg-header{border-bottom:2px solid var(--spp-avg);font-size:12px;background:rgba(160,174,192,.06)}
        .spp-table thead th.spp-sc-header{text-align:left;min-width:60px}
        .spp-table tbody td{color:var(--spp-text-secondary);text-align:center}
        .spp-table tbody td:first-child{text-align:left;font-weight:600;color:var(--spp-text-primary);position:sticky;left:0;background:var(--spp-bg-card);z-index:2;border-right:2px solid var(--spp-border)}
        .spp-table thead th:first-child{position:sticky;left:0;z-index:10;text-align:left}
        .spp-table thead tr:first-child th:first-child{position:sticky;left:0;z-index:10;text-align:left}
        .spp-table thead tr:nth-child(2) th:first-child{position:static;text-align:center}
        .spp-table tbody tr:hover{background:rgba(77,159,255,.04)}
        .spp-table .spp-tph-cell{font-weight:700;color:var(--spp-accent)}
        .spp-table .spp-tph-green{font-weight:700;color:#34d399}
        .spp-table .spp-tph-yellow{font-weight:700;color:#fbbf24}
        .spp-table .spp-tph-red{font-weight:700;color:#f87171}
        .spp-table .spp-vs-green{font-weight:700;color:#34d399}
        .spp-table .spp-vs-yellow{font-weight:700;color:#fbbf24}
        .spp-table .spp-vs-red{font-weight:700;color:#f87171}
        .spp-table .spp-avg-cell{font-weight:700;color:var(--spp-avg)}
        .spp-table .spp-error-cell{color:var(--spp-error);font-style:italic}
        .spp-table .spp-divider{border-left:2px solid var(--spp-border)}
        .spp-target-input{width:50px;background:var(--spp-bg-tertiary);border:1px solid var(--spp-border);color:var(--spp-text-primary);padding:4px 6px;border-radius:4px;font-size:11px;text-align:center}
        .spp-target-input:focus{border-color:var(--spp-accent);outline:none}
        .spp-target-grid{display:grid;grid-template-columns:auto 1fr;gap:6px 10px;align-items:center;margin-top:8px}
        .spp-target-label{color:var(--spp-text-secondary);font-size:11px;font-weight:600}
        .spp-chart-section{background:var(--spp-bg-card);border:1px solid var(--spp-border);border-radius:var(--spp-radius);padding:16px;margin-bottom:16px}
        .spp-chart-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
        .spp-chart-title{color:var(--spp-text-primary);font-size:13px;font-weight:700}
        .spp-chart-toggles{display:flex;flex-wrap:wrap;gap:4px}
        .spp-target-toggle{display:inline-flex;align-items:center;gap:4px;background:var(--spp-bg-tertiary);border:1px solid var(--spp-border);color:var(--spp-text-secondary);padding:3px 8px;border-radius:12px;font-size:10px;cursor:pointer;transition:var(--spp-transition);user-select:none}
        .spp-target-toggle:hover{border-color:var(--spp-accent)}
        .spp-target-toggle.active{border-color:currentColor;opacity:1}
        .spp-target-toggle .spp-toggle-dash{width:12px;height:0;border-top:2px dashed currentColor}
        .spp-chart-canvas-wrap{position:relative;height:280px}
        .spp-ixd-charts{display:grid;grid-template-columns:1fr 1fr;gap:16px}
        .spp-ixd-chart-wrap{position:relative;height:240px}
        .spp-error-msg{background:rgba(248,113,113,.08);border:1px solid var(--spp-error);color:var(--spp-error);padding:14px 18px;border-radius:var(--spp-radius);margin:16px 0;font-size:13px}
        .spp-info{color:var(--spp-text-secondary);font-size:11px;margin-top:16px}
        .spp-copy-btn{background:var(--spp-bg-card);border:1px solid var(--spp-border);color:var(--spp-text-primary);padding:10px 20px;border-radius:var(--spp-radius);font-size:12px;cursor:pointer;transition:var(--spp-transition);margin-top:16px}
        .spp-copy-btn:hover{background:var(--spp-accent);border-color:var(--spp-accent)}
        .spp-spinner{width:24px;height:24px;border:3px solid var(--spp-bg-tertiary);border-top:3px solid var(--spp-accent);border-radius:50%;animation:spp-spin 1s linear infinite;display:inline-block;vertical-align:middle;margin-right:8px}
        @keyframes spp-spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}
        .spp-empty-state{text-align:center;padding:80px 40px;color:var(--spp-text-secondary)}
        .spp-empty-state h3{color:var(--spp-text-primary);margin-bottom:8px;font-size:18px}
        .spp-empty-state p{font-size:13px;max-width:400px;margin:0 auto}
        .spp-year-select{background:var(--spp-bg-tertiary);border:1px solid var(--spp-border);color:var(--spp-text-primary);padding:5px 10px;border-radius:6px;font-size:12px;cursor:pointer;outline:none}
        .spp-year-select:focus{border-color:var(--spp-accent)}
        /* Light, ink-friendly theme applied only while capturing the PDF snapshot */
        .spp-pdf-capture { background: #ffffff !important; padding: 12px !important; overflow: visible !important; height: auto !important; }
        .spp-pdf-capture, .spp-pdf-capture * { color: #111 !important; }
        /* Force all scrollable areas open so nothing is clipped in the snapshot */
        .spp-pdf-capture .spp-table-container, .spp-pdf-capture .spp-main { overflow: visible !important; max-height: none !important; height: auto !important; }
        /* Let the two-column grids size each row to its tallest content (no clipping) */
        .spp-pdf-capture .spp-ixd-charts { grid-auto-rows: min-content !important; align-items: start !important; }
        /* html2canvas mishandles position:sticky (pins headers/first column to wrong spot,
           causing the top group-header row to look cropped). Force static during capture. */
        .spp-pdf-capture .spp-table thead th,
        .spp-pdf-capture .spp-table tbody td:first-child,
        .spp-pdf-capture .spp-table thead th:first-child,
        .spp-pdf-capture .spp-table thead tr:first-child th:first-child { position: static !important; }
        .spp-pdf-capture .spp-section-title, .spp-pdf-capture .spp-chart-title { color: #000 !important; }
        .spp-pdf-capture .spp-table-container, .spp-pdf-capture .spp-chart-section { background: #fff !important; border: 1px solid #ccc !important; overflow: visible !important; }
        .spp-pdf-capture .spp-table thead th { background: #f0f0f0 !important; color: #000 !important; border-bottom: 2px solid #999 !important; }
        .spp-pdf-capture .spp-table th, .spp-pdf-capture .spp-table td { border-bottom: 1px solid #ddd !important; }
        .spp-pdf-capture .spp-table .spp-divider { border-left: 2px solid #bbb !important; }
        .spp-pdf-capture .spp-table tbody td:first-child { background: #fff !important; border-right: 2px solid #bbb !important; }
        .spp-pdf-capture .spp-table .spp-tph-cell { color: #1a56b0 !important; }
        .spp-pdf-capture .spp-table .spp-vs-green, .spp-pdf-capture .spp-table .spp-tph-green { color: #157347 !important; }
        .spp-pdf-capture .spp-table .spp-vs-yellow, .spp-pdf-capture .spp-table .spp-tph-yellow { color: #997404 !important; }
        .spp-pdf-capture .spp-table .spp-vs-red, .spp-pdf-capture .spp-table .spp-tph-red { color: #b02a37 !important; }
        .spp-pdf-capture .spp-table .spp-avg-cell { color: #555 !important; }
        .spp-pdf-capture .spp-info { color: #444 !important; }
        /* Hide interactive chart controls (the site toggle "pills") in the snapshot */
        .spp-pdf-capture .spp-chart-toggles { display: none !important; }
        /* Ensure chart wrappers don't clip their canvas during capture */
        .spp-pdf-capture .spp-chart-canvas-wrap, .spp-pdf-capture .spp-ixd-chart-wrap { overflow: visible !important; }
        .spp-pdf-capture .spp-chart-section { break-inside: avoid; }
    `;
    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);

    // ─── Table Rendering: Weekly ─────────────────────────────────────

    function buildWeeklySourceTable(data, source) {
        if (!data || data.length === 0) return '';
        const weeks = data[0].weeks;
        const colSpan = 1 + (showDetails ? 2 : 0) + (showTargets ? 1 : 0);
        let h1 = '<th class="spp-sc-header" rowspan="2">SC</th>';
        let h2 = '';
        for (const w of weeks) {
            h1 += `<th class="spp-week-header spp-divider" colspan="${colSpan}">W${w.wNum}</th>`;
            h2 += showDetails ? '<th class="spp-divider">Capacity</th><th>Hours</th><th>TPH</th>' : '<th class="spp-divider">TPH</th>';
            if (showTargets) h2 += '<th>vs Target</th>';
        }
        if (showAverages && weeks.length >= 2) {
            const avgSpan = 1 + (showTargets ? 1 : 0);
            h1 += `<th class="spp-avg-header spp-divider" colspan="${avgSpan}">Avg L4</th>`;
            h2 += '<th class="spp-divider">TPH</th>';
            if (showTargets) h2 += '<th>vs Target</th>';
        }
        let body = '';
        for (const s of data) {
            let r = `<td>${s.sc}</td>`; const tphValues = [];
            for (const w of s.weeks) {
                const d = w[source];
                if (d && !d.error) {
                    if (showDetails) { r += `<td class="spp-divider">${formatEUInt(d.units)}</td><td>${formatEU(d.hours)}</td><td class="spp-tph-cell">${formatEU(d.tph)}</td>`; }
                    else { r += `<td class="spp-divider spp-tph-cell">${formatEU(d.tph)}</td>`; }
                    if (showTargets) { const vs = formatVsTarget(d.tph, s.sc, w.wNum); r += `<td class="${vs.cssClass}">${vs.html}</td>`; }
                    tphValues.push(d.tph);
                } else {
                    if (showDetails) { r += `<td class="spp-divider spp-error-cell">\u2013</td><td class="spp-error-cell">\u2013</td><td class="spp-error-cell">\u2013</td>`; }
                    else { r += `<td class="spp-divider spp-error-cell">\u2013</td>`; }
                    if (showTargets) r += '<td>\u2013</td>';
                    tphValues.push(NaN);
                }
            }
            if (showAverages && weeks.length >= 2) {
                const l4 = avgTPH(tphValues.slice(-4));
                r += `<td class="spp-divider spp-avg-cell">${!isNaN(l4)?formatEU(l4):'\u2013'}</td>`;
                if (showTargets) { const vs = formatVsTarget(l4, s.sc, weeks[weeks.length-1].wNum); r += `<td class="${vs.cssClass}">${!isNaN(l4)?vs.html:'\u2013'}</td>`; }
            }
            body += `<tr>${r}</tr>`;
        }
        return `<div class="spp-table-container"><table class="spp-table"><thead><tr>${h1}</tr><tr>${h2}</tr></thead><tbody>${body}</tbody></table></div>`;
    }

    function buildWeeklyIXDTable(ixdData) {
        if (!ixdData || ixdData.length === 0) return '';
        const weeks = ixdData[0].weeks;
        function buildSingleTable(type, label) {
            const colSpan = 1 + (showDetails ? 2 : 0) + (showTargets ? 1 : 0) + (showPlanned ? 1 : 0);
            let h1 = `<th class="spp-sc-header" rowspan="2">Site</th>`;
            let h2 = '';
            for (const w of weeks) {
                h1 += `<th class="spp-week-header spp-divider" colspan="${colSpan}">W${w.wNum}</th>`;
                h2 += showDetails ? '<th class="spp-divider">Cap</th><th>Hrs</th><th>TPH</th>' : '<th class="spp-divider">TPH</th>';
                if (showTargets) h2 += '<th>vs Target</th>';
                if (showPlanned) h2 += '<th>vs Plan</th>';
            }
            if (showAverages && weeks.length >= 2) { const avgSpan = 1 + (showTargets ? 1 : 0); h1 += `<th class="spp-avg-header spp-divider" colspan="${avgSpan}">Avg L4</th>`; h2 += '<th class="spp-divider">TPH</th>'; if (showTargets) h2 += '<th>vs Target</th>'; }
            let body = '';
            for (const s of ixdData) {
                let r = `<td>${s.sc}</td>`; const tphVals = [];
                for (const w of s.weeks) {
                    const d = w[type === 'ib' ? 'inbound' : 'da'];
                    const tph = (d && !d.error && d.tph > 0) ? d.tph : NaN;
                    if (!isNaN(tph)) {
                        if (showDetails) { r += `<td class="spp-divider">${formatEUInt(d.units)}</td><td>${formatEU(d.hours)}</td><td class="spp-tph-cell">${formatEU(tph)}</td>`; }
                        else { r += `<td class="spp-divider spp-tph-cell">${formatEU(tph)}</td>`; }
                        if (showTargets) { const vs = formatIXDVsTarget(tph, s.sc, type, w.wNum); r += `<td class="${vs.cssClass}">${vs.html}</td>`; }
                        if (showPlanned) { const pl = formatPlanned(tph, d?.planned); r += `<td class="${pl.cssClass}" >${pl.html}</td>`; }
                    } else {
                        if (showDetails) { r += `<td class="spp-divider spp-error-cell">\u2013</td><td class="spp-error-cell">\u2013</td><td class="spp-error-cell">\u2013</td>`; }
                        else { r += `<td class="spp-divider spp-error-cell">\u2013</td>`; }
                        if (showTargets) r += '<td>\u2013</td>';
                        if (showPlanned) r += '<td>\u2013</td>';
                    }
                    tphVals.push(tph);
                }
                if (showAverages && weeks.length >= 2) { const l4 = avgTPH(tphVals.slice(-4)); r += `<td class="spp-divider spp-avg-cell">${!isNaN(l4)?formatEU(l4):'\u2013'}</td>`; if (showTargets) { const vs = formatIXDVsTarget(l4, s.sc, type, weeks[weeks.length-1].wNum); r += `<td class="${vs.cssClass}">${!isNaN(l4)?vs.html:'\u2013'}</td>`; } }
                body += `<tr>${r}</tr>`;
            }
            return `<div><div style="color:var(--spp-text-secondary);font-size:11px;margin-bottom:6px;text-align:center;font-weight:600">${label}</div><div class="spp-table-container"><table class="spp-table"><thead><tr>${h1}</tr><tr>${h2}</tr></thead><tbody>${body}</tbody></table></div></div>`;
        }
        return `<div class="spp-ixd-charts">${buildSingleTable('ib','Inbound')}${buildSingleTable('da','DA')}</div>`;
    }

    // ─── Table Rendering: Daily ──────────────────────────────────────

    function buildDailySourceTable(data, source) {
        if (!data || data.length === 0) return '';
        const days = data[0].days;
        const colSpan = 1 + (showDetails ? 2 : 0) + (showTargets ? 1 : 0);
        let h1 = '<th class="spp-sc-header" rowspan="2">SC</th>';
        let h2 = '';
        for (const d of days) {
            h1 += `<th class="spp-week-header spp-divider" colspan="${colSpan}">${d.label}</th>`;
            h2 += showDetails ? '<th class="spp-divider">Capacity</th><th>Hours</th><th>TPH</th>' : '<th class="spp-divider">TPH</th>';
            if (showTargets) h2 += '<th>vs Target</th>';
        }
        const avgSpan = 1 + (showTargets ? 1 : 0);
        if (showAverages) {
            h1 += `<th class="spp-avg-header spp-divider" colspan="${avgSpan}">Avg L4</th>`;
            h2 += '<th class="spp-divider">TPH</th>';
            if (showTargets) h2 += '<th>vs Target</th>';
        }
        let body = '';
        for (const s of data) {
            let r = `<td>${s.sc}</td>`; let totalCap = 0, totalHrs = 0; const tphValues = [];
            for (const d of s.days) {
                const v = d[source];
                if (v && !v.error) {
                    if (showDetails) { r += `<td class="spp-divider">${formatEUInt(v.units)}</td><td>${formatEU(v.hours)}</td><td class="spp-tph-cell">${formatEU(v.tph)}</td>`; }
                    else { r += `<td class="spp-divider spp-tph-cell">${formatEU(v.tph)}</td>`; }
                    if (showTargets) { const vs = formatVsTarget(v.tph, s.sc, getWeekNumber(d.date||days[0].date)); r += `<td class="${vs.cssClass}">${vs.html}</td>`; }
                    totalCap += v.units || 0; totalHrs += v.hours || 0;
                    tphValues.push(v.tph);
                } else {
                    if (showDetails) { r += `<td class="spp-divider spp-error-cell">\u2013</td><td class="spp-error-cell">\u2013</td><td class="spp-error-cell">\u2013</td>`; }
                    else { r += `<td class="spp-divider spp-error-cell">\u2013</td>`; }
                    if (showTargets) r += '<td>\u2013</td>';
                    tphValues.push(NaN);
                }
            }
            if (showAverages) {
                const l4 = avgTPH(tphValues.slice(-4));
                r += `<td class="spp-divider spp-avg-cell">${!isNaN(l4)?formatEU(l4):'\u2013'}</td>`;
                if (showTargets) { const vs = formatVsTarget(l4, s.sc, getWeekNumber(days[days.length-1].date)); r += `<td class="${vs.cssClass}">${!isNaN(l4)?vs.html:'\u2013'}</td>`; }
            }
            body += `<tr>${r}</tr>`;
        }
        return `<div class="spp-table-container"><table class="spp-table"><thead><tr>${h1}</tr><tr>${h2}</tr></thead><tbody>${body}</tbody></table></div>`;
    }

    function buildDailyIXDTable(ixdData) {
        if (!ixdData || ixdData.length === 0) return '';
        const days = ixdData[0].days;
        function buildSingleTable(type, label) {
            const colSpan = 1 + (showDetails ? 2 : 0) + (showTargets ? 1 : 0) + (showPlanned ? 1 : 0);
            let h1 = `<th class="spp-sc-header" rowspan="2">Site</th>`;
            let h2 = '';
            for (const d of days) {
                h1 += `<th class="spp-week-header spp-divider" colspan="${colSpan}">${d.label}</th>`;
                h2 += showDetails ? '<th class="spp-divider">Cap</th><th>Hrs</th><th>TPH</th>' : '<th class="spp-divider">TPH</th>';
                if (showTargets) h2 += '<th>vs Target</th>';
                if (showPlanned) h2 += '<th>vs Plan</th>';
            }
            if (showAverages) { const avgSpan = 1 + (showTargets ? 1 : 0); h1 += `<th class="spp-avg-header spp-divider" colspan="${avgSpan}">Avg L4</th>`; h2 += '<th class="spp-divider">TPH</th>'; if (showTargets) h2 += '<th>vs Target</th>'; }
            let body = '';
            for (const s of ixdData) {
                let r = `<td>${s.sc}</td>`; const tphVals = [];
                for (const d of s.days) {
                    const dd = d[type === 'ib' ? 'inbound' : 'da'];
                    const tph = (dd && !dd.error && dd.tph > 0) ? dd.tph : NaN;
                    if (!isNaN(tph)) {
                        if (showDetails) { r += `<td class="spp-divider">${formatEUInt(dd.units)}</td><td>${formatEU(dd.hours)}</td><td class="spp-tph-cell">${formatEU(tph)}</td>`; }
                        else { r += `<td class="spp-divider spp-tph-cell">${formatEU(tph)}</td>`; }
                        if (showTargets) { const vs = formatIXDVsTarget(tph, s.sc, type, getWeekNumber(d.date)); r += `<td class="${vs.cssClass}">${vs.html}</td>`; }
                        if (showPlanned) { const pl = formatPlanned(tph, dd?.planned); r += `<td class="${pl.cssClass}" >${pl.html}</td>`; }
                    } else {
                        if (showDetails) { r += `<td class="spp-divider spp-error-cell">\u2013</td><td class="spp-error-cell">\u2013</td><td class="spp-error-cell">\u2013</td>`; }
                        else { r += `<td class="spp-divider spp-error-cell">\u2013</td>`; }
                        if (showTargets) r += '<td>\u2013</td>';
                        if (showPlanned) r += '<td>\u2013</td>';
                    }
                    tphVals.push(tph);
                }
                if (showAverages) { const l4 = avgTPH(tphVals.slice(-4)); r += `<td class="spp-divider spp-avg-cell">${!isNaN(l4)?formatEU(l4):'\u2013'}</td>`; if (showTargets) { const vs = formatIXDVsTarget(l4, s.sc, type, getWeekNumber(days[days.length-1].date)); r += `<td class="${vs.cssClass}">${!isNaN(l4)?vs.html:'\u2013'}</td>`; } }
                body += `<tr>${r}</tr>`;
            }
            return `<div><div style="color:var(--spp-text-secondary);font-size:11px;margin-bottom:6px;text-align:center;font-weight:600">${label}</div><div class="spp-table-container"><table class="spp-table"><thead><tr>${h1}</tr><tr>${h2}</tr></thead><tbody>${body}</tbody></table></div></div>`;
        }
        return `<div class="spp-ixd-charts">${buildSingleTable('ib','Inbound')}${buildSingleTable('da','DA')}</div>`;
    }

    function buildWeeklyResultsHTML(fcData, scData, ixdData) {
        let html = '';
        // FC section (on top)
        if (fcData && fcData.length > 0) {
            html += '<h4 class="spp-section-title">\ud83c\udfed FC Performance</h4>';
            html += buildFCWeeklyTable(fcData);
            html += `<div class="spp-chart-section">
                <div class="spp-chart-header">
                    <span class="spp-chart-title">\ud83c\udfed FC \u2013 TPH Trend</span>
                    <div class="spp-chart-toggles" id="spp-fc-target-toggles">
                        ${fcData.map(s => `<span class="spp-target-toggle" data-fc="${s.sc}" style="color:${FC_COLORS[s.sc]}"><span class="spp-toggle-dash"></span>${s.sc}</span>`).join('')}
                    </div>
                </div>
                <div class="spp-ixd-charts">
                    <div><div style="color:var(--spp-text-secondary);font-size:11px;margin-bottom:8px;text-align:center">Inbound</div><div class="spp-ixd-chart-wrap" id="spp-fc-ib-chart"></div></div>
                    <div><div style="color:var(--spp-text-secondary);font-size:11px;margin-bottom:8px;text-align:center">Outbound</div><div class="spp-ixd-chart-wrap" id="spp-fc-ob-chart"></div></div>
                </div>
            </div>`;
        }
        // SC Table + Chart
        if (scData && scData.length > 0) {
            html += '<h4 class="spp-section-title">\ud83d\ude9b SC Performance</h4>';
            html += buildWeeklySourceTable(scData, 'ppr');
            html += `<div class="spp-chart-section">
                <div class="spp-chart-header">
                    <span class="spp-chart-title">\ud83d\udcca SC \u2013 Transport TPH Trend</span>
                    <div class="spp-chart-toggles" id="spp-sc-op2-toggles">
                        ${scData.map(s => `<span class="spp-target-toggle" data-sc="${s.sc}" style="color:${SC_COLORS[s.sc]}"><span class="spp-toggle-dash"></span>${s.sc}</span>`).join('')}
                    </div>
                </div>
                <div class="spp-chart-canvas-wrap" id="spp-sc-chart"></div>
            </div>`;
        }
        // IXD Table + Charts
        if (ixdData && ixdData.length > 0) {
            html += '<h4 class="spp-section-title">\ud83d\udd00 IXD \u2013 CrossDock Performance</h4>';
            html += buildWeeklyIXDTable(ixdData);
            html += `<div class="spp-chart-section">
                <div class="spp-chart-header">
                    <span class="spp-chart-title">\ud83d\udd00 IXD \u2013 CrossDock TPH Trend</span>
                    <div class="spp-chart-toggles" id="spp-ixd-target-toggles">
                        ${ixdData.map(s => `<span class="spp-target-toggle" data-ixd="${s.sc}" style="color:${IXD_COLORS[s.sc]}"><span class="spp-toggle-dash"></span>${s.sc}</span>`).join('')}
                    </div>
                </div>
                <div class="spp-ixd-charts">
                    <div><div style="color:var(--spp-text-secondary);font-size:11px;margin-bottom:8px;text-align:center">Inbound</div><div class="spp-ixd-chart-wrap" id="spp-ixd-ib-chart"></div></div>
                    <div><div style="color:var(--spp-text-secondary);font-size:11px;margin-bottom:8px;text-align:center">DA</div><div class="spp-ixd-chart-wrap" id="spp-ixd-da-chart"></div></div>
                </div>
            </div>`;
        }
        if (!fcData?.length && !scData?.length && !ixdData?.length) return '<p class="spp-error-msg">No data. Select at least one site.</p>';
        const histLabel = (currentTab === 'historical') ? ` | \ud83d\udcc5 Historical: ${historicalYear}` : '';
        html += `<p class="spp-info">PPR TPH = Amtran Out / Transport Hrs | ${new Date().toLocaleString()}${histLabel}</p>`;
        html += '<div style="text-align:center"><button class="spp-copy-btn" id="spp-copy-btn">\ud83d\udccb Copy to Clipboard</button><button class="spp-copy-btn" id="spp-db-btn" style="margin-left:8px">\ud83d\uddc4\ufe0f Copy as Database</button><button class="spp-copy-btn" id="spp-pdf-btn" style="margin-left:8px">\ud83d\udcc4 Export PDF</button></div>';
        return html;
    }

    function buildDailyResultsHTML(fcData, scData, ixdData, weekStart) {
        const wNum = getWeekNumber(weekStart);
        const uid = `w${wNum}`; // unique suffix for chart IDs per week
        let html = `<p class="spp-info" style="margin-bottom:16px;font-size:13px"><strong>W${wNum} Daily View</strong> (${formatShortDate(weekStart)} \u2013 ${formatShortDate(new Date(weekStart.getTime() + 6*86400000))})</p>`;
        // FC section
        if (fcData && fcData.length > 0) {
            html += '<h4 class="spp-section-title">\ud83c\udfed FC Performance (Daily)</h4>';
            html += buildFCDailyTable(fcData);
            html += `<div class="spp-chart-section">
                <div class="spp-chart-header"><span class="spp-chart-title">\ud83c\udfed FC \u2013 Daily TPH (W${wNum})</span></div>
                <div class="spp-ixd-charts">
                    <div><div style="color:var(--spp-text-secondary);font-size:11px;margin-bottom:8px;text-align:center">Inbound</div><div class="spp-ixd-chart-wrap" id="spp-fc-ib-chart-${uid}"></div></div>
                    <div><div style="color:var(--spp-text-secondary);font-size:11px;margin-bottom:8px;text-align:center">Outbound</div><div class="spp-ixd-chart-wrap" id="spp-fc-ob-chart-${uid}"></div></div>
                </div>
            </div>`;
        }
        // SC Table + Chart
        if (scData && scData.length > 0) {
            html += '<h4 class="spp-section-title">\ud83d\ude9b SC Performance (Daily)</h4>';
            html += buildDailySourceTable(scData, 'ppr');
            html += `<div class="spp-chart-section">
                <div class="spp-chart-header">
                    <span class="spp-chart-title">\ud83d\udcca SC \u2013 Daily TPH (W${wNum})</span>
                    <div class="spp-chart-toggles" id="spp-sc-op2-toggles-${uid}">
                        ${scData.map(s => `<span class="spp-target-toggle" data-sc="${s.sc}" style="color:${SC_COLORS[s.sc]}"><span class="spp-toggle-dash"></span>${s.sc}</span>`).join('')}
                    </div>
                </div>
                <div class="spp-chart-canvas-wrap" id="spp-sc-chart-${uid}"></div>
            </div>`;
        }
        // IXD Table + Charts
        if (ixdData && ixdData.length > 0) {
            html += '<h4 class="spp-section-title">\ud83d\udd00 IXD \u2013 CrossDock Performance (Daily)</h4>';
            html += buildDailyIXDTable(ixdData);
            html += `<div class="spp-chart-section">
                <div class="spp-chart-header"><span class="spp-chart-title">\ud83d\udd00 IXD \u2013 Daily TPH (W${wNum})</span></div>
                <div class="spp-ixd-charts">
                    <div><div style="color:var(--spp-text-secondary);font-size:11px;margin-bottom:8px;text-align:center">Inbound</div><div class="spp-ixd-chart-wrap" id="spp-ixd-ib-chart-${uid}"></div></div>
                    <div><div style="color:var(--spp-text-secondary);font-size:11px;margin-bottom:8px;text-align:center">DA</div><div class="spp-ixd-chart-wrap" id="spp-ixd-da-chart-${uid}"></div></div>
                </div>
            </div>`;
        }
        if (!fcData?.length && !scData?.length && !ixdData?.length) return '<p class="spp-error-msg">No data. Select at least one site.</p>';
        html += `<p class="spp-info">Daily view W${wNum} | ${new Date().toLocaleString()}</p>`;
        html += '<div style="text-align:center"><button class="spp-copy-btn" id="spp-copy-btn">\ud83d\udccb Copy to Clipboard</button><button class="spp-copy-btn" id="spp-db-btn" style="margin-left:8px">\ud83d\uddc4\ufe0f Copy as Database</button><button class="spp-copy-btn" id="spp-pdf-btn" style="margin-left:8px">\ud83d\udcc4 Export PDF</button></div>';
        return html;
    }

    // ─── Dashboard UI ────────────────────────────────────────────────

    let dashEl = null, currentTab = 'weekly', lastSCData = null, lastIXDData = null, lastFCData = null, lastMode = 'weekly';
    let showDetails = false, showTargets = false, showAverages = false, showPlanned = false;
    let abortRequested = false;
    let historicalYear = new Date().getFullYear() - 1; // default to last year

    function buildWeekChips() {
        if (currentTab === 'historical') {
            // For historical tab, show all 52/53 weeks of the selected year (ascending)
            const weeksInYear = getWeeksInYear(historicalYear);
            return Array.from({ length: weeksInYear }, (_, i) => i + 1).map(w => {
                const start = getWeekStartFromWeekNumber(historicalYear, w);
                const end = new Date(start); end.setDate(start.getDate() + 6);
                return `<span class="spp-chip" data-week="${w}" title="${formatShortDate(start)} \u2013 ${formatShortDate(end)}">W${w}</span>`;
            }).join('');
        }
        const weeks = getAvailableWeeks();
        const currentWN = getCurrentWeekNumber();
        return weeks.map(w => {
            const isDefault = (currentTab === 'weekly')
                ? (w.wNum >= currentWN - 4 && w.wNum <= currentWN - 1)
                : (w.wNum === currentWN);
            return `<span class="spp-chip${isDefault ? ' selected' : ''}" data-week="${w.wNum}" title="${formatShortDate(w.start)} \u2013 ${formatShortDate(w.end)}">W${w.wNum}</span>`;
        }).join('');
    }

    function getWeeksInYear(year) {
        // ISO weeks: a year has 53 weeks if Jan 1 is Thursday, or Dec 31 is Thursday
        const jan1 = new Date(year, 0, 1);
        const dec31 = new Date(year, 11, 31);
        return (jan1.getDay() === 4 || dec31.getDay() === 4) ? 53 : 52;
    }

    function buildYearSelector() {
        const currentYear = new Date().getFullYear();
        const years = [];
        for (let y = currentYear - 1; y >= currentYear - 2; y--) years.push(y);
        return `<select class="spp-year-select" id="spp-year-select">${years.map(y => `<option value="${y}" ${y === historicalYear ? 'selected' : ''}>${y}</option>`).join('')}</select>`;
    }

    function showDashboard() {
        if (dashEl) { dashEl.remove(); dashEl = null; }
        dashEl = document.createElement('div');
        dashEl.className = 'spp-dashboard';

        const scChips = SORT_CENTERS.map(sc => `<span class="spp-chip selected" data-sc="${sc}">${sc}</span>`).join('');
        const ixdChips = IXD_SITES.map(s => `<span class="spp-chip selected" data-ixd="${s}">${s}</span>`).join('');
        const fcChips = FC_SITES.map(s => `<span class="spp-chip selected" data-fc="${s}">${s}</span>`).join('');

        dashEl.innerHTML = `
            <div class="spp-dash-header">
                <div>
                    <h2 class="spp-dash-title"><span>\ud83d\udcca</span> Performance Dashboard</h2>
                    <div class="spp-dash-subtitle">TPH & Capacity Analysis \u2022 FC, SC & IXD Networks</div>
                </div>
                <div style="display:flex;gap:10px;align-items:center">
                    <a href="https://form.asana.com/?k=G783g_szh5RLMgKV1BF5WQ&d=8442528107068" target="_blank" style="background:var(--spp-bg-tertiary);border:1px solid var(--spp-border);color:var(--spp-text-secondary);padding:8px 14px;border-radius:var(--spp-radius);font-size:12px;text-decoration:none;transition:var(--spp-transition)" onmouseover="this.style.background='var(--spp-accent)';this.style.color='#fff'" onmouseout="this.style.background='var(--spp-bg-tertiary)';this.style.color='var(--spp-text-secondary)'">\ud83d\udcac Feedback</a>
                    <button class="spp-close" id="spp-close">\u2715 Close</button>
                </div>
            </div>
            <div class="spp-dash-body">
                <div class="spp-sidebar" id="spp-sidebar">
                    <button class="spp-sidebar-toggle" id="spp-sidebar-toggle" title="Collapse sidebar">\u25c0</button>
                    <div class="spp-sidebar-content">
                    <div class="spp-filter-group">
                        <div class="spp-filter-group-title">\ud83d\udcc5 View Mode</div>
                        <div class="spp-tabs" id="spp-tabs">
                            <div class="spp-tab active" data-tab="weekly">Weekly</div>
                            <div class="spp-tab" data-tab="daily">Daily</div>
                            <div class="spp-tab" data-tab="historical">Historical</div>
                        </div>
                    </div>
                    <div class="spp-filter-group">
                        <div class="spp-filter-group-title">\ud83c\udfed Fulfilment Centers</div>
                        <div class="spp-chips-row">
                            <span class="spp-chip all-btn" id="spp-fc-all">All</span>
                            <span class="spp-chip none-btn" id="spp-fc-none">None</span>
                        </div>
                        <div class="spp-chips-row" id="spp-fc-chips">${fcChips}</div>
                    </div>
                    <div class="spp-filter-group">
                        <div class="spp-filter-group-title">\ud83c\udfe2 Sort Centers</div>
                        <div class="spp-chips-row">
                            <span class="spp-chip all-btn" id="spp-sc-all">All</span>
                            <span class="spp-chip none-btn" id="spp-sc-none">None</span>
                        </div>
                        <div class="spp-chips-row" id="spp-sc-chips">${scChips}</div>
                    </div>
                    <div class="spp-filter-group">
                        <div class="spp-filter-group-title">\ud83d\udd00 IXD Sites</div>
                        <div class="spp-chips-row">
                            <span class="spp-chip all-btn" id="spp-ixd-all">All</span>
                            <span class="spp-chip none-btn" id="spp-ixd-none">None</span>
                        </div>
                        <div class="spp-chips-row" id="spp-ixd-chips">${ixdChips}</div>
                    </div>
                    <div class="spp-filter-group">
                        <div class="spp-filter-group-title">\ud83d\uddd3 Weeks</div>
                        <div class="spp-chips-row" id="spp-week-shortcuts">
                            <span class="spp-chip shortcut-btn" id="spp-week-l4w">L4W</span>
                            <span class="spp-chip shortcut-btn" id="spp-week-cw">CW</span>
                            <span class="spp-chip none-btn" id="spp-week-none">Clear</span>
                        </div>
                        <div id="spp-year-selector-wrap" style="display:none;margin-top:8px">
                            <span style="color:var(--spp-text-secondary);font-size:11px;margin-right:8px">Year:</span>
                            ${buildYearSelector()}
                        </div>
                        <div class="spp-week-chips-scroll">
                            <div class="spp-chips-row" id="spp-week-chips">${buildWeekChips()}</div>
                        </div>
                    </div>
                    <div class="spp-filter-group">
                        <div class="spp-filter-group-title">\ud83c\udfaf Targets (SC) \u2014 W${getCurrentWeekNumber()}</div>
                        <div class="spp-target-grid" id="spp-target-grid">
                            ${SORT_CENTERS.map(sc => `<span class="spp-target-label">${sc}</span><input class="spp-target-input" data-sc="${sc}" type="number" step="0.1" value="${sidebarSCTarget[sc] || ''}">`).join('')}
                        </div>
                    </div>
                    <div class="spp-filter-group">
                        <div class="spp-filter-group-title">\ud83c\udfaf Targets (FC) \u2014 W${getCurrentWeekNumber()}</div>
                        <div class="spp-target-grid" id="spp-fc-op2-grid">
                            <span class="spp-target-label" style="grid-column:1;font-size:10px;opacity:.6"></span><span style="display:flex;gap:4px;font-size:9px;color:#888"><span style="width:50px;text-align:center">IB</span><span style="width:50px;text-align:center">OB</span></span>
                            ${FC_SITES.map(fc => `<span class="spp-target-label">${fc}</span><span style="display:flex;gap:4px"><input class="spp-target-input" data-fc-ib="${fc}" type="number" step="0.1" value="${sidebarFCTarget.ib[fc] || ''}"><input class="spp-target-input" data-fc-ob="${fc}" type="number" step="0.1" value="${sidebarFCTarget.ob[fc] || ''}"></span>`).join('')}
                        </div>
                    </div>
                    <div class="spp-filter-group">
                        <div class="spp-filter-group-title">\ud83c\udfaf Targets (IXD) \u2014 W${getCurrentWeekNumber()}</div>
                        <div class="spp-target-grid" id="spp-ixd-target-grid">
                            <span class="spp-target-label" style="grid-column:1;font-size:10px;opacity:.6"></span><span style="display:flex;gap:4px;font-size:9px;color:#888"><span style="width:50px;text-align:center">IB</span><span style="width:50px;text-align:center">DA</span></span>
                            ${IXD_SITES.map(s => `<span class="spp-target-label">${s}</span><span style="display:flex;gap:4px"><input class="spp-target-input" data-ixd-ib="${s}" type="number" step="0.1" value="${sidebarIXDTarget.ib[s] || ''}"><input class="spp-target-input" data-ixd-da="${s}" type="number" step="0.1" value="${sidebarIXDTarget.da[s] || ''}"></span>`).join('')}
                        </div>
                    </div>
                    <div class="spp-filter-group">
                        <div class="spp-filter-group-title">\u2699\ufe0f Display</div>
                        <div class="spp-toggle-row">
                            <div class="spp-toggle" id="spp-toggle-details" title="Show Capacity and Hours columns"></div>
                            <span class="spp-toggle-label">Show Details (Cap/Hrs)</span>
                        </div>
                        <div class="spp-toggle-row">
                            <div class="spp-toggle" id="spp-toggle-targets" title="Show vs Target column"></div>
                            <span class="spp-toggle-label">Show vs Target</span>
                        </div>
                        <div class="spp-toggle-row">
                            <div class="spp-toggle" id="spp-toggle-averages" title="Show L4 averages column"></div>
                            <span class="spp-toggle-label">Show Averages (L4)</span>
                        </div>
                        <div class="spp-toggle-row">
                            <div class="spp-toggle" id="spp-toggle-planned" title="Show Planned TPH (FC/IXD only)"></div>
                            <span class="spp-toggle-label">Show vs Plan (FC/IXD)</span>
                        </div>
                    </div>
                    <button class="spp-run-btn" id="spp-run-btn">\u25b6 Run Analysis</button>
                    <button class="spp-run-btn" id="spp-stop-btn" style="display:none;background:var(--spp-error)">\u25a0 Stop</button>
                    <div id="spp-progress-area" style="display:none">
                        <div class="spp-progress"><div class="spp-progress-bar" id="spp-progress-bar"></div></div>
                        <div class="spp-progress-text" id="spp-progress-text">0%</div>
                    </div>
                    <div class="spp-status" id="spp-status"></div>
                    </div>
                </div>
                <div class="spp-main" id="spp-main">
                    <div class="spp-empty-state">
                        <h3>Ready to Analyze</h3>
                        <p>Select your sites, weeks, and data sources from the sidebar, then click <strong>Run Analysis</strong>.</p>
                        <p style="margin-top:8px;font-size:11px;color:var(--spp-text-secondary)">Use the <strong>Historical</strong> tab to look up past year data (e.g. W41 2024).</p>
                    </div>
                </div>
            </div>`;

        document.body.appendChild(dashEl);
        attachDashListeners();
    }

    function attachDashListeners() {
        const currentWN = getCurrentWeekNumber();

        // Sidebar collapse/expand
        dashEl.querySelector('#spp-sidebar-toggle').addEventListener('click', function() {
            const sidebar = document.getElementById('spp-sidebar');
            const isCollapsed = sidebar.classList.toggle('collapsed');
            this.textContent = isCollapsed ? '\u25b6' : '\u25c0';
            this.title = isCollapsed ? 'Expand sidebar' : 'Collapse sidebar';
            // Force all charts to redraw after sidebar animation
            setTimeout(() => { window.dispatchEvent(new Event('resize')); }, 350);
        });

        dashEl.querySelector('#spp-close').addEventListener('click', closeDashboard);
        dashEl.querySelector('#spp-run-btn').addEventListener('click', handleRun);
        dashEl.querySelector('#spp-stop-btn').addEventListener('click', function() {
            abortRequested = true;
            this.style.display = 'none';
            document.getElementById('spp-run-btn').disabled = false;
            document.getElementById('spp-progress-area').style.display = 'none';
            document.getElementById('spp-status').textContent = '\u26a0 Stopped by user';
        });

        // Tabs
        dashEl.querySelectorAll('.spp-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                currentTab = tab.dataset.tab;
                dashEl.querySelectorAll('.spp-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === currentTab));
                // Show/hide year selector and week shortcuts based on tab
                const yearWrap = document.getElementById('spp-year-selector-wrap');
                const weekShortcuts = document.getElementById('spp-week-shortcuts');
                if (currentTab === 'historical') {
                    yearWrap.style.display = 'flex';
                    weekShortcuts.style.display = 'none';
                } else {
                    yearWrap.style.display = 'none';
                    weekShortcuts.style.display = 'flex';
                }
                refreshWeekChips();
            });
        });

        // Year selector for historical tab
        const yearSelect = dashEl.querySelector('#spp-year-select');
        if (yearSelect) {
            yearSelect.addEventListener('change', function() {
                historicalYear = parseInt(this.value);
                refreshWeekChips();
            });
        }

        // SC chips
        dashEl.querySelectorAll('.spp-chip[data-sc]').forEach(chip => { chip.addEventListener('click', () => chip.classList.toggle('selected')); });
        dashEl.querySelector('#spp-sc-all').addEventListener('click', () => { dashEl.querySelectorAll('.spp-chip[data-sc]').forEach(c => c.classList.add('selected')); });
        dashEl.querySelector('#spp-sc-none').addEventListener('click', () => { dashEl.querySelectorAll('.spp-chip[data-sc]').forEach(c => c.classList.remove('selected')); });

        // IXD chips
        dashEl.querySelectorAll('.spp-chip[data-ixd]').forEach(chip => { chip.addEventListener('click', () => chip.classList.toggle('selected')); });
        dashEl.querySelector('#spp-ixd-all').addEventListener('click', () => { dashEl.querySelectorAll('.spp-chip[data-ixd]').forEach(c => c.classList.add('selected')); });
        dashEl.querySelector('#spp-ixd-none').addEventListener('click', () => { dashEl.querySelectorAll('.spp-chip[data-ixd]').forEach(c => c.classList.remove('selected')); });

        // FC chips
        dashEl.querySelectorAll('.spp-chip[data-fc]').forEach(chip => { chip.addEventListener('click', () => chip.classList.toggle('selected')); });
        dashEl.querySelector('#spp-fc-all').addEventListener('click', () => { dashEl.querySelectorAll('.spp-chip[data-fc]').forEach(c => c.classList.add('selected')); });
        dashEl.querySelector('#spp-fc-none').addEventListener('click', () => { dashEl.querySelectorAll('.spp-chip[data-fc]').forEach(c => c.classList.remove('selected')); });

        // Week chips
        dashEl.querySelectorAll('.spp-chip[data-week]').forEach(chip => {
            chip.addEventListener('click', () => chip.classList.toggle('selected'));
        });

        // Week shortcuts
        dashEl.querySelector('#spp-week-l4w').addEventListener('click', () => {
            dashEl.querySelectorAll('.spp-chip[data-week]').forEach(c => c.classList.remove('selected'));
            for (let w = currentWN - 4; w <= currentWN - 1; w++) {
                const chip = dashEl.querySelector(`.spp-chip[data-week="${w}"]`);
                if (chip) chip.classList.add('selected');
            }
        });
        dashEl.querySelector('#spp-week-cw').addEventListener('click', () => {
            dashEl.querySelectorAll('.spp-chip[data-week]').forEach(c => c.classList.remove('selected'));
            const chip = dashEl.querySelector(`.spp-chip[data-week="${currentWN}"]`);
            if (chip) chip.classList.add('selected');
        });
        dashEl.querySelector('#spp-week-none').addEventListener('click', () => {
            dashEl.querySelectorAll('.spp-chip[data-week]').forEach(c => c.classList.remove('selected'));
        });

        // Target inputs (SC) — updates sidebar value only (resets on reload)
        dashEl.querySelectorAll('.spp-target-input[data-sc]').forEach(input => {
            input.addEventListener('change', function() {
                const sc = this.dataset.sc;
                const val = parseFloat(this.value);
                if (!isNaN(val) && val > 0) { sidebarSCTarget[sc] = val; }
                else { sidebarSCTarget[sc] = 0; this.value = ''; }
            });
        });

        // Target inputs (FC IB)
        dashEl.querySelectorAll('.spp-target-input[data-fc-ib]').forEach(input => {
            input.addEventListener('change', function() {
                const fc = this.dataset.fcIb;
                const val = parseFloat(this.value);
                if (!isNaN(val) && val > 0) { sidebarFCTarget.ib[fc] = val; }
                else { sidebarFCTarget.ib[fc] = 0; this.value = ''; }
            });
        });

        // Target inputs (FC OB)
        dashEl.querySelectorAll('.spp-target-input[data-fc-ob]').forEach(input => {
            input.addEventListener('change', function() {
                const fc = this.dataset.fcOb;
                const val = parseFloat(this.value);
                if (!isNaN(val) && val > 0) { sidebarFCTarget.ob[fc] = val; }
                else { sidebarFCTarget.ob[fc] = 0; this.value = ''; }
            });
        });

        // Target inputs (IXD IB)
        dashEl.querySelectorAll('.spp-target-input[data-ixd-ib]').forEach(input => {
            input.addEventListener('change', function() {
                const site = this.dataset.ixdIb;
                const val = parseFloat(this.value);
                if (!isNaN(val) && val > 0) { sidebarIXDTarget.ib[site] = val; }
                else { sidebarIXDTarget.ib[site] = 0; this.value = ''; }
            });
        });

        // Target inputs (IXD DA)
        dashEl.querySelectorAll('.spp-target-input[data-ixd-da]').forEach(input => {
            input.addEventListener('change', function() {
                const site = this.dataset.ixdDa;
                const val = parseFloat(this.value);
                if (!isNaN(val) && val > 0) { sidebarIXDTarget.da[site] = val; }
                else { sidebarIXDTarget.da[site] = 0; this.value = ''; }
            });
        });

        // Display toggles
        dashEl.querySelector('#spp-toggle-details').addEventListener('click', function() {
            showDetails = !showDetails;
            this.classList.toggle('active', showDetails);
        });
        dashEl.querySelector('#spp-toggle-targets').addEventListener('click', function() {
            showTargets = !showTargets;
            this.classList.toggle('active', showTargets);
        });
        dashEl.querySelector('#spp-toggle-averages').addEventListener('click', function() {
            showAverages = !showAverages;
            this.classList.toggle('active', showAverages);
        });
        dashEl.querySelector('#spp-toggle-planned').addEventListener('click', function() {
            showPlanned = !showPlanned;
            this.classList.toggle('active', showPlanned);
        });
    }

    function refreshWeekChips() {
        const container = document.getElementById('spp-week-chips');
        if (container) {
            container.innerHTML = buildWeekChips();
            dashEl.querySelectorAll('.spp-chip[data-week]').forEach(chip => {
                chip.addEventListener('click', () => chip.classList.toggle('selected'));
            });
        }
    }

    function closeDashboard() {
        if (dashEl) { dashEl.remove(); dashEl = null; }
        const b = document.querySelector('.spp-button');
        if (b) b.style.display = 'block';
    }

    function getSelectedSCs() { return Array.from(dashEl.querySelectorAll('.spp-chip[data-sc].selected')).map(c => c.dataset.sc); }
    function getSelectedIXDs() { return Array.from(dashEl.querySelectorAll('.spp-chip[data-ixd].selected')).map(c => c.dataset.ixd); }
    function getSelectedFCs() { return Array.from(dashEl.querySelectorAll('.spp-chip[data-fc].selected')).map(c => c.dataset.fc); }

    function getSelectedWeekStarts() {
        const selectedWeekNums = Array.from(dashEl.querySelectorAll('.spp-chip[data-week].selected'))
            .map(c => parseInt(c.dataset.week))
            .sort((a, b) => a - b); // ascending: oldest first (left) → newest last (right)
        const year = (currentTab === 'historical') ? historicalYear : new Date().getFullYear();
        return selectedWeekNums.map(wNum => getWeekStartFromWeekNumber(year, wNum));
    }

    async function handleRun() {
        const selectedSCs = getSelectedSCs();
        const selectedIXDs = getSelectedIXDs();
        const selectedFCs = getSelectedFCs();
        const main = document.getElementById('spp-main');

        if (selectedSCs.length === 0 && selectedIXDs.length === 0 && selectedFCs.length === 0) {
            main.innerHTML = '<p class="spp-error-msg">Select at least one site.</p>';
            return;
        }

        const weekStarts = getSelectedWeekStarts();
        if (weekStarts.length === 0) {
            main.innerHTML = '<p class="spp-error-msg">Select at least one week.</p>';
            return;
        }

        if (currentTab === 'weekly' || currentTab === 'historical') {
            await runWeeklyFetch(selectedSCs, selectedIXDs, selectedFCs, weekStarts);
        } else {
            await runDailyFetchMultiWeek(selectedSCs, selectedIXDs, selectedFCs, weekStarts);
        }
    }
    async function runWeeklyFetch(selectedSCs, selectedIXDs, selectedFCs, weekStarts) {
        const btn = document.getElementById('spp-run-btn');
        const stopBtn = document.getElementById('spp-stop-btn');
        const pa = document.getElementById('spp-progress-area'), pb = document.getElementById('spp-progress-bar');
        const pt = document.getElementById('spp-progress-text'), st = document.getElementById('spp-status');
        const main = document.getElementById('spp-main');

        abortRequested = false;
        btn.disabled = true; stopBtn.style.display = 'block'; pa.style.display = 'block';
        main.innerHTML = '<div style="text-align:center;padding:60px;color:var(--spp-text-secondary)"><div class="spp-spinner"></div> Fetching weekly data\u2026</div>';

        try {
            // Fetch FC data first
            let fcData = [];
            if (selectedFCs.length > 0) {
                fcData = await fetchFCWeeklyData(selectedFCs, weekStarts, (c, t) => {
                    const p = Math.round(c/t*100); pb.style.width = p+'%'; pt.textContent = `${p}% FCs (${c}/${t})`;
                }, 0);
            }
            // Fetch SC + IXD
            const { scData, ixdData } = await fetchWeeklyData(selectedSCs, selectedIXDs, weekStarts, (c, t) => {
                const p = Math.round(c/t*100); pb.style.width = p+'%'; pt.textContent = `${p}% (${c}/${t})`;
            });
            lastSCData = scData; lastIXDData = ixdData; lastFCData = fcData; lastMode = 'weekly';
            // In historical mode, suppress targets and plan (they don't apply to past years)
            const savedTargets = showTargets, savedPlanned = showPlanned;
            if (currentTab === 'historical') { showTargets = false; showPlanned = false; }
            main.innerHTML = buildWeeklyResultsHTML(fcData, scData, ixdData);
            if (currentTab === 'historical') { showTargets = savedTargets; showPlanned = savedPlanned; }
            initChartsAfterRender(fcData, scData, ixdData, 'weekly');
            const copyBtn = document.getElementById('spp-copy-btn');
            if (copyBtn) copyBtn.addEventListener('click', handleWeeklyCopy);
            const dbBtn = document.getElementById('spp-db-btn');
            if (dbBtn) dbBtn.addEventListener('click', handleDBExport);
            const pdfBtn = document.getElementById('spp-pdf-btn');
            if (pdfBtn) pdfBtn.addEventListener('click', handlePDFExport);
            st.textContent = `\u2705 ${selectedFCs.length} FCs + ${scData.length} SCs + ${ixdData.length} IXD \u00d7 ${weekStarts.length} week(s)`;
        } catch (e) {
            main.innerHTML = `<div class="spp-error-msg">\u274c ${e.message}</div>`;
            st.textContent = 'Failed';
        } finally {
            btn.disabled = false; pa.style.display = 'none'; stopBtn.style.display = 'none';
        }
    }

    async function runDailyFetchMultiWeek(selectedSCs, selectedIXDs, selectedFCs, weekStarts) {
        const btn = document.getElementById('spp-run-btn');
        const stopBtn = document.getElementById('spp-stop-btn');
        const pa = document.getElementById('spp-progress-area'), pb = document.getElementById('spp-progress-bar');
        const pt = document.getElementById('spp-progress-text'), st = document.getElementById('spp-status');
        const main = document.getElementById('spp-main');
        const currentWN = getCurrentWeekNumber();

        abortRequested = false;
        btn.disabled = true; stopBtn.style.display = 'block'; pa.style.display = 'block';

        let totalDays = 0;
        const weekConfigs = weekStarts.map(ws => {
            const selectedWN = getWeekNumber(ws);
            const maxDay = (selectedWN === currentWN) ? getYesterday() : null;
            const dayCount = maxDay ? Math.min(7, Math.floor((maxDay - ws) / 86400000) + 1) : 7;
            totalDays += dayCount;
            return { weekStart: ws, maxDay, dayCount, wNum: selectedWN };
        });

        main.innerHTML = `<div style="text-align:center;padding:60px;color:var(--spp-text-secondary)"><div class="spp-spinner"></div> Fetching daily data for ${weekStarts.length} week(s) (${totalDays} days total)\u2026</div>`;

        try {
            let globalCompleted = 0;
            const requestsPerDay = selectedFCs.length + selectedSCs.length + selectedIXDs.length;
            const totalRequests = totalDays * requestsPerDay;

            const allFCData = [], allSCData = [], allIXDData = [];

            for (const cfg of weekConfigs) {
                if (abortRequested) throw new Error('Stopped');
                let fcData = [];
                if (selectedFCs.length > 0) {
                    fcData = await fetchFCDailyData(selectedFCs, cfg.weekStart, null, cfg.maxDay, globalCompleted);
                }
                const { scData, ixdData } = await fetchDailyData(selectedSCs, selectedIXDs, cfg.weekStart, (c, t) => {
                    const overallProgress = Math.round(((globalCompleted + selectedFCs.length * cfg.dayCount + c) / totalRequests) * 100);
                    pb.style.width = overallProgress + '%';
                    pt.textContent = `${overallProgress}% (W${cfg.wNum})`;
                }, cfg.maxDay);

                globalCompleted += cfg.dayCount * requestsPerDay;
                allFCData.push({ wNum: cfg.wNum, weekStart: cfg.weekStart, fcData });
                allSCData.push({ wNum: cfg.wNum, weekStart: cfg.weekStart, scData });
                allIXDData.push({ wNum: cfg.wNum, weekStart: cfg.weekStart, ixdData });
            }

            // Build combined chart data (merge all days across weeks)
            const combinedSC = mergeDailySCData(allSCData);
            const combinedFC = mergeDailyFCData(allFCData);
            const combinedIXD = mergeDailyIXDData(allIXDData);

            // Build HTML: combined charts on top, then per-week tables below
            let html = '';
            const weekLabels = weekConfigs.map(c => `W${c.wNum}`).join(', ');
            html += `<p class="spp-info" style="margin-bottom:16px;font-size:13px"><strong>Daily View: ${weekLabels}</strong> (${totalDays} days)</p>`;

            // Combined FC chart
            if (combinedFC && combinedFC.length > 0) {
                html += `<div class="spp-chart-section">
                    <div class="spp-chart-header"><span class="spp-chart-title">\ud83c\udfed FC \u2013 Daily TPH Trend</span></div>
                    <div class="spp-ixd-charts">
                        <div><div style="color:var(--spp-text-secondary);font-size:11px;margin-bottom:8px;text-align:center">Inbound</div><div class="spp-ixd-chart-wrap" id="spp-fc-ib-chart-combined"></div></div>
                        <div><div style="color:var(--spp-text-secondary);font-size:11px;margin-bottom:8px;text-align:center">Outbound</div><div class="spp-ixd-chart-wrap" id="spp-fc-ob-chart-combined"></div></div>
                    </div>
                </div>`;
            }
            // Combined SC chart
            if (combinedSC && combinedSC.length > 0) {
                html += `<div class="spp-chart-section">
                    <div class="spp-chart-header">
                        <span class="spp-chart-title">\ud83d\udcca SC \u2013 Daily TPH Trend</span>
                        <div class="spp-chart-toggles" id="spp-sc-op2-toggles">
                            ${combinedSC.map(s => `<span class="spp-target-toggle" data-sc="${s.sc}" style="color:${SC_COLORS[s.sc]}"><span class="spp-toggle-dash"></span>${s.sc}</span>`).join('')}
                        </div>
                    </div>
                    <div class="spp-chart-canvas-wrap" id="spp-sc-chart-combined"></div>
                </div>`;
            }
            // Combined IXD chart
            if (combinedIXD && combinedIXD.length > 0) {
                html += `<div class="spp-chart-section">
                    <div class="spp-chart-header"><span class="spp-chart-title">\ud83d\udd00 IXD \u2013 Daily TPH Trend</span></div>
                    <div class="spp-ixd-charts">
                        <div><div style="color:var(--spp-text-secondary);font-size:11px;margin-bottom:8px;text-align:center">Inbound</div><div class="spp-ixd-chart-wrap" id="spp-ixd-ib-chart-combined"></div></div>
                        <div><div style="color:var(--spp-text-secondary);font-size:11px;margin-bottom:8px;text-align:center">DA</div><div class="spp-ixd-chart-wrap" id="spp-ixd-da-chart-combined"></div></div>
                    </div>
                </div>`;
            }

            // Per-week tables
            for (let i = 0; i < weekConfigs.length; i++) {
                const cfg = weekConfigs[i];
                const fcData = allFCData[i]?.fcData || [];
                const scData = allSCData[i]?.scData || [];
                const ixdData = allIXDData[i]?.ixdData || [];
                html += `<h3 style="color:var(--spp-text-primary);font-size:16px;margin:28px 0 12px;border-top:1px solid var(--spp-border);padding-top:20px">W${cfg.wNum} (${formatShortDate(cfg.weekStart)} \u2013 ${formatShortDate(new Date(cfg.weekStart.getTime() + 6*86400000))})</h3>`;
                if (fcData.length > 0) { html += '<h4 class="spp-section-title">\ud83c\udfed FC Performance</h4>'; html += buildFCDailyTable(fcData); }
                if (scData.length > 0) { html += '<h4 class="spp-section-title">\ud83d\ude9b SC Performance</h4>'; html += buildDailySourceTable(scData, 'ppr'); }
                if (ixdData.length > 0) { html += '<h4 class="spp-section-title">\ud83d\udd00 IXD Performance</h4>'; html += buildDailyIXDTable(ixdData); }
            }

            html += `<p class="spp-info">Daily view ${weekLabels} | ${new Date().toLocaleString()}</p>`;
            html += '<div style="text-align:center"><button class="spp-copy-btn" id="spp-copy-btn">\ud83d\udccb Copy to Clipboard</button><button class="spp-copy-btn" id="spp-db-btn" style="margin-left:8px">\ud83d\uddc4\ufe0f Copy as Database</button><button class="spp-copy-btn" id="spp-pdf-btn" style="margin-left:8px">\ud83d\udcc4 Export PDF</button></div>';

            lastSCData = allSCData;
            lastIXDData = allIXDData;
            lastFCData = allFCData; lastMode = 'daily';
            main.innerHTML = html;

            // Render combined charts
            const fcIB = document.getElementById('spp-fc-ib-chart-combined');
            const fcOB = document.getElementById('spp-fc-ob-chart-combined');
            if (fcIB && fcOB && combinedFC && combinedFC.length > 0) buildFCCharts(fcIB, fcOB, combinedFC, 'daily');

            const scEl = document.getElementById('spp-sc-chart-combined');
            if (scEl && combinedSC && combinedSC.length > 0) {
                buildSCChart(scEl, combinedSC, 'daily');
                document.querySelectorAll('#spp-sc-op2-toggles .spp-target-toggle').forEach(toggle => {
                    toggle.addEventListener('click', function() {
                        const sc = this.dataset.sc;
                        const isActive = this.classList.toggle('active');
                        toggleTargetLine(sc, isActive);
                    });
                });
            }

            const ixdIB = document.getElementById('spp-ixd-ib-chart-combined');
            const ixdDA = document.getElementById('spp-ixd-da-chart-combined');
            if (ixdIB && ixdDA && combinedIXD && combinedIXD.length > 0) buildIXDCharts(ixdIB, ixdDA, combinedIXD, 'daily');

            const copyBtn = document.getElementById('spp-copy-btn');
            if (copyBtn) copyBtn.addEventListener('click', handleDailyCopy);
            const dbBtn = document.getElementById('spp-db-btn');
            if (dbBtn) dbBtn.addEventListener('click', handleDBExport);
            const pdfBtn = document.getElementById('spp-pdf-btn');
            if (pdfBtn) pdfBtn.addEventListener('click', handlePDFExport);

            st.textContent = `\u2705 Daily: ${weekLabels} \u2013 ${selectedFCs.length} FCs + ${selectedSCs.length} SCs + ${selectedIXDs.length} IXD`;
        } catch (e) {
            main.innerHTML = `<div class="spp-error-msg">\u274c ${e.message}</div>`;
            st.textContent = 'Failed';
        } finally {
            btn.disabled = false; pa.style.display = 'none'; stopBtn.style.display = 'none';
        }
    }

    // ─── Merge daily data across weeks for combined charts ───────────

    function mergeDailySCData(allSCData) {
        if (!allSCData || allSCData.length === 0) return null;
        // Get all SC names from first week
        const firstWeek = allSCData[0]?.scData;
        if (!firstWeek || firstWeek.length === 0) return null;
        const merged = firstWeek.map(s => ({ sc: s.sc, days: [] }));
        for (const weekEntry of allSCData) {
            for (let i = 0; i < merged.length; i++) {
                const siteWeekData = weekEntry.scData?.find(s => s.sc === merged[i].sc);
                if (siteWeekData) {
                    // Add week number prefix to day labels
                    const wNum = weekEntry.wNum;
                    const days = siteWeekData.days.map(d => ({ ...d, label: `${d.label} W${wNum}` }));
                    merged[i].days.push(...days);
                }
            }
        }
        return merged;
    }

    function mergeDailyFCData(allFCData) {
        if (!allFCData || allFCData.length === 0) return null;
        const firstWeek = allFCData[0]?.fcData;
        if (!firstWeek || firstWeek.length === 0) return null;
        const merged = firstWeek.map(s => ({ sc: s.sc, days: [] }));
        for (const weekEntry of allFCData) {
            for (let i = 0; i < merged.length; i++) {
                const siteWeekData = weekEntry.fcData?.find(s => s.sc === merged[i].sc);
                if (siteWeekData) {
                    const wNum = weekEntry.wNum;
                    const days = siteWeekData.days.map(d => ({ ...d, label: `${d.label} W${wNum}` }));
                    merged[i].days.push(...days);
                }
            }
        }
        return merged;
    }

    function mergeDailyIXDData(allIXDData) {
        if (!allIXDData || allIXDData.length === 0) return null;
        const firstWeek = allIXDData[0]?.ixdData;
        if (!firstWeek || firstWeek.length === 0) return null;
        const merged = firstWeek.map(s => ({ sc: s.sc, days: [] }));
        for (const weekEntry of allIXDData) {
            for (let i = 0; i < merged.length; i++) {
                const siteWeekData = weekEntry.ixdData?.find(s => s.sc === merged[i].sc);
                if (siteWeekData) {
                    const wNum = weekEntry.wNum;
                    const days = siteWeekData.days.map(d => ({ ...d, label: `${d.label} W${wNum}` }));
                    merged[i].days.push(...days);
                }
            }
        }
        return merged;
    }

    function initChartsAfterRender(fcData, scData, ixdData, mode) {
        // Build FC charts
        const fcIBContainer = document.getElementById('spp-fc-ib-chart');
        const fcOBContainer = document.getElementById('spp-fc-ob-chart');
        if (fcIBContainer && fcOBContainer && fcData && fcData.length > 0) {
            buildFCCharts(fcIBContainer, fcOBContainer, fcData, mode);
            // FC target toggles
            document.querySelectorAll('#spp-fc-target-toggles .spp-target-toggle').forEach(toggle => {
                toggle.addEventListener('click', function() {
                    const fc = this.dataset.fc;
                    const isActive = this.classList.toggle('active');
                    toggleFCTargetLine(fc, isActive);
                });
            });
        }
        // Build SC chart
        const scContainer = document.getElementById('spp-sc-chart');
        if (scContainer && scData && scData.length > 0) {
            buildSCChart(scContainer, scData, mode);
            document.querySelectorAll('#spp-sc-op2-toggles .spp-target-toggle').forEach(toggle => {
                toggle.addEventListener('click', function() {
                    const sc = this.dataset.sc;
                    const isActive = this.classList.toggle('active');
                    toggleTargetLine(sc, isActive);
                });
            });
        }
        // Build IXD charts
        const ibContainer = document.getElementById('spp-ixd-ib-chart');
        const daContainer = document.getElementById('spp-ixd-da-chart');
        if (ibContainer && daContainer && ixdData && ixdData.length > 0) {
            buildIXDCharts(ibContainer, daContainer, ixdData, mode);
            // IXD target toggles
            document.querySelectorAll('#spp-ixd-target-toggles .spp-target-toggle').forEach(toggle => {
                toggle.addEventListener('click', function() {
                    const site = this.dataset.ixd;
                    const isActive = this.classList.toggle('active');
                    toggleIXDTargetLine(site, isActive);
                });
            });
        }
    }

    function toggleFCTargetLine(fc, show) {
        if (!fcIBChartInstance || !fcOBChartInstance) return;
        const ibTarget = sidebarFCTarget.ib[fc] || 0;
        const obTarget = sidebarFCTarget.ob[fc] || 0;
        // IB chart
        const ibLabel = `${fc} Target`;
        const ibIdx = fcIBChartInstance.data.datasets.findIndex(ds => ds.label === ibLabel);
        if (show && ibIdx === -1 && ibTarget > 0) {
            fcIBChartInstance.data.datasets.push({ label: ibLabel, data: fcIBChartInstance.data.labels.map(() => ibTarget), borderColor: FC_COLORS[fc] || '#888', backgroundColor: 'transparent', borderWidth: 1.5, borderDash: [6, 4], pointRadius: 0, tension: 0, order: 10 });
        } else if (!show && ibIdx !== -1) { fcIBChartInstance.data.datasets.splice(ibIdx, 1); }
        fcIBChartInstance.update();
        // OB chart
        const obLabel = `${fc} Target`;
        const obIdx = fcOBChartInstance.data.datasets.findIndex(ds => ds.label === obLabel);
        if (show && obIdx === -1 && obTarget > 0) {
            fcOBChartInstance.data.datasets.push({ label: obLabel, data: fcOBChartInstance.data.labels.map(() => obTarget), borderColor: FC_COLORS[fc] || '#888', backgroundColor: 'transparent', borderWidth: 1.5, borderDash: [6, 4], pointRadius: 0, tension: 0, order: 10 });
        } else if (!show && obIdx !== -1) { fcOBChartInstance.data.datasets.splice(obIdx, 1); }
        fcOBChartInstance.update();
    }

    function toggleIXDTargetLine(site, show) {
        if (!ixdIBChartInstance || !ixdDAChartInstance) return;
        const ibTarget = sidebarIXDTarget.ib[site] || 0;
        const daTarget = sidebarIXDTarget.da[site] || 0;
        // IB chart
        const ibLabel = `${site} Target`;
        const ibIdx = ixdIBChartInstance.data.datasets.findIndex(ds => ds.label === ibLabel);
        if (show && ibIdx === -1 && ibTarget > 0) {
            ixdIBChartInstance.data.datasets.push({ label: ibLabel, data: ixdIBChartInstance.data.labels.map(() => ibTarget), borderColor: IXD_COLORS[site] || '#888', backgroundColor: 'transparent', borderWidth: 1.5, borderDash: [6, 4], pointRadius: 0, tension: 0, order: 10 });
        } else if (!show && ibIdx !== -1) { ixdIBChartInstance.data.datasets.splice(ibIdx, 1); }
        ixdIBChartInstance.update();
        // DA chart
        const daLabel = `${site} Target`;
        const daIdx = ixdDAChartInstance.data.datasets.findIndex(ds => ds.label === daLabel);
        if (show && daIdx === -1 && daTarget > 0) {
            ixdDAChartInstance.data.datasets.push({ label: daLabel, data: ixdDAChartInstance.data.labels.map(() => daTarget), borderColor: IXD_COLORS[site] || '#888', backgroundColor: 'transparent', borderWidth: 1.5, borderDash: [6, 4], pointRadius: 0, tension: 0, order: 10 });
        } else if (!show && daIdx !== -1) { ixdDAChartInstance.data.datasets.splice(daIdx, 1); }
        ixdDAChartInstance.update();
    }

    function handleWeeklyCopy() {
        copyAllTables();
    }

    function handleDailyCopy() {
        copyAllTables();
    }

    function copyAllTables() {
        const main = document.getElementById('spp-main');
        if (!main) return;
        const tables = main.querySelectorAll('table.spp-table');
        if (tables.length === 0) return;

        let tsv = '';
        tables.forEach((table, idx) => {
            if (idx > 0) tsv += '\n\n';

            // Handle thead: output both rows properly
            const thead = table.querySelector('thead');
            if (thead) {
                const headerRows = thead.querySelectorAll('tr');
                if (headerRows.length >= 2) {
                    // Row 1: Site/SC + week/day group headers (with colspan)
                    const row1Cells = Array.from(headerRows[0].querySelectorAll('th'));
                    let row1TSV = '';
                    for (const cell of row1Cells) {
                        const text = cell.textContent.trim();
                        const colspan = parseInt(cell.getAttribute('colspan')) || 1;
                        row1TSV += text;
                        for (let i = 1; i < colspan; i++) row1TSV += '\t';
                        row1TSV += '\t';
                    }
                    tsv += row1TSV.trimEnd() + '\n';

                    // Row 2: sub-headers (TPH, vs Target, etc.) - prepend empty cell for Site column
                    const row2Cells = Array.from(headerRows[1].querySelectorAll('th')).map(c => c.textContent.trim());
                    tsv += '\t' + row2Cells.join('\t') + '\n';
                } else if (headerRows.length === 1) {
                    const cells = Array.from(headerRows[0].querySelectorAll('th')).map(c => c.textContent.trim());
                    tsv += cells.join('\t') + '\n';
                }
            }

            // Handle tbody
            const tbody = table.querySelector('tbody');
            if (tbody) {
                const rows = tbody.querySelectorAll('tr');
                for (const row of rows) {
                    const cells = Array.from(row.querySelectorAll('td')).map(c => c.textContent.trim().replace(/\s+/g, ' '));
                    tsv += cells.join('\t') + '\n';
                }
            }
        });

        navigator.clipboard.writeText(tsv).then(() => {
            const btns = main.querySelectorAll('.spp-copy-btn');
            btns.forEach(b => { b.textContent = '\u2705 Copied!'; setTimeout(() => { b.textContent = '\ud83d\udccb Copy to Clipboard'; }, 2000); });
        }).catch(() => {
            const ta = document.createElement('textarea');
            ta.value = tsv; ta.style.position = 'fixed'; ta.style.opacity = '0';
            document.body.appendChild(ta); ta.select(); document.execCommand('copy');
            document.body.removeChild(ta);
            const btns = main.querySelectorAll('.spp-copy-btn');
            btns.forEach(b => { b.textContent = '\u2705 Copied!'; setTimeout(() => { b.textContent = '\ud83d\udccb Copy to Clipboard'; }, 2000); });
        });
    }

    // ─── Database (tidy/long) Export ─────────────────────────────────
    // Builds one row per Site × Week × (Date) × Flow with a consistent
    // schema so the output pastes straight into a pivot-ready DB tab:
    //   Building | Site | Week | Date | Flow | Capacity | Hours | TPH
    function buildDBExport() {
        const header = ['Building', 'Site', 'Week', 'Date', 'Flow', 'Capacity', 'Hours', 'TPH', 'Target'];
        const rows = [];

        // Targets are Q3G current-year values; they don't apply to past years.
        const inclTargets = (currentTab !== 'historical');
        const tgt = (v) => (inclTargets && v && v > 0) ? v : '';

        // Returns [capacity, hours, tph] as strings; blanks when no valid data.
        const metric = (o) => {
            if (!o || o.error || !(o.tph > 0)) return ['', '', ''];
            return [o.units > 0 ? o.units : '', o.hours > 0 ? o.hours : '', o.tph];
        };
        const addSC = (site, wNum, date, ppr) => rows.push(['SC', site, wNum, date, 'Transport', ...metric(ppr), tgt(getSCTargetForWeek(site, wNum))]);
        const addFC = (site, wNum, date, ib, ob) => {
            rows.push(['FC', site, wNum, date, 'Inbound', ...metric(ib), tgt(getFCTargetForWeek(site, wNum, 'ib'))]);
            rows.push(['FC', site, wNum, date, 'Outbound', ...metric(ob), tgt(getFCTargetForWeek(site, wNum, 'ob'))]);
        };
        const addIXD = (site, wNum, date, inbound, da) => {
            rows.push(['IXD', site, wNum, date, 'Inbound', ...metric(inbound), tgt(getIXDTargetForWeek(site, wNum, 'ib'))]);
            rows.push(['IXD', site, wNum, date, 'DA', ...metric(da), tgt(getIXDTargetForWeek(site, wNum, 'da'))]);
        };

        if (lastMode === 'daily') {
            (lastFCData || []).forEach(wk => (wk.fcData || []).forEach(s => s.days.forEach(d => addFC(s.sc, wk.wNum, d.label, d.ib, d.ob))));
            (lastSCData || []).forEach(wk => (wk.scData || []).forEach(s => s.days.forEach(d => addSC(s.sc, wk.wNum, d.label, d.ppr))));
            (lastIXDData || []).forEach(wk => (wk.ixdData || []).forEach(s => s.days.forEach(d => addIXD(s.sc, wk.wNum, d.label, d.inbound, d.da))));
        } else {
            (lastFCData || []).forEach(s => s.weeks.forEach(w => addFC(s.sc, w.wNum, '', w.ib, w.ob)));
            (lastSCData || []).forEach(s => s.weeks.forEach(w => addSC(s.sc, w.wNum, '', w.ppr)));
            (lastIXDData || []).forEach(s => s.weeks.forEach(w => addIXD(s.sc, w.wNum, '', w.inbound, w.da)));
        }

        const lines = [header.join('\t')];
        rows.forEach(r => lines.push(r.join('\t')));
        return lines.join('\n');
    }

    function handleDBExport() {
        const tsv = buildDBExport();
        const btn = document.getElementById('spp-db-btn');
        const done = () => { if (btn) { btn.textContent = '\u2705 Copied!'; setTimeout(() => { btn.textContent = '\ud83d\uddc4\ufe0f Copy as Database'; }, 2000); } };
        navigator.clipboard.writeText(tsv).then(done).catch(() => {
            const ta = document.createElement('textarea');
            ta.value = tsv; ta.style.position = 'fixed'; ta.style.opacity = '0';
            document.body.appendChild(ta); ta.select(); document.execCommand('copy');
            document.body.removeChild(ta);
            done();
        });
    }

    // ─── PDF Export (print only the results area) ────────────────────
    // Uses the @media print stylesheet, which hides the sidebar/header/buttons
    // and switches the results to a light, ink-friendly theme. Charts are
    // canvas-based so they print as rendered. The document title is set so the
    // browser's "Save as PDF" suggests a sensible filename.
    async function handlePDFExport() {
        const btn = document.getElementById('spp-pdf-btn');
        const main = document.getElementById('spp-main');
        if (!main) return;

        const stamp = new Date().toISOString().slice(0, 10);
        const modeLabel = (lastMode === 'daily') ? 'Daily' : (currentTab === 'historical' ? `Historical-${historicalYear}` : 'Weekly');
        const fileName = `Performance Dashboard - ${modeLabel} - ${stamp}.pdf`;

        // Libraries provided via @require
        const jsPDFCtor = (window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF : window.jsPDF;
        if (typeof html2canvas !== 'function' || !jsPDFCtor) {
            alert('PDF libraries failed to load. Check your network/userscript @require lines.');
            return;
        }

        if (btn) { btn.textContent = '\ud83d\udcc4 Building PDF\u2026'; btn.disabled = true; }

        // Hide the action buttons in the capture (but keep tables/charts)
        const actionBar = btn ? btn.parentElement : null;
        const prevActionDisplay = actionBar ? actionBar.style.display : null;
        if (actionBar) actionBar.style.display = 'none';

        // Force a light, ink-friendly theme just for the snapshot
        main.classList.add('spp-pdf-capture');

        // Build a summary header (filters + display options) shown only in the PDF
        const summaryEl = buildPDFSummaryHeader(modeLabel);
        if (summaryEl) main.insertBefore(summaryEl, main.firstChild);

        // Reset scroll so html2canvas captures from the top-left origin
        main.scrollTop = 0; main.scrollLeft = 0;

        // Charts are responsive; hiding the toggle pills changes header geometry,
        // so re-lay-out every chart instance before the snapshot to avoid clipping.
        const chartInstances = [scChartInstance, ixdIBChartInstance, ixdDAChartInstance, fcIBChartInstance, fcOBChartInstance];

        try {
            // Wait for the capture-mode styles (unstick headers, open overflow,
            // grid row sizing, hidden toggles) to apply, then resize charts and
            // let the layout settle before snapshot.
            await new Promise(r => setTimeout(r, 150));
            chartInstances.forEach(c => { try { if (c) c.resize(); } catch (_) {} });
            await new Promise(r => setTimeout(r, 250));

            const fullW = main.scrollWidth;
            const fullH = main.scrollHeight;
            const canvas = await html2canvas(main, {
                backgroundColor: '#ffffff',
                scale: 1.5,             // enough for crisp text, far fewer pixels than 2x
                useCORS: true,
                logging: false,
                scrollX: 0,
                scrollY: 0,
                x: 0,
                y: 0,
                width: fullW,
                height: fullH,
                windowWidth: fullW,
                windowHeight: fullH
            });

            // Build a page sized to the snapshot's own aspect ratio so there's no
            // wasted blank space on the sides. We fix the content width and derive
            // the page height from the image ratio (single page, tight fit).
            const margin = 8; // mm
            const imgRatio = canvas.width / canvas.height; // width / height
            const contentW = 277;                 // ~A4 landscape printable width (mm)
            const pageW = contentW + margin * 2;
            const drawW = contentW;
            const drawH = drawW / imgRatio;
            const pageH = drawH + margin * 2;

            const pdf = new jsPDFCtor({
                orientation: (pageW >= pageH) ? 'landscape' : 'portrait',
                unit: 'mm',
                format: [pageW, pageH]
            });

            // JPEG (quality 0.85) instead of PNG keeps the file small. Text stays
            // readable on a white background; PNG was lossless and 5-10x heavier.
            const imgData = canvas.toDataURL('image/jpeg', 0.85);
            pdf.addImage(imgData, 'JPEG', margin, margin, drawW, drawH, undefined, 'FAST');
            pdf.save(fileName);
        } catch (e) {
            alert('PDF export failed: ' + e.message);
        } finally {
            const hdr = document.getElementById('spp-pdf-summary');
            if (hdr) hdr.remove();
            main.classList.remove('spp-pdf-capture');
            if (actionBar) actionBar.style.display = prevActionDisplay || '';
            if (btn) { btn.textContent = '\ud83d\udcc4 Export PDF'; btn.disabled = false; }
        }
    }

    // Builds the summary header injected at the top of the PDF snapshot.
    // Lists the selected sites, the weeks in scope, and which display options
    // are enabled. Returns a detached element (removed again after capture).
    function buildPDFSummaryHeader(modeLabel) {
        try {
            const fcs = getSelectedFCs();
            const scs = getSelectedSCs();
            const ixds = getSelectedIXDs();
            const allSites = [...fcs, ...scs, ...ixds];

            const weekNums = Array.from(dashEl.querySelectorAll('.spp-chip[data-week].selected'))
                .map(c => parseInt(c.dataset.week)).sort((a, b) => a - b);
            const weeksLabel = weekNums.length ? weekNums.map(w => `W${w}`).join(', ') : '\u2013';

            const includes = [];
            if (showDetails) includes.push('Details (Cap/Hrs)');
            if (showTargets) includes.push('vs Target');
            if (showAverages) includes.push('L4W avg');
            if (showPlanned) includes.push('vs Plan');
            const includeLabel = includes.length ? includes.join(', ') : 'None';

            const yearLabel = (currentTab === 'historical') ? ` ${historicalYear}` : '';

            const el = document.createElement('div');
            el.id = 'spp-pdf-summary';
            el.style.cssText = 'margin:0 0 14px 0;padding:10px 14px;border:1px solid #ccc;border-radius:8px;background:#f7f8fa;font-size:12px;line-height:1.6;color:#111;';
            el.innerHTML =
                `<div style="font-size:15px;font-weight:700;margin-bottom:4px;color:#000">Performance Dashboard \u2014 ${modeLabel}${yearLabel}</div>` +
                `<div><strong>Sites:</strong> ${allSites.length ? allSites.join(', ') : '\u2013'}</div>` +
                `<div><strong>Weeks:</strong> ${weeksLabel}</div>` +
                `<div><strong>Include:</strong> ${includeLabel}</div>` +
                `<div style="color:#555;margin-top:2px">Generated ${new Date().toLocaleString()}</div>`;
            return el;
        } catch (_) {
            return null;
        }
    }

    // ─── Entry Point ─────────────────────────────────────────────────

    function init() {
        const b = document.createElement('button');
        b.className = 'spp-button';
        b.innerHTML = '\ud83d\udcca Dashboard';
        b.title = 'Performance Dashboard v2.5';
        b.addEventListener('click', () => { b.style.display = 'none'; showDashboard(); });
        document.body.appendChild(b);
        console.log('[SPP] v2.5 loaded \u2013 Performance Dashboard (planned TPH, per-week targets, historical lookup)');
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

})();

