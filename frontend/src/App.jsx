import { useState, useRef, useCallback } from 'react'
import axios from 'axios'
import {
  Pill,
  Upload,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  Sparkles,
  TrendingDown,
  ShieldCheck,
  Store,
  ArrowDownRight,
  FileSearch,
  Info,
  Zap,
  IndianRupee,
  Heart,
} from 'lucide-react'

const API_BASE = 'http://localhost:8000'

// ── Utility ──────────────────────────────────────────────────────────────────
const formatPrice = (p) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(p)

// ── Sub-components ────────────────────────────────────────────────────────────

function ComparisonCard({ type, data, benchmarkPrice }) {
  const colorClass = { red: 'red', blue: 'blue', green: 'green' }[type]

  if (type === 'red') {
    return (
      <div className={`comp-card ${colorClass} fade-in-up stagger-1`}>
        <div className="card-type-label">
          <AlertCircle size={12} /> Expensive Market Brand
        </div>
        <div className="card-brand-name">{data.name}</div>
        <div className="card-company">{data.company}</div>
        <div className="card-price">
          <span className="card-price-amount">₹{formatPrice(data.price_inr)}</span>
          <span className="card-price-unit">/ {data.pack}</span>
        </div>
        <div className="card-separator" />
        <div className="card-badges">
          <span className="badge warn"><AlertCircle size={10} /> Benchmark Price</span>
        </div>
      </div>
    )
  }

  if (type === 'blue') {
    return (
      <div className={`comp-card ${colorClass} fade-in-up stagger-2`}>
        <div className="card-type-label">
          <ShieldCheck size={12} /> Best Trusted Alternative
        </div>
        <div className="card-brand-name">{data.name}</div>
        <div className="card-company">{data.company}</div>
        <div className="card-price">
          <span className="card-price-amount">₹{formatPrice(data.price_inr)}</span>
          <span className="card-price-unit">/ {data.pack}</span>
        </div>
        {data.savings_percent > 0 && (
          <div className="savings-badge">
            <TrendingDown size={12} />
            {data.savings_percent}% cheaper than {benchmarkPrice}
          </div>
        )}
        <div className="card-separator" />
        <div className="card-badges">
          {data.who_gmp_certified && (
            <span className="badge who"><ShieldCheck size={10} /> WHO-GMP</span>
          )}
        </div>
      </div>
    )
  }

  if (type === 'green') {
    return (
      <div className={`comp-card ${colorClass} fade-in-up stagger-3`}>
        <div className="card-type-label">
          <Store size={12} /> Absolute Cheapest
        </div>
        <div className="card-brand-name">{data.name}</div>
        <div className="card-company">{data.outlet}</div>
        <div className="card-price">
          <span className="card-price-amount">₹{formatPrice(data.price_inr)}</span>
          <span className="card-price-unit">/ {data.pack}</span>
        </div>
        {data.savings_percent > 0 && (
          <div className="savings-badge">
            <ArrowDownRight size={12} />
            {data.savings_percent}% savings
          </div>
        )}
        <div className="card-separator" />
        <div className="card-badges">
          <span className="badge pmbjp"><Zap size={10} /> PMBJP</span>
          <span className="badge govt"><Store size={10} /> Jan Aushadhi</span>
        </div>
      </div>
    )
  }

  return null
}

