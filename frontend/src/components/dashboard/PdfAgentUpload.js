import React, { useRef, useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import toast from 'react-hot-toast';

const ANALYZE_STEPS = [
  { id: 'upload', title: 'PDF Received' },
  { id: 'extract', title: 'Extracting Text' },
  { id: 'members', title: 'Identifying Member' },
  { id: 'classify', title: 'Classifying Document' },
  { id: 'vitals', title: 'Extracting Vitals' },
  { id: 'review', title: 'Review Required' },
];

const SAVE_STEPS = [
  { id: 'save', title: 'Saving Record' },
  { id: 'vitals_save', title: 'Saving Vitals' },
];

const StatusIcon = ({ status }) => {
  if (status === 'running') {
    return <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />;
  }
  if (status === 'done') {
    return (
      <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  if (status === 'waiting') {
    return (
      <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
  if (status === 'error') {
    return (
      <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  }
  if (status === 'skipped') {
    return (
      <svg className="w-5 h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
      </svg>
    );
  }
  return <div className="w-5 h-5 rounded-full border-2 border-neutral-300" />;
};

const PdfAgentUpload = ({ onComplete, members = [] }) => {
  const fileInputRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [phase, setPhase] = useState('idle'); // idle | analyzing | review | saving | done | error
  const [steps, setSteps] = useState([]);
  const [review, setReview] = useState(null);
  const [reviewForm, setReviewForm] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const resetState = () => {
    setSteps(ANALYZE_STEPS.map((s) => ({ ...s, status: 'pending', message: 'Waiting...' })));
    setReview(null);
    setReviewForm(null);
    setResult(null);
    setError(null);
    setPhase('idle');
  };

  const openAgent = () => {
    resetState();
    setIsOpen(true);
  };

  const closeAgent = () => {
    if (phase === 'analyzing' || phase === 'saving') return;
    setIsOpen(false);
    resetState();
  };

  const updateStep = (step) => {
    setSteps((prev) => prev.map((s) => (s.id === step.id ? { ...s, ...step } : s)));
  };

  const readStream = async (response, onEvent) => {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        onEvent(JSON.parse(line));
      }
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Please select a PDF file');
      return;
    }

    resetState();
    setPhase('analyzing');
    updateStep({ id: 'upload', status: 'running', message: `Uploading ${file.name}...` });

    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/health/agent/analyze', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || 'Analysis failed');
      }

      await readStream(response, (event) => {
        if (event.type === 'step') updateStep(event);
        if (event.type === 'review') {
          setReview(event);
          setReviewForm({
            analysisId: event.analysisId,
            memberId: event.proposal.memberId,
            category: event.proposal.category,
            reportDate: event.proposal.reportDate,
            title: event.proposal.title,
            vitals: event.proposal.vitals || [],
          });
          setPhase('review');
          updateStep({ id: 'review', status: 'waiting', message: 'Waiting for your confirmation' });
        }
        if (event.type === 'error') throw new Error(event.message);
      });
    } catch (err) {
      setError(err.message);
      setPhase('error');
      toast.error(err.message);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleConfirm = async () => {
    if (!reviewForm) return;

    setPhase('saving');
    setSteps([
      ...ANALYZE_STEPS.map((s) => {
        const existing = steps.find((x) => x.id === s.id);
        return existing || { ...s, status: 'done', message: 'Complete' };
      }),
      ...SAVE_STEPS.map((s) => ({ ...s, status: 'pending', message: 'Waiting...' })),
    ]);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/health/agent/confirm', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reviewForm),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || 'Save failed');
      }

      await readStream(response, (event) => {
        if (event.type === 'step') {
          setSteps((prev) => {
            const exists = prev.find((s) => s.id === event.id);
            if (exists) return prev.map((s) => (s.id === event.id ? { ...s, ...event } : s));
            return [...prev, event];
          });
        }
        if (event.type === 'complete') {
          setResult(event.result);
          setPhase('done');
          toast.success(`Saved for ${event.result.member.name}`);
          if (onComplete) onComplete(event.result);
        }
        if (event.type === 'error') throw new Error(event.message);
      });
    } catch (err) {
      setError(err.message);
      setPhase('error');
      toast.error(err.message);
    }
  };

  const reviewMembers = review?.members?.length ? review.members : members;
  const categoryLabel = reviewForm?.category === 'report' ? 'Medical Report' : 'Document';

  const overlay = isOpen && ReactDOM.createPortal(
    <div className="agent-fullscreen">
      <div className="liquid-glass-nav mx-4 mt-3 rounded-2xl px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-bold text-neutral-900">AI Health Agent</h2>
            <p className="text-xs text-neutral-500">Smart PDF analysis & import</p>
          </div>
        </div>
        {phase !== 'analyzing' && phase !== 'saving' && (
          <button onClick={closeAgent} className="p-2 rounded-xl hover:bg-white/40 text-neutral-500">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="agent-fullscreen-body max-w-2xl mx-auto w-full">
        {phase === 'idle' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 flex items-center justify-center mb-6 animate-pulse-slow">
              <svg className="w-10 h-10 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-neutral-900 mb-2">Upload a health PDF</h3>
            <p className="text-neutral-500 mb-8 max-w-sm">
              Our AI agent will identify the member, classify the file, extract lab values, and ask you to review before saving.
            </p>
            <label className="btn-ai cursor-pointer">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Choose PDF</span>
              <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={handleFileSelect} />
            </label>
            <p className="text-xs text-neutral-400 mt-4">Works best with digital lab reports (not scanned photos)</p>
          </div>
        )}

        {(phase === 'analyzing' || phase === 'saving') && (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-600 mb-4">
              {phase === 'analyzing' ? 'Agent Working...' : 'Saving...'}
            </p>
            {steps.map((step) => (
              <div
                key={step.id}
                className={`flex items-start gap-3 p-4 rounded-2xl liquid-glass transition-all ${
                  step.status === 'running' ? 'ring-2 ring-violet-400/50' : ''
                }`}
              >
                <div className="mt-0.5"><StatusIcon status={step.status} /></div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-neutral-900">{step.title}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">{step.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {phase === 'review' && reviewForm && (
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/60 backdrop-blur-sm">
              <p className="text-sm font-semibold text-amber-900">Review before saving</p>
              <p className="text-xs text-amber-700 mt-1">Confirm the details below. Nothing is saved until you approve.</p>
            </div>

            <div className="space-y-4 liquid-glass rounded-2xl p-5">
              <div>
                <label className="input-label">Family Member</label>
                <select
                  className="glass-input w-full"
                  value={reviewForm.memberId}
                  onChange={(e) => setReviewForm({ ...reviewForm, memberId: e.target.value })}
                >
                  {reviewMembers.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="input-label">Save As</label>
                <select
                  className="glass-input w-full"
                  value={reviewForm.category}
                  onChange={(e) => setReviewForm({ ...reviewForm, category: e.target.value })}
                >
                  <option value="report">Medical Report</option>
                  <option value="document">Document</option>
                </select>
              </div>

              <div>
                <label className="input-label">Title</label>
                <input
                  className="glass-input w-full"
                  value={reviewForm.title}
                  onChange={(e) => setReviewForm({ ...reviewForm, title: e.target.value })}
                />
              </div>

              <div>
                <label className="input-label">Date</label>
                <input
                  type="date"
                  className="glass-input w-full"
                  value={reviewForm.reportDate}
                  onChange={(e) => setReviewForm({ ...reviewForm, reportDate: e.target.value })}
                />
              </div>

              {reviewForm.category === 'report' && reviewForm.vitals.length > 0 && (
                <div>
                  <label className="input-label">Vitals to import ({reviewForm.vitals.length})</label>
                  <div className="space-y-2 mt-2">
                    {reviewForm.vitals.map((v, i) => (
                      <div key={i} className="flex justify-between items-center p-3 rounded-xl liquid-glass-subtle text-sm">
                        <span className="font-medium text-neutral-800">{v.label || v.vitalType}</span>
                        <span className="text-violet-700 font-semibold">{v.value} {v.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pb-6">
              <button onClick={closeAgent} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleConfirm} className="btn-ai flex-1 justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Confirm & Save</span>
              </button>
            </div>
          </div>
        )}

        {phase === 'done' && result && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-neutral-900 mb-2">All Done!</h3>
            <p className="text-neutral-600 mb-1">Saved for <strong>{result.member.name}</strong></p>
            <p className="text-sm text-neutral-500 mb-6">
              {result.savedRecord?.type === 'report' ? 'Medical report' : 'Document'} · {result.reportDate}
              {result.vitalsSaved?.length > 0 && ` · ${result.vitalsSaved.length} vitals added`}
            </p>
            <button onClick={closeAgent} className="btn-primary px-8">Done</button>
          </div>
        )}

        {phase === 'error' && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-neutral-900 mb-2">Something went wrong</h3>
            <p className="text-sm text-neutral-600 mb-6 max-w-sm">{error}</p>
            <div className="flex gap-3 w-full max-w-xs">
              <button onClick={closeAgent} className="btn-secondary flex-1">Close</button>
              <button onClick={() => { resetState(); fileInputRef.current?.click(); }} className="btn-ai flex-1 justify-center">
                <span>Retry</span>
              </button>
              <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={handleFileSelect} />
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );

  return (
    <>
      <button type="button" onClick={openAgent} className="btn-ai">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <span>AI Upload</span>
        <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 px-1.5 py-0.5 rounded-md">Beta</span>
      </button>
      {overlay}
    </>
  );
};

export default PdfAgentUpload;
