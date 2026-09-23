/* 新西兰南岛行程助手 · 离线单页应用 */

(function () {
  "use strict";

  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };

  const TAG_TEXT = {
    p0: "必到 · 迟到不退", p1: "景点", meal: "餐食", drive: "行车",
    stay: "住宿", flight: "航班", alert: "注意", tip: "提示", call: "致电确认",
  };

  const state = {
    view: "days",
    dayIdx: 0,
    seg: "tel",
    done: LS.get("nz_done", []),
  };

  const $view = document.getElementById("view");
  const $status = document.getElementById("hdStatus");
  const $toast = document.getElementById("toast");

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function toast(msg) {
    $toast.textContent = msg;
    $toast.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => $toast.classList.remove("show"), 1600);
  }
  function telHref(t) {
    let s = String(t || "").replace(/\(0\)/g, "").replace(/[\s()\u2013\u2014-]/g, "");
    if (!s) return null;
    if (s.startsWith("+")) return "tel:" + s;
    if (/^(0800|0508)/.test(s)) return "tel:" + s;
    if (s.startsWith("0")) return "tel:+64" + s.slice(1);
    return "tel:" + s;
  }
  function mapsHref(addr) {
    return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(addr);
  }
  function copyText(t) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(t).then(() => toast("已复制：" + t.slice(0, 22))).catch(() => fallback());
    } else fallback();
    function fallback() {
      const ta = document.createElement("textarea");
      ta.value = t; ta.style.position = "fixed"; ta.style.left = "-9999px";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); toast("已复制"); } catch (e) { toast("复制失败，请长按选择"); }
      document.body.removeChild(ta);
    }
  }
  function todayIso() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function daysBetween(a, b) {
    return Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);
  }

  /* ---------- 当前日期定位 ---------- */
  function resolveToday() {
    const t = todayIso();
    let idx = TRIP.days.findIndex(d => d.iso === t);
    if (idx >= 0) return idx;
    const future = TRIP.days.findIndex(d => d.iso > t);
    if (future >= 0) return future;
    return TRIP.days.length - 1;
  }
  function initDay() {
    const t = todayIso();
    const savedDate = LS.get("nz_daydate", "");
    const savedIdx = LS.get("nz_dayidx", -1);
    state.dayIdx = (savedDate === t && savedIdx >= 0 && savedIdx < TRIP.days.length) ? savedIdx : resolveToday();
    LS.set("nz_daydate", t);
    LS.set("nz_dayidx", state.dayIdx);
  }

  /* ---------- header ---------- */
  function renderStatus() {
    const t = todayIso();
    const dep = TRIP.meta.depIso;
    const last = TRIP.days[TRIP.days.length - 1].iso;
    let html = "";
    if (t < dep) {
      const n = daysBetween(t, dep);
      html += `<span class="hd-chip hot">距出发还有 <b>${n}</b> 天</span>`;
      html += `<span class="hd-chip">${esc(TRIP.meta.crew)}</span>`;
    } else if (t > last) {
      html += `<span class="hd-chip">行程已结束 · 共 13 天</span>`;
    } else {
      const d = TRIP.days[state.dayIdx];
      const inTrip = d.iso === t;
      html += `<span class="hd-chip${inTrip ? " hot" : ""}">${t === d.iso ? "今天" : "当前查看"} · <b>${esc(d.date)}</b> ${esc(d.weekday)}</span>`;
      html += `<span class="hd-chip">Day ${d.id} / 14</span>`;
      if (d.stay && d.stay !== "机上" && d.stay !== "返程") html += `<span class="hd-chip">宿 ${esc(d.stay)}</span>`;
    }
    $status.innerHTML = html;
  }

  /* ---------- 视图：行程 ---------- */
  function itemHtml(it) {
    const tag = it.tag || "tip";
    let h = `<div class="item is-${tag}">
      <div class="item-time">${esc(it.time)}</div>
      <div class="item-dot"></div>
      <div class="item-body">
        <div><span class="tag tag-${tag}">${esc(TAG_TEXT[tag] || "提示")}</span><span class="item-title">${esc(it.title)}</span></div>`;
    if (it.addr) {
      h += `<div class="addr-line">📍 ${esc(it.addr)}</div>`;
    }
    if (it.notes && it.notes.length) {
      h += `<ul class="notes">${it.notes.map(n => `<li>${esc(n)}</li>`).join("")}</ul>`;
    }
    h += `<div class="act-row">`;
    if (it.addr) h += `<a class="act addr" target="_blank" rel="noopener" href="${esc(mapsHref(it.addr))}">地图导航</a>`;
    if (it.addr) h += `<button class="act" data-copy="${esc(it.addr)}">复制地址</button>`;
    if (it.tel) h += `<a class="act tel" href="${esc(telHref(it.tel))}">📞 ${esc(it.tel)}</a>`;
    h += `</div></div></div>`;
    return h;
  }

  function viewDays() {
    const d = TRIP.days[state.dayIdx];
    const chips = TRIP.days.map((x, i) => {
      const isToday = x.iso === todayIso();
      return `<div class="dchip${i === state.dayIdx ? " on" : ""}${isToday ? " today" : ""}" data-day="${i}">
        <div class="d1">Day ${x.id}</div><div class="d2">${esc(x.date)}</div><div class="d3">${esc(x.weekday.split(" · ")[0])}</div>
      </div>`;
    }).join("");

    return `
      <div class="sec-title" style="justify-content:space-between">
        <span>逐日行程</span>
        <button class="ck-reset" data-act="today">回到今天</button>
      </div>
      <div class="daystrip">${chips}</div>
      <div class="card">
        <div class="dayhead">
          <div class="dh-date">${esc(d.date)} ${esc(d.weekday)}</div>
          <div class="dh-wd">Day ${d.id}</div>
        </div>
        <div class="daytitle">${esc(d.title)}</div>
        <div class="meta-row">
          <span class="meta-pill">住宿：${esc(d.stay)}</span>
          <span class="meta-pill">${d.items.length} 个节点</span>
        </div>
        <div class="tl">${d.items.map(itemHtml).join("")}</div>
      </div>`;
  }

  /* ---------- 视图：速查 ---------- */
  const SEGS = [["tel", "电话 / 地址"], ["stay", "住宿"], ["meal", "餐食"], ["drive", "自驾租车"]];

  function segHtml() {
    return `<div class="seg">${SEGS.map(([k, label]) =>
      `<button data-seg="${k}" class="${state.seg === k ? "on" : ""}">${label}</button>`).join("")}</div>`;
  }

  function segTel() {
    return `<div class="sec-title">关键电话与地址速查</div>
      <div class="card">${TRIP.contacts.map(c => {
        let h = `<div class="qrow"><div class="qname">${esc(c.name)}<span class="qbadge">报道 ${esc(c.report)}</span></div>`;
        h += `<div class="qsub">📍 ${esc(c.addr)}</div>`;
        if (c.note) h += `<div class="qnote">${esc(c.note)}</div>`;
        h += `<div class="act-row">
          <a class="act tel" href="${esc(telHref(c.tel))}">📞 ${esc(c.tel)}</a>
          <a class="act addr" target="_blank" rel="noopener" href="${esc(mapsHref(c.addr))}">地图</a>
          <button class="act" data-copy="${esc(c.addr)}">复制地址</button>
        </div></div>`;
        return h;
      }).join("")}</div>`;
  }

  function segStay() {
    return `<div class="sec-title">住宿锚点</div>
      <div class="warnbox"><b>免费取消倒计时：</b>${esc(TRIP.cancelNote)}</div>
      <div class="card">${TRIP.stays.map(s => {
        let h = `<div class="qrow"><div class="qname">${esc(s.city)} <span class="qbadge">${esc(s.dates)}</span></div>`;
        h += `<div class="qsub">📍 ${esc(s.addr)}</div>`;
        h += `<div class="qnote">免费取消截止：${esc(s.cancel)}</div>`;
        if (s.notes && s.notes.length) h += `<div class="qnote">${s.notes.map(esc).join(" · ")}</div>`;
        h += `<div class="act-row">
          <a class="act addr" target="_blank" rel="noopener" href="${esc(mapsHref(s.addr))}">地图</a>
          <button class="act" data-copy="${esc(s.addr)}">复制地址</button>`;
        if (s.tel) h += `<a class="act tel" href="${esc(telHref(s.tel))}">📞 ${esc(s.tel)}</a>`;
        h += `</div></div>`;
        return h;
      }).join("")}</div>`;
  }

  function segMeal() {
    return `<div class="sec-title">餐食速查（B 列汇总）</div>
      <div class="card">${TRIP.meals.map(m => `
        <div class="qrow">
          <div class="qname">${esc(m.date)}</div>
          <div class="qsub">${esc(m.plan)}</div>
          <div class="qnote">要点：${esc(m.point)}</div>
        </div>`).join("")}</div>`;
  }

  function segDrive() {
    const dv = TRIP.driving;
    return `<div class="sec-title">自驾与租车</div>
      <div class="card">${dv.rows.map(r => `
        <div class="qrow"><div class="qname">${esc(r.k)}</div><div class="qsub">${esc(r.v)}</div></div>`).join("")}</div>
      <div class="sec-title">禁行路段（保险不赔）</div>
      <div class="card">
        <div class="dangerbox"><b>合同禁止通行：</b>开进去不违法，但出事故车损险与第三者险全部失效。</div>
        <div class="forbid">${dv.forbidden.map(f => `<span>${esc(f)}</span>`).join("")}</div>
        <div class="qnote" style="margin-top:9px">${esc(dv.forbiddenNote)}</div>
      </div>`;
  }

  function viewQuick() {
    const body = { tel: segTel, stay: segStay, meal: segMeal, drive: segDrive }[state.seg]();
    return segHtml() + body;
  }

  /* ---------- 视图：提醒 ---------- */
  function viewAlert() {
    const ten = TRIP.topTen.map(t => `
      <div class="ten ${t.level}">
        <div class="ten-n">${t.n}</div>
        <div><div class="ten-t">${esc(t.title)}</div><div class="ten-d">${esc(t.detail)}</div></div>
      </div>`).join("");

    const conf = TRIP.conflicts.map(c => `
      <div class="card conf" data-conf="${c.n}">
        <div class="conf-head">
          <div class="conf-n">${c.n}</div>
          <div class="conf-t">${esc(c.title)}</div>
          <div class="conf-arrow">›</div>
        </div>
        <ul class="conf-body">${c.points.map(p => `<li>${esc(p)}</li>`).join("")}</ul>
      </div>`).join("");

    return `
      <div class="sec-title">出发前必看 · 十条</div>
      <div class="card">${ten}</div>
      <div class="sec-title">夏令时</div>
      <div class="warnbox">${esc(TRIP.meta.dstNote)}</div>
      <div class="sec-title">七个冲突与修正（点开看细节）</div>
      ${conf}
      <div class="sec-title">机票</div>
      <div class="card">${TRIP.flights.map(f => `
        <div class="qrow"><div class="qname">${esc(f.dir)} · ${esc(f.date)}</div>
        <div class="qsub">${esc(f.text)}</div><div class="qnote">${esc(f.note)}</div></div>`).join("")}</div>`;
  }

  /* ---------- 视图：清单 ---------- */
  function viewCheck() {
    let total = 0, doneN = 0;
    TRIP.checklist.forEach((g, gi) => g.items.forEach((it, ii) => {
      total++; if (state.done.indexOf(gi + ":" + ii) >= 0) doneN++;
    }));
    const pct = total ? Math.round(doneN / total * 100) : 0;

    const groups = TRIP.checklist.map((g, gi) => {
      const rows = g.items.map((it, ii) => {
        const key = gi + ":" + ii;
        const on = state.done.indexOf(key) >= 0;
        return `<div class="ck-item${on ? " done" : ""}" data-key="${key}">
          <div class="ck-box">${on ? "✓" : ""}</div><div class="ck-text">${esc(it)}</div></div>`;
      }).join("");
      return `<div class="sec-title">${esc(g.group)}</div><div class="card">${rows}</div>`;
    }).join("");

    return `
      <div class="sec-title">出发前 24 小时清单</div>
      <div class="card">
        <div class="ck-head">
          <div class="ck-prog">已完成 <b>${doneN}</b> / ${total} · ${pct}%</div>
          <button class="ck-reset" data-act="reset">清空勾选</button>
        </div>
        <div style="height:6px;background:#eaf1f4;border-radius:99px;margin-top:6px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#2f9e77,#14959b);border-radius:99px;transition:.3s"></div>
        </div>
        <div class="qnote" style="margin-top:7px">勾选状态保存在本机浏览器，换设备不同步。</div>
      </div>
      ${groups}`;
  }

  /* ---------- render ---------- */
  function render() {
    const map = { days: viewDays, quick: viewQuick, alert: viewAlert, check: viewCheck };
    $view.innerHTML = map[state.view]();
    $view.scrollTop = 0;
    renderStatus();
    document.querySelectorAll(".tab").forEach(b =>
      b.classList.toggle("is-active", b.dataset.view === state.view));
  }

  /* ---------- events ---------- */
  function viewFromHash() {
    const h = (location.hash || "").replace("#", "");
    return ["days", "quick", "alert", "check"].indexOf(h) >= 0 ? h : "days";
  }
  window.addEventListener("hashchange", () => {
    state.view = viewFromHash();
    window.scrollTo(0, 0);
    render();
  });

  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      state.view = btn.dataset.view;
      window.scrollTo(0, 0);
      render();
      if (location.hash !== "#" + state.view) location.hash = state.view;
    });
  });

  $view.addEventListener("click", e => {
    const chip = e.target.closest(".dchip");
    if (chip) {
      state.dayIdx = +chip.dataset.day;
      LS.set("nz_dayidx", state.dayIdx);
      render();
      document.querySelector(".daystrip .dchip.on") &&
        document.querySelector(".daystrip .dchip.on").scrollIntoView({ inline: "center", block: "nearest" });
      return;
    }
    const seg = e.target.closest("[data-seg]");
    if (seg) { state.seg = seg.dataset.seg; render(); return; }

    const copy = e.target.closest("[data-copy]");
    if (copy) { copyText(copy.dataset.copy); return; }

    const conf = e.target.closest(".conf");
    if (conf) { conf.classList.toggle("open"); return; }

    const ck = e.target.closest(".ck-item");
    if (ck) {
      const key = ck.dataset.key;
      const i = state.done.indexOf(key);
      if (i >= 0) state.done.splice(i, 1); else state.done.push(key);
      LS.set("nz_done", state.done);
      render();
      return;
    }

    const act = e.target.closest("[data-act]");
    if (act) {
      if (act.dataset.act === "today") {
        state.dayIdx = resolveToday();
        LS.set("nz_dayidx", state.dayIdx);
        render();
        setTimeout(() => {
          const on = document.querySelector(".daystrip .dchip.on");
          if (on) on.scrollIntoView({ inline: "center", block: "nearest" });
        }, 30);
      }
      if (act.dataset.act === "reset") {
        state.done = []; LS.set("nz_done", []); render(); toast("已清空勾选");
      }
    }
  });

  /* ---------- 离线：注册 Service Worker ---------- */
  if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }

  /* ---------- init ---------- */
  state.view = viewFromHash();
  initDay();
  render();
})();
