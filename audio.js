/* Block Bound Dungeon — synthesized sound effects and procedural dungeon music (Web Audio, no files). */
'use strict';
const Sound = (() => {
  let ctx = null, master, sfxBus, musicBus, ambBus, revIn, delayIn, noiseBuf;
  let vol = {music:0.5, sfx:0.7, amb:0.5};
  const mtof = m => 440 * Math.pow(2, (m-69)/12);

  function impulse(sec, decay){
    const len = Math.floor(ctx.sampleRate*sec), b = ctx.createBuffer(2, len, ctx.sampleRate);
    for(let ch=0; ch<2; ch++){ const d = b.getChannelData(ch); for(let i=0;i<len;i++) d[i] = (Math.random()*2-1)*Math.pow(1-i/len, decay); }
    return b;
  }
  function init(){
    if(ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext; if(!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = vol.sfx; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = vol.music*0.55; musicBus.connect(master);
    ambBus = ctx.createGain(); ambBus.gain.value = vol.amb*0.6; ambBus.connect(master);
    // dungeon reverb
    const rev = ctx.createConvolver(); rev.buffer = impulse(3.2, 2.6);
    revIn = ctx.createGain(); revIn.gain.value = 0.9; revIn.connect(rev); rev.connect(master);
    // echo for music plucks
    const dl = ctx.createDelay(1.0), fb = ctx.createGain(), lp = ctx.createBiquadFilter();
    dl.delayTime.value = 0.36; fb.gain.value = 0.38; lp.type='lowpass'; lp.frequency.value = 1800;
    delayIn = ctx.createGain(); delayIn.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(musicBus); lp.connect(revIn);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate*2, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0); for(let i=0;i<nd.length;i++) nd[i] = Math.random()*2-1;
    return true;
  }
  function unlock(){ if(!init()) return; if(ctx.state==='suspended') ctx.resume(); Music.kick(); Amb.start(); }

  /* ---------- primitives ---------- */
  function tone(o){
    if(!ctx) return;
    const t = ctx.currentTime + (o.delay||0), dur = o.dur||0.15;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type||'sine'; osc.frequency.setValueAtTime(o.f, t);
    if(o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t+dur);
    if(o.detune) osc.detune.value = o.detune;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(o.vol||0.25, t+(o.attack||0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
    let node = osc;
    if(o.lp){ const f = ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value = o.lp; osc.connect(f); node = f; }
    node.connect(g); g.connect(o.bus||sfxBus);
    if(o.rev){ const s = ctx.createGain(); s.gain.value = o.rev; g.connect(s); s.connect(revIn); }
    if(o.echo){ const s = ctx.createGain(); s.gain.value = o.echo; g.connect(s); s.connect(delayIn); }
    osc.start(t); osc.stop(t+dur+0.05);
  }
  function noise(o){
    if(!ctx) return;
    const t = ctx.currentTime + (o.delay||0), dur = o.dur||0.2;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = o.filter||'lowpass'; f.frequency.setValueAtTime(o.f||1200, t); f.Q.value = o.q||0.8;
    if(o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t+dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(o.vol||0.25, t+(o.attack||0.004)); g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
    src.connect(f); f.connect(g); g.connect(o.bus||sfxBus);
    if(o.rev){ const s = ctx.createGain(); s.gain.value = o.rev; g.connect(s); s.connect(revIn); }
    src.start(t, Math.random()); src.stop(t+dur+0.05);
  }

  /* ---------- sound effects ---------- */
  const PENTA = [62,65,67,69,72,74,77,79,81,84,86,89];
  const sfx = {
    click(){ tone({type:'square', f:520, f2:380, dur:0.05, vol:0.08, lp:2400}); },
    pick(){ tone({type:'triangle', f:340, f2:520, dur:0.07, vol:0.12}); },
    rotate(){ tone({type:'square', f:900, f2:1300, dur:0.04, vol:0.06, lp:3000}); noise({f:4000, filter:'highpass', dur:0.03, vol:0.05}); },
    place(){ tone({type:'sine', f:190, f2:70, dur:0.12, vol:0.35}); noise({f:900, dur:0.06, vol:0.12, rev:0.1}); },
    invalid(){ tone({type:'square', f:150, f2:120, dur:0.09, vol:0.06, lp:900}); },
    clear(lines, mult){
      const n = Math.min(3+lines*2, 10);
      for(let i=0;i<n;i++) tone({type:'triangle', f:mtof(PENTA[Math.min(i+lines,PENTA.length-1)]), dur:0.22, vol:0.11, delay:i*0.045, rev:0.35});
      noise({f:6000, f2:1500, filter:'bandpass', q:0.6, dur:0.35, vol:0.12, rev:0.3});
      if(lines>=2 || mult>=2){
        [50,57,62].forEach(m=>tone({type:'sawtooth', f:mtof(m), dur:0.6, vol:0.06, lp:1600, delay:0.05, rev:0.5}));
        tone({type:'sine', f:60, f2:35, dur:0.4, vol:0.4});
      }
    },
    pure(){ [74,78,81,86].forEach((m,i)=>tone({type:'sine', f:mtof(m), dur:0.35, vol:0.1, delay:i*0.06, rev:0.6})); },
    perfect(){ [62,66,69,74,78,81,86].forEach((m,i)=>tone({type:'triangle', f:mtof(m), dur:0.5, vol:0.12, delay:i*0.07, rev:0.7})); },
    hit(big){ noise({f:2200, f2:300, dur:big?0.35:0.18, vol:big?0.4:0.28}); tone({type:'sine', f:big?110:150, f2:45, dur:0.2, vol:0.4}); },
    hurt(){ tone({type:'sawtooth', f:110, f2:45, dur:0.28, vol:0.22, lp:700}); noise({f:500, dur:0.25, vol:0.3}); },
    block(){ tone({type:'triangle', f:1250, dur:0.18, vol:0.12, rev:0.4}); tone({type:'sine', f:1870, dur:0.25, vol:0.08, rev:0.4}); noise({f:5000, filter:'highpass', dur:0.05, vol:0.1}); },
    shield(){ tone({type:'triangle', f:660, f2:990, dur:0.18, vol:0.1, rev:0.3}); },
    heal(){ [72,76,79].forEach((m,i)=>tone({type:'sine', f:mtof(m), dur:0.3, vol:0.09, delay:i*0.06, rev:0.5})); },
    coin(){ tone({type:'square', f:988, dur:0.07, vol:0.07, lp:5000}); tone({type:'square', f:1319, dur:0.18, vol:0.07, lp:5000, delay:0.06}); },
    poison(){ tone({type:'sine', f:300, f2:180, dur:0.25, vol:0.12, detune:30}); tone({type:'sine', f:310, f2:170, dur:0.25, vol:0.08, delay:0.05}); },
    rubble(){ noise({f:400, f2:120, dur:0.5, vol:0.35, rev:0.3}); tone({type:'sine', f:70, f2:40, dur:0.4, vol:0.3}); },
    ice(){ [88,93,96].forEach((m,i)=>tone({type:'sine', f:mtof(m), dur:0.25, vol:0.06, delay:i*0.04, rev:0.6})); noise({f:7000, filter:'highpass', dur:0.15, vol:0.08}); },
    armor(){ tone({type:'square', f:220, f2:330, dur:0.15, vol:0.08, lp:1500}); noise({f:3000, filter:'bandpass', dur:0.1, vol:0.1}); },
    rage(){ tone({type:'sawtooth', f:80, f2:160, dur:0.4, vol:0.15, lp:900}); noise({f:300, dur:0.4, vol:0.2}); },
    warn(){ tone({type:'square', f:440, dur:0.06, vol:0.05, lp:1500}); },
    potion(){ for(let i=0;i<4;i++) tone({type:'sine', f:400+i*90, f2:700+i*90, dur:0.08, vol:0.08, delay:i*0.06}); },
    ult(){ noise({f:200, f2:6000, filter:'bandpass', q:1.5, dur:0.6, vol:0.3, rev:0.5}); [50,57,62,69].forEach((m,i)=>tone({type:'sawtooth', f:mtof(m), dur:0.9, vol:0.07, lp:2500, delay:0.1+i*0.05, rev:0.6})); },
    cavein(){ noise({f:250, f2:60, dur:1.0, vol:0.5, rev:0.4}); tone({type:'sine', f:55, f2:30, dur:0.8, vol:0.45}); },
    kill(){ noise({f:3000, f2:200, dur:0.5, vol:0.3, rev:0.4}); [62,69,74].forEach((m,i)=>tone({type:'triangle', f:mtof(m), dur:0.4, vol:0.12, delay:0.15+i*0.08, rev:0.5})); },
    victory(){ [62,66,69,74,69,74,78].forEach((m,i)=>tone({type:'triangle', f:mtof(m), dur:i===6?0.9:0.2, vol:0.13, delay:i*0.12, rev:0.5})); },
    defeat(){ [62,61,58,55,50].forEach((m,i)=>tone({type:'sawtooth', f:mtof(m), dur:0.5, vol:0.08, lp:900, delay:i*0.22, rev:0.6})); },
    door(){ noise({f:300, f2:100, dur:0.6, vol:0.25, rev:0.5}); tone({type:'sine', f:90, f2:60, dur:0.5, vol:0.2}); },
    buy(){ sfx.coin(); tone({type:'triangle', f:880, dur:0.15, vol:0.08, delay:0.12}); },
    steal(){ [84,79,76,72].forEach((m,i)=>tone({type:'square', f:mtof(m), dur:0.07, vol:0.05, lp:4000, delay:i*0.05})); noise({f:5000, filter:'highpass', dur:0.2, vol:0.06}); },
    petrify(){ noise({f:600, f2:150, dur:0.45, vol:0.35, rev:0.3}); [40,35].forEach((m,i)=>tone({type:'square', f:mtof(m), dur:0.2, vol:0.08, lp:400, delay:i*0.08})); },
    sap(){ tone({type:'sawtooth', f:900, f2:120, dur:0.45, vol:0.08, lp:2000, rev:0.4}); },
    shuffle(){ for(let i=0;i<7;i++) noise({f:3000+i*200, filter:'bandpass', q:2, dur:0.04, vol:0.08, delay:i*0.035}); },
    pet(kind){ const base = {bat:84, slime:60, turtle:52, wisp:88, rat:86, spider:70, imp:76}[kind]||72; tone({type:'triangle', f:mtof(base), f2:mtof(base+7), dur:0.12, vol:0.08}); tone({type:'sine', f:mtof(base+12), dur:0.15, vol:0.05, delay:0.08, rev:0.4}); },
    phase(){ noise({f:120, f2:900, filter:'bandpass', q:1, dur:1.0, vol:0.4, rev:0.6}); [38,41,45].forEach((m,i)=>tone({type:'sawtooth', f:mtof(m), dur:1.1, vol:0.09, lp:700, delay:i*0.06, rev:0.6})); },
    combo(n){ const m = 72 + Math.min(n,8)*2; tone({type:'triangle', f:mtof(m), dur:0.14, vol:0.07}); tone({type:'triangle', f:mtof(m+7), dur:0.18, vol:0.06, delay:0.06, rev:0.3}); },
    levelup(){ [67,72,76,79,84,88].forEach((m,i)=>tone({type:'triangle', f:mtof(m), dur:0.4, vol:0.1, delay:i*0.08, rev:0.5})); },
    claim(){ [84,88,91].forEach((m,i)=>tone({type:'sine', f:mtof(m), dur:0.3, vol:0.08, delay:i*0.05, rev:0.5})); noise({f:8000, filter:'highpass', dur:0.25, vol:0.05}); },
    relic(){ [76,83,88,95].forEach((m,i)=>tone({type:'sine', f:mtof(m), dur:0.45, vol:0.07, delay:i*0.06, rev:0.7})); },
    chest(){ noise({f:400, f2:1200, filter:'bandpass', dur:0.25, vol:0.2}); tone({type:'triangle', f:mtof(64), dur:0.12, vol:0.08, delay:0.18}); sfx.relic(); },
    anvil(){ tone({type:'square', f:1400, dur:0.35, vol:0.07, lp:5000, rev:0.6}); tone({type:'sine', f:2100, dur:0.5, vol:0.05, rev:0.6}); noise({f:4000, filter:'bandpass', dur:0.08, vol:0.2}); },
    tick(){ tone({type:'square', f:1800, dur:0.02, vol:0.03, lp:5000}); },
    heartbeat(){ tone({type:'sine', f:70, f2:45, dur:0.16, vol:0.35}); tone({type:'sine', f:62, f2:40, dur:0.2, vol:0.28, delay:0.2}); },
    trophy(){ [72,76,79,84,88].forEach((m,i)=>tone({type:'triangle', f:mtof(m), dur:0.35, vol:0.1, delay:i*0.07, rev:0.5})); },
    whoosh(){ noise({f:300, f2:3000, filter:'bandpass', q:1.2, dur:0.45, vol:0.18, rev:0.3}); },
    flee(){ [79,76,72,67].forEach((m,i)=>tone({type:'square', f:mtof(m), dur:0.08, vol:0.05, lp:3000, delay:i*0.06})); noise({f:2000, f2:6000, filter:'highpass', dur:0.3, vol:0.08}); },
    blast(){ noise({f:1500, f2:80, dur:0.7, vol:0.5, rev:0.4}); tone({type:'sine', f:90, f2:30, dur:0.5, vol:0.5}); },
    map(){ tone({type:'triangle', f:mtof(69), dur:0.12, vol:0.07}); tone({type:'triangle', f:mtof(74), dur:0.2, vol:0.07, delay:0.07}); },
  };
  function play(name, ...args){ try{ if(ctx && vol.sfx>0 && sfx[name]) sfx[name](...args); }catch(e){} }

  /* ---------- ambience: wind, water drips, campfire crackle ---------- */
  const Amb = {
    on:false, wind:null, timer:null, kind:'dungeon',
    start(){
      if(!ctx || this.on) return; this.on = true;
      const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 380; f.Q.value = 0.6;
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 160; lfo.connect(lg); lg.connect(f.frequency); lfo.start();
      const g = ctx.createGain(); g.gain.value = 0.05; src.connect(f); f.connect(g); g.connect(ambBus); src.start();
      this.wind = g;
      this.timer = setInterval(()=>this.tick(), 400);
    },
    tick(){
      if(!ctx || vol.amb<=0 || ctx.state!=='running') return;
      if(this.kind==='fire'){ if(Math.random()<0.7) noise({f:2500+Math.random()*3000, filter:'bandpass', q:3, dur:0.03+Math.random()*0.05, vol:0.06+Math.random()*0.08, bus:ambBus}); return; }
      if(Math.random()<0.12){ const f = 900+Math.random()*900; tone({type:'sine', f, f2:f*0.55, dur:0.12, vol:0.05, bus:ambBus, rev:0.9}); }
      if(Math.random()<0.02) noise({f:200, f2:90, dur:1.6, vol:0.05, bus:ambBus, rev:0.5});
    },
    set(kind){ this.kind = kind; if(this.wind) this.wind.gain.setTargetAtTime(kind==='fire'?0.015:kind==='quiet'?0.02:0.05, ctx.currentTime, 0.8); },
  };

  /* ---------- music ---------- */
  const PROGS = {
    calm:  [[50,53,57],[46,50,53],[48,52,55],[45,48,52]],      // Dm Bb C Am
    fight: [[50,53,57],[46,50,53],[48,52,55],[49,52,57]],      // Dm Bb C A
    boss:  [[50,53,57],[51,55,58],[50,53,57],[49,52,55]],      // Dm Eb Dm C#dim
    shop:  [[48,52,55],[45,48,52],[41,45,48],[43,47,50]],      // C Am F G
    rest:  [[45,48,52],[41,45,48],[48,52,55],[43,47,50]],      // Am F C G
    deep:  [[47,50,54],[48,51,55],[47,50,53],[46,50,53]],      // Bm Cm Bdim Bb
  };
  const MODES = {
    menu:   {tempo:62, prog:'calm'},
    map:    {tempo:70, prog:'calm'},
    shop:   {tempo:96, prog:'shop', light:true},
    rest:   {tempo:56, prog:'rest', light:true},
    combat: {tempo:112, prog:'fight'},
    boss:   {tempo:124, prog:'boss'},
    endless:{tempo:118, prog:'deep'},
  };
  const Music = {
    mode:'off', step:0, next:0, timer:null,
    set(mode){
      this.want = mode; if(!ctx) return; if(mode===this.mode) return;
      const g = musicBus.gain, now = ctx.currentTime, v = vol.music*0.55;
      g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(v*0.15, now+0.25); g.linearRampToValueAtTime(v, now+1.2);
      this.mode = mode; this.step = 0; this.next = now + 0.3;
      Amb.set(mode==='rest' ? 'fire' : (mode==='menu'||mode==='shop') ? 'quiet' : 'dungeon');
      if(!this.timer) this.timer = setInterval(()=>this.tick(), 50);
    },
    kick(){ if(this.want && this.mode!==this.want) this.set(this.want); },
    tick(){
      if(!ctx || this.mode==='off' || !MODES[this.mode]) return;
      const M = MODES[this.mode], spb = 60/M.tempo/4;
      while(this.next < ctx.currentTime + 0.2){ this.play(this.step, this.next, M, spb); this.next += spb; this.step++; }
    },
    play(s, t, M, spb){
      if(vol.music<=0) return;
      const P = PROGS[M.prog], bar = Math.floor(s/16) % P.length, ch = P[bar], st = s % 16, d = ctx.currentTime;
      const at = t - d;
      const B = musicBus;
      // pad: once per bar
      if(st===0){
        ch.forEach((m,i)=>{
          tone({type:'sawtooth', f:mtof(m), dur:spb*16*1.05, vol:0.035, attack:spb*4, lp:this.mode==='boss'?900:650, bus:B, delay:at, detune:i*6, rev:0.6});
          tone({type:'sawtooth', f:mtof(m), dur:spb*16*1.05, vol:0.03, attack:spb*4, lp:650, bus:B, delay:at, detune:-8, rev:0.5});
        });
        tone({type:'sine', f:mtof(ch[0]-12), dur:spb*16, vol:0.07, attack:spb*2, bus:B, delay:at});
      }
      if(M.light){
        const step = this.mode==='shop' ? [0,4,6,8,12,14] : [0,8];
        if(step.includes(st)){ const m = ch[(st/2)%3|0] + 24; tone({type:this.mode==='shop'?'square':'triangle', f:mtof(m), dur:this.mode==='shop'?0.18:0.9, vol:this.mode==='shop'?0.03:0.05, lp:2500, bus:B, delay:at, echo:0.3, rev:0.4}); }
        if(this.mode==='shop' && st%4===2) noise({f:6000, filter:'highpass', dur:0.03, vol:0.03, bus:B, delay:at});
        return;
      }
      if(this.mode==='menu' || this.mode==='map'){
        if((st===0||st===6||st===10) && Math.random()<0.75){
          const m = ch[Math.floor(Math.random()*3)] + 24;
          tone({type:'triangle', f:mtof(m), dur:0.6, vol:0.05, bus:B, delay:at, echo:0.6, rev:0.4});
        }
        if(st===8 && bar%2===1) tone({type:'sine', f:mtof(ch[0]+36), dur:1.6, vol:0.025, bus:B, delay:at, rev:0.8});
        return;
      }
      // combat / boss
      const boss = this.mode==='boss' || this.mode==='endless';
      if(st%4===0) tone({type:'sine', f:110, f2:38, dur:0.22, vol:boss?0.32:0.26, bus:B, delay:at});
      if(st===4||st===12) noise({f:1800, filter:'bandpass', q:0.7, dur:0.16, vol:0.12, bus:B, delay:at, rev:0.25});
      if(st%2===1) noise({f:7000, filter:'highpass', dur:0.04, vol:0.04, bus:B, delay:at});
      if(boss && (st===14||st===15)) tone({type:'sine', f:st===14?160:120, f2:60, dur:0.18, vol:0.18, bus:B, delay:at});
      // bass line
      if(st%2===0){ const bm = ch[0]-12 + (st===6||st===14 ? 7 : 0); tone({type:'square', f:mtof(bm), dur:spb*1.8, vol:0.05, lp:boss?500:420, bus:B, delay:at}); }
      // arpeggio
      const pat = [0,1,2,1, 0,2,1,2, 0,1,2,3, 2,1,0,1];
      const idx = pat[st], m = (idx===3 ? ch[0]+12 : ch[idx]) + 12;
      if(st%2===0 || boss) tone({type:'triangle', f:mtof(m), dur:spb*1.4, vol:0.04, bus:B, delay:at, echo:0.25});
    },
  };

  document.addEventListener('visibilitychange', ()=>{ if(!ctx) return; try{ if(document.hidden) ctx.suspend(); else ctx.resume(); }catch(e){} });
  function setVolume(kind, v){
    vol[kind] = v; if(!ctx) return;
    if(kind==='sfx') sfxBus.gain.value = v;
    else if(kind==='amb') ambBus.gain.value = v*0.6;
    else { musicBus.gain.cancelScheduledValues(ctx.currentTime); musicBus.gain.value = v*0.55; }
  }
  function vibrate(ms){ try{ if(navigator.vibrate) navigator.vibrate(ms); }catch(e){} }
  return {unlock, play, music:(m)=>Music.set(m), setVolume, vibrate, get ready(){ return !!ctx; }};
})();
