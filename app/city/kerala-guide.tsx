'use client';
import {useState} from 'react';
const districts = [
 ['Kasaragod',12.5,74.99,'Bekal Fort · Bekal Beach'],
 ['Kannur',11.87,75.37,'Muzhappilangad Beach · St Angelo Fort'],
 ['Wayanad',11.61,76.08,'Edakkal Caves · Pookode Lake'],
 ['Kozhikode',11.26,75.78,'SM Street (Mittayi Theru) · Kozhikode Beach · Beypore'],
 ['Malappuram',11.05,76.07,'Kottakkunnu · Nilambur · Padinjarekkara Beach'],
 ['Palakkad',10.79,76.65,'Palakkad Fort · Malampuzha'],
 ['Thrissur',10.53,76.21,'Vadakkunnathan Temple · Athirappilly · Snehatheeram Beach'],
 ['Ernakulam',9.98,76.3,'Fort Kochi · Mattancherry · Cherai Beach'],
 ['Idukki',9.85,76.97,'Munnar · Idukki Dam · Thekkady'],
 ['Kottayam',9.59,76.52,'Kumarakom · Vembanad Lake'],
 ['Alappuzha',9.5,76.34,'Alappuzha Beach · Marari Beach · Backwaters'],
 ['Pathanamthitta',9.26,76.78,'Aranmula · Konni · Gavi'],
 ['Kollam',8.89,76.61,'Ashtamudi Lake · Thangassery · Thenmala'],
 ['Thiruvananthapuram',8.52,76.94,'Kovalam · Varkala · Padmanabhaswamy Temple'],
] as const;
export default function KeralaGuide(){const [open,setOpen]=useState(false),[selected,setSelected]=useState(3),[map,setMap]=useState(false);const [name,lat,lon,places]=districts[selected];
return <aside className="kerala-guide"><button onClick={()=>setOpen(!open)} aria-expanded={open}>🌴 Kerala guide</button>{open&&<section><header><h2>Explore Kerala</h2><button onClick={()=>setOpen(false)} aria-label="Close Kerala guide">×</button></header><p>14 districts · beaches, towns and landmarks</p><label>District<select value={selected} onChange={e=>{setSelected(Number(e.target.value));setMap(false);}}>{districts.map((d,i)=><option key={d[0]} value={i}>{d[0]}</option>)}</select></label><svg viewBox="0 0 240 310" aria-label="Approximate district centres, north at top" role="img"><rect width="240" height="310" rx="16" fill="#143e42"/><text x="12" y="285" fill="#a8d8df" fontSize="11">Arabian Sea</text>{districts.map((d,i)=>{const x=35+(d[2]-74.8)*75,y=20+(12.65-d[1])*63;return <g key={d[0]}><circle cx={x} cy={y} r={i===selected?7:3} fill={i===selected?'#dcff89':'#91bfb1'}/>{i===selected&&<text x={Math.min(x,130)} y={y-12} fill="white" fontSize="11">{d[0]}</text>}</g>})}</svg><h3>{name}</h3><p>{places}</p><a href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(name+', Kerala, India')}`} target="_blank" rel="noopener noreferrer">Open real street map ↗</a><button onClick={()=>setMap(!map)}>{map?'Hide':'Load'} real map</button>{map&&<iframe title={`${name} street map`} loading="lazy" referrerPolicy="no-referrer" src={`https://www.openstreetmap.org/export/embed.html?bbox=${lon-.12},${lat-.08},${lon+.12},${lat+.08}&layer=mapnik&marker=${lat},${lon}`}/>}<small>District centres are approximate. The real map is provided by OpenStreetMap contributors and loads only when requested. The playable village is a separate, Kerala-inspired scene; individual houses and landmarks are not yet recreated in 3D.</small><a href="https://www.keralatourism.org/destination/" target="_blank" rel="noopener noreferrer">Kerala Tourism destination guide ↗</a></section>}</aside>}
