// client/src/components/CharacterSheet.jsx
import React from 'react';

/* eslint-disable react/prop-types */

function safeJsonParse(s) {
  if (!s) return null;
  try {
    return typeof s === 'string' ? JSON.parse(s) : s;
  } catch (error) {
    console.debug('safeJsonParse failed', error);
    return null;
  }
}

function mod(score) {
  if (!Number.isFinite(score)) return null;
  return Math.floor((score - 10) / 2);
}

function formatSigned(value) {
  if (value == null) return '—';
  return value >= 0 ? `+${value}` : String(value);
}

function formatLevelSummary(classesList, level, race) {
  const parts = [classesList.join(', ')];
  if (level) parts.push(`Level ${level}`);
  if (race) parts.push(race);
  return parts.filter(Boolean).join(' • ');
}

function StatRow({ label, value }) {
  if (value == null || value === '') return null;
  return (
    <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 0' }}>
      <div style={{ color:'var(--muted)' }}>{label}</div>
      <div style={{ fontWeight:600 }}>{value}</div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ border:'1px solid var(--border)', borderRadius:8, padding:12, background:'var(--panel)' }}>
      <div style={{ fontWeight:700, marginBottom:8 }}>{title}</div>
      {children}
    </div>
  );
}

export default function CharacterSheet({ json, avatarUrl }) {
  const data = safeJsonParse(json) || {};
  // Try common locations
  const ch = data.character || data;

  // Basic identity
  const name = ch.name || ch.characterName || '';
  const classesList = (ch.classes || data.classes || []).map(c => {
    const n = c?.definition?.name || c?.name || 'Class';
    const lvl = c?.level || c?.levels || c?.levelTotal || '';
    return lvl ? `${n} ${lvl}` : n;
  });
  const level = ch.level || data.level || '';
  const race = ch.race?.fullName || ch.race?.name || data.race?.name || '';

  // Vital stats
  const baseHP = ch.baseHitPoints ?? data.baseHitPoints ?? null;
  const hpTemp = ch.temporaryHitPoints ?? null;
  const ac = ch.armorClass ?? ch.overrideArmorClass ?? data.armorClass ?? null;
  const speed = ch?.bonusSpeeds?.[0]?.value || ch?.movement?.walk || data.speed || null;

  // Abilities (common DDB layout: stats array with id/value)
  // Fallback to abilityScores dictionary if present
  const statsArr = ch.stats || data.stats || [];
  const byId = new Map();
  statsArr.forEach((stat) => {
    if (stat?.id == null) return;
    byId.set(stat.id, stat.value);
  });
  // DDB standard ids: 1 STR,2 DEX,3 CON,4 INT,5 WIS,6 CHA
  const abilities = {
    STR: byId.get(1) ?? ch.strength ?? data.strength,
    DEX: byId.get(2) ?? ch.dexterity ?? data.dexterity,
    CON: byId.get(3) ?? ch.constitution ?? data.constitution,
    INT: byId.get(4) ?? ch.intelligence ?? data.intelligence,
    WIS: byId.get(5) ?? ch.wisdom ?? data.wisdom,
    CHA: byId.get(6) ?? ch.charisma ?? data.charisma,
  };

  // Proficiency bonus (rough heuristic by level)
  const lvlNum = Number(level) || (Array.isArray(ch.classes) ? ch.classes.reduce((a,c)=>a+(c.level||0),0) : 0);
  const profBonus = lvlNum ? (1 + Math.ceil(lvlNum / 4)) : null; // 1->+2,5->+3,9->+4,13->+5,17->+6 -> adjust +1

  // Saves and skills are complex in DDB; give a light derived view
  const saves = Object.fromEntries(Object.entries(abilities).map(([k, v]) => {
    const saveValue = v == null ? null : mod(v);
    return [k, saveValue];
  }));
  const subtitle = formatLevelSummary(classesList, level, race);
  let hpDisplay = null;
  if (baseHP != null) {
    hpDisplay = hpTemp ? `${baseHP} (+${hpTemp})` : baseHP;
  }

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1.2fr 1fr', gap:12 }}>
      <div>
        <Section title="Character">
          <div style={{ display:'flex', gap:12, alignItems:'center' }}>
            {avatarUrl ? <img src={avatarUrl} alt="avatar" style={{ width:64, height:64, objectFit:'cover', borderRadius:8 }} /> : null}
            <div>
              <div style={{ fontSize:18, fontWeight:800 }}>{name || '(Unnamed)'}</div>
              <div style={{ fontSize:12, color:'var(--muted)' }}>{subtitle}</div>
            </div>
          </div>
        </Section>
        <div style={{ height:12 }} />
        <Section title="Abilities">
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8 }}>
            {Object.entries(abilities).map(([k,v]) => (
              <div key={k} style={{ border:'1px solid var(--border)', borderRadius:6, padding:8, textAlign:'center', background:'var(--bg)' }}>
                <div style={{ fontWeight:700, fontSize:12, color:'var(--muted)' }}>{k}</div>
                <div style={{ fontSize:20, fontWeight:800 }}>{v ?? '—'}</div>
                <div style={{ fontSize:12, color:'var(--muted)' }}>mod {formatSigned(mod(v))}</div>
              </div>
            ))}
          </div>
        </Section>
      </div>
      <div>
        <Section title="Combat">
          <StatRow label="HP" value={hpDisplay} />
          <StatRow label="AC" value={ac} />
          <StatRow label="Speed" value={speed} />
          <StatRow label="Proficiency" value={profBonus == null ? null : formatSigned(profBonus)} />
        </Section>
        <div style={{ height:12 }} />
        <Section title="Saving Throws (mods)">
          {Object.entries(saves).map(([k,v]) => (
            <StatRow key={k} label={k} value={formatSigned(v)} />
          ))}
        </Section>
      </div>
    </div>
  );
}
