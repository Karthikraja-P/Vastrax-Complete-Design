import React, { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Sparkles, Upload, RefreshCw, Check, ShoppingBag,
         AlertCircle, Layers, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';

// ── Photo tip sets per garment category ──────────────────────────────────────
const PHOTO_TIPS = {
  bottoms: 'Avoid wearing a long top, kurti, or dress that covers your legs. Wear shorts or leggings so the AI can drape the pants correctly.',
  tops: 'A full-body photo is recommended, but a waist-up (half-pose) photo can also be detected and draped.',
  'dresses': 'A full-body pose photo is required to drape the kurti correctly.',
};

const TIP_LABEL = {
  bottoms:     'Pants Try-On Guide',
  tops:        'Tops Try-On Guide',
  'dresses':   'Kurti Try-On Guide',
};

export function VirtualTryOn() {
  const { id } = useParams();
  const { products, addToCart, tryOnPortraitFile, setTryOnPortraitFile, tryOnPortraitPreview, setTryOnPortraitPreview } = useApp();
  const navigate = useNavigate();

  const product = products.find(p => p.id === id) || products[0];

  // ── Category mapping ──
  const getFashnCategory = (cat) => ({
    dress: 'dresses', pants: 'bottoms', tops: 'tops',
    shirt: 'tops', denim: 'bottoms', skirt: 'bottoms',
    cardigan: 'tops', bodycon: 'dresses',
  }[cat] || 'tops');

  const fashnType = getFashnCategory(product.category);
  const isBottoms = fashnType === 'bottoms';

  // Available tops for the combo selector
  const availableTops = products.filter(p => getFashnCategory(p.category) === 'tops' && p.id !== product.id);

  // ── State ──
  const personFile = tryOnPortraitFile;
  const setPersonFile = setTryOnPortraitFile;
  const previewUrl = tryOnPortraitPreview;
  const setPreviewUrl = setTryOnPortraitPreview;
  const [selectedTop, setSelectedTop]       = useState(null);   // combo: chosen top
  const [isProcessing, setIsProcessing]     = useState(false);
  const [statusType, setStatusType]         = useState('');
  const [statusText, setStatusText]         = useState('');
  const [tryOnComplete, setTryOnComplete]   = useState(false);
  const [tryOnResultUrl, setTryOnResultUrl] = useState('');
  const [addedBag, setAddedBag]             = useState(false);
  const [selectedSize, setSelectedSize]     = useState(null);
  const [sizeError, setSizeError]           = useState(false);
  const [showGarmentList, setShowGarmentList] = useState(false);
  const [showTipsModal, setShowTipsModal]   = useState(false);

  // ── File upload ──
  const fileInputRef = useRef();
  const triggerFileInput = () => fileInputRef.current.click();

  const handlePhotoUpload = (file) => {
    if (file && file.type.startsWith('image/')) {
      setPersonFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setPreviewUrl(e.target.result);
      reader.readAsDataURL(file);
      setTryOnComplete(false);
      setStatusType('');
      setStatusText('');
      setShowTipsModal(false); // Close guidelines modal on upload
    }
  };

  const onFileChange = (e) => { if (e.target.files?.[0]) handlePhotoUpload(e.target.files[0]); };
  const onDragOver   = (e) => e.preventDefault();
  const onDrop       = (e) => { e.preventDefault(); if (e.dataTransfer.files?.[0]) handlePhotoUpload(e.dataTransfer.files[0]); };

  // ── Try-on pipeline ──
  const startTryOnPipeline = async () => {
    if (!personFile || !product) return;

    const isCombo = isBottoms && selectedTop;
    setIsProcessing(true);
    setTryOnComplete(false);
    setStatusType('processing');
    setStatusText(isCombo
      ? 'Running 2-pass outfit drape on GPU… (~30 seconds)'
      : 'Sending to GPU node… (~14 seconds)');

    try {
      const formData = new FormData();
      formData.append('person_image', personFile);

      let res;
      if (isCombo) {
        formData.append('top_path', selectedTop.images[0]);
        formData.append('bottom_path', product.images[0]);
        res = await fetch('/api/v1/tryon/combo', { method: 'POST', body: formData });
      } else {
        formData.append('garment_path', product.images[0]);
        formData.append('garment_type', fashnType);
        res = await fetch('/api/v1/tryon/', { method: 'POST', body: formData });
      }

      if (!res.ok) {
        let message = `Server error (${res.status})`;
        try {
          const err = await res.json();
          message = err.detail || message;
        } catch {
          const text = await res.text().catch(() => '');
          if (text.includes('<!DOCTYPE') || text.includes('<html')) {
            message = res.status === 504
              ? 'GPU backend timed out — try again in a moment.'
              : 'Backend unreachable. Make sure the GPU server is running.';
          }
        }
        throw new Error(message);
      }

      let data;
      try { data = await res.json(); }
      catch { throw new Error('Backend returned an unexpected response.'); }

      if (data.status === 'success') {
        setTryOnResultUrl(data.result_url);
        setTryOnComplete(true);
        setStatusType('success');
        setStatusText(`Done! ${isCombo ? 'Full outfit draped' : 'Garment draped'} using ${data.model}.`);
      } else {
        throw new Error(data.message || 'Try-on response failed.');
      }
    } catch (err) {
      setStatusType('error');
      setStatusText(err.message || 'GPU server unreachable. Make sure the backend is running.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddBag = () => {
    if (!selectedSize) { setSizeError(true); return; }
    addToCart(product, selectedSize);
    setAddedBag(true);
    setTimeout(() => setAddedBag(false), 3000);
  };

  const resetAll = () => {
    setTryOnComplete(false);
    setTryOnResultUrl('');
    setStatusType('');
    setStatusText('');
    setSelectedSize(null);
    setSizeError(false);
  };

  const tips = PHOTO_TIPS[fashnType] || PHOTO_TIPS.tops;

  return (
    <div className="container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '960px', paddingTop: '32px', paddingBottom: '32px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          ← Back
        </button>
      </div>

      {/* Title */}
      <div style={{ textAlign: 'center' }}>
        <h1 className="title-section" style={{ fontSize: '28px', marginBottom: '0', fontWeight: 400 }}>Virtual Try-On</h1>
      </div>

      {/* Main layout */}
      <div className="tryon-grid">

        {/* ── Left: Controls ── */}
        <div className="tryon-controls" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Step 1: Upload */}
          <div style={{ border: 'var(--border-thin)', padding: '20px', backgroundColor: '#FFFFFF' }}>
            <span className="label-eyebrow" style={{ fontSize: '9px', marginBottom: '12px' }}>Step 1 — Your Photo</span>

            {/* Upload zone */}
            <div
              onClick={previewUrl ? triggerFileInput : () => setShowTipsModal(true)}
              onDragOver={onDragOver}
              onDrop={onDrop}
              style={{ border: previewUrl ? '0.5px solid var(--emerald-accent)' : '1px dashed var(--border-color)', backgroundColor: previewUrl ? '#FDFDFD' : '#FAFAFA', padding: previewUrl ? '8px' : '32px 20px', textAlign: 'center', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', minHeight: '160px', transition: 'border-color 0.2s' }}
            >
              <input type="file" ref={fileInputRef} onChange={onFileChange} accept="image/*" style={{ display: 'none' }} />
              {previewUrl ? (
                <img src={previewUrl} alt="Portrait" style={{ maxWidth: '100%', maxHeight: '220px', objectFit: 'contain' }} />
              ) : (
                <>
                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: 'var(--green-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Upload size={20} color="var(--green-mid)" />
                  </div>
                  <div>
                    <strong style={{ fontSize: '13px', color: 'var(--text-dark)' }}>Upload your photo</strong>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>Drag & drop or click to choose</p>
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>JPG, PNG — up to 10 MB</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Step 2: Garment selected */}
          <div style={{ border: 'var(--border-thin)', padding: '20px', backgroundColor: '#FFFFFF', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span className="label-eyebrow" style={{ fontSize: '9px', marginBottom: 0 }}>Step 2 — Garment Selected</span>
              <button
                onClick={() => setShowGarmentList(!showGarmentList)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--emerald-accent)',
                  fontSize: '11px',
                  fontWeight: 600,
                  fontFamily: 'var(--font-body)',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                {showGarmentList ? 'Hide List ▴' : 'Choose Garment ▾'}
              </button>
            </div>

            {/* Collapsible Vertical list of all available garments */}
            {showGarmentList && (
              <div style={{
                position: 'absolute',
                top: '48px',
                right: '20px',
                width: '240px',
                maxHeight: '300px',
                overflowY: 'auto',
                backgroundColor: '#FFFFFF',
                border: '0.5px solid var(--border-color)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                zIndex: 10,
                padding: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                animation: 'fadeInSlide 0.2s ease-out'
              }}>
                {products.map(p => {
                  const isSelected = p.id === product.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        navigate(`/product/${p.id}/tryon`);
                        resetAll();
                        setShowGarmentList(false); // Hide the list once chosen
                      }}
                      style={{
                        border: isSelected ? '1px solid var(--emerald-accent)' : '0.5px solid transparent',
                        backgroundColor: isSelected ? 'var(--green-light)' : 'transparent',
                        padding: '6px 8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        width: '100%',
                        textAlign: 'left',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <img src={p.images[0]} alt={p.name} style={{ width: '40px', height: '50px', objectFit: 'cover' }} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: isSelected ? 600 : 400,
                          color: 'var(--text-dark)',
                        }}>
                          {p.name}
                        </span>
                        <span style={{
                          fontSize: '9px',
                          color: 'var(--text-muted)'
                        }}>
                          ₹{p.priceSelling.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Currently selected garment details */}
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <img src={product.images[0]} alt={product.name} style={{ width: '80px', height: '100px', objectFit: 'cover', border: '0.5px solid var(--border-color)' }} />
              <div>
                <h3 className="title-card" style={{ fontSize: '15px', marginBottom: '4px' }}>{product.name}</h3>
                <span className="badge-text" style={{ textTransform: 'uppercase', fontSize: '9px', display: 'inline-block', marginBottom: '6px' }}>{fashnType}</span>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>₹{product.priceSelling.toLocaleString('en-IN')}</div>
              </div>
            </div>
          </div>

          {/* Step 3 (bottoms only): Optional top selector for full-outfit combo */}
          {isBottoms && (
            <div style={{ border: selectedTop ? '0.5px solid var(--emerald-accent)' : 'var(--border-thin)', padding: '20px', backgroundColor: '#FFFFFF' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span className="label-eyebrow" style={{ fontSize: '9px' }}>Step 3 — Replace Top Too? <span style={{ color: 'var(--text-muted)', textTransform: 'none', letterSpacing: 0, fontSize: '9px', fontWeight: 400 }}>(optional)</span></span>
                {selectedTop && (
                  <button onClick={() => setSelectedTop(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', fontSize: '10px' }}>
                    <X size={12} /> Clear
                  </button>
                )}
              </div>

              {selectedTop ? (
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <img src={selectedTop.images[0]} alt={selectedTop.name} style={{ width: '60px', height: '76px', objectFit: 'cover', border: '0.5px solid var(--emerald-accent)' }} />
                  <div>
                    <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-dark)' }}>{selectedTop.name}</p>
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>Will be draped in pass 1, then your pants in pass 2</p>
                  </div>
                </div>
              ) : (
                <>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                    Wearing a kurti in your photo? Select a top below — the AI will replace it first, then drape the pants. Skip this if you're already wearing a short top.
                  </p>
                  <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                    {availableTops.map(top => (
                      <button
                        key={top.id}
                        onClick={() => setSelectedTop(top)}
                        style={{ flexShrink: 0, border: '0.5px solid var(--border-color)', background: 'none', cursor: 'pointer', padding: '4px' }}
                        title={top.name}
                      >
                        <img src={top.images[0]} alt={top.name} style={{ width: '64px', height: '80px', objectFit: 'cover', display: 'block' }} />
                        <p style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '4px', maxWidth: '64px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', textAlign: 'center' }}>{top.name}</p>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Generate button */}
          <button
            onClick={startTryOnPipeline}
            disabled={isProcessing || !personFile}
            className="btn btn-accent"
            style={{ padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '12px' }}
          >
            {isBottoms && selectedTop
              ? <><Layers size={14} /> Generate Full Outfit Try-On</>
              : <><Sparkles size={14} fill="#FFF" /> Generate Virtual Try-On</>
            }
          </button>

          {/* Status banner */}
          {statusType && (
            <div style={{ border: '0.5px solid', borderColor: statusType === 'processing' ? 'var(--warning-border)' : statusType === 'success' ? 'var(--emerald-accent)' : 'var(--danger-border)', backgroundColor: statusType === 'processing' ? 'var(--warning-bg)' : statusType === 'success' ? 'var(--green-light)' : 'var(--danger-bg)', padding: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
              {statusType === 'processing'
                ? <RefreshCw size={16} color="var(--warning-text)" style={{ animation: 'spin 2s linear infinite' }} />
                : statusType === 'success'
                  ? <Check size={18} color="var(--green-mid)" />
                  : <AlertCircle size={18} color="var(--danger-text)" />
              }
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: '12px', color: statusType === 'processing' ? 'var(--warning-text)' : statusType === 'success' ? 'var(--green-mid)' : 'var(--danger-text)' }}>
                  {statusType === 'processing' ? 'Processing…' : statusType === 'success' ? 'Generation Complete' : 'Error'}
                </strong>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.4 }}>{statusText}</p>
              </div>
            </div>
          )}

          {/* Post-result: size + bag */}
          {tryOnComplete && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ border: 'var(--border-thin)', padding: '16px', backgroundColor: '#FFFFFF' }}>
                <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '10px' }}>Select Size</p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {product.sizes.map(sz => (
                    <button
                      key={sz}
                      onClick={() => { setSelectedSize(sz); setSizeError(false); }}
                      style={{ width: '44px', height: '44px', fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-body)', border: selectedSize === sz ? '1.5px solid var(--emerald-accent)' : sizeError ? '0.5px solid var(--danger-border)' : '0.5px solid var(--border-color)', backgroundColor: selectedSize === sz ? 'var(--green-light)' : '#FFFFFF', color: selectedSize === sz ? 'var(--green-mid)' : 'var(--text-body)', cursor: 'pointer', transition: 'all 0.15s ease' }}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
                {sizeError && <p style={{ fontSize: '11px', color: 'var(--danger-text)', marginTop: '8px' }}>Please select a size to continue.</p>}
              </div>

              <button onClick={handleAddBag} className="btn btn-primary" style={{ width: '100%', padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <ShoppingBag size={14} /> Add This Look to Shopping Bag
              </button>

              <button onClick={resetAll} className="btn btn-outline" style={{ width: '100%', fontSize: '11px', padding: '10px' }}>Change Photo</button>

              {addedBag && (
                <div style={{ backgroundColor: 'var(--green-light)', color: 'var(--green-mid)', padding: '12px', fontSize: '11px', textAlign: 'center', border: '0.5px solid var(--emerald-accent)' }}>
                  Size {selectedSize} added to your bag.
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right: Result viewport ── */}
        <div className="tryon-result" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            {tryOnComplete ? 'Your Look' : 'Preview'}
          </span>

          <div className="tryon-viewport" style={{ position: 'relative', width: '100%', maxWidth: '420px', aspectRatio: '3/4', backgroundColor: '#FFFFFF', border: 'var(--border-thin)', overflow: 'hidden', margin: '0 auto' }}>
            {tryOnComplete && tryOnResultUrl ? (
              <img src={tryOnResultUrl} alt="Virtual Try-On Result" style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#FAFAFA' }} />
            ) : isProcessing ? (
              <>
                <img src={product.images[0]} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.35 }} />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                  <RefreshCw size={28} color="var(--emerald-accent)" style={{ animation: 'spin 1.5s linear infinite' }} />
                  <p style={{ fontSize: '12px', color: 'var(--text-dark)', fontWeight: 600 }}>
                    {isBottoms && selectedTop ? 'Draping outfit on GPU (2 passes)…' : 'Draping on GPU…'}
                  </p>
                </div>
              </>
            ) : previewUrl ? (
              <>
                <img src={previewUrl} alt="Your portrait" style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#FAFAFA', opacity: 0.5 }} />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: 'rgba(28,6,69,0.25)' }}>
                  <Sparkles size={22} fill="#FFF" color="#FFF" />
                  <p style={{ fontSize: '12px', color: '#FFFFFF', fontWeight: 600 }}>Click Generate to try on</p>
                </div>
              </>
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', backgroundColor: '#FDFDFD' }}>
                <img src={product.images[0]} alt={product.name} style={{ maxHeight: '320px', maxWidth: '100%', objectFit: 'contain', opacity: 0.6 }} />
                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Upload your photo to see it on you</p>
              </div>
            )}
          </div>

          {tryOnComplete && (
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
              Generated by FASHN VTON 1.5 · Portrait deleted from server
            </p>
          )}
        </div>
      </div>

      {/* ── Guidelines Interstitial Modal ── */}
      {showTipsModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(28, 6, 69, 0.45)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            border: 'var(--border-thin)',
            width: '100%',
            maxWidth: '460px',
            padding: '24px',
            position: 'relative',
            boxShadow: '0 12px 32px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}>
            {/* Close Button */}
            <button
              onClick={() => setShowTipsModal(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)'
              }}
            >
              <X size={18} />
            </button>

            {/* Title */}
            <div style={{ borderBottom: '0.5px solid var(--border-color)', paddingBottom: '12px' }}>
              <span className="label-eyebrow" style={{ fontSize: '9px', color: 'var(--emerald-accent)', marginBottom: '4px' }}>AI Photo Guidelines</span>
              <h2 style={{ fontFamily: 'var(--font-headings)', fontSize: '22px', color: 'var(--text-dark)', fontWeight: 400, marginTop: '2px' }}>
                {TIP_LABEL[fashnType] || 'Photo Guidelines'}
              </h2>
            </div>

            {/* Guide content */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', backgroundColor: '#F9F9F7', padding: '14px 16px', border: '0.5px solid var(--border-color)' }}>
              <span style={{ flexShrink: 0, marginTop: '2px' }}>
                <Sparkles size={16} color="var(--emerald-accent)" fill="var(--emerald-accent)" />
              </span>
              <p style={{
                fontSize: '12px',
                color: 'var(--text-body)',
                lineHeight: 1.6,
                margin: 0,
                fontFamily: 'var(--font-body)'
              }}>
                {tips}
              </p>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
              <button
                onClick={() => setShowTipsModal(false)}
                className="btn btn-outline"
                style={{ flex: 1, padding: '10px' }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  triggerFileInput();
                }}
                className="btn btn-primary"
                style={{ flex: 2, padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                Choose Photo <Upload size={13} />
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .tryon-grid {
          display: grid;
          grid-template-columns: 380px 1fr;
          gap: 40px;
          margin-top: 4px;
          align-items: start;
        }
        @media (max-width: 900px) {
          .tryon-grid {
            grid-template-columns: 1fr;
            gap: 24px;
          }
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}
