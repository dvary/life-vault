import React, { useRef, useState } from 'react';
import toast from 'react-hot-toast';

const STEP_TEMPLATE = [
  { id: 'upload', title: 'PDF Received' },
  { id: 'extract', title: 'Extracting Text' },
  { id: 'members', title: 'Identifying Member' },
  { id: 'classify', title: 'Classifying Document' },
  { id: 'save', title: 'Saving Record' },
  { id: 'vitals', title: 'Extracting Vitals' },
];

const StatusIcon = ({ status }) => {
  if (status === 'running') {
    return <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />;
  }
  if (status === 'done') {
    return (
      <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
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

const PdfAgentUpload = ({ onComplete }) => {
  const fileInputRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [steps, setSteps] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const resetState = () => {
    setSteps(STEP_TEMPLATE.map((s) => ({ ...s, status: 'pending', message: 'Waiting...' })));
    setResult(null);
    setError(null);
  };

  const openModal = () => {
    resetState();
    setIsOpen(true);
  };

  const closeModal = () => {
    if (!processing) {
      setIsOpen(false);
      resetState();
    }
  };

  const updateStep = (step) => {
    setSteps((prev) => {
      const existing = prev.find((s) => s.id === step.id);
      if (existing) {
        return prev.map((s) => (s.id === step.id ? { ...s, ...step } : s));
      }
      return [...prev, step];
    });
  };

  const processStream = async (response) => {
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
        const event = JSON.parse(line);

        if (event.type === 'step') {
          updateStep(event);
        } else if (event.type === 'complete') {
          setResult(event.result);
          toast.success(`Saved for ${event.result.member.name}`);
          if (onComplete) onComplete(event.result);
        } else if (event.type === 'error') {
          setError(event.message);
          toast.error(event.message);
        }
      }
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.includes('pdf')) {
      toast.error('Please select a PDF file');
      return;
    }

    resetState();
    setProcessing(true);
    updateStep({ id: 'upload', status: 'running', title: 'PDF Received', message: `Uploading ${file.name}...` });

    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/health/agent/process', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || 'Upload failed');
      }

      await processStream(response);
    } catch (err) {
      setError(err.message || 'Agent processing failed');
      toast.error(err.message || 'Agent processing failed');
    } finally {
      setProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="btn-secondary flex items-center space-x-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <span>Smart Upload</span>
      </button>

      {isOpen && (
        <div className="modal-overlay z-[200]">
          <div className="modal-content max-w-lg">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">Smart PDF Upload</h2>
                <p className="text-sm text-neutral-500 mt-1">
                  AI agent identifies the member, classifies the file, and extracts vitals from lab reports.
                </p>
              </div>
              {!processing && (
                <button onClick={closeModal} className="text-neutral-400 hover:text-neutral-600 p-1">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {!processing && !result && (
              <label className="block cursor-pointer">
                <div className="glass-panel border-2 border-dashed border-primary-300/50 p-8 text-center hover:border-primary-400/70 transition-colors">
                  <svg className="w-12 h-12 mx-auto text-primary-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="font-medium text-neutral-800">Tap to upload a PDF</p>
                  <p className="text-sm text-neutral-500 mt-1">Lab reports, prescriptions, or documents</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </label>
            )}

            {(processing || result || error) && (
              <div className="space-y-3 mt-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Agent Progress</p>
                {steps.map((step) => (
                  <div
                    key={step.id}
                    className={`flex items-start gap-3 p-3 rounded-xl transition-all ${
                      step.status === 'running' ? 'liquid-glass-subtle ring-1 ring-primary-300/50' : 'liquid-glass-subtle'
                    }`}
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      <StatusIcon status={step.status} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${
                        step.status === 'error' ? 'text-red-600' :
                        step.status === 'done' ? 'text-neutral-900' :
                        step.status === 'running' ? 'text-primary-700' :
                        'text-neutral-600'
                      }`}>
                        {step.title}
                      </p>
                      <p className="text-xs text-neutral-500 mt-0.5">{step.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {result && (
              <div className="mt-4 p-4 rounded-xl liquid-glass-subtle border border-green-200/50">
                <p className="text-sm font-semibold text-green-800 mb-2">Upload Complete</p>
                <ul className="text-sm text-neutral-700 space-y-1">
                  <li><span className="text-neutral-500">Member:</span> {result.member.name}</li>
                  <li><span className="text-neutral-500">Type:</span> {result.savedRecord?.type === 'report' ? 'Medical Report' : 'Document'}</li>
                  <li><span className="text-neutral-500">Date:</span> {result.reportDate}</li>
                  {result.vitalsSaved?.length > 0 && (
                    <li><span className="text-neutral-500">Vitals added:</span> {result.vitalsSaved.length}</li>
                  )}
                </ul>
                <button onClick={closeModal} className="btn-primary w-full mt-4">
                  Done
                </button>
              </div>
            )}

            {error && !processing && !result && (
              <div className="mt-4 flex gap-3">
                <button onClick={closeModal} className="btn-secondary flex-1">Close</button>
                <button
                  onClick={() => { resetState(); fileInputRef.current?.click(); }}
                  className="btn-primary flex-1"
                >
                  Try Again
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default PdfAgentUpload;
