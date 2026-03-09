import { useState, useEffect, useRef } from "react";

// ═══════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════
const PROXY = "https://aftt-proxy.onrender.com";
const CLUB_ID = "H136";
const CLUB_NAME = "RCTT Heppignies";
const SEASON = "2024-2025";

const C = {
  navy:    "#0d1e3b",
  navyMid: "#1a3a6b",
  navyLight:"#2a5cb8",
  gold:    "#c8a200",
  goldLight:"#f0c840",
  sky:     "#3d9be9",
  bg:      "#f0f4f9",
  card:    "#ffffff",
  success: "#1e8a4a",
  danger:  "#c0392b",
  muted:   "#8899bb",
};

// ═══════════════════════════════════════════════════
// FALLBACK DATA
// ═══════════════════════════════════════════════════
const FALLBACK_PLAYERS = [
  { name:"Marc Dumont",    ranking:"C2", points:1320, played:26, won:18 },
  { name:"Jean-Paul Denis",ranking:"C4", points:1185, played:22, won:14 },
  { name:"Sophie Renard",  ranking:"D0", points:1050, played:20, won:13 },
  { name:"Thomas Leroy",   ranking:"D2", points:940,  played:24, won:16 },
  { name:"Pierre Meunier", ranking:"D4", points:820,  played:18, won:10 },
  { name:"Julie Lambert",  ranking:"E0", points:710,  played:16, won:8  },
  { name:"David Collignon",ranking:"E2", points:630,  played:14, won:7  },
  { name:"Alain Bastin",   ranking:"E4", points:560,  played:12, won:5  },
];

const FALLBACK_NEXT = [
  { date:"15/03/2025", time:"14h30", team:"Heppignies A", opponent:"Buffalo Couillet A", location:"Domicile", division:"Provinciale 2" },
  { date:"15/03/2025", time:"14h30", team:"Heppignies B", opponent:"Loverval C",         location:"Extérieur", division:"Provinciale 4" },
  { date:"22/03/2025", time:"14h30", team:"Heppignies A", opponent:"Naast A",            location:"Extérieur", division:"Provinciale 2" },
];

