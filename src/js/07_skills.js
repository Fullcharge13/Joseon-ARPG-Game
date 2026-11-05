/* ======================= 스킬 시전 ======================= */
// aim: 마우스로 가리킨 세계 좌표(PC). 없으면 자동 조준, 대상도 없으면 바라보는 쪽
function castSkill(w, id, aim) {
  const p = w.p,
    S = w.S,
    sk = SKILLS[id];
  if (!sk || !(S.ranks[id] > 0)) return false;
  if ((p.cds[id] || 0) > 0) return false;
  if (p.ki < sk.cost) return false;
  let a = p.face;
  if (aim) a = Math.atan2(aim.y - p.y, aim.x - p.x);
  else if (sk.range) {
    const t = autoTarget(w, sk.range);
    if (t) a = Math.atan2(t.y - p.y, t.x - p.x);
  }
  p.face = a;
  if (Math.abs(Math.cos(a)) > 0.2) p.fx = Math.cos(a) > 0 ? 1 : -1;
  p.ki -= sk.cost;
  if (sk.gain) {
    const g = Math.min(sk.gain, S.maxKi - p.ki);
    p.ki += g;
    w.rs.kiGot += g;
  }
  p.cds[id] = skillCd(S, id);
  p.castT = 0.18;
  SKILL_FX[id](w, a);
  sfx(id);
  return true;
}
function shoot(w, a, o) {
  if (w.projs.length >= CAP.projs) return;
  const p = w.p;
  w.projs.push({x: p.x + Math.cos(a) * 6, y: p.y + Math.sin(a) * 6, // 시선 검사와 같은 선 위에서 나간다
     vx: Math.cos(a) * o.speed, vy: Math.sin(a) * o.speed, a, r: o.r || 3, dmg: o.dmg, src: o.src, type: o.type, life: o.range / o.speed, pierce: o.pierce || 0, splash: o.splash, boom: o.boom, hit: new Set(), look: o.look});
}
function explode(w, x, y, r, dmg, src, type) {
  for (const e of w.ens) if (!e.dead && !e.sleep && dist2(x, y, e.x, e.y) < (r + e.r) ** 2) hurt(w, e, dmg, src, type);
  ring(w, x, y, r, type === 'fire' ? '#ff8a2a' : '#c8e8ff');
  burst(w, x, y, 6, type === 'fire' ? '#ffb040' : '#c8e8ff');
}
const SKILL_FX = {
  meok(w, a) {
    const S = w.S,
      sk = SKILLS.meok,
      br = S.branches.meok;
    const three = S.legends.includes('meok3');
    const angs = three ? [a - 0.22, a, a + 0.22] : [a];
    for (const b of angs)
      shoot(w, b, {speed: sk.speed, range: sk.range, dmg: skillHit(S, 'meok', three ? 0.7 : 1), src: three ? 'meok3' : 'meok', type: 'phys', pierce: br === 2 ? 2 : 0, splash: br === 1 ? {r: 22, part: 0.5} : null, look: 'meok'});
  },
  hwa(w, a) {
    const S = w.S,
      sk = SKILLS.hwa,
      br = S.branches.hwa;
    const R = sk.radius * (br === 1 ? 1.5 : 1);
    const throwOne = (ang, part, rr) => {
      const dmg = skillHit(S, 'hwa', part);
      shoot(w, ang, {
        speed: sk.speed,
        range: sk.range,
        dmg,
        src: 'hwa',
        type: 'fire',
        r: 4,
        look: 'hwa',
        boom: (x, y) => {
          explode(w, x, y, rr, dmg, 'hwa', 'fire');
          if (S.legends.includes('hwa2')) w.later.push({t: 0.5, fn: () => explode(w, x, y, rr, dmg * 0.6, 'hwa2', 'fire')});
          sfx('boom');
        }
      });
    };
    throwOne(a, 1, R);
    if (br === 2) {
      throwOne(a - 0.3, 0.5, R * 0.7);
      throwOne(a + 0.3, 0.5, R * 0.7);
    }
  },
  ilpil(w, a) {
    const S = w.S,
      sk = SKILLS.ilpil,
      br = S.branches.ilpil,
      p = w.p;
    let L = sk.range * (br === 1 ? 1.6 : 1);
    // 벽에서 획이 멈춘다
    for (let s = 8; s <= L; s += 6) {
      const t = w.map.tiles[Math.floor((p.y + Math.sin(a) * s) / TILE) * w.map.w + Math.floor((p.x + Math.cos(a) * s) / TILE)];
      if (t === 1 || t === 2 || t === 4) {
        L = s;
        break;
      }
    }
    const x2 = p.x + Math.cos(a) * L,
      y2 = p.y + Math.sin(a) * L;
    const dmg = skillHit(S, 'ilpil');
    let n = 0;
    for (const e of w.ens) {
      if (e.dead || e.sleep) continue;
      if (segDist2(e.x, e.y, p.x, p.y, x2, y2) < (sk.width / 2 + e.r) ** 2) {
        hurt(w, e, dmg, 'ilpil', 'phys');
        n++;
      }
    }
    if (S.legends.includes('ilpilKi') && n) {
      const g = Math.min(6 * n, S.maxKi - p.ki);
      p.ki += g;
      w.rs.kiGot += g;
    }
    if (br === 2) w.pools.push({line: 1, x: p.x, y: p.y, x2, y2, wd: sk.width, t: 2, tick: 0.5, every: 0.5, dmg: dmg * 0.3, src: 'ilpil', type: 'phys', slow: 0.5, look: 'ink'});
    if (w.fx.length < CAP.fx) w.fx.push({k: 'stroke', x: p.x, y: p.y, x2, y2, t: 0.35, T: 0.35});
    if (n) w.hitstop = 0.04;
  },
  hanseol(w) {
    const S = w.S,
      sk = SKILLS.hanseol,
      br = S.branches.hanseol,
      p = w.p;
    const R = sk.radius * (br === 2 ? 1.4 : 1);
    const dmg = skillHit(S, 'hanseol');
    for (const e of w.ens) {
      if (e.dead || e.sleep || dist2(p.x, p.y, e.x, e.y) > (R + e.r) ** 2) continue;
      hurt(w, e, dmg, 'hanseol', 'cold');
      if (br === 1) {
        e.frozen = 1.2;
        if (!e.boss) e.root = 1.2;
      }
    }
    ring(w, p.x, p.y, R, '#c8e8ff');
    burst(w, p.x, p.y, 12, '#e8f6ff');
    if (S.legends.includes('seolStay')) w.pools.push({x: p.x, y: p.y, r: R, t: 2, tick: 0.5, every: 0.5, dmg: dmg * 0.4, src: 'seolStay', type: 'cold', look: 'frost'});
  },
  gyeol(w) {
    const S = w.S,
      sk = SKILLS.gyeol,
      br = S.branches.gyeol,
      p = w.p;
    if (p.shield) breakShield(w);
    p.shield = {amt: S.maxHp * sk.coef * rankMul(S.ranks.gyeol) * (br === 1 ? 1.6 : 1), t: sk.dur};
    p.shield.max = p.shield.amt;
    ring(w, p.x, p.y, 14, '#ffe08a');
  }
};
