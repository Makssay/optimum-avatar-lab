"use client";

import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";

const mascotRail = ["hi", "think", "thumb", "lol", "light", "gg"];
const MAX_FILE_SIZE = 8 * 1024 * 1024;
const DAILY_GENERATION_LIMIT = 3;
const DAILY_USAGE_KEY = "optimum-avatar-daily-usage-v4";
const SHARE_TEXT = `Now you can create your own avatar in @get_optimum!

https://optimum-avatar-lab.vercel.app

Thanks for the work @Makssay_eth

How do you like my avatar? @kentlinyy @blockchainjeff`;

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [generationResults, setGenerationResults] = useState<string[]>([]);
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.removeItem("optimum-avatar-gallery");
      localStorage.removeItem("optimum-avatar-gallery-v2");
    } catch {}
  }, []);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function acceptFile(nextFile?: File) {
    if (!nextFile) return;
    setError(null); setCopyStatus(null);
    if (!nextFile.type.startsWith("image/")) return setError("Please upload an image file: JPG, PNG, or WEBP.");
    if (nextFile.size > MAX_FILE_SIZE) return setError("The file is too large. Maximum size is 8 MB.");
    if (preview) URL.revokeObjectURL(preview);
    setFile(nextFile); setPreview(URL.createObjectURL(nextFile));
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) { acceptFile(event.target.files?.[0]); event.target.value = ""; }
  function onDrop(event: DragEvent<HTMLButtonElement>) { event.preventDefault(); setIsDragging(false); acceptFile(event.dataTransfer.files?.[0]); }

  function getTodayKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }

  function readDailyUsage() {
    try {
      const today = getTodayKey();
      const saved = JSON.parse(localStorage.getItem(DAILY_USAGE_KEY) || "null") as { date?: string; count?: number } | null;
      return saved?.date === today ? { date: today, count: saved.count || 0 } : { date: today, count: 0 };
    } catch {
      return { date: getTodayKey(), count: 0 };
    }
  }

  function recordSuccessfulGeneration() {
    const usage = readDailyUsage();
    localStorage.setItem(DAILY_USAGE_KEY, JSON.stringify({ date: usage.date, count: usage.count + 1 }));
  }

  async function generate() {
    if (!file || isGenerating) return;
    const usage = readDailyUsage();
    if (usage.count >= DAILY_GENERATION_LIMIT) {
      setError("You have used all 3 daily generations. Please try again tomorrow.");
      return;
    }
    setIsGenerating(true); setError(null); setCopyStatus(null);
    const body = new FormData(); body.append("avatar", file); body.append("mood", "bold");
    try {
      const response = await fetch("/api/generate", { method: "POST", body });
      const payload = (await response.json()) as { image?: string; images?: string[]; error?: string };
      const images = payload.images?.length ? payload.images : payload.image ? [payload.image] : [];
      if (!response.ok || images.length === 0) throw new Error(payload.error || "Could not create an avatar.");
      const nextImage = images[0];
      setGenerationResults((previous) => {
        const next = [...previous, nextImage].slice(-DAILY_GENERATION_LIMIT);
        setSelectedResultIndex(next.length - 1);
        return next;
      });
      setResult(nextImage); recordSuccessfulGeneration();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Something went wrong. Please try again."); }
    finally { setIsGenerating(false); }
  }

  async function copyPng() {
    if (!result) return;
    setCopyStatus(null);
    try {
      const response = await fetch(result);
      const blob = await response.blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type || "image/png"]: blob })]);
      setCopyStatus("PNG copied to clipboard.");
    } catch {
      setCopyStatus("Copy failed. Use Download PNG instead.");
    }
  }

  const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(SHARE_TEXT)}`;

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Optimum Avatar Lab home"><img src="/optimum-logo-white.svg" alt="Optimum" /><span>Avatar Lab</span></a>
      </header>
      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">Optimum mascot generator · 01</p>
          <h1>Your character.<br /><span>Our mascot.</span></h1>
          <p className="lead">Upload your avatar and get yourself reimagined in the recognizable Optimum mascot style. We keep the likeness, then add the character.</p>
          <div className="hero-notes" aria-label="Benefits"><span>1K quality</span><span>about 10-30 sec</span><span>PNG output</span></div>
        </div>
        <div className="mascot-stage" aria-hidden="true"><div className="orb orb-lavender" /><div className="orb orb-peach" /><div className="stage-grid" /><img className="hero-mascot" src="/mascot/hi.png" alt="" /><span className="sticker sticker-top">HEY!</span><span className="sticker sticker-bottom">THAT&apos;S YOU</span></div>
      </section>
      <section className="studio" id="studio">
        <div className="studio-heading"><p className="eyebrow">Avatar studio · 02</p><h2>Make it yours.</h2><p>One image, one click, and your new Optimum-style avatar is ready.</p></div>
        <div className="generator-shell">
          <div className="control-panel">
            <div className="step-heading"><span>01</span><div><h3>Upload avatar</h3><p>Front-facing portraits work best</p></div></div>
            <button className={`dropzone ${isDragging ? "is-dragging" : ""} ${preview ? "has-preview" : ""}`} type="button" onClick={() => inputRef.current?.click()} onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setIsDragging(false)} onDrop={onDrop} aria-label={preview ? "Replace uploaded avatar" : "Upload avatar"}>
              {preview ? <><img src={preview} alt="Uploaded avatar preview" /><span className="replace-badge">Replace</span></> : <div className="dropzone-empty"><span className="upload-mark" aria-hidden="true">↗</span><strong>Drop an image here</strong><small>or click to choose · up to 8 MB</small></div>}
            </button>
            <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={onFileChange} hidden />
            {error && <p className="error-message" role="alert">{error}</p>}
            <button className="generate-button" type="button" onClick={generate} disabled={!file || isGenerating}><span>{isGenerating ? "Generating..." : "Generate variant"}</span><b aria-hidden="true">↗</b></button>
            <p className="limit-note">3 generations available per day.</p>
            <p className="privacy-note">Your file is not stored on the site and is used only for this generation.</p>
          </div>
          <div className={`result-panel ${result ? "has-result" : ""}`}>
            <div className="result-topline"><span>Result</span><small>Generated images disappear after refresh or closing the page.</small><span className="live-dot"><i /> LIVE PREVIEW</span></div>
            <div className="result-workspace">
              <div className="result-canvas">{isGenerating ? <div className="generating-state"><div className="scan-frame"><img src="/mascot/light.png" alt="" /><span /></div><strong>Redrawing your character</strong><p>The model is matching the avatar traits with the mascot style</p></div> : result ? <img className="result-image" src={result} alt="Generated Optimum mascot avatar" /> : <div className="empty-result"><span className="spark">✦</span><div className="face-placeholder"><i /><b /></div><strong>Your mascot will appear here</strong><p>Upload an image and start generation</p></div>}</div>
              <div className="variant-gallery" aria-label="Generated variants">
                {Array.from({ length: DAILY_GENERATION_LIMIT }).map((_, index) => {
                  const image = generationResults[index];
                  return image ? <button key={image.slice(0, 64) + index} className={index === selectedResultIndex ? "is-active" : ""} type="button" onClick={() => { setSelectedResultIndex(index); setResult(image); setCopyStatus(null); }} aria-label={"Select variant " + (index + 1)}><img src={image} alt="" /><span>{index + 1}</span></button> : <div className="variant-slot" key={`empty-${index}`}><span>{index + 1}</span></div>;
                })}
              </div>
            </div>
          </div>
        </div>
        <div className="studio-actions" aria-label="Avatar actions">
          <a className={!result ? "is-disabled" : ""} href={result || undefined} download="optimum-avatar.png" aria-disabled={!result}>Download PNG</a>
          <button type="button" onClick={copyPng} disabled={!result}>Copy PNG</button>
          <a className={!result ? "is-disabled" : ""} href={result ? shareUrl : undefined} target="_blank" rel="noreferrer" aria-disabled={!result}>Share on X</a>
        </div>
        {copyStatus && <p className="copy-status">{copyStatus}</p>}
      </section>
      <section className="mascot-rail" aria-label="Optimum mascot gallery"><div className="rail-copy"><span>One mascot.</span><strong>Infinite moods.</strong></div><div className="rail-images">{mascotRail.map((name, index) => <div key={name} style={{ "--delay": `${index * 0.12}s` } as React.CSSProperties}><img src={`/mascot/${name}.png`} alt="" /></div>)}</div></section>
      <footer><img src="/optimum-logo-white.svg" alt="Optimum" /><p>Built for the Optimum community · 2026 · by @Makssay_eth</p><a href="#top">Back to top ↑</a></footer>
    </main>
  );
}