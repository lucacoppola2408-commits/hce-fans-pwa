import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
<h3 className="text-base font-semibold">Quelle & Zusammenfassung</h3>
<label className="block mt-3 text-xs text-neutral-400">News‑Quelle (Standard: Offizielle HCE‑Newsseite)</label>
<input value={newsUrl} onChange={(e)=>setNewsUrl(e.target.value)} className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-2 text-sm"/>
<label className="mt-3 flex items-center gap-2 text-sm text-neutral-400"><input type="checkbox" checked={useProxy} onChange={(e)=>setUseProxy(e.target.checked)}/> Bei CORS‑Fehler Proxy verwenden</label>
<label className="block mt-3 text-xs text-neutral-400">Zusammenfassungslänge: {summaryChars} Zeichen</label>
<input type="range" min={120} max={400} step={10} value={summaryChars} onChange={(e)=>setSummaryChars(parseInt(e.target.value,10))} className="w-full"/>
<p className="mt-3 text-xs text-neutral-500">Hinweis: Die App extrahiert Überschrift, Datum und den ersten sinnvollen Absatz und kürzt ihn smart. Quellen können variieren; für die beste Qualität die offizielle HCE‑Seite nutzen.</p>
</motion.section>
</main>
)}


{/* Reminder‑Modal */}
{showReminderModal && (
<div className="fixed inset-0 z-20 bg-black/60 grid place-items-center p-4" onClick={()=>setShowReminderModal(false)}>
<div className="max-w-md w-full rounded-2xl border border-neutral-800 bg-neutral-900 p-5" onClick={(e)=>e.stopPropagation()}>
<div className="flex items-center justify-between">
<h3 className="text-lg font-semibold flex items-center gap-2"><Bell className="w-5 h-5"/> Erinnerung planen</h3>
<button onClick={()=>setShowReminderModal(false)} className="px-2 py-1 rounded-lg border border-neutral-700 hover:bg-neutral-800"><X className="w-4 h-4"/></button>
</div>
<p className="text-sm text-neutral-400 mt-1">Wähle, wie lange <em>vor</em> dem Anpfiff du erinnert werden möchtest.</p>


<div className="mt-4 grid grid-cols-[1fr_auto] gap-2 items-center">
<input type="number" min={1} value={remValue} onChange={(e)=>setRemValue(parseInt(e.target.value||"0",10))} className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-2 text-sm"/>
<select value={remUnit} onChange={(e)=>setRemUnit(e.target.value)} className="bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-2 text-sm">
<option value="minutes">Minuten</option>
<option value="hours">Stunden</option>
<option value="days">Tage</option>
</select>
</div>


<div className="mt-3 flex flex-wrap gap-2">
{[{v:10,u:"minutes"},{v:30,u:"minutes"},{v:60,u:"minutes"},{v:3,u:"hours"},{v:24,u:"hours"},{v:2,u:"days"}].map(p=> (
<button key={`${p.v}-${p.u}`} onClick={()=>{ setRemValue(p.v); setRemUnit(p.u); }} className="px-3 py-1.5 rounded-lg border border-neutral-700 text-sm hover:bg-neutral-800">
{p.v} {p.u === 'minutes' ? 'Min' : p.u === 'hours' ? 'Std' : 'Tage'}
</button>
))}
</div>


<div className="mt-5 flex items-center justify-end gap-2">
<button onClick={()=>setShowReminderModal(false)} className="px-3 py-2 rounded-xl border border-neutral-700 hover:bg-neutral-800 text-sm">Abbrechen</button>
<button onClick={confirmReminder} className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm">Speichern</button>
</div>


<p className="mt-3 text-xs text-neutral-500">Hinweis: Lokale Erinnerungen funktionieren am zuverlässigsten, wenn die App im Vordergrund ist. Für echte Hintergrund‑Pushes wäre später Web Push nötig.</p>
</div>
</div>
)}


{/* Share/QR‑Modal */}
{showShare && (
<div className="fixed inset-0 z-20 bg-black/60 grid place-items-center p-4" onClick={()=>setShowShare(false)}>
<div className="max-w-md w-full rounded-2xl border border-neutral-800 bg-neutral-900 p-5" onClick={(e)=>e.stopPropagation()}>
<div className="flex items-center justify-between">
<h3 className="text-lg font-semibold flex items-center gap-2"><QrCode className="w-5 h-5"/> App teilen</h3>
<button onClick={()=>setShowShare(false)} className="px-2 py-1 rounded-lg border border-neutral-700 hover:bg-neutral-800"><X className="w-4 h-4"/></button>
</div>


<div className="mt-4 grid place-items-center">
{/* QRCodeCanvas rendert <canvas> -> direkt referenzierbar */}
<QRCodeCanvas value={shareUrl} size={220} includeMargin={true} ref={qrRef} />
</div>


<label className="block mt-4 text-xs text-neutral-400">Link zur selben Ansicht (inkl. Feed‑URL)</label>
<div className="mt-1 flex items-center gap-2">
<input readOnly value={shareUrl} className="flex-1 bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-2 text-sm"/>
<button onClick={copyShareUrl} className="px-3 py-2 rounded-xl border border-neutral-700 hover:bg-neutral-800 text-sm">Kopieren</button>
</div>


<div className="mt-3 flex items-center justify-end gap-2">
<button onClick={downloadQR} className="px-3 py-2 rounded-xl border border-neutral-700 hover:bg-neutral-800 text-sm">QR speichern</button>
<button onClick={webShare} className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm">System‑Teilen</button>
</div>


<p className="mt-3 text-xs text-neutral-500">Hinweis: Scanne den QR‑Code mit dem Smartphone oder öffne den Link. Die App lädt dann automatisch die gleiche Feed‑URL und zeigt die selben Infos.</p>
</div>
</div>
)}


<footer className="max-w-6xl mx-auto px-4 pb-10 text-xs text-neutral-500">
Made for HC Erlangen Fans • PWA & Live‑Daten • © {(new Date()).getFullYear()}
</footer>
</div>
);
}