function MedicineBlock({ result, index }) {
  return (
    <div className="medicine-block fade-in-up" style={{ animationDelay: `${index * 0.08}s` }}>
      <div className="medicine-block-header">
        <div className="medicine-icon-wrap">
          <Pill size={22} color="#fff" />
        </div>
        <div>
          <div className="medicine-name">
            {result.generic_name} <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{result.strength}</span>
          </div>
          <div className="medicine-meta">
            <span className="medicine-tag use">{result.use_case}</span>
            <span className="medicine-tag salt">{result.active_salt}</span>
          </div>
        </div>
      </div>

      <div className="comparison-grid">
        <ComparisonCard
          type="red"
          data={result.benchmark_brand}
          benchmarkPrice={null}
        />
        <ComparisonCard
          type="blue"
          data={result.best_alternative}
          benchmarkPrice={result.benchmark_brand.name}
        />
        <ComparisonCard
          type="green"
          data={result.jan_aushadhi}
          benchmarkPrice={result.benchmark_brand.name}
        />
      </div>
    </div>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  const handleFile = useCallback((file) => {
    if (!file) return
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
    if (!allowed.includes(file.type)) {
      setError('Please upload a JPEG, PNG, or WebP image of your prescription.')
      return
    }
    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setResult(null)
    setError(null)
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleDragOver = (e) => { e.preventDefault(); setIsDragOver(true) }
  const handleDragLeave = () => setIsDragOver(false)

  const handleFileInput = (e) => { handleFile(e.target.files?.[0]) }

  const handleRemove = () => {
    setSelectedFile(null)
    setPreviewUrl(null)
    setResult(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleAnalyze = async () => {
    if (!selectedFile) return
    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const response = await axios.post(`${API_BASE}/api/analyze`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResult(response.data)
    } catch (err) {
      const detail = err.response?.data?.detail
      if (typeof detail === 'string') {
        setError(detail)
      } else if (err.code === 'ERR_NETWORK') {
        setError('Cannot connect to AushadhAI backend. Make sure the FastAPI server is running on port 8000.')
      } else {
        setError('An unexpected error occurred. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const hasResults = result && result.results && result.results.length > 0

  return (
    <div className="app-wrapper">
      {/* ── Header ── */}
      <header className="header">
        <div className="logo">
          <div className="logo-icon">
            <Heart size={20} color="#fff" strokeWidth={2.5} />
          </div>
          <span className="logo-text">AushadhAI</span>
        </div>
        <div className="header-badge">
          <Sparkles size={10} style={{ display:'inline', marginRight: 4 }} />
          Powered by Gemini AI
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="hero">
        <div className="hero-tag">
          <IndianRupee size={12} />
          Smart Medicine Price Analyzer
        </div>
        <h1>
          Stop Overpaying <br />
          for <span>Your Medicines</span>
        </h1>
        <p className="hero-sub">
          Upload your prescription and instantly discover the cheapest
          Jan Aushadhi alternatives and best WHO-GMP certified brands — saving you up to <strong>94%</strong>.
        </p>

        <div className="stats-bar">
          <div className="stat-item">
            <div className="stat-value">94%</div>
            <div className="stat-label">Max Savings</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">9,000+</div>
            <div className="stat-label">Jan Aushadhi Kendras</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">WHO-GMP</div>
            <div className="stat-label">Certified Brands</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">AI-First</div>
            <div className="stat-label">Gemini Vision</div>
          </div>
        </div>
      </section>

      {/* ── Main Content ── */}
      <main className="main-content">
        {/* Upload Section */}
        <div className="upload-section">
          <div className="upload-section-title">
            <div className="step-badge">1</div>
            Upload Your Prescription
          </div>

          {/* Drop Zone */}
          <div
            id="prescription-drop-zone"
            className={`drop-zone ${isDragOver ? 'drag-over' : ''} ${previewUrl ? 'has-image' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => !previewUrl && fileInputRef.current?.click()}
          >
            {previewUrl ? (
              <div className="preview-container">
                <img src={previewUrl} alt="Prescription preview" className="preview-img" />
                <button
                  id="remove-image-btn"
                  className="preview-remove-btn"
                  onClick={(e) => { e.stopPropagation(); handleRemove() }}
                  title="Remove image"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <>
                <div className="drop-zone-icon">
                  <Upload size={28} />
                </div>
                <div className="drop-zone-text">
                  <h3>Drop your prescription here</h3>
                  <p>
                    or <span className="browse-link">browse to upload</span>
                    <br />
                    JPEG, PNG, WebP supported
                  </p>
                </div>
              </>
            )}
          </div>

          <input
            ref={fileInputRef}
            id="prescription-file-input"
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            style={{ display: 'none' }}
            onChange={handleFileInput}
          />

          {/* Analyze Button */}
          <button
            id="analyze-btn"
            className="analyze-btn"
            disabled={!selectedFile || isLoading}
            onClick={handleAnalyze}
          >
            {isLoading ? (
              <>
                <div className="spinner" />
                Analyzing with Gemini AI…
              </>
            ) : (
              <>
                <FileSearch size={18} />
                Analyze Prescription
              </>
            )}
          </button>
        </div>

        {/* Error State */}
        {error && (
          <div className="status-card error fade-in-up">
            <div className="status-icon err">
              <AlertCircle size={24} />
            </div>
            <h3>Analysis Failed</h3>
            <p>{error}</p>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="status-card fade-in-up">
            <div className="status-icon spin-wrap">
              <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
            <h3>Analyzing your prescription…</h3>
            <p>Gemini AI is reading the prescription and matching medicines from our catalog.</p>
          </div>
        )}

        {/* Results */}
        {result && !isLoading && (
          <>
            {/* Prescription Info Banner */}
            {result.prescription_text && (
              <div className="prescription-banner fade-in-up">
                <div className="prescription-banner-icon">
                  <Info size={18} />
                </div>
                <div className="prescription-banner-text">
                  <p>Prescription Summary</p>
                  <p>{result.prescription_text}</p>
                </div>
              </div>
            )}

            {hasResults ? (
              <>
                {/* Results Header */}
                <div className="results-header fade-in-up">
                  <h2>Price Comparison Results</h2>
                  <span className="results-count-badge">
                    {result.results.length} medicine{result.results.length !== 1 ? 's' : ''} found
                  </span>
                </div>

                {/* Legend */}
                <div style={{ display:'flex', gap:'16px', flexWrap:'wrap', marginBottom:'24px', fontSize:'0.78rem', color:'var(--text-secondary)' }}>
                  <span style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                    <span style={{ width:10, height:10, borderRadius:'50%', background:'var(--accent-red)', flexShrink:0 }} />
                    Expensive Market Brand (Benchmark)
                  </span>
                  <span style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                    <span style={{ width:10, height:10, borderRadius:'50%', background:'var(--accent-blue)', flexShrink:0 }} />
                    WHO-GMP Certified Alternative
                  </span>
                  <span style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                    <span style={{ width:10, height:10, borderRadius:'50%', background:'var(--accent-green)', flexShrink:0 }} />
                    Jan Aushadhi (Cheapest)
                  </span>
                </div>

                {/* Medicine Blocks */}
                {result.results.map((med, i) => (
                  <MedicineBlock key={med.generic_name + i} result={med} index={i} />
                ))}

                {/* Unmatched */}
                {result.unmatched && result.unmatched.length > 0 && (
                  <div className="unmatched-section fade-in-up">
                    <h4><Info size={14} /> Medicines Not in Our Catalog</h4>
                    <div className="unmatched-tags">
                      {result.unmatched.map((u) => (
                        <span key={u} className="unmatched-tag">{u}</span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="status-card fade-in-up">
                <div className="status-icon ok">
                  <CheckCircle size={24} />
                </div>
                <h3>No Catalog Matches Found</h3>
                <p>{result.message}</p>
              </div>
            )}
          </>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="footer">
        <p>
          AushadhAI uses <strong>Google Gemini AI</strong> to analyze prescriptions. Prices are indicative and subject to change.
          Always consult your pharmacist before substituting medicines.
        </p>
        <p style={{ marginTop: 8 }}>
          Jan Aushadhi Kendras: <a href="https://janaushadhi.gov.in" target="_blank" rel="noopener noreferrer">janaushadhi.gov.in</a>
          &ensp;|&ensp; PMBJP Scheme by Government of India
        </p>
      </footer>
    </div>
  )
}