// ═══════════════════════════════════════════════════
// FETCH
// ═══════════════════════════════════════════════════
async function apiFetch(path) {
  const r = await fetch(`${PROXY}${path}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// ═══════════════════════════════════════════════════
// MINI COMPONENTS
// ═══════════════════════════════════════════════════
const Badge = ({ children, color = "blue", sm }) => {
  const map = {
    blue:  { bg:"#dce8ff", tx:C.navyMid },
    green: { bg:"#d4f0e0", tx:"#1a7a40" },
    red:   { bg:"#fde0dd", tx:"#a93226" },
    gold:  { bg:"#fdf0c0", tx:"#8a6a00" },
    gray:  { bg:"#e8edf5", tx:C.muted   },
  };
  const s = map[color]||map.blue;
  return (
    <span style={{
      background:s.bg, color:s.tx,
      padding: sm ? "2px 8px" : "3px 12px",
      borderRadius:20, fontSize: sm ? 10 : 11,
      fontWeight:700, display:"inline-block", lineHeight:1.7,
      fontFamily:"'DM Mono', monospace",
    }}>{children}</span>
  );
};

const Card = ({ children, style={}, onClick, accent }) => (
  <div onClick={onClick} style={{
    background:C.card, borderRadius:16, padding:16, marginBottom:10,
    boxShadow:"0 2px 16px rgba(13,30,59,0.07)",
    cursor: onClick ? "pointer" : "default",
    borderLeft: accent ? `4px solid ${accent}` : undefined,
    transition:"transform 0.12s, box-shadow 0.12s",
    ...style,
  }}
    onMouseEnter={onClick ? e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 6px 24px rgba(13,30,59,0.13)"} : null}
    onMouseLeave={onClick ? e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="0 2px 16px rgba(13,30,59,0.07)"} : null}
  >{children}</div>
);

const Sec = ({ title }) => (
  <div style={{ fontSize:10, fontWeight:800, color:C.muted, textTransform:"uppercase",
    letterSpacing:2, margin:"20px 0 8px", fontFamily:"'DM Mono', monospace" }}>{title}</div>
);

const Pill = ({ label, active, onClick }) => (
  <button onClick={onClick} style={{
    padding:"5px 14px", borderRadius:20, border:"none",
    background: active ? C.navyMid : C.card,
    color: active ? "#fff" : C.muted,
    fontSize:11, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap",
    boxShadow: active ? "none" : "0 1px 5px rgba(0,0,0,0.07)",
    transition:"all .15s", fontFamily:"'DM Mono', monospace",
  }}>{label}</button>
);

const initials = name => name.split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase();

const Avatar = ({ name, size=44 }) => (
  <div style={{
    width:size, height:size, borderRadius:"50%", flexShrink:0,
    background:`linear-gradient(135deg,${C.navyMid},${C.navyLight})`,
    display:"flex", alignItems:"center", justifyContent:"center",
    color:"#fff", fontWeight:900, fontSize:size*0.3,
    fontFamily:"'DM Mono', monospace",
  }}>{initials(name)}</div>
);

const StatBar = ({ label, value, max=100, color }) => (
  <div style={{ marginBottom:8 }}>
    <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:C.muted, marginBottom:4 }}>
      <span>{label}</span>
      <span style={{ fontWeight:700, color, fontFamily:"'DM Mono', monospace" }}>{value}%</span>
    </div>
    <div style={{ background:"#e8edf5", borderRadius:8, height:7, overflow:"hidden" }}>
      <div style={{
        width:`${value}%`, height:"100%", borderRadius:8,
        background:`linear-gradient(90deg,${color},${color}aa)`,
        transition:"width 0.6s ease",
      }}/>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════
// LOADER
// ═══════════════════════════════════════════════════
const Loader = ({ step }) => (
  <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
    justifyContent:"center", height:380, gap:16 }}>
    <div style={{ fontSize:48 }}>🏓</div>
    <div style={{ fontSize:14, fontWeight:800, color:C.navyMid, fontFamily:"'DM Mono', monospace" }}>
      Connexion AFTT…
    </div>
    <div style={{ fontSize:11, color:C.muted, textAlign:"center", maxWidth:260 }}>{step}</div>
    <div style={{ width:200, height:4, background:"#e0e8f0", borderRadius:4, overflow:"hidden" }}>
      <div style={{
        width:"50%", height:"100%",
        background:`linear-gradient(90deg,${C.navyMid},${C.sky})`,
        borderRadius:4, animation:"slide 1.2s ease-in-out infinite alternate",
      }}/>
    </div>
    <style>{`@keyframes slide{from{transform:translateX(-80px)}to{transform:translateX(80px)}}`}</style>
  </div>
);

// ═══════════════════════════════════════════════════
// HOME TAB
// ═══════════════════════════════════════════════════
const HomeTab = ({ data, status, onTeamClick, onTabChange }) => {
  const ourTeams = data.standings.filter(t => t.isOurTeam);
  const recentMatches = data.matches.slice(0, 4);

  const statusCfg = {
    live:  { bg:"#d4f0e0", tx:"#1a7a40", icon:"🟢", txt:"Données live · data.aftt.be" },
    demo:  { bg:"#fdf0c0", tx:"#8a6a00", icon:"🟡", txt:"Mode démo · proxy non disponible" },
  }[status] || { bg:"#e8edf5", tx:C.muted, icon:"⚫", txt:"Chargement…" };

  return (
    <div style={{ padding:"0 16px 110px" }}>
      {/* Hero */}
      <div style={{
        background:`linear-gradient(150deg,${C.navy} 0%,${C.navyMid} 55%,${C.navyLight} 100%)`,
        borderRadius:20, padding:"26px 20px", marginBottom:8,
        position:"relative", overflow:"hidden",
      }}>
        <div style={{ position:"absolute", top:-50, right:-50, width:200, height:200,
          border:`2px solid rgba(200,162,0,0.15)`, borderRadius:"50%" }}/>
        <div style={{ position:"absolute", top:-20, right:-20, width:130, height:130,
          border:`2px solid rgba(200,162,0,0.1)`, borderRadius:"50%" }}/>
        <div style={{ position:"absolute", bottom:-60, left:-60, width:180, height:180,
          background:"rgba(255,255,255,0.02)", borderRadius:"50%" }}/>
        <div style={{ fontSize:40, marginBottom:8 }}>🏓</div>
        <div style={{ color:"#fff", fontSize:24, fontWeight:900, letterSpacing:-0.5 }}>RCTT Heppignies</div>
        <div style={{ color:"rgba(255,255,255,0.45)", fontSize:11, marginTop:3, fontFamily:"'DM Mono', monospace" }}>
          H136 · Province de Hainaut · AFTT {SEASON}
        </div>
        <div style={{ display:"flex", gap:28, marginTop:20 }}>
          {[
            { v: ourTeams.length, l:"Équipes" },
            { v: data.players.length, l:"Joueurs" },
            { v: data.matches.length, l:"Matchs" },
          ].map((s,i) => (
            <div key={i}>
              <div style={{ color:C.gold, fontSize:26, fontWeight:900, fontFamily:"'DM Mono', monospace" }}>{s.v}</div>
              <div style={{ color:"rgba(255,255,255,0.4)", fontSize:10 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Status */}
      <div style={{ background:statusCfg.bg, borderRadius:10, padding:"7px 14px",
        marginBottom:4, fontSize:11, fontWeight:600, color:statusCfg.tx,
        display:"flex", alignItems:"center", gap:6, fontFamily:"'DM Mono', monospace" }}>
        {statusCfg.icon} {statusCfg.txt}
      </div>

      {/* Nos équipes — résumé */}
      <Sec title="Nos équipes" />
      {ourTeams.slice(0,4).map((t,i) => (
        <Card key={i} onClick={() => onTabChange(1)} accent={t.rank <= 3 ? C.gold : C.navyMid}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <div style={{ fontSize:15, fontWeight:800, color:C.navy }}>{t.name}</div>
              <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>
                {t.played}J · {t.won}V · {t.drawn}N · {t.lost}D
              </div>
            </div>
            <div style={{ textAlign:"right", display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4 }}>
              <div style={{
                background: t.rank <= 2 ? `linear-gradient(135deg,${C.gold},#a07800)` : "#eef2f7",
                borderRadius:10, padding:"4px 12px", textAlign:"center",
              }}>
                <span style={{ fontSize:18, fontWeight:900, color: t.rank <= 2 ? "#fff" : C.navyMid,
                  fontFamily:"'DM Mono', monospace" }}>{t.rank}<sup style={{fontSize:10}}>e</sup></span>
              </div>
              <span style={{ fontSize:13, fontWeight:900, color:C.navyMid, fontFamily:"'DM Mono', monospace" }}>
                {t.points} pts
              </span>
            </div>
          </div>
        </Card>
      ))}

      {/* Derniers matchs */}
      {recentMatches.length > 0 && <>
        <Sec title="Derniers résultats" />
        {recentMatches.map((m,i) => {
          const isHome = m.home.toLowerCase().includes("heppignies");
          const ourScore = isHome ? m.homeScore : m.awayScore;
          const theirScore = isHome ? m.awayScore : m.homeScore;
          const result = ourScore > theirScore ? "V" : ourScore < theirScore ? "D" : "N";
          return (
            <Card key={i}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:10, color:C.muted, marginBottom:3, fontFamily:"'DM Mono', monospace" }}>
                    {m.teamName}
                  </div>
                  <div style={{ fontSize:13, fontWeight:700, color:C.navy }}>{m.home}</div>
                  <div style={{ fontSize:11, color:C.muted }}>vs {m.away}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:24, fontWeight:900, color:C.navyMid,
                    marginBottom:4, fontFamily:"'DM Mono', monospace" }}>
                    {m.homeScore}–{m.awayScore}
                  </div>
                  <Badge color={result==="V"?"green":result==="D"?"red":"gold"} sm>
                    {result==="V"?"✓ Victoire":result==="D"?"✗ Défaite":"= Nul"}
                  </Badge>
                </div>
              </div>
            </Card>
          );
        })}
      </>}

      {/* Prochains matchs */}
      <Sec title="Prochains matchs" />
      {FALLBACK_NEXT.map((m,i) => (
        <div key={i} style={{
          background:`linear-gradient(135deg,${C.navy},${C.navyMid})`,
          borderRadius:14, padding:"14px 16px", marginBottom:8,
          display:"flex", alignItems:"center", gap:14,
        }}>
          <div style={{ background:"rgba(255,255,255,0.1)", borderRadius:10,
            padding:"8px 10px", textAlign:"center", minWidth:50 }}>
            <div style={{ color:C.gold, fontSize:18, fontWeight:900, fontFamily:"'DM Mono', monospace" }}>
              {m.date.split("/")[0]}
            </div>
            <div style={{ color:"rgba(255,255,255,0.45)", fontSize:9 }}>
              {["","Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"][+m.date.split("/")[1]]}
            </div>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ color:"#fff", fontSize:13, fontWeight:700 }}>{m.team}</div>
            <div style={{ color:"rgba(255,255,255,0.55)", fontSize:12 }}>vs {m.opponent} · {m.time}</div>
            <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", marginTop:2 }}>{m.division}</div>
          </div>
          <Badge color={m.location==="Domicile"?"blue":"gold"}>
            {m.location==="Domicile"?"🏠 Dom.":"✈ Ext."}
          </Badge>
        </div>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════════════
// TEAMS TAB
// ═══════════════════════════════════════════════════
const TeamsTab = ({ data }) => {
  const [division, setDivision] = useState(null);
  const divisions = [...new Set(data.standings.map(t => t.division||"Général"))];

  const shownDivision = division || divisions[0];
  const divTeams = data.standings.filter(t => (t.division||"Général") === shownDivision);

  return (
    <div style={{ padding:"0 16px 110px" }}>
      <Sec title="Divisions" />

      {/* Division pills */}
      <div style={{ display:"flex", gap:8, marginBottom:14, overflowX:"auto", paddingBottom:4 }}>
        {divisions.map(d => (
          <Pill key={d} label={d||"Général"} active={shownDivision===d} onClick={()=>setDivision(d)}/>
        ))}
      </div>

      {/* Table */}
      <div style={{ background:C.card, borderRadius:16, overflow:"hidden",
        boxShadow:"0 2px 16px rgba(13,30,59,0.07)" }}>
        {/* Header */}
        <div style={{ background:C.navyMid, padding:"10px 16px",
          display:"grid", gridTemplateColumns:"1fr 2.5fr 1fr 1fr 1fr 1fr 1fr",
          gap:4, alignItems:"center" }}>
          {["#","Équipe","J","V","N","D","Pts"].map((h,i) => (
            <div key={i} style={{ color:"rgba(255,255,255,0.6)", fontSize:10, fontWeight:700,
              textAlign:i>1?"center":"left", textTransform:"uppercase", letterSpacing:1,
              fontFamily:"'DM Mono', monospace" }}>{h}</div>
          ))}
        </div>

        {divTeams.map((t,i) => {
          const isOurs = t.isOurTeam;
          return (
            <div key={i} style={{
              padding:"12px 16px",
              display:"grid", gridTemplateColumns:"1fr 2.5fr 1fr 1fr 1fr 1fr 1fr",
              gap:4, alignItems:"center",
              background: isOurs ? `linear-gradient(90deg,rgba(200,162,0,0.08),transparent)` : "transparent",
              borderBottom:"1px solid #f0f4f9",
              borderLeft: isOurs ? `3px solid ${C.gold}` : "3px solid transparent",
            }}>
              <div style={{ fontSize:12, fontWeight:900, color: t.rank<=3?C.gold:C.muted,
                fontFamily:"'DM Mono', monospace" }}>{t.rank}</div>
              <div>
                <div style={{ fontSize:12, fontWeight: isOurs ? 800 : 600,
                  color: isOurs ? C.navy : "#334" }}>
                  {t.name}
                  {isOurs && <span style={{ color:C.gold, marginLeft:4 }}>★</span>}
                </div>
              </div>
              {[t.played,t.won,t.drawn,t.lost,t.points].map((v,j) => (
                <div key={j} style={{ textAlign:"center", fontSize:12,
                  fontWeight: j===4 ? 900 : 600,
                  color: j===4 ? C.navyMid : "#556",
                  fontFamily:"'DM Mono', monospace" }}>{v}</div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Our teams detail cards */}
      <Sec title="Nos équipes — détail" />
      {data.standings.filter(t=>t.isOurTeam).map((t,i) => {
        const wr = t.played ? Math.round(t.won/t.played*100) : 0;
        const wrColor = wr >= 60 ? C.success : wr >= 40 ? C.gold : C.danger;
        return (
          <Card key={i} accent={t.rank<=3?C.gold:C.navyMid}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
              <div>
                <div style={{ fontSize:17, fontWeight:900, color:C.navy }}>{t.name}</div>
                <div style={{ fontSize:11, color:C.navyLight, fontWeight:600, marginTop:2 }}>{t.division}</div>
              </div>
              <div style={{
                background: t.rank<=2 ? `linear-gradient(135deg,${C.gold},#a07800)` : "linear-gradient(135deg,#eef2f7,#e0e8f0)",
                borderRadius:12, padding:"8px 14px", textAlign:"center",
              }}>
                <div style={{ fontSize:22, fontWeight:900,
                  color: t.rank<=2 ? "#fff" : C.navyMid, fontFamily:"'DM Mono', monospace" }}>
                  {t.rank}<sup style={{fontSize:11}}>e</sup>
                </div>
                <div style={{ fontSize:9, color: t.rank<=2?"rgba(255,255,255,0.6)":"#aaa",
                  textTransform:"uppercase", letterSpacing:0.5 }}>place</div>
              </div>
            </div>

            <StatBar label="Taux de victoire" value={wr} color={wrColor}/>

            <div style={{ display:"flex", background:"#f5f8fc", borderRadius:10,
              overflow:"hidden", marginTop:10 }}>
              {[
                {v:t.played,l:"J"},{v:t.won,l:"V"},{v:t.drawn,l:"N"},{v:t.lost,l:"D"},{v:t.points,l:"Pts"},
              ].map((s,j) => (
                <div key={j} style={{ flex:1, padding:"9px 4px", textAlign:"center",
                  borderRight:j<4?"1px solid #e0e8f0":"none" }}>
                  <div style={{ fontSize:16, fontWeight:900,
                    color: j===4 ? C.navyMid : C.navy, fontFamily:"'DM Mono', monospace" }}>{s.v}</div>
                  <div style={{ fontSize:9, color:C.muted, textTransform:"uppercase", letterSpacing:0.5 }}>{s.l}</div>
                </div>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
};

// ═══════════════════════════════════════════════════
// PLAYERS TAB
// ═══════════════════════════════════════════════════
const PlayersTab = ({ data }) => {
  const [sel, setSel] = useState(null);
  const [filter, setFilter] = useState("tous");

  const rankingGroups = ["tous","C","D","E","F","G","H"];
  const list = data.players
    .filter(p => filter==="tous" || (p.ranking||"").startsWith(filter))
    .sort((a,b)=>(b.points||0)-(a.points||0));

  if (sel) {
    const p = sel;
    const wr = p.played ? Math.round(p.won/p.played*100) : null;
    const wrColor = wr>=60?C.success:wr>=40?C.gold:C.danger;
    return (
      <div style={{ padding:"0 16px 110px" }}>
        <button onClick={()=>setSel(null)} style={{ background:"none", border:"none",
          color:C.navyMid, fontSize:14, fontWeight:600, padding:"8px 0 16px", cursor:"pointer",
          fontFamily:"'DM Mono', monospace" }}>← Tous les joueurs</button>

        <div style={{ background:`linear-gradient(140deg,${C.navy},${C.navyMid})`,
          borderRadius:20, padding:"28px 20px", textAlign:"center", marginBottom:14 }}>
          <div style={{ width:76, height:76, borderRadius:"50%", background:"rgba(255,255,255,0.12)",
            display:"flex", alignItems:"center", justifyContent:"center",
            margin:"0 auto 14px", fontSize:28, color:"#fff", fontWeight:900,
            fontFamily:"'DM Mono', monospace" }}>{initials(p.name)}</div>
          <div style={{ color:"#fff", fontSize:22, fontWeight:900 }}>{p.name}</div>
          <div style={{ color:"rgba(255,255,255,0.45)", fontSize:12, marginTop:3 }}>RCTT Heppignies</div>
          <div style={{ display:"flex", justifyContent:"center", gap:28, marginTop:20 }}>
            <div>
              <div style={{ color:C.gold, fontSize:30, fontWeight:900, fontFamily:"'DM Mono', monospace" }}>
                {p.ranking||"—"}
              </div>
              <div style={{ color:"rgba(255,255,255,0.35)", fontSize:10 }}>Classement AFTT</div>
            </div>
            <div>
              <div style={{ color:"#fff", fontSize:30, fontWeight:900, fontFamily:"'DM Mono', monospace" }}>
                {p.points||0}
              </div>
              <div style={{ color:"rgba(255,255,255,0.35)", fontSize:10 }}>Points</div>
            </div>
          </div>
        </div>

        {wr !== null ? (
          <>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
              {[
                {v:p.played,l:"Matchs",icon:"🎯"},
                {v:p.won,l:"Victoires",icon:"🏆"},
                {v:p.played-p.won,l:"Défaites",icon:"📉"},
                {v:`${wr}%`,l:"Taux V.",icon:"📊"},
              ].map((s,i) => (
                <Card key={i} style={{ textAlign:"center", padding:14, marginBottom:0 }}>
                  <div style={{ fontSize:24 }}>{s.icon}</div>
                  <div style={{ fontSize:22, fontWeight:900, color:C.navyMid, marginTop:6,
                    fontFamily:"'DM Mono', monospace" }}>{s.v}</div>
                  <div style={{ fontSize:11, color:C.muted }}>{s.l}</div>
                </Card>
              ))}
            </div>
            <Card>
              <div style={{ fontSize:12, fontWeight:700, color:"#556", marginBottom:10 }}>Performance</div>
              <StatBar label="Taux de victoire" value={wr} color={wrColor}/>
            </Card>
          </>
        ) : (
          <Card>
            <div style={{ textAlign:"center", color:C.muted, fontSize:13, padding:"20px 0" }}>
              Statistiques individuelles non disponibles.<br/>
              <span style={{ fontSize:11, marginTop:4, display:"block" }}>Données classement AFTT live.</span>
            </div>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding:"0 16px 110px" }}>
      <Sec title="Classement des joueurs H136" />
      <div style={{ display:"flex", gap:7, marginBottom:14, overflowX:"auto", paddingBottom:4 }}>
        {rankingGroups.map(g=>(
          <Pill key={g} label={g==="tous"?"Tous":g} active={filter===g} onClick={()=>setFilter(g)}/>
        ))}
      </div>

      {list.length===0
        ? <Card><div style={{color:C.muted,fontSize:13,textAlign:"center",padding:"20px 0"}}>Aucun joueur dans cette catégorie</div></Card>
        : list.map((p,i) => {
            const wr = p.played ? Math.round(p.won/p.played*100) : null;
            const rankLetter = (p.ranking||"?")[0];
            const rankColor = {C:C.gold,D:C.sky,E:C.success,F:C.muted}[rankLetter]||C.muted;
            return (
              <div key={i} onClick={()=>setSel(p)} style={{
                background:C.card, borderRadius:14, padding:"13px 16px", marginBottom:9,
                boxShadow:"0 2px 10px rgba(13,30,59,0.06)", cursor:"pointer",
                display:"flex", alignItems:"center", gap:14,
                transition:"transform 0.12s",
              }}
                onMouseEnter={e=>e.currentTarget.style.transform="translateY(-1px)"}
                onMouseLeave={e=>e.currentTarget.style.transform=""}
              >
                <Avatar name={p.name}/>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:C.navy }}>{p.name}</div>
                  <div style={{ fontSize:11, color:C.muted }}>RCTT Heppignies</div>
                  {wr !== null && (
                    <div style={{ marginTop:4 }}>
                      <Badge color={wr>=60?"green":wr>=40?"gold":"red"} sm>{wr}% victoires</Badge>
                    </div>
                  )}
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:20, fontWeight:900, color:rankColor,
                    fontFamily:"'DM Mono', monospace" }}>{p.ranking||"—"}</div>
                  <div style={{ fontSize:10, color:C.muted, fontFamily:"'DM Mono', monospace" }}>
                    {p.points||0} pts
                  </div>
                </div>
              </div>
            );
          })
      }
    </div>
  );
};

// ═══════════════════════════════════════════════════
// CALENDAR TAB
// ═══════════════════════════════════════════════════
const CalendarTab = ({ data }) => {
  const [filter, setFilter] = useState("tous");
  const ourTeamNames = [...new Set(data.standings.filter(t=>t.isOurTeam).map(t=>t.name))];
  const teams = ["tous", ...ourTeamNames];

  const matches = data.matches.filter(m =>
    filter==="tous" || m.teamName===filter
  );

  return (
    <div style={{ padding:"0 16px 110px" }}>
      {/* Prochains matchs */}
      <Sec title="Prochains matchs" />
      {FALLBACK_NEXT.map((m,i) => (
        <Card key={i} accent={m.location==="Domicile" ? C.navyMid : C.gold}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div>
              <div style={{ fontSize:10, color:C.muted, fontFamily:"'DM Mono', monospace" }}>
                {m.date} · {m.time}
              </div>
              <div style={{ fontSize:15, fontWeight:800, color:C.navy, marginTop:4 }}>{m.team}</div>
              <div style={{ fontSize:13, color:"#445", marginTop:2 }}>
                vs <strong>{m.opponent}</strong>
              </div>
              <div style={{ fontSize:10, color:C.muted, marginTop:2 }}>{m.division}</div>
            </div>
            <Badge color={m.location==="Domicile"?"blue":"gold"}>
              {m.location==="Domicile"?"🏠":"✈"} {m.location}
            </Badge>
          </div>
        </Card>
      ))}

      {/* Résultats */}
      <Sec title="Historique des matchs" />
      <div style={{ display:"flex", gap:7, marginBottom:14, overflowX:"auto", paddingBottom:4 }}>
        {teams.map(t=>(
          <Pill key={t} label={t==="tous"?"Tous":t.replace("Heppignies ","")} active={filter===t} onClick={()=>setFilter(t)}/>
        ))}
      </div>

      {matches.length===0
        ? <Card><div style={{color:C.muted,fontSize:13,textAlign:"center",padding:"20px 0"}}>Aucun match trouvé</div></Card>
        : matches.map((m,i) => {
            const isHome = m.home.toLowerCase().includes("heppignies");
            const ourScore = isHome ? m.homeScore : m.awayScore;
            const theirScore = isHome ? m.awayScore : m.homeScore;
            const result = ourScore > theirScore ? "V" : ourScore < theirScore ? "D" : "N";
            return (
              <Card key={i}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <div style={{ fontSize:10, color:C.muted, marginBottom:2,
                      fontFamily:"'DM Mono', monospace" }}>
                      {m.teamName}
                    </div>
                    <div style={{ fontSize:13, fontWeight:700, color:C.navy }}>{m.home}</div>
                    <div style={{ fontSize:11, color:C.muted }}>vs {m.away}</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:24, fontWeight:900, color:C.navyMid, marginBottom:3,
                      fontFamily:"'DM Mono', monospace" }}>{m.homeScore}–{m.awayScore}</div>
                    <Badge color={result==="V"?"green":result==="D"?"red":"gold"} sm>
                      {result==="V"?"✓ V":result==="D"?"✗ D":"= N"}
                    </Badge>
                  </div>
                </div>
              </Card>
            );
          })
      }
    </div>
  );
};

// ═══════════════════════════════════════════════════
// APP
// ═══════════════════════════════════════════════════
export default function App() {
  const [tab, setTab]       = useState(0);
  const [data, setData]     = useState(null);
  const [status, setStatus] = useState("loading");
  const [step, setStep]     = useState("Connexion au serveur proxy…");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setStep("Vérification du proxy AFTT…");
        await apiFetch("/");

        setStep("Chargement des équipes H136…");
        const teamsRes = await apiFetch(`/api/club/${CLUB_ID}/teams`);

        setStep("Chargement des matchs…");
        const matchesRes = await apiFetch(`/api/club/${CLUB_ID}/matches`).catch(()=>({matches:[]}));

        setStep("Chargement des joueurs…");
        const playersRes = await apiFetch(`/api/club/${CLUB_ID}/players`).catch(()=>({players:[]}));

        if (cancelled) return;

        // Build standings from the nested divisions
        const allStandings = [];
        for (const divObj of (teamsRes.standings || [])) {
          for (const row of (divObj.rows || [])) {
            allStandings.push({
              ...row,
              division: divObj.division || "Général",
              isOurTeam: row.isOurTeam,
            });
          }
        }

        // Build matches with team name
        const allMatches = [];
        for (const m of (matchesRes.matches || [])) {
          for (const match of (m.matches || [])) {
            // parse "X - Y" score
            const parts = (match.score||"").split(/[-–]/);
            const homeScore = parseInt(parts[0])||0;
            const awayScore = parseInt(parts[1])||0;
            allMatches.push({
              home: match.home,
              away: match.away,
              homeScore,
              awayScore,
              teamName: m.teamName || "",
            });
          }
        }

        // Players
        const players = (playersRes.players || []).map(p => ({
          ...p,
          played: 0, won: 0,
        }));

        setData({
          standings: allStandings,
          matches: allMatches,
          players: players.length ? players : FALLBACK_PLAYERS,
        });
        setStatus("live");
      } catch (e) {
        if (!cancelled) {
          setData({
            standings: [],
            matches: [],
            players: FALLBACK_PLAYERS,
          });
          setStatus("demo");
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const TABS = [
    { icon:"🏠", label:"Accueil" },
    { icon:"🏆", label:"Équipes" },
    { icon:"👤", label:"Joueurs" },
    { icon:"📅", label:"Calendrier" },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${C.bg}; }
      `}</style>

      <div style={{ maxWidth:430, margin:"0 auto", minHeight:"100vh",
        background:C.bg, fontFamily:"'Syne', system-ui, sans-serif", position:"relative" }}>

        {/* Header */}
        <div style={{ background:C.navy, padding:"14px 20px 10px",
          display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ color:"#fff", fontSize:15, fontWeight:900, letterSpacing:-0.3 }}>
              🏓 RCTT Heppignies
            </div>
            <div style={{ color:"rgba(255,255,255,0.35)", fontSize:10, fontFamily:"'DM Mono', monospace" }}>
              H136 · Hainaut · AFTT
            </div>
          </div>
          <div style={{ background:"rgba(255,255,255,0.1)", borderRadius:20, padding:"4px 12px",
            fontSize:10, color:"rgba(255,255,255,0.6)", fontFamily:"'DM Mono', monospace", fontWeight:500 }}>
            {SEASON}
          </div>
        </div>

        {/* Content */}
        <div style={{ paddingTop:12 }}>
          {!data
            ? <Loader step={step}/>
            : <>
              {tab===0 && <HomeTab data={data} status={status} onTabChange={setTab}/>}
              {tab===1 && <TeamsTab data={data}/>}
              {tab===2 && <PlayersTab data={data}/>}
              {tab===3 && <CalendarTab data={data}/>}
            </>
          }
        </div>

        {/* Bottom nav */}
        <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)",
          width:"100%", maxWidth:430, background:"#fff",
          boxShadow:"0 -4px 28px rgba(13,30,59,0.1)",
          display:"flex", borderRadius:"20px 20px 0 0", overflow:"hidden" }}>
          {TABS.map((t,i) => (
            <button key={i} onClick={()=>setTab(i)} style={{
              flex:1, padding:"12px 4px 8px", border:"none", background:"none",
              cursor:"pointer", display:"flex", flexDirection:"column",
              alignItems:"center", gap:2, transition:"background 0.15s",
            }}>
              <div style={{ fontSize:22 }}>{t.icon}</div>
              <div style={{ fontSize:9, fontWeight:800, textTransform:"uppercase",
                letterSpacing:0.8, color: tab===i ? C.navyMid : "#ccc",
                fontFamily:"'DM Mono', monospace" }}>{t.label}</div>
              {tab===i && (
                <div style={{ width:18, height:3, borderRadius:2, background:C.gold, marginTop:1 }}/>
              )}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
